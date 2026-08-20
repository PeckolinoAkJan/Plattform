using System.IO.Compression;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
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
            ? string.Empty
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
            .Where(folder => File.Exists(Path.Combine(folder, "scs-telemetry.dll")))
            .ToList();
        if (installedFolders.Count != installFolders.Count)
        {
            return new PluginInstallationState
            {
                IsInstalled = false,
                StatusMessage = $"SCS-Telemetrie fehlt in {installFolders.Count - installedFolders.Count} von {installFolders.Count} Spielinstallation(en).",
                InstalledPath = string.Join("; ", installFolders),
            };
        }

        return new PluginInstallationState
        {
            IsInstalled = true,
            StatusMessage = $"SCS-Telemetrie ist in {installedFolders.Count} Spielinstallation(en) einsatzbereit.",
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
                    if (!FilesMatch(bundledPlugin, targetPlugin))
                    {
                        File.Copy(bundledPlugin, targetPlugin, overwrite: true);
                    }
                    await TryWriteMarkerAsync(destinationFolder, "bundled:RenCloud-1.12.1", cancellationToken).ConfigureAwait(false);
                    installedPaths.Add(targetPlugin);
                }
                return new PluginInstallResult
                {
                    Success = true,
                    StatusMessage = $"SCS-Telemetrie in {installedPaths.Count} Spielinstallation(en) geprüft und einsatzbereit. Spiel bitte neu starten.",
                    InstalledPath = string.Join("; ", installedPaths),
                };
            }

            var existingPlugins = installFolders
                .Select(folder => Path.Combine(folder, "scs-telemetry.dll"))
                .Where(File.Exists)
                .ToList();
            if (existingPlugins.Count == installFolders.Count)
            {
                return new PluginInstallResult
                {
                    Success = true,
                    StatusMessage = $"SCS-Telemetrie ist bereits in {existingPlugins.Count} Spielinstallation(en) einsatzbereit.",
                    InstalledPath = string.Join("; ", existingPlugins),
                };
            }

            if (string.IsNullOrWhiteSpace(_downloadUrl))
            {
                return new PluginInstallResult
                {
                    ManualActionRequired = true,
                    Success = false,
                    StatusMessage = "Plugin-Datei fehlt im Client-Paket. Bitte Client neu installieren oder aktualisieren.",
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

            await TryWriteMarkerAsync(installFolder, _downloadUrl, cancellationToken).ConfigureAwait(false);

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
            var message = ex is UnauthorizedAccessException
                ? "Keine Schreibberechtigung im Steam-Spielordner. Client einmal als Administrator starten und erneut installieren."
                : ex.Message;
            return new PluginInstallResult
            {
                Success = false,
                StatusMessage = $"Plugin-Installation fehlgeschlagen: {message}",
                ManualActionRequired = true,
            };
        }
    }

    private static async Task TryWriteMarkerAsync(string installFolder, string source, CancellationToken cancellationToken)
    {
        var markerPath = Path.Combine(installFolder, "VTC-Hub-Plugin.installed");
        try
        {
            await File.WriteAllTextAsync(markerPath, JsonSerializer.Serialize(new
            {
                InstalledAt = DateTime.UtcNow,
                Source = source,
            }), cancellationToken).ConfigureAwait(false);
        }
        catch (UnauthorizedAccessException)
        {
            // The DLL itself is the source of truth. A marker must never turn a
            // successful/verified installation into a false failure.
        }
    }

    private static bool FilesMatch(string source, string target)
    {
        if (!File.Exists(target)) return false;
        var sourceInfo = new FileInfo(source);
        var targetInfo = new FileInfo(target);
        if (sourceInfo.Length != targetInfo.Length) return false;
        using var sourceStream = File.OpenRead(source);
        using var targetStream = File.OpenRead(target);
        return SHA256.HashData(sourceStream).AsSpan().SequenceEqual(SHA256.HashData(targetStream));
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
            .Select(root => NormalizePath(root!))
            .Where(Directory.Exists)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .SelectMany(ReadSteamLibraryRoots)
            .Select(NormalizePath)
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
            .Select(NormalizePath)
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string NormalizePath(string path) => Path.GetFullPath(
        path.Trim('"').Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar));
}
