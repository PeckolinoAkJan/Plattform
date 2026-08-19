using System.IO.Compression;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using Microsoft.Win32;

namespace VtcDesktopClient;

public sealed class PluginInstallResult
{
    public bool Success { get; init; }
    public bool ManualActionRequired { get; init; }
    public string StatusMessage { get; init; } = "Unbekannter Fehler";
    public string? InstalledPath { get; init; }
}

public sealed class PluginInstallationState
{
    public bool IsInstalled { get; init; }
    public string StatusMessage { get; init; } = "Unbekannter Status";
    public string? InstalledPath { get; init; }
}

public sealed class TelemetryPluginInstaller
{
    private readonly HttpClient _httpClient;
    private readonly string _downloadUrl;
    private readonly string _pluginFolderHint;

    public TelemetryPluginInstaller(
        string? downloadUrl = null,
        HttpClient? httpClient = null,
        string? pluginFolderHint = null)
    {
        _downloadUrl = string.IsNullOrWhiteSpace(downloadUrl)
            ? "http://localhost:3001/downloads/vtchub-telemetry-plugin.zip"
            : downloadUrl.Trim();

        _httpClient = httpClient ?? new HttpClient();
        _pluginFolderHint = pluginFolderHint ?? "VTC Hub";
    }

    public PluginInstallationState GetCurrentState()
    {
        var installFolder = ResolvePluginFolder();
        if (string.IsNullOrWhiteSpace(installFolder))
        {
            return new PluginInstallationState
            {
                IsInstalled = false,
                StatusMessage = "Plugin-Pfad nicht automatisch ermittelbar.",
            };
        }

        var marker = Path.Combine(installFolder, "VTC-Hub-Plugin.installed");
        if (!File.Exists(marker))
        {
            return new PluginInstallationState
            {
                IsInstalled = false,
                StatusMessage = $"Plugin nicht gefunden in: {installFolder}",
                InstalledPath = installFolder,
            };
        }

        return new PluginInstallationState
        {
            IsInstalled = true,
            StatusMessage = $"Plugin installiert in: {installFolder}",
            InstalledPath = installFolder,
        };
    }

    public async Task<PluginInstallResult> InstallAsync(CancellationToken cancellationToken = default)
    {
        var installFolder = ResolvePluginFolder();
        if (string.IsNullOrWhiteSpace(installFolder))
        {
            return new PluginInstallResult
            {
                ManualActionRequired = true,
                Success = false,
                StatusMessage = "Plugin-Pfad nicht gefunden. Bitte Game-Ordner manuell im Dialog auswählen.",
            };
        }

        try
        {
            Directory.CreateDirectory(installFolder);
            var bundledPlugin = Path.Combine(AppContext.BaseDirectory, "Plugin", "scs-telemetry.dll");
            if (File.Exists(bundledPlugin))
            {
                var targetPlugin = Path.Combine(installFolder, "scs-telemetry.dll");
                File.Copy(bundledPlugin, targetPlugin, overwrite: true);
                await WriteMarkerAsync(installFolder, "bundled:RenCloud-1.12.1", cancellationToken).ConfigureAwait(false);
                return new PluginInstallResult
                {
                    Success = true,
                    StatusMessage = $"Plugin installed: {targetPlugin}",
                    InstalledPath = installFolder,
                };
            }
            var tempFile = Path.Combine(
                Path.GetTempPath(),
                $"vtc-hub-telemetry-plugin-{DateTime.UtcNow:yyyyMMddHHmmss}.tmp");

            if (!Uri.TryCreate(_downloadUrl, UriKind.Absolute, out var downloadUri))
            {
                return new PluginInstallResult
                {
                    ManualActionRequired = true,
                    Success = false,
                    StatusMessage = "Ungültige Plugin-Download-URL.",
                };
            }

            await using (var response = await _httpClient.GetStreamAsync(downloadUri, cancellationToken).ConfigureAwait(false))
            await using (var fileStream = File.Create(tempFile))
            {
                await response.CopyToAsync(fileStream, cancellationToken).ConfigureAwait(false);
            }

            var extension = Path.GetExtension(downloadUri.LocalPath)?.ToLowerInvariant();
            if (string.Equals(extension, ".zip", StringComparison.OrdinalIgnoreCase))
            {
                var extractTarget = Path.Combine(installFolder, _pluginFolderHint);
                Directory.CreateDirectory(extractTarget);

                using (var archive = ZipFile.OpenRead(tempFile))
                {
                    foreach (var entry in archive.Entries)
                    {
                        var targetPath = Path.GetFullPath(Path.Combine(extractTarget, entry.FullName));
                        var safeRoot = Path.GetFullPath(extractTarget) + Path.DirectorySeparatorChar;
                        if (!targetPath.StartsWith(safeRoot, StringComparison.OrdinalIgnoreCase))
                        {
                            throw new InvalidDataException("Unsafe path in plugin archive.");
                        }
                        var targetDir = Path.GetDirectoryName(targetPath);
                        if (string.IsNullOrWhiteSpace(targetDir))
                        {
                            continue;
                        }

                        Directory.CreateDirectory(targetDir);
                        if (string.IsNullOrWhiteSpace(entry.Name))
                        {
                            continue;
                        }

                        entry.ExtractToFile(targetPath, overwrite: true);
                    }
                }
            }
            else
            {
                var targetFile = Path.Combine(installFolder, $"VTC-Hub-Telemetry-Plugin{extension}");
                File.Copy(tempFile, targetFile, overwrite: true);
            }

            await WriteMarkerAsync(installFolder, _downloadUrl, cancellationToken).ConfigureAwait(false);

            return new PluginInstallResult
            {
                Success = true,
                ManualActionRequired = false,
                StatusMessage = $"Plugin installiert: {installFolder}",
                InstalledPath = installFolder,
            };
        }
        catch (Exception ex)
        {
            return new PluginInstallResult
            {
                Success = false,
                StatusMessage = $"Plugin-Installation fehlgeschlagen: {ex.Message}",
                ManualActionRequired = true,
            };
        }
    }

    private static Task WriteMarkerAsync(string installFolder, string source, CancellationToken cancellationToken)
    {
        var markerPath = Path.Combine(installFolder, "VTC-Hub-Plugin.installed");
        return File.WriteAllTextAsync(markerPath, JsonSerializer.Serialize(new
        {
            InstalledAt = DateTime.UtcNow,
            Source = source,
        }), cancellationToken);
    }

    private static string? TryGetValueFromRegistry(string key, string valueName)
    {
        using var regKey = Registry.CurrentUser.OpenSubKey(key);
        return regKey?.GetValue(valueName)?.ToString();
    }

    private string? ResolvePluginFolder()
    {
        var candidateFolders = new List<string>();

        var documents = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        if (!string.IsNullOrWhiteSpace(documents))
        {
        }

        var steamPath = TryGetValueFromRegistry(@"Software\Valve\Steam", "SteamPath");
        if (!string.IsNullOrWhiteSpace(steamPath))
        {
            var common = Path.Combine(steamPath.Trim('"'), "steamapps", "common");
            candidateFolders.Add(Path.Combine(common, "Euro Truck Simulator 2", "bin", "win_x64", "plugins"));
            candidateFolders.Add(Path.Combine(common, "American Truck Simulator", "bin", "win_x64", "plugins"));
        }

        candidateFolders = candidateFolders
            .Select(path => path.TrimEnd('/', '\\'))
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var candidate in candidateFolders)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            if (Directory.Exists(candidate))
            {
                return candidate;
            }
        }

        return candidateFolders.FirstOrDefault();
    }
}
