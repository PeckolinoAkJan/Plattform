using System.IO;
using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media.Imaging;

namespace VtcDesktopClient;

public partial class MainWindow : Window
{
    private readonly TelemetryManager _telemetry;
    private readonly ApiClient _api;
    private readonly MainViewModel _viewModel;

    public MainWindow()
    {
        InitializeComponent();
        var settings = ClientSettings.Load();
        _telemetry = new TelemetryManager();
        _api = new ApiClient(settings.BaseUrl, settings.ClientSecret, ClientSessionStore.LoadToken());
        _viewModel = new MainViewModel(_telemetry, _api, Dispatcher, settings.UpdateManifestUrl);
        DataContext = _viewModel;
        Loaded += MainWindow_Loaded;
        Closed += (_, _) => _viewModel.Dispose();
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        SessionButton.Content = string.IsNullOrWhiteSpace(_api.JwtToken) ? "LOG IN                                      →" : "LOG OUT                                     →";
        await _viewModel.InitializeAsync();
    }

    private void HeaderDragArea_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.OriginalSource is DependencyObject source && FindAncestor<ButtonBase>(source) is not null) return;
        if (e.ClickCount == 2) WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
        else if (e.ButtonState == MouseButtonState.Pressed) DragMove();
    }

    private async void UpdateButton_Click(object sender, RoutedEventArgs e)
    {
        if (_viewModel.IsUpdatePending) await _viewModel.ApplyAvailableUpdateAsync();
        else await _viewModel.CheckForUpdateAsync(true);
    }

    private async void InstallPluginButton_Click(object sender, RoutedEventArgs e) => await _viewModel.InstallTelemetryPluginAsync();

    private void SessionButton_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrWhiteSpace(_api.JwtToken))
        {
            _api.JwtToken = string.Empty;
            ClientSessionStore.Clear();
            SessionButton.Content = "LOG IN                                      →";
            return;
        }

        var login = new LoginWindow(_api) { Owner = this };
        if (login.ShowDialog() == true) SessionButton.Content = "LOG OUT                                     →";
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void CloseButton_Click(object sender, RoutedEventArgs e) => Close();

    private void ApplyLogoFromAssets()
    {
        foreach (var name in new[] { "vtc-hub-logo.png", "vtc-logo.png", "logo.png" })
        {
            var path = Path.Combine(AppContext.BaseDirectory, "Assets", name);
            if (!File.Exists(path)) continue;
            try
            {
                var bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.UriSource = new Uri(path, UriKind.Absolute);
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.EndInit();
                bitmap.Freeze();
                LogoImage.Source = bitmap;
                LogoImage.Visibility = Visibility.Visible;
                LogoFallback.Visibility = Visibility.Collapsed;
                return;
            }
            catch { }
        }
    }

    private static T? FindAncestor<T>(DependencyObject current) where T : DependencyObject
    {
        while (current is not null)
        {
            if (current is T match) return match;
            current = System.Windows.Media.VisualTreeHelper.GetParent(current);
        }
        return null;
    }
}
