using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Security.Cryptography;

namespace VtcDesktopClient;

public sealed class ClientUpdateCheckResult
{
    public bool Success { get; init; }
    public bool IsUpdateAvailable { get; init; }
    public bool IsMandatory { get; init; }
    public string? ErrorMessage { get; init; }
    public Version? CurrentVersion { get; init; }
    public Version? LatestVersion { get; init; }
    public string? InstallerUrl { get; init; }
    public string? Sha256 { get; init; }
}

public sealed class UpdateManifest
{
    [JsonPropertyName("version")]
    public string Version { get; init; } = "0.0.0";

    [JsonPropertyName("installerUrl")]
    public string InstallerUrl { get; init; } = string.Empty;

    [JsonPropertyName("mandatory")]
    public bool Mandatory { get; init; }

    [JsonPropertyName("releaseNotes")]
    public string? ReleaseNotes { get; init; }

    [JsonPropertyName("sha256")]
    public string Sha256 { get; init; } = string.Empty;
}

public sealed class ClientAutoUpdater
{
    private readonly HttpClient _httpClient;
    private readonly string _manifestUrl;

    public ClientAutoUpdater(string manifestUrl = "http://localhost:3001/client/updates/latest.json", HttpClient? httpClient = null)
    {
        _manifestUrl = manifestUrl;
        _httpClient = httpClient ?? new HttpClient();
    }

    public async Task<ClientUpdateCheckResult> CheckForUpdateAsync(CancellationToken cancellationToken = default)
    {
        var currentVersion = ResolveCurrentVersion();
        try
        {
            if (!Uri.TryCreate(_manifestUrl, UriKind.Absolute, out var manifestUri))
            {
                return new ClientUpdateCheckResult
                {
                    Success = false,
                    ErrorMessage = "Manifest-URL ungültig.",
                    CurrentVersion = currentVersion,
                };
            }

            using var response = await _httpClient.GetAsync(manifestUri, cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return new ClientUpdateCheckResult
                {
                    Success = false,
                    ErrorMessage = $"Manifest nicht erreichbar (HTTP {(int)response.StatusCode}).",
                    CurrentVersion = currentVersion,
                };
            }

            var json = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            var manifest = JsonSerializer.Deserialize<UpdateManifest>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            });

            if (manifest is null || string.IsNullOrWhiteSpace(manifest.InstallerUrl) || !IsSha256(manifest.Sha256))
            {
                return new ClientUpdateCheckResult
                {
                    Success = false,
                    ErrorMessage = "Ungültiges Update-Manifest.",
                    CurrentVersion = currentVersion,
                };
            }

            var latestVersion = ParseVersion(manifest.Version);
            if (latestVersion is null)
            {
                return new ClientUpdateCheckResult
                {
                    Success = false,
                    ErrorMessage = "Manifest-Version ungültig.",
                    CurrentVersion = currentVersion,
                };
            }

            return new ClientUpdateCheckResult
            {
                Success = true,
                CurrentVersion = currentVersion,
                LatestVersion = latestVersion,
                IsMandatory = manifest.Mandatory,
                InstallerUrl = manifest.InstallerUrl,
                Sha256 = manifest.Sha256.ToLowerInvariant(),
                IsUpdateAvailable = currentVersion is null || latestVersion > currentVersion,
            };
        }
        catch (Exception ex)
        {
            return new ClientUpdateCheckResult
            {
                Success = false,
                ErrorMessage = $"Update-Prüfung fehlgeschlagen: {ex.Message}",
                CurrentVersion = currentVersion,
            };
        }
    }

    public async Task<bool> ApplyUpdateAsync(string downloadUrl, string? expectedSha256, CancellationToken cancellationToken = default)
    {
        if (!Uri.TryCreate(downloadUrl, UriKind.Absolute, out var downloadUri) || !IsSha256(expectedSha256))
        {
            return false;
        }

        if (downloadUri.Scheme != Uri.UriSchemeHttps && !downloadUri.IsLoopback) return false;

        var currentExecutable = ResolveCurrentExecutable();
        if (string.IsNullOrWhiteSpace(currentExecutable))
        {
            return false;
        }

        var workingDir = Path.Combine(Path.GetTempPath(), "VtcHubClient", "Updates");
        Directory.CreateDirectory(workingDir);
        var downloadFile = Path.Combine(workingDir, $"VtcHubClient-Update-{DateTime.UtcNow:yyyyMMddHHmmss}.exe");

        await using (var responseStream = await _httpClient.GetStreamAsync(downloadUri, cancellationToken).ConfigureAwait(false))
        await using (var targetStream = File.Create(downloadFile))
        {
            await responseStream.CopyToAsync(targetStream, cancellationToken).ConfigureAwait(false);
        }

        if (!File.Exists(downloadFile))
        {
            return false;
        }


        await using (var stream = File.OpenRead(downloadFile))
        {
            var actualHash = Convert.ToHexString(await SHA256.HashDataAsync(stream, cancellationToken)).ToLowerInvariant();
            if (!CryptographicOperations.FixedTimeEquals(
                    Convert.FromHexString(actualHash),
                    Convert.FromHexString(expectedSha256!)))
            {
                File.Delete(downloadFile);
                return false;
            }
        }

        var scriptPath = Path.Combine(workingDir, "apply-update.ps1");
        var processName = Path.GetFileNameWithoutExtension(currentExecutable);
        var script = @$"
param(
    [Parameter(Mandatory = $true)] [string]$CurrentExecutable,
    [Parameter(Mandatory = $true)] [string]$DownloadedExecutable,
    [Parameter(Mandatory = $true)] [string]$ProcessName
)

Start-Sleep -Milliseconds 900
while (Get-Process -Name $ProcessName -ErrorAction SilentlyContinue) {{
    Start-Sleep -Milliseconds 400
}}

Move-Item -Force -Path $DownloadedExecutable -Destination $CurrentExecutable
Start-Sleep -Milliseconds 350
Start-Process -FilePath $CurrentExecutable
Remove-Item -Force -Path $PSCommandPath
";

        await File.WriteAllTextAsync(scriptPath, script, cancellationToken).ConfigureAwait(false);

        var arguments = $"-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{scriptPath}\" \"{currentExecutable}\" \"{downloadFile}\" \"{processName}\"";
        Process.Start(new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = arguments,
            CreateNoWindow = true,
            UseShellExecute = false,
        });

        return true;
    }

    private static Version? ParseVersion(string versionText)
    {
        if (string.IsNullOrWhiteSpace(versionText))
        {
            return null;
        }

        if (Version.TryParse(versionText.Trim(), out var parsed))
        {
            return parsed;
        }

        var parts = versionText.Split('.');
        if (parts.Length > 2 && int.TryParse(parts[0], out var major) && int.TryParse(parts[1], out var minor))
        {
            return new Version(major, minor, 0, 0);
        }

        return null;
    }

    private static bool IsSha256(string? value) =>
        value is { Length: 64 } && value.All(Uri.IsHexDigit);

    private static Version? ResolveCurrentVersion()
    {
        var version = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version;
        if (version is null)
        {
            return null;
        }

        return new Version(version.Major, version.Minor, version.Build < 0 ? 0 : version.Build, version.Revision < 0 ? 0 : version.Revision);
    }

    private static string? ResolveCurrentExecutable()
    {
        try
        {
            return Environment.ProcessPath;
        }
        catch
        {
            return null;
        }
    }
}
