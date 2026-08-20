using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
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
        _api = new ApiClient(settings.BaseUrl, ClientSessionStore.LoadToken());
        _viewModel = new MainViewModel(_telemetry, _api, Dispatcher, settings.UpdateManifestUrl);
        DataContext = _viewModel;
        Loaded += MainWindow_Loaded;
        Closed += (_, _) => _viewModel.Dispose();
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        ApplyLogoFromAssets();
        var profile = await _api.GetCurrentUserAsync();
        if (profile is null)
        {
            _api.JwtToken = string.Empty;
            ClientSessionStore.Clear();
            var login = new LoginWindow(_api) { Owner = this };
            if (login.ShowDialog() == true) profile = await _api.GetCurrentUserAsync();
        }
        ApplySession(profile);
        await _viewModel.InitializeAsync();
    }

    private void Window_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton != MouseButton.Left || e.GetPosition(this).Y > 92) return;
        if (e.OriginalSource is DependencyObject source && FindAncestor<ButtonBase>(source) is not null) return;
        if (e.ClickCount == 2)
        {
            ToggleMaximize();
            e.Handled = true;
            return;
        }
        if (e.ButtonState != MouseButtonState.Pressed) return;
        BeginWindowDrag(e.GetPosition(this));
        e.Handled = true;
    }

    private void BeginWindowDrag(Point cursorInWindow)
    {
        if (WindowState == WindowState.Maximized)
        {
            var horizontalRatio = ActualWidth > 0 ? cursorInWindow.X / ActualWidth : 0.5;
            var screenPixels = PointToScreen(cursorInWindow);
            var source = PresentationSource.FromVisual(this);
            var screen = source?.CompositionTarget?.TransformFromDevice.Transform(screenPixels) ?? screenPixels;
            var restoredWidth = RestoreBounds.Width > 0 ? RestoreBounds.Width : Width;
            WindowState = WindowState.Normal;
            Left = screen.X - (restoredWidth * horizontalRatio);
            Top = screen.Y - 24;
        }

        try { DragMove(); }
        catch (InvalidOperationException) { }
    }

    private async void UpdateButton_Click(object sender, RoutedEventArgs e)
    {
        if (_viewModel.IsUpdatePending) await _viewModel.ApplyAvailableUpdateAsync();
        else await _viewModel.CheckForUpdateAsync(true);
    }

    private async void InstallPluginButton_Click(object sender, RoutedEventArgs e) => await _viewModel.InstallTelemetryPluginAsync();

    private async void NavigationButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not System.Windows.Controls.Button button) return;
        var section = button.Tag?.ToString() ?? "DASHBOARD";
        _viewModel.SelectSection(section);
        var showDashboard = string.Equals(section, "DASHBOARD", StringComparison.OrdinalIgnoreCase);
        DashboardPanel.Visibility = showDashboard ? Visibility.Visible : Visibility.Collapsed;
        SectionPanel.Visibility = showDashboard ? Visibility.Collapsed : Visibility.Visible;
        var showMessages = string.Equals(section, "MESSAGES", StringComparison.OrdinalIgnoreCase);
        SectionMetricsPanel.Visibility = showMessages ? Visibility.Collapsed : Visibility.Visible;
        MessagesPanel.Visibility = showMessages ? Visibility.Visible : Visibility.Collapsed;

        foreach (var nav in new[] { DashboardNavButton, JobsNavButton, VehiclesNavButton, DriversNavButton, ReportsNavButton, AlertsNavButton, MessagesNavButton, SettingsNavButton })
        {
            nav.Background = Brushes.Transparent;
            nav.Foreground = new SolidColorBrush(Color.FromRgb(174, 178, 185));
            nav.BorderThickness = new Thickness(0);
        }
        button.Background = new SolidColorBrush(Color.FromRgb(32, 27, 15));
        button.Foreground = new SolidColorBrush(Color.FromRgb(242, 205, 103));
        button.BorderBrush = new SolidColorBrush(Color.FromRgb(217, 169, 40));
        button.BorderThickness = new Thickness(3, 0, 0, 0);

        if (section is "ALERTS" or "SETTINGS")
        {
            await _viewModel.CheckForPluginStateAsync();
            await _viewModel.RefreshConnectivityAsync();
        }
        if (showMessages) await _viewModel.RefreshChatAsync();
    }

    private async void RefreshChatButton_Click(object sender, RoutedEventArgs e) => await _viewModel.RefreshChatAsync();

    private async void SendChatButton_Click(object sender, RoutedEventArgs e)
    {
        var message = ChatInput.Text;
        if (await _viewModel.SendChatMessageAsync(message)) ChatInput.Clear();
    }

    private async void RefreshSectionButton_Click(object sender, RoutedEventArgs e)
    {
        await _viewModel.CheckForPluginStateAsync();
        await _viewModel.RefreshConnectivityAsync();
        _viewModel.SelectSection(_viewModel.SelectedSectionTitle);
    }

    private void OpenWebPortalButton_Click(object sender, RoutedEventArgs e)
    {
        var route = _viewModel.SelectedSectionTitle switch
        {
            "REPORTS" => "dashboard/logbook",
            "JOBS" or "VEHICLES" or "DRIVERS" => "dashboard/company",
            "SETTINGS" => "dashboard/profile",
            "ALERTS" or "MESSAGES" => "dashboard",
            _ => "dashboard",
        };
        var target = new Uri(new Uri(_api.BaseUrl), route);
        Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true });
    }

    private async void SessionButton_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrWhiteSpace(_api.JwtToken))
        {
            _api.JwtToken = string.Empty;
            ClientSessionStore.Clear();
            _viewModel.SetSignedOut();
            ApplySession(null);
            return;
        }

        var login = new LoginWindow(_api) { Owner = this };
        if (login.ShowDialog() == true) ApplySession(await _api.GetCurrentUserAsync());
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void MaximizeButton_Click(object sender, RoutedEventArgs e) => ToggleMaximize();
    private void CloseButton_Click(object sender, RoutedEventArgs e) => Close();

    private void ToggleMaximize()
    {
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
        MaximizeButton.Content = WindowState == WindowState.Maximized ? "❐" : "□";
    }

    private void ApplySession(ApiUserProfile? profile)
    {
        var authenticated = profile is not null && !string.IsNullOrWhiteSpace(_api.JwtToken);
        SessionButton.Content = authenticated ? "LOG OUT                                     →" : "LOG IN                                      →";
        if (authenticated) _viewModel.SetAuthenticatedUser(profile!.DisplayName);
    }

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
                if (bitmap.PixelWidth > 1024 || bitmap.PixelHeight > 512) continue;
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
