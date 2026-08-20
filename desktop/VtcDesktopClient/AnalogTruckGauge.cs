using System.Globalization;
using System.Windows;
using System.Windows.Media;

namespace VtcDesktopClient;

public sealed class AnalogTruckGauge : FrameworkElement
{
    public static readonly DependencyProperty SpeedProperty = DependencyProperty.Register(
        nameof(Speed), typeof(double), typeof(AnalogTruckGauge),
        new FrameworkPropertyMetadata(0d, FrameworkPropertyMetadataOptions.AffectsRender));

    public static readonly DependencyProperty OdometerProperty = DependencyProperty.Register(
        nameof(Odometer), typeof(double), typeof(AnalogTruckGauge),
        new FrameworkPropertyMetadata(0d, FrameworkPropertyMetadataOptions.AffectsRender));

    public double Speed
    {
        get => (double)GetValue(SpeedProperty);
        set => SetValue(SpeedProperty, value);
    }

    public double Odometer
    {
        get => (double)GetValue(OdometerProperty);
        set => SetValue(OdometerProperty, value);
    }

    protected override void OnRender(DrawingContext dc)
    {
        base.OnRender(dc);
        var size = Math.Min(ActualWidth, ActualHeight);
        if (size < 80) return;

        var center = new Point(ActualWidth / 2d, ActualHeight / 2d);
        var radius = size * 0.44d;
        var face = new RadialGradientBrush(
            Color.FromRgb(30, 36, 42),
            Color.FromRgb(4, 7, 9)) { RadiusX = .72, RadiusY = .72 };
        dc.DrawEllipse(new SolidColorBrush(Color.FromRgb(8, 11, 14)), new Pen(new SolidColorBrush(Color.FromRgb(117, 91, 34)), 3), center, radius + 10, radius + 10);
        dc.DrawEllipse(face, new Pen(new SolidColorBrush(Color.FromRgb(46, 53, 59)), 2), center, radius, radius);

        var gold = new SolidColorBrush(Color.FromRgb(226, 179, 47));
        var bright = new SolidColorBrush(Color.FromRgb(244, 240, 230));
        var muted = new SolidColorBrush(Color.FromRgb(132, 142, 149));
        var red = new SolidColorBrush(Color.FromRgb(225, 72, 68));
        var start = 135d;
        var sweep = 270d;

        for (var value = 0; value <= 140; value += 2)
        {
            var major = value % 20 == 0;
            var medium = value % 10 == 0;
            var angle = start + sweep * value / 140d;
            var outer = Polar(center, radius - 12, angle);
            var inner = Polar(center, radius - (major ? 37 : medium ? 29 : 22), angle);
            var tickBrush = value >= 120 ? red : major ? bright : muted;
            dc.DrawLine(new Pen(tickBrush, major ? 3 : medium ? 2 : 1), inner, outer);

            if (!major) continue;
            var labelPoint = Polar(center, radius - 58, angle);
            DrawText(dc, value.ToString(CultureInfo.InvariantCulture), labelPoint, size * .039, bright, FontWeights.SemiBold, centered: true);
        }

        DrawText(dc, "km/h", new Point(center.X, center.Y + radius * .33), size * .045, gold, FontWeights.SemiBold, centered: true);
        DrawText(dc, "VTC DRIVE", new Point(center.X, center.Y - radius * .31), size * .031, muted, FontWeights.SemiBold, centered: true);

        var clampedSpeed = Math.Clamp(Speed, 0d, 140d);
        var needleAngle = start + sweep * clampedSpeed / 140d;
        var needleTip = Polar(center, radius * .72, needleAngle);
        var needleTail = Polar(center, radius * .14, needleAngle + 180d);
        dc.DrawLine(new Pen(new SolidColorBrush(Color.FromRgb(253, 189, 45)), Math.Max(3, size * .012)) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round }, needleTail, needleTip);
        dc.DrawEllipse(new SolidColorBrush(Color.FromRgb(18, 22, 25)), new Pen(gold, 3), center, size * .036, size * .036);

        var displayRect = new Rect(center.X - radius * .37, center.Y + radius * .53, radius * .74, radius * .21);
        dc.DrawRoundedRectangle(new SolidColorBrush(Color.FromRgb(7, 12, 14)), new Pen(new SolidColorBrush(Color.FromRgb(74, 67, 43)), 1), displayRect, 7, 7);
        DrawText(dc, $"{clampedSpeed:0}  km/h", new Point(center.X, displayRect.Top + displayRect.Height * .35), size * .038, bright, FontWeights.Bold, centered: true);
        DrawText(dc, $"ODO  {Math.Max(0, Odometer):N0} km", new Point(center.X, displayRect.Top + displayRect.Height * .72), size * .022, muted, FontWeights.Normal, centered: true);
    }

    private static Point Polar(Point center, double radius, double degrees)
    {
        var radians = degrees * Math.PI / 180d;
        return new Point(center.X + Math.Cos(radians) * radius, center.Y + Math.Sin(radians) * radius);
    }

    private static void DrawText(DrawingContext dc, string value, Point point, double size, Brush brush, FontWeight weight, bool centered)
    {
        var text = new FormattedText(
            value,
            CultureInfo.InvariantCulture,
            FlowDirection.LeftToRight,
            new Typeface(new FontFamily("Bahnschrift"), FontStyles.Normal, weight, FontStretches.Normal),
            size,
            brush,
            1d);
        dc.DrawText(text, centered ? new Point(point.X - text.Width / 2d, point.Y - text.Height / 2d) : point);
    }
}
