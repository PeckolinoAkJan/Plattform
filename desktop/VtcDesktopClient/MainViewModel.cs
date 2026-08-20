using System.ComponentModel;
using System.Collections.ObjectModel;
using System.Runtime.CompilerServices;
using System.Windows.Media;
using System.Windows.Threading;

namespace VtcDesktopClient;

public sealed class MainViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly TelemetryManager _telemetry;
    private readonly ApiClient? _api;
    private readonly Dispatcher _dispatcher;
    private readonly TelemetryPluginInstaller _pluginInstaller;
    private readonly ClientAutoUpdater _autoUpdater;
    private readonly SemaphoreSlim _liveTelemetryGate = new(1, 1);
    private readonly SemaphoreSlim _chatGate = new(1, 1);
    private readonly CancellationTokenSource _lifetime = new();
    private ClientUpdateCheckResult? _update;
    private Task? _heartbeat;
    private DateTime? _jobStartedAt;
    private DateTime _lastLiveTelemetrySentAtUtc = DateTime.MinValue;
    private DateTime _lastTelemetryAtUtc = DateTime.MinValue;
    private DateTime _lastSyncAtUtc = DateTime.MinValue;
    private bool _disposed;
    private bool _isPluginInstalled;
    private bool _networkConnected;
    private bool _syncReady;
    private bool _gpsLive;
    private string _chatStatus = "Speditionschat wird geladen";

    private string _gameStatus = "GAME DISCONNECTED";
    private string _gameStatusDetails = "Waiting for ETS2 / ATS";
    private string _apiStatus = "SERVER CHECKING";
    private string _apiStatusDetails = "Backend health check pending";
    private string _pluginStatus = "Plugin is being checked";
    private string _updateStatus = "Update not checked";
    private bool _isPluginInstalling;
    private bool _isUpdateChecking;
    private bool _isUpdatePending;
    private string _currentCargo = "NO ACTIVE JOB";
    private string _sourceCity = "--";
    private string _destinationCity = "--";
    private string _currentTruck = "NO TRUCK CONNECTED";
    private int _currentSpeed;
    private int _averageSpeed;
    private double _distanceKm;
    private double _fuelPercent;
    private double _engineTemperature;
    private double _brakeAirPressure;
    private double _odometerKm;
    private double _fuelEfficiency;
    private double _damagePercent;
    private string _driveTime = "00:00";
    private string _userName = Environment.UserName;
    private string _userStatus = "OFF DUTY";
    private string _userAvatar = "U";
    private Brush _gameStatusDotBrush = Brush("#D8A928");
    private Brush _serverStatusDotBrush = Brush("#D8A928");
    private Brush _pluginStatusDotBrush = Brush("#D8A928");
    private Brush _gpsStatusDotBrush = Brush("#E5E7EB");
    private Brush _networkStatusDotBrush = Brush("#E5E7EB");
    private Brush _syncStatusDotBrush = Brush("#E5E7EB");
    private string _gpsStatusText = "WAITING";
    private string _networkStatusText = "CHECKING";
    private string _syncStatusText = "NOT READY";
    private string _gpsStatusDetails = "No live SCS position yet";
    private string _networkStatusDetails = "Backend check pending";
    private string _syncStatusDetails = "Sign-in and backend connection required";
    private string _selectedSectionTitle = "DASHBOARD";
    private string _selectedSectionDescription = "Live-Fahrdaten, Auftrag und Systemzustand im Überblick.";
    private string _sectionMetric1Label = "TELEMETRY";
    private string _sectionMetric1Value = "WAITING";
    private string _sectionMetric2Label = "NETWORK";
    private string _sectionMetric2Value = "CHECKING";
    private string _sectionMetric3Label = "SYNC";
    private string _sectionMetric3Value = "NOT READY";

    public event PropertyChangedEventHandler? PropertyChanged;

    public MainViewModel(TelemetryManager telemetry, ApiClient? api, Dispatcher dispatcher, string? updateManifestUrl = null, string? pluginDownloadUrl = null)
    {
        _telemetry = telemetry;
        _api = api;
        _dispatcher = dispatcher;
        _pluginInstaller = new TelemetryPluginInstaller(pluginDownloadUrl);
        _autoUpdater = new ClientAutoUpdater(updateManifestUrl ?? "http://localhost:3001/client/updates/latest.json");
        _userAvatar = string.IsNullOrWhiteSpace(_userName) ? "U" : _userName[..1].ToUpperInvariant();
        _telemetry.JobStarted += OnJobStarted;
        _telemetry.JobDelivered += OnJobDelivered;
        _telemetry.JobCancelled += OnJobCancelled;
        _telemetry.TelemetryUpdated += OnTelemetryUpdated;
        _telemetry.ConnectionChanged += OnConnectionChanged;
        SetInitialPluginState();
        RefreshSectionSummary();
    }

    public string GameStatus { get => _gameStatus; private set => Set(ref _gameStatus, value); }
    public string GameStatusDetails { get => _gameStatusDetails; private set => Set(ref _gameStatusDetails, value); }
    public string ApiStatus { get => _apiStatus; private set => Set(ref _apiStatus, value); }
    public string ApiStatusDetails { get => _apiStatusDetails; private set => Set(ref _apiStatusDetails, value); }
    public string PluginStatus { get => _pluginStatus; private set => Set(ref _pluginStatus, value); }
    public string UpdateStatus { get => _updateStatus; private set => Set(ref _updateStatus, value); }
    public string CurrentCargo { get => _currentCargo; private set => Set(ref _currentCargo, value); }
    public string SourceCity { get => _sourceCity; private set => Set(ref _sourceCity, value); }
    public string DestinationCity { get => _destinationCity; private set => Set(ref _destinationCity, value); }
    public string CurrentTruck { get => _currentTruck; private set => Set(ref _currentTruck, value); }
    public int CurrentSpeed { get => _currentSpeed; private set => Set(ref _currentSpeed, value); }
    public int AverageSpeed { get => _averageSpeed; private set => Set(ref _averageSpeed, value); }
    public double DistanceKm { get => _distanceKm; private set => Set(ref _distanceKm, value); }
    public double FuelPercent { get => _fuelPercent; private set => Set(ref _fuelPercent, value); }
    public double EngineTemperature { get => _engineTemperature; private set => Set(ref _engineTemperature, value); }
    public double BrakeAirPressure { get => _brakeAirPressure; private set => Set(ref _brakeAirPressure, value); }
    public double OdometerKm { get => _odometerKm; private set => Set(ref _odometerKm, value); }
    public double FuelEfficiency { get => _fuelEfficiency; private set => Set(ref _fuelEfficiency, value); }
    public double DamagePercent { get => _damagePercent; private set => Set(ref _damagePercent, value); }
    public string DriveTime { get => _driveTime; private set => Set(ref _driveTime, value); }
    public string UserName { get => _userName; private set => Set(ref _userName, value); }
    public string UserStatus { get => _userStatus; private set => Set(ref _userStatus, value); }
    public string UserAvatar { get => _userAvatar; private set => Set(ref _userAvatar, value); }
    public Brush GameStatusDotBrush { get => _gameStatusDotBrush; private set => Set(ref _gameStatusDotBrush, value); }
    public Brush ServerStatusDotBrush { get => _serverStatusDotBrush; private set => Set(ref _serverStatusDotBrush, value); }
    public Brush PluginStatusDotBrush { get => _pluginStatusDotBrush; private set => Set(ref _pluginStatusDotBrush, value); }
    public Brush GpsStatusDotBrush { get => _gpsStatusDotBrush; private set => Set(ref _gpsStatusDotBrush, value); }
    public Brush NetworkStatusDotBrush { get => _networkStatusDotBrush; private set => Set(ref _networkStatusDotBrush, value); }
    public Brush SyncStatusDotBrush { get => _syncStatusDotBrush; private set => Set(ref _syncStatusDotBrush, value); }
    public string GpsStatusText { get => _gpsStatusText; private set => Set(ref _gpsStatusText, value); }
    public string NetworkStatusText { get => _networkStatusText; private set => Set(ref _networkStatusText, value); }
    public string SyncStatusText { get => _syncStatusText; private set => Set(ref _syncStatusText, value); }
    public string GpsStatusDetails { get => _gpsStatusDetails; private set => Set(ref _gpsStatusDetails, value); }
    public string NetworkStatusDetails { get => _networkStatusDetails; private set => Set(ref _networkStatusDetails, value); }
    public string SyncStatusDetails { get => _syncStatusDetails; private set => Set(ref _syncStatusDetails, value); }
    public string SelectedSectionTitle { get => _selectedSectionTitle; private set => Set(ref _selectedSectionTitle, value); }
    public string SelectedSectionDescription { get => _selectedSectionDescription; private set => Set(ref _selectedSectionDescription, value); }
    public string SectionMetric1Label { get => _sectionMetric1Label; private set => Set(ref _sectionMetric1Label, value); }
    public string SectionMetric1Value { get => _sectionMetric1Value; private set => Set(ref _sectionMetric1Value, value); }
    public string SectionMetric2Label { get => _sectionMetric2Label; private set => Set(ref _sectionMetric2Label, value); }
    public string SectionMetric2Value { get => _sectionMetric2Value; private set => Set(ref _sectionMetric2Value, value); }
    public string SectionMetric3Label { get => _sectionMetric3Label; private set => Set(ref _sectionMetric3Label, value); }
    public string SectionMetric3Value { get => _sectionMetric3Value; private set => Set(ref _sectionMetric3Value, value); }
    public string CurrentVersion => System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.0.0";
    public string CurrentSourceCity => SourceCity;
    public string CurrentDestinationCity => DestinationCity;
    public bool IsPluginActionEnabled => !_isPluginInstalling;
    public bool IsUpdateActionEnabled => !_isUpdateChecking;
    public bool IsUpdatePending => _isUpdatePending;
    public string UpdateActionLabel => _isUpdatePending ? "INSTALL UPDATE" : "CHECK UPDATE";
    public bool IsPluginInstalled => _isPluginInstalled;
    public bool NetworkConnected => _networkConnected;
    public bool SyncReady => _syncReady;
    public bool GpsLive => _gpsLive;
    public ObservableCollection<ChatMessageItem> ChatMessages { get; } = [];
    public string ChatStatus { get => _chatStatus; private set => Set(ref _chatStatus, value); }

    public void SetAuthenticatedUser(string? displayName) => Ui(() =>
    {
        UserName = Text(displayName, Environment.UserName);
        UserAvatar = UserName[..1].ToUpperInvariant();
        UserStatus = "SIGNED IN";
        SetSyncState(_networkConnected && _api is not null && !string.IsNullOrWhiteSpace(_api.JwtToken), "Secure channel ready");
    });

    public void SetSignedOut() => Ui(() =>
    {
        UserStatus = "SIGNED OUT";
        SetSyncState(false, "Sign-in required for synchronization");
        RefreshSectionSummary();
    });

    public async Task InitializeAsync()
    {
        await CheckForPluginStateAsync().ConfigureAwait(false);
        await RefreshConnectivityAsync().ConfigureAwait(false);
        await CheckForUpdateAsync().ConfigureAwait(false);
        _heartbeat ??= Task.Run(HeartbeatAsync);
    }

    public Task CheckForPluginStateAsync() => Task.Run(() =>
    {
        var state = _pluginInstaller.GetCurrentState();
        Ui(() => ApplyPluginState(state));
    });

    public async Task InstallTelemetryPluginAsync()
    {
        if (_isPluginInstalling) return;
        _isPluginInstalling = true;
        Notify(nameof(IsPluginActionEnabled));
        Ui(() => PluginStatus = "Installing telemetry plugin...");
        var result = await _pluginInstaller.InstallAsync(_lifetime.Token).ConfigureAwait(false);
        _isPluginInstalling = false;
        var state = _pluginInstaller.GetCurrentState();
        Ui(() =>
        {
            PluginStatus = result.StatusMessage;
            _isPluginInstalled = result.Success && state.IsInstalled;
            PluginStatusDotBrush = Brush(_isPluginInstalled ? "#4ADE80" : "#EF4444");
            Notify(nameof(IsPluginInstalled));
            Notify(nameof(IsPluginActionEnabled));
            RefreshSectionSummary();
        });
    }

    public async Task RefreshConnectivityAsync()
    {
        var healthy = _api is not null && await _api.CheckHealthAsync(_lifetime.Token).ConfigureAwait(false);
        Ui(() => SetNetworkState(healthy));
    }

    public async Task RefreshChatAsync()
    {
        if (_api is null || string.IsNullOrWhiteSpace(_api.JwtToken))
        {
            Ui(() => ChatStatus = "Bitte zuerst anmelden.");
            return;
        }

        if (!await _chatGate.WaitAsync(0, _lifetime.Token).ConfigureAwait(false)) return;
        try
        {
            var messages = await _api.GetChatMessagesAsync(100, _lifetime.Token).ConfigureAwait(false);
            Ui(() =>
            {
                ChatMessages.Clear();
                foreach (var message in messages) ChatMessages.Add(message);
                ChatStatus = messages.Count == 0 ? "Noch keine Nachrichten in dieser Spedition." : $"{messages.Count} Nachricht(en) geladen";
            });
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            Ui(() => ChatStatus = $"Chat konnte nicht geladen werden: {ex.Message}");
        }
        finally
        {
            _chatGate.Release();
        }
    }

    public async Task<bool> SendChatMessageAsync(string body)
    {
        var message = body.Trim();
        if (string.IsNullOrWhiteSpace(message)) return false;
        if (_api is null || string.IsNullOrWhiteSpace(_api.JwtToken))
        {
            Ui(() => ChatStatus = "Bitte zuerst anmelden.");
            return false;
        }

        try
        {
            await _api.SendChatMessageAsync(message, _lifetime.Token).ConfigureAwait(false);
            await RefreshChatAsync().ConfigureAwait(false);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            Ui(() => ChatStatus = $"Nachricht konnte nicht gesendet werden: {ex.Message}");
            return false;
        }
    }

    public async Task CheckForUpdateAsync(bool forceCheck = false)
    {
        if (_isUpdateChecking) return;
        _isUpdateChecking = true;
        Notify(nameof(IsUpdateActionEnabled));
        Ui(() => UpdateStatus = "Checking update...");
        _update = await _autoUpdater.CheckForUpdateAsync().ConfigureAwait(false);
        _isUpdateChecking = false;
        _isUpdatePending = _update.Success && _update.IsUpdateAvailable;
        Ui(() =>
        {
            UpdateStatus = !_update.Success ? _update.ErrorMessage ?? "Update check failed"
                : _update.IsUpdateAvailable ? $"Version {_update.LatestVersion} available"
                : $"Current ({_update.CurrentVersion})";
            Notify(nameof(IsUpdateActionEnabled));
            Notify(nameof(IsUpdatePending));
            Notify(nameof(UpdateActionLabel));
            RefreshSectionSummary();
        });
        if (forceCheck && _update.IsMandatory && _update.IsUpdateAvailable) await ApplyAvailableUpdateAsync().ConfigureAwait(false);
    }

    public async Task ApplyAvailableUpdateAsync()
    {
        if (_update?.InstallerUrl is not { Length: > 0 } url) return;
        Ui(() => UpdateStatus = "Installing update...");
        var applied = await _autoUpdater.ApplyUpdateAsync(url, _update.Sha256).ConfigureAwait(false);
        Ui(() => UpdateStatus = applied ? "Updater started" : "Update verification failed");
        if (applied) Environment.Exit(0);
    }

    public void SelectSection(string section)
    {
        SelectedSectionTitle = string.IsNullOrWhiteSpace(section) ? "DASHBOARD" : section.Trim().ToUpperInvariant();
        SelectedSectionDescription = SelectedSectionTitle switch
        {
            "JOBS" => "Aktueller SCS-Auftrag und Tourdaten in Echtzeit.",
            "VEHICLES" => "Fahrzeugzustand, Verbrauch und technische Telemetrie.",
            "DRIVERS" => "Angemeldeter Fahrer und Verbindungszustand.",
            "REPORTS" => "Live-Auswertung der aktuellen Fahrt und Synchronisierung.",
            "ALERTS" => "Plugin-, Netzwerk-, Update- und Telemetriehinweise.",
            "MESSAGES" => "Speditionschat mit den angemeldeten Fahrerinnen und Fahrern.",
            "SETTINGS" => "Clientversion, Serverziel, Plugin und Updateverwaltung.",
            _ => "Live-Fahrdaten, Auftrag und Systemzustand im Überblick.",
        };
        RefreshSectionSummary();
    }

    private async Task HeartbeatAsync()
    {
        while (!_lifetime.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(15), _lifetime.Token).ConfigureAwait(false);
                await RefreshConnectivityAsync().ConfigureAwait(false);
                if (string.Equals(SelectedSectionTitle, "MESSAGES", StringComparison.OrdinalIgnoreCase))
                    await RefreshChatAsync().ConfigureAwait(false);
                if (_lastTelemetryAtUtc != DateTime.MinValue && DateTime.UtcNow - _lastTelemetryAtUtc > TimeSpan.FromSeconds(8))
                    Ui(() => SetGpsState(false, "Telemetry stream timed out"));
            }
            catch (OperationCanceledException) when (_lifetime.IsCancellationRequested) { break; }
        }
    }

    private void OnConnectionChanged(object? sender, bool connected) => Ui(() =>
    {
        GameStatus = connected ? "GAME CONNECTED" : "GAME DISCONNECTED";
        GameStatusDetails = connected ? "SCS telemetry stream active" : "Waiting for ETS2 / ATS";
        GameStatusDotBrush = Brush(connected ? "#4ADE80" : "#D8A928");
        if (!connected) SetGpsState(false, "Waiting for ETS2 / ATS telemetry");
    });

    private void OnJobStarted(object? sender, TelemetryPayload payload)
    {
        _jobStartedAt = DateTime.UtcNow;
        Apply(payload);
        Ui(() => GameStatusDetails = "Job in progress");
    }

    private void OnTelemetryUpdated(object? sender, TelemetryPayload payload)
    {
        _lastTelemetryAtUtc = DateTime.UtcNow;
        Apply(payload);
        Ui(() => SetGpsState(payload.Latitude.HasValue && payload.Longitude.HasValue,
            payload.Latitude.HasValue ? payload.CoordinateAccuracy ?? "SCS position active" : "SCS position could not be projected"));
        _ = SendLiveTelemetryAsync(payload);
    }

    private void OnJobCancelled(object? sender, TelemetryPayload payload)
    {
        Apply(payload);
        _jobStartedAt = null;
        Ui(() => GameStatusDetails = "Job cancelled");
    }

    private void OnJobDelivered(object? sender, TelemetryPayload payload)
    {
        Apply(payload);
        _jobStartedAt = null;
        _ = SendTripAsync(payload);
    }

    private void Apply(TelemetryPayload payload) => Ui(() =>
    {
        CurrentCargo = Text(payload.Cargo, "NO ACTIVE JOB");
        SourceCity = Text(payload.SourceCity, "--");
        DestinationCity = Text(payload.DestinationCity, "--");
        CurrentTruck = Text(payload.TruckModel ?? payload.Truck, "NO TRUCK CONNECTED");
        CurrentSpeed = Math.Max(payload.SpeedKmh, 0);
        AverageSpeed = AverageSpeed == 0 ? CurrentSpeed : (int)Math.Round(AverageSpeed * .85 + CurrentSpeed * .15);
        DistanceKm = payload.DistanceKm;
        FuelPercent = payload.FuelPercent;
        EngineTemperature = payload.EngineTemperatureC;
        BrakeAirPressure = payload.BrakeAirPressure;
        OdometerKm = payload.OdometerKm;
        FuelEfficiency = payload.AverageFuelConsumption;
        DamagePercent = payload.DamagePct;
        UserName = Text(payload.DriverName, Environment.UserName);
        UserAvatar = UserName[..1].ToUpperInvariant();
        UserStatus = Text(payload.UserStatus, "READY");
        DriveTime = _jobStartedAt is null ? "00:00" : (DateTime.UtcNow - _jobStartedAt.Value).ToString(@"hh\:mm");
        RefreshSectionSummary();
    });

    private async Task SendTripAsync(TelemetryPayload payload)
    {
        if (_api is null || string.IsNullOrWhiteSpace(_api.JwtToken))
        {
            Ui(() => { ApiStatus = "SERVER AUTH REQUIRED"; ApiStatusDetails = "Sign in before trip upload"; SetSyncState(false, "Sign-in required"); });
            return;
        }
        try
        {
            Ui(() => { ApiStatus = "SERVER SENDING"; ApiStatusDetails = "Uploading delivered job"; });
            await _api.SendTripDataAsync(new TripData
            {
                Game = payload.Game,
                Cargo = payload.Cargo,
                SourceCity = payload.SourceCity,
                DestinationCity = payload.DestinationCity,
                Truck = payload.Truck,
                TruckModel = payload.TruckModel,
                DistanceKm = payload.DistanceKm,
                DamagePct = payload.DamagePct,
                SpeedKmh = payload.SpeedKmh,
                MaxSpeedKmh = payload.SpeedKmh,
                DeliveredAtUtc = DateTime.UtcNow,
                TimestampUtc = DateTimeOffset.UtcNow,
            }, _lifetime.Token).ConfigureAwait(false);
            Ui(() => { SetNetworkState(true); SetSyncState(true, "Trip synchronized"); ApiStatusDetails = "Trip synchronized"; });
        }
        catch (Exception ex)
        {
            Ui(() => { ApiStatus = "SERVER OFFLINE"; ApiStatusDetails = ex.Message; SetNetworkState(false); SetSyncState(false, ex.Message); });
        }
    }

    private async Task SendLiveTelemetryAsync(TelemetryPayload payload)
    {
        if (_api is null || string.IsNullOrWhiteSpace(_api.JwtToken))
        {
            Ui(() => SetSyncState(false, "Sign-in required for live synchronization"));
            return;
        }
        if (payload.Latitude is not { } latitude || payload.Longitude is not { } longitude) return;
        if (Math.Abs(latitude) > 90d || Math.Abs(longitude) > 180d) return;
        var now = DateTime.UtcNow;
        if (now - _lastLiveTelemetrySentAtUtc < TimeSpan.FromSeconds(3)) return;

        var enteredGate = false;
        try
        {
            if (!await _liveTelemetryGate.WaitAsync(0, _lifetime.Token).ConfigureAwait(false)) return;
            enteredGate = true;
            now = DateTime.UtcNow;
            if (now - _lastLiveTelemetrySentAtUtc < TimeSpan.FromSeconds(3)) return;
            _lastLiveTelemetrySentAtUtc = now;
            await _api.SendLiveLocationAsync(new LocationData
            {
                Latitude = latitude,
                Longitude = longitude,
                SpeedKmh = Math.Max(payload.SpeedKmh, 0),
                Heading = payload.Heading ?? 0,
                TruckModel = payload.TruckModel ?? payload.Truck,
                CargoName = payload.Cargo,
                SourceCity = payload.SourceCity,
                DestinationCity = payload.DestinationCity,
                TimestampUtc = payload.TimestampUtc,
            }, _lifetime.Token).ConfigureAwait(false);
            _lastSyncAtUtc = DateTime.UtcNow;
            Ui(() =>
            {
                SetNetworkState(true);
                SetSyncState(true, $"Live map synchronized at {_lastSyncAtUtc:HH:mm:ss}");
                ApiStatusDetails = "Live telemetry synchronized";
            });
        }
        catch (OperationCanceledException) when (_lifetime.IsCancellationRequested) { }
        catch (Exception ex)
        {
            Ui(() =>
            {
                ApiStatus = "SERVER TELEMETRY ERROR";
                ApiStatusDetails = ex.Message;
                ServerStatusDotBrush = Brush("#EF4444");
                SetSyncState(false, ex.Message);
            });
        }
        finally { if (enteredGate) _liveTelemetryGate.Release(); }
    }

    private void ApplyPluginState(PluginInstallationState state)
    {
        PluginStatus = state.StatusMessage;
        _isPluginInstalled = state.IsInstalled;
        PluginStatusDotBrush = Brush(state.IsInstalled ? "#4ADE80" : "#D8A928");
        Notify(nameof(IsPluginInstalled));
        RefreshSectionSummary();
    }

    private void SetInitialPluginState() => ApplyPluginState(_pluginInstaller.GetCurrentState());

    private void SetNetworkState(bool connected)
    {
        _networkConnected = connected;
        NetworkStatusText = connected ? "CONNECTED" : "OFFLINE";
        NetworkStatusDetails = connected ? "API, database and Redis reachable" : "Backend health check failed";
        NetworkStatusDotBrush = Brush(connected ? "#4ADE80" : "#EF4444");
        ServerStatusDotBrush = NetworkStatusDotBrush;
        ApiStatus = connected ? "SERVER ONLINE" : "SERVER OFFLINE";
        if (!connected) ApiStatusDetails = NetworkStatusDetails;
        Notify(nameof(NetworkConnected));
        SetSyncState(connected && _api is not null && !string.IsNullOrWhiteSpace(_api.JwtToken),
            connected ? "Secure synchronization channel ready" : "Network connection required");
        RefreshSectionSummary();
    }

    private void SetSyncState(bool ready, string details)
    {
        _syncReady = ready;
        SyncStatusText = ready ? (_lastSyncAtUtc == DateTime.MinValue ? "SYNC READY" : "SYNCED") : "NOT READY";
        SyncStatusDetails = details;
        SyncStatusDotBrush = Brush(ready ? "#4ADE80" : "#E5E7EB");
        Notify(nameof(SyncReady));
        RefreshSectionSummary();
    }

    private void SetGpsState(bool live, string details)
    {
        _gpsLive = live;
        GpsStatusText = live ? "SCS LIVE" : "WAITING";
        GpsStatusDetails = details;
        GpsStatusDotBrush = Brush(live ? "#4ADE80" : "#E5E7EB");
        Notify(nameof(GpsLive));
        RefreshSectionSummary();
    }

    private void RefreshSectionSummary()
    {
        switch (SelectedSectionTitle)
        {
            case "JOBS": SetSectionMetrics("CARGO", CurrentCargo, "ROUTE", $"{SourceCity} → {DestinationCity}", "DISTANCE", $"{DistanceKm:F0} km"); break;
            case "VEHICLES": SetSectionMetrics("TRUCK", CurrentTruck, "FUEL", $"{FuelPercent:F0}%", "DAMAGE", $"{DamagePercent:F1}%"); break;
            case "DRIVERS": SetSectionMetrics("DRIVER", UserName, "STATUS", UserStatus, "TELEMETRY", GpsStatusText); break;
            case "REPORTS": SetSectionMetrics("AVG SPEED", $"{AverageSpeed} km/h", "DRIVE TIME", DriveTime, "EFFICIENCY", $"{FuelEfficiency:F1} L/100 km"); break;
            case "ALERTS": SetSectionMetrics("PLUGIN", _isPluginInstalled ? "READY" : "ACTION REQUIRED", "UPDATE", UpdateStatus, "SERVER", NetworkStatusText); break;
            case "MESSAGES": SetSectionMetrics("TELEMETRY", PluginStatus, "NETWORK", NetworkStatusDetails, "SYNC", SyncStatusDetails); break;
            case "SETTINGS": SetSectionMetrics("VERSION", CurrentVersion, "API", _api?.BaseUrl ?? "not configured", "PLUGIN", _isPluginInstalled ? "INSTALLED" : "MISSING"); break;
            default: SetSectionMetrics("TELEMETRY", GpsStatusText, "NETWORK", NetworkStatusText, "SYNC", SyncStatusText); break;
        }
    }

    private void SetSectionMetrics(string label1, string value1, string label2, string value2, string label3, string value3)
    {
        SectionMetric1Label = label1; SectionMetric1Value = value1;
        SectionMetric2Label = label2; SectionMetric2Value = value2;
        SectionMetric3Label = label3; SectionMetric3Value = value3;
    }

    private void Ui(Action action) { if (_dispatcher.CheckAccess()) action(); else _dispatcher.BeginInvoke(action); }
    private static string Text(string? value, string fallback) => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    private static SolidColorBrush Brush(string color) { var brush = new SolidColorBrush((Color)ColorConverter.ConvertFromString(color)!); brush.Freeze(); return brush; }
    private void Set<T>(ref T field, T value, [CallerMemberName] string? name = null) { if (EqualityComparer<T>.Default.Equals(field, value)) return; field = value; Notify(name); }
    private void Notify(string? name) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _lifetime.Cancel();
        _telemetry.JobStarted -= OnJobStarted;
        _telemetry.JobDelivered -= OnJobDelivered;
        _telemetry.JobCancelled -= OnJobCancelled;
        _telemetry.TelemetryUpdated -= OnTelemetryUpdated;
        _telemetry.ConnectionChanged -= OnConnectionChanged;
        _telemetry.Dispose();
        _lifetime.Dispose();
    }
}
