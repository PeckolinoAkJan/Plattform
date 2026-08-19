using System.Text.Json;
using System.IO;

namespace VtcDesktopClient;

public sealed class ClientSettings
{
    public string BaseUrl { get; init; } = "http://localhost:3001";
    public string ClientSecret { get; init; } = string.Empty;
    public string UpdateManifestUrl { get; init; } = "http://localhost:3001/client/updates/latest.json";

    public static ClientSettings Load()
    {
        ClientSettings fileSettings = new();
        var path = Path.Combine(AppContext.BaseDirectory, "clientsettings.json");
        if (File.Exists(path))
        {
            try
            {
                fileSettings = JsonSerializer.Deserialize<ClientSettings>(File.ReadAllText(path), new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? fileSettings;
            }
            catch { }
        }

        return new ClientSettings
        {
            BaseUrl = Environment.GetEnvironmentVariable("VTC_API_URL") ?? fileSettings.BaseUrl,
            ClientSecret = Environment.GetEnvironmentVariable("VTC_CLIENT_SECRET") ?? fileSettings.ClientSecret,
            UpdateManifestUrl = Environment.GetEnvironmentVariable("VTC_UPDATE_MANIFEST_URL") ?? fileSettings.UpdateManifestUrl,
        };
    }
}
