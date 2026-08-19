using System;

namespace VtcDesktopClient;

public sealed class TripData
{
    public string? Game { get; set; }

    public string? Cargo { get; set; }

    public string? SourceCity { get; set; }

    public string? DestinationCity { get; set; }

    public string? Truck { get; set; }

    public string? TruckModel { get; set; }

    public double DistanceKm { get; set; }

    public double FuelConsumed { get; set; }

    public double DamagePct { get; set; }

    public int SpeedKmh { get; set; }

    public int CurrentSpeed { get; set; }

    public bool IsWotr { get; set; }

    public int? MaxSpeedKmh { get; set; }

    public DateTimeOffset TimestampUtc { get; set; }

    public DateTime DeliveredAtUtc { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public double? Heading { get; set; }
}
