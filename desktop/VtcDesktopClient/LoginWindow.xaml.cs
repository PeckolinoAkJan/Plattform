using System.Windows;

namespace VtcDesktopClient;

public partial class LoginWindow : Window
{
    private readonly ApiClient _api;

    public LoginWindow(ApiClient api)
    {
        InitializeComponent();
        _api = api;
        MouseLeftButtonDown += (_, e) => { if (e.ButtonState == System.Windows.Input.MouseButtonState.Pressed) DragMove(); };
    }

    private async void LoginWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            var providers = await _api.GetProviderAvailabilityAsync();
            ConfigureProviderButton(GoogleButton, providers, "google");
            ConfigureProviderButton(DiscordButton, providers, "discord");
            ConfigureProviderButton(SteamButton, providers, "steam");
        }
        catch
        {
            ErrorText.Text = "Provider status could not be loaded.";
        }
    }

    private async void Login_Click(object sender, RoutedEventArgs e)
    {
        ErrorText.Text = string.Empty;
        LoginButton.IsEnabled = false;
        try
        {
            var success = await _api.LoginAsync(EmailBox.Text.Trim(), PasswordBox.Password);
            if (!success) { ErrorText.Text = "Login failed. Check credentials and server connection."; return; }
            DialogResult = true;
        }
        catch (Exception ex) { ErrorText.Text = ex.Message; }
        finally { LoginButton.IsEnabled = true; }
    }

    private async void OAuth_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not System.Windows.Controls.Button button || button.Tag is not string provider) return;
        ErrorText.Text = string.Empty;
        LoginButton.IsEnabled = false;
        ProviderPanel.IsEnabled = false;
        try
        {
            var success = await _api.LoginWithProviderAsync(provider);
            if (!success) { ErrorText.Text = $"{provider} login failed or was cancelled."; return; }
            DialogResult = true;
        }
        catch (OperationCanceledException) { ErrorText.Text = "Login timed out or was cancelled."; }
        catch (Exception ex) { ErrorText.Text = ex.Message; }
        finally
        {
            LoginButton.IsEnabled = true;
            ProviderPanel.IsEnabled = true;
        }
    }

    private void Cancel_Click(object sender, RoutedEventArgs e) => DialogResult = false;

    private static void ConfigureProviderButton(System.Windows.Controls.Button button, IReadOnlyDictionary<string, bool> providers, string provider)
    {
        var enabled = providers.TryGetValue(provider, out var available) && available;
        button.IsEnabled = enabled;
        if (!enabled) button.Content = $"{provider.ToUpperInvariant()} - NOT CONFIGURED";
    }
}
