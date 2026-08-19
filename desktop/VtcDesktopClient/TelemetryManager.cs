using System.Diagnostics;
using SCSSdkClient;
using SCSSdkClient.Object;

namespace VtcDesktopClient;

public sealed class TelemetryManager : IDisposable
{
    public event EventHandler<TelemetryPayload>? JobStarted;
    public event EventHandler<TelemetryPayload>? JobDelivered;
    public event EventHandler<TelemetryPayload>? JobCancelled;
    public event EventHandler<TelemetryPayload>? TelemetryUpdated;
    public event EventHandler<bool>? ConnectionChanged;

    private static readonly string[] GameProcesses = ["eurotrucks2", "amtrucks"];
    private readonly CancellationTokenSource _cancellation = new();
    private readonly object _sync = new();
    private Task? _monitor;
    private SCSSdkTelemetry? _sdk;
    private SCSTelemetry? _lastData;
    private TelemetryPayload? _lastPayload;
    private Guid _activeJobId;
    private bool _connected;
    private bool _disposed;

    public bool IsConnected => _connected;

    public TelemetryManager() => _monitor = Task.Run(MonitorAsync);

    private async Task MonitorAsync()
    {
        while (!_cancellation.IsCancellationRequested)
        {
            try
            {
                var running = GameProcesses.Any(name => Process.GetProcessesByName(name).Length > 0);
                if (running && _sdk is null) Attach();
                if (!running && _sdk is not null) Detach();
            }
            catch { Detach(); }

            try { await Task.Delay(TimeSpan.FromSeconds(1), _cancellation.Token).ConfigureAwait(false); }
            catch (OperationCanceledException) { break; }
        }
    }

    private void Attach()
    {
        lock (_sync)
        {
            if (_sdk is not null) return;
            var sdk = new SCSSdkTelemetry("Local\\SCSTelemetry", 1000);
            sdk.Data += OnTelemetryData;
            sdk.JobStarted += OnJobStarted;
            sdk.JobDelivered += OnJobDelivered;
            sdk.JobCancelled += OnJobCancelled;
            _sdk = sdk;
            SetConnected(true);
        }
    }

    private void Detach()
    {
        lock (_sync)
        {
            if (_sdk is not null)
            {
                _sdk.Data -= OnTelemetryData;
                _sdk.JobStarted -= OnJobStarted;
                _sdk.JobDelivered -= OnJobDelivered;
                _sdk.JobCancelled -= OnJobCancelled;
                _sdk.Dispose();
                _sdk = null;
            }
            _lastData = null;
            _lastPayload = null;
            SetConnected(false);
        }
    }

    private void OnTelemetryData(SCSTelemetry data, bool newTimestamp)
    {
        if (!newTimestamp || data is null || !data.SdkActive) return;
        _lastData = data;
        _lastPayload = Map(data);
        TelemetryUpdated?.Invoke(this, _lastPayload);
    }

    private void OnJobStarted(object? sender, EventArgs e)
    {
        _activeJobId = Guid.NewGuid();
        JobStarted?.Invoke(this, Snapshot());
    }

    private void OnJobDelivered(object? sender, EventArgs e)
    {
        var payload = Snapshot();
        if (_lastData?.GamePlay?.JobDelivered is { } delivered)
        {
            payload.DistanceKm = Math.Max(payload.DistanceKm, delivered.DistanceKm);
            payload.DamagePct = Math.Max(payload.DamagePct, delivered.CargoDamage * 100d);
        }
        JobDelivered?.Invoke(this, payload);
        _activeJobId = Guid.Empty;
    }

    private void OnJobCancelled(object? sender, EventArgs e)
    {
        JobCancelled?.Invoke(this, Snapshot());
        _activeJobId = Guid.Empty;
    }

    private TelemetryPayload Snapshot() => _lastData is null ? _lastPayload ?? new TelemetryPayload() : Map(_lastData);

    private static TelemetryPayload Map(SCSTelemetry data)
    {
        var truck = data.TruckValues;
        var dashboard = truck.CurrentValues.DashboardValues;
        var damage = truck.CurrentValues.DamageValues;
        var fuel = dashboard.FuelValue;
        var capacity = truck.ConstantsValues.CapacityValues.Fuel;
        var position = truck.CurrentValues.PositionValue;
        var maxDamage = new[] { damage.Engine, damage.Transmission, damage.Cabin, damage.Chassis, damage.WheelsAvg }.Max() * 100d;

        return new TelemetryPayload
        {
            Cargo = data.JobValues.CargoValues.Name,
            SourceCity = data.JobValues.CitySource,
            DestinationCity = data.JobValues.CityDestination,
            Truck = truck.ConstantsValues.Name,
            TruckModel = truck.ConstantsValues.Name,
            SpeedKmh = (int)Math.Round(Math.Abs(dashboard.Speed.Kph)),
            DriverName = Environment.UserName,
            UserStatus = data.JobValues.CargoLoaded ? "ON DUTY" : "READY",
            // SCS X/Z values are game-world coordinates, not geographic WGS84 coordinates.
            // Latitude/Longitude intentionally remain unset until a calibrated projection is available.
            Heading = NormalizeHeading(position.Orientation.Heading * 360d),
            DamagePct = maxDamage,
            DistanceKm = data.JobValues.PlannedDistanceKm,
            FuelLiters = fuel.Amount,
            FuelCapacityLiters = capacity,
            FuelPercent = capacity > 0 ? Math.Clamp(fuel.Amount / capacity * 100d, 0d, 100d) : 0d,
            EngineTemperatureC = dashboard.WaterTemperature,
            BrakeAirPressure = truck.CurrentValues.MotorValues.BrakeValues.AirPressure,
            AverageFuelConsumption = fuel.AverageConsumption,
            OdometerKm = dashboard.Odometer,
            EngineDamagePct = damage.Engine * 100d,
            TransmissionDamagePct = damage.Transmission * 100d,
            CabinDamagePct = damage.Cabin * 100d,
            ChassisDamagePct = damage.Chassis * 100d,
            WheelsDamagePct = damage.WheelsAvg * 100d,
            Game = data.Game == SCSGame.Ats ? "ATS" : "ETS2",
            TimestampUtc = DateTime.UtcNow,
        };
    }

    private void SetConnected(bool value)
    {
        if (_connected == value) return;
        _connected = value;
        ConnectionChanged?.Invoke(this, value);
    }

    private static double NormalizeHeading(double heading)
    {
        heading %= 360d;
        return heading < 0 ? heading + 360d : heading;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _cancellation.Cancel();
        Detach();
        try { _monitor?.Wait(TimeSpan.FromSeconds(2)); } catch { }
        _cancellation.Dispose();
    }
}
