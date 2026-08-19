using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Media;
using System.Windows.Threading;

namespace VtcDesktopClient;

public sealed class MainViewModel : INotifyPropertyChanged, IDisposable
{
    private readonly TelemetryManager _telemetry;
    private readonly ApiClient? _api;
    private readonly Dispatcher _dispatcher;
    private readonly TelemetryPluginInstaller _pluginInstaller = new();
    private readonly ClientAutoUpdater _autoUpdater;
    private readonly SemaphoreSlim _liveTelemetryGate = new(1, 1);
    private readonly CancellationTokenSource _lifetime = new();
    private ClientUpdateCheckResult? _update;
    private DateTime? _jobStartedAt;
    private DateTime _lastLiveTelemetrySentAtUtc = DateTime.MinValue;
    private bool _disposed;

    private string _gameStatus = "GAME DISCONNECTED";
    private string _gameStatusDetails = "Waiting for ETS2 / ATS";
    private string _apiStatus = "SERVER READY";
    private string _apiStatusDetails = "No backend contact yet";
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

    public event PropertyChangedEventHandler? PropertyChanged;

    public MainViewModel(TelemetryManager telemetry, ApiClient? api, Dispatcher dispatcher, string? updateManifestUrl = null)
    {
        _telemetry = telemetry;
        _api = api;
        _dispatcher = dispatcher;
        _autoUpdater = new ClientAutoUpdater(updateManifestUrl ?? "http://localhost:3001/client/updates/latest.json");
        _userAvatar = string.IsNullOrWhiteSpace(_userName) ? "U" : _userName[..1].ToUpperInvariant();
        _telemetry.JobStarted += OnJobStarted;
        _telemetry.JobDelivered += OnJobDelivered;
        _telemetry.JobCancelled += OnJobCancelled;
        _telemetry.TelemetryUpdated += OnTelemetryUpdated;
        _telemetry.ConnectionChanged += OnConnectionChanged;
        SetInitialPluginState();
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
    public string CurrentVersion => System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.0.0";
    public string CurrentSourceCity => SourceCity;
    public string CurrentDestinationCity => DestinationCity;
    public bool IsPluginActionEnabled => !_isPluginInstalling;
    public bool IsUpdateActionEnabled => !_isUpdateChecking;
    public bool IsUpdatePending => _isUpdatePending;
    public string UpdateActionLabel => _isUpdatePending ? "INSTALL UPDATE" : "CHECK UPDATE";

    public async Task InitializeAsync()
    {
        await CheckForPluginStateAsync().ConfigureAwait(false);
        await CheckForUpdateAsync().ConfigureAwait(false);
    }

    public Task CheckForPluginStateAsync() => Task.Run(() =>
    {
        var state = _pluginInstaller.GetCurrentState();
        Ui(() => PluginStatus = state.StatusMessage);
    });

    public async Task InstallTelemetryPluginAsync()
    {
        if (_isPluginInstalling) return;
        _isPluginInstalling = true;
        Notify(nameof(IsPluginActionEnabled));
        Ui(() => PluginStatus = "Installing telemetry plugin...");
        var result = await _pluginInstaller.InstallAsync().ConfigureAwait(false);
        _isPluginInstalling = false;
        Ui(() =>
        {
            PluginStatus = result.StatusMessage;
            Notify(nameof(IsPluginActionEnabled));
        });
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

    private void OnConnectionChanged(object? sender, bool connected) => Ui(() =>
    {
        GameStatus = connected ? "GAME CONNECTED" : "GAME DISCONNECTED";
        GameStatusDetails = connected ? "SCS telemetry stream active" : "Waiting for ETS2 / ATS";
        GameStatusDotBrush = Brush(connected ? "#4ADE80" : "#D8A928");
    });

    private void OnJobStarted(object? sender, TelemetryPayload payload)
    {
        _jobStartedAt = DateTime.UtcNow;
        Apply(payload);
        Ui(() => GameStatusDetails = "Job in progress");
    }

    private void OnTelemetryUpdated(object? sender, TelemetryPayload payload)
    {
        Apply(payload);
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
    });

    private async Task SendTripAsync(TelemetryPayload payload)
    {
        if (_api is null || string.IsNullOrWhiteSpace(_api.JwtToken))
        {
            Ui(() => { ApiStatus = "SERVER AUTH REQUIRED"; ApiStatusDetails = "Sign in before trip upload"; });
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
            }).ConfigureAwait(false);
            Ui(() => { ApiStatus = "SERVER ONLINE"; ApiStatusDetails = "Trip synchronized"; ServerStatusDotBrush = Brush("#4ADE80"); });
        }
        catch (Exception ex)
        {
            Ui(() => { ApiStatus = "SERVER OFFLINE"; ApiStatusDetails = ex.Message; ServerStatusDotBrush = Brush("#EF4444"); });
        }
    }

    private async Task SendLiveTelemetryAsync(TelemetryPayload payload)
    {
        if (_api is null || string.IsNullOrWhiteSpace(_api.JwtToken)) return;
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
        }
        catch (OperationCanceledException) when (_lifetime.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            Ui(() =>
            {
                ApiStatus = "SERVER TELEMETRY ERROR";
                ApiStatusDetails = ex.Message;
                ServerStatusDotBrush = Brush("#EF4444");
            });
        }
        finally
        {
            if (enteredGate) _liveTelemetryGate.Release();
        }
    }

    private void SetInitialPluginState() => PluginStatus = _pluginInstaller.GetCurrentState().StatusMessage;
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
    }
}
