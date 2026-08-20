using System.IO.Compression;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
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
        var installFolders = ResolvePluginFolders();
        if (installFolders.Count == 0)
        {
            return new PluginInstallationState
            {
                IsInstalled = false,
                StatusMessage = "Plugin-Pfad nicht automatisch ermittelbar.",
            };
        }

        var installedFolders = installFolders
            .Where(folder => File.Exists(Path.Combine(folder, "VTC-Hub-Plugin.installed")))
            .ToList();
        if (installedFolders.Count != installFolders.Count)
        {
            return new PluginInstallationState
            {
                IsInstalled = false,
                StatusMessage = $"Plugin fehlt in {installFolders.Count - installedFolders.Count} von {installFolders.Count} Spielinstallation(en).",
                InstalledPath = string.Join("; ", installFolders),
            };
        }

        return new PluginInstallationState
        {
            IsInstalled = true,
            StatusMessage = $"Plugin installiert in {installedFolders.Count} Spielinstallation(en).",
            InstalledPath = string.Join("; ", installedFolders),
        };
    }

    public async Task<PluginInstallResult> InstallAsync(CancellationToken cancellationToken = default)
    {
        var installFolders = ResolvePluginFolders();
        if (installFolders.Count == 0)
        {
            return new PluginInstallResult
            {
                ManualActionRequired = true,
                Success = false,
                StatusMessage = "Keine ETS2-/ATS-Steam-Installation gefunden.",
            };
        }

        try
        {
            var bundledPlugin = Path.Combine(AppContext.BaseDirectory, "Plugin", "scs-telemetry.dll");
            if (File.Exists(bundledPlugin))
            {
                var installedPaths = new List<string>();
                foreach (var destinationFolder in installFolders)
                {
                    Directory.CreateDirectory(destinationFolder);
                    var targetPlugin = Path.Combine(destinationFolder, "scs-telemetry.dll");
                    File.Copy(bundledPlugin, targetPlugin, overwrite: true);
                    await WriteMarkerAsync(destinationFolder, "bundled:RenCloud-1.12.1", cancellationToken).ConfigureAwait(false);
                    installedPaths.Add(targetPlugin);
                }
                return new PluginInstallResult
                {
                    Success = true,
                    StatusMessage = $"Plugin in {installedPaths.Count} Spielinstallation(en) installiert.",
                    InstalledPath = string.Join("; ", installedPaths),
                };
            }

            var installFolder = installFolders[0];
            Directory.CreateDirectory(installFolder);
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

    private static string? TryGetCurrentUserRegistryValue(string key, string valueName)
    {
        using var regKey = Registry.CurrentUser.OpenSubKey(key);
        return regKey?.GetValue(valueName)?.ToString();
    }

    private static string? TryGetLocalMachineRegistryValue(string key, string valueName, RegistryView view)
    {
        using var baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, view);
        using var regKey = baseKey.OpenSubKey(key);
        return regKey?.GetValue(valueName)?.ToString();
    }

    private static IEnumerable<string> ReadSteamLibraryRoots(string steamRoot)
    {
        yield return steamRoot;
        var libraryFile = Path.Combine(steamRoot, "steamapps", "libraryfolders.vdf");
        if (!File.Exists(libraryFile))
        {
            yield break;
        }

        foreach (var line in File.ReadLines(libraryFile))
        {
            var match = Regex.Match(line, "\\\"path\\\"\\s+\\\"(?<path>.+)\\\"", RegexOptions.IgnoreCase);
            if (!match.Success) continue;
            yield return match.Groups["path"].Value.Replace(@"\\", @"\").Trim();
        }
    }

    private static IReadOnlyList<string> ResolvePluginFolders()
    {
        var steamRoots = new[]
        {
            TryGetCurrentUserRegistryValue(@"Software\Valve\Steam", "SteamPath"),
            TryGetLocalMachineRegistryValue(@"SOFTWARE\Valve\Steam", "InstallPath", RegistryView.Registry64),
            TryGetLocalMachineRegistryValue(@"SOFTWARE\Valve\Steam", "InstallPath", RegistryView.Registry32),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Steam"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Steam"),
        };

        var libraryRoots = steamRoots
            .Where(root => !string.IsNullOrWhiteSpace(root))
            .Select(root => root!.Trim('"').TrimEnd('/', '\\'))
            .Where(Directory.Exists)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .SelectMany(ReadSteamLibraryRoots)
            .Where(Directory.Exists)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var candidateFolders = new List<string>();
        foreach (var libraryRoot in libraryRoots)
        {
            var common = Path.Combine(libraryRoot, "steamapps", "common");
            foreach (var game in new[] { "Euro Truck Simulator 2", "American Truck Simulator" })
            {
                var gameRoot = Path.Combine(common, game);
                if (!Directory.Exists(gameRoot)) continue;
                candidateFolders.Add(Path.Combine(gameRoot, "bin", "win_x64", "plugins"));
            }
        }

        return candidateFolders
            .Select(path => path.TrimEnd('/', '\\'))
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
