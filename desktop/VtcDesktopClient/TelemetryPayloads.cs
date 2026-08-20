using System;
using System.Text.Json.Serialization;

namespace VtcDesktopClient;

public sealed class TelemetryPayload
{
    public string? Cargo { get; set; }

    public string? SourceCity { get; set; }

    public string? DestinationCity { get; set; }

    public string? Truck { get; set; }

    public string? TruckModel { get; set; }

    public int SpeedKmh { get; set; }

    public string? DriverName { get; set; }

    public string? UserStatus { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public double? Heading { get; set; }

    public double? GameX { get; set; }

    public double? GameZ { get; set; }

    public string? CoordinateAccuracy { get; set; }

    public double DamagePct { get; set; }

    public double DistanceKm { get; set; }

    public double FuelLiters { get; set; }
    public double FuelCapacityLiters { get; set; }
    public double FuelPercent { get; set; }
    public double EngineTemperatureC { get; set; }
    public double BrakeAirPressure { get; set; }
    public double AverageFuelConsumption { get; set; }
    public double OdometerKm { get; set; }
    public double EngineDamagePct { get; set; }
    public double TransmissionDamagePct { get; set; }
    public double CabinDamagePct { get; set; }
    public double ChassisDamagePct { get; set; }
    public double WheelsDamagePct { get; set; }

    public string? Game { get; set; }

    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}

public sealed class LocationData
{
    public string DriverId { get; set; } = Guid.NewGuid().ToString("N");

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public double SpeedKmh { get; set; }

    public double Heading { get; set; }

    public string? TruckModel { get; set; }

    public string? CompanyId { get; set; }

    [JsonIgnore]
    public string? Room { get; set; }

    public string? CargoName { get; set; }

    public string? SourceCity { get; set; }

    public string? DestinationCity { get; set; }

    [JsonPropertyName("timestamp")]
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}

public sealed class JobStartedEvent
{
    public Guid JobId { get; } = Guid.NewGuid();

    public TelemetryPayload Payload { get; }

    public JobStartedEvent(TelemetryPayload payload)
    {
        Payload = payload;
    }
}

public sealed class JobDeliveredEvent
{
    public Guid JobId { get; }

    public TelemetryPayload Payload { get; }

    public bool IsWotrLike { get; }

    public JobDeliveredEvent(Guid jobId, TelemetryPayload payload, bool isWotrLike = false)
    {
        JobId = jobId;
        Payload = payload;
        IsWotrLike = isWotrLike;
    }
}

public sealed class TelemetryUpdatedEvent
{
    public TelemetryPayload Payload { get; }

    public TelemetryUpdatedEvent(TelemetryPayload payload)
    {
        Payload = payload;
    }
}

public sealed class JobCancelledEvent
{
    public Guid JobId { get; }
    public TelemetryPayload Payload { get; }

    public JobCancelledEvent(Guid jobId, TelemetryPayload payload)
    {
        JobId = jobId;
        Payload = payload;
    }
}
