using System;
using System.Globalization;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace VtcDesktopClient;

public sealed class ApiClient
{
    private readonly HttpClient _httpClient;

    public string BaseUrl { get; }

    public string JwtToken { get; set; }

    public ApiClient(string baseUrl, string jwtToken)
    {
        BaseUrl = NormalizeBaseUrl(baseUrl);
        JwtToken = jwtToken?.Trim() ?? string.Empty;

        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(BaseUrl),
            Timeout = TimeSpan.FromSeconds(20),
        };
    }

    public async Task SendTripDataAsync(TripData payload, CancellationToken cancellationToken = default)
    {
        var backendPayload = new
        {
            game = payload.Game ?? "ETS2",
            cargo = payload.Cargo ?? "Unbekannt",
            sourceCity = payload.SourceCity ?? "Unbekannt",
            destinationCity = payload.DestinationCity ?? "Unbekannt",
            truckModel = payload.Truck ?? payload.TruckModel ?? "Unbekannt",
            distanceKm = Math.Max(payload.DistanceKm, 0),
            maxSpeedKmh = payload.MaxSpeedKmh ?? payload.SpeedKmh,
            fuelConsumed = payload.FuelConsumed,
            damage = Math.Max(payload.DamagePct, 0),
            isWotr = payload.IsWotr,
        };

        var response = await SendAsync("/api/logbook/submit", backendPayload, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
    }

    public async Task<bool> LoginAsync(string email, string password, CancellationToken cancellationToken = default)
    {
        var json = JsonSerializer.Serialize(new { email, password, returnTo = "/dashboard" }, ApiJson.Default);
        using var response = await _httpClient.PostAsync("/api/auth/login", new StringContent(json, Encoding.UTF8, "application/json"), cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) return false;
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken).ConfigureAwait(false);
        if (!document.RootElement.TryGetProperty("token", out var tokenNode)) return false;
        var token = tokenNode.GetString();
        if (string.IsNullOrWhiteSpace(token)) return false;
        JwtToken = token;
        ClientSessionStore.SaveToken(token);
        return true;
    }

    public async Task<bool> LoginWithProviderAsync(string provider, CancellationToken cancellationToken = default)
    {
        provider = provider?.Trim().ToLowerInvariant() ?? string.Empty;
        if (provider is not ("google" or "discord" or "steam"))
            throw new ArgumentOutOfRangeException(nameof(provider), "Unsupported login provider.");

        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var callback = $"http://127.0.0.1:{port}/oauth/callback";
        var state = Base64Url(RandomNumberGenerator.GetBytes(24));
        var verifier = Base64Url(RandomNumberGenerator.GetBytes(48));
        var challenge = Base64Url(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        var loginUrl = new Uri(
            new Uri(BaseUrl),
            $"api/auth/{provider}/login?client=desktop&callback={Uri.EscapeDataString(callback)}&state={Uri.EscapeDataString(state)}&challenge={Uri.EscapeDataString(challenge)}");

        Process.Start(new ProcessStartInfo(loginUrl.AbsoluteUri) { UseShellExecute = true });

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromMinutes(3));
        using var browser = await listener.AcceptTcpClientAsync(timeout.Token).ConfigureAwait(false);
        await using var stream = browser.GetStream();
        using var reader = new StreamReader(stream, Encoding.ASCII, false, 1024, leaveOpen: true);
        var requestLine = await reader.ReadLineAsync(timeout.Token).ConfigureAwait(false);
        string? headerLine;
        do { headerLine = await reader.ReadLineAsync(timeout.Token).ConfigureAwait(false); }
        while (!string.IsNullOrEmpty(headerLine));

        var target = requestLine?.Split(' ', StringSplitOptions.RemoveEmptyEntries).ElementAtOrDefault(1);
        var callbackUri = target is null ? null : new Uri(new Uri($"http://127.0.0.1:{port}"), target);
        var query = callbackUri is null ? new Dictionary<string, string>() : ParseQuery(callbackUri.Query);
        var valid = query.TryGetValue("code", out var code)
                    && query.TryGetValue("state", out var returnedState)
                    && FixedTimeEquals(state, returnedState);

        await WriteBrowserResponseAsync(stream, valid, timeout.Token).ConfigureAwait(false);
        if (!valid || string.IsNullOrWhiteSpace(code)) return false;

        var exchangeJson = JsonSerializer.Serialize(new { code, verifier }, ApiJson.Default);
        using var exchange = await _httpClient.PostAsync(
            "/api/auth/desktop/exchange",
            new StringContent(exchangeJson, Encoding.UTF8, "application/json"),
            timeout.Token).ConfigureAwait(false);
        if (!exchange.IsSuccessStatusCode) return false;
        await using var responseStream = await exchange.Content.ReadAsStreamAsync(timeout.Token).ConfigureAwait(false);
        using var document = await JsonDocument.ParseAsync(responseStream, cancellationToken: timeout.Token).ConfigureAwait(false);
        var token = document.RootElement.TryGetProperty("token", out var tokenNode) ? tokenNode.GetString() : null;
        if (string.IsNullOrWhiteSpace(token)) return false;
        JwtToken = token;
        ClientSessionStore.SaveToken(token);
        return true;
    }

    public async Task<IReadOnlyDictionary<string, bool>> GetProviderAvailabilityAsync(CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync("/api/auth/providers", cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) return new Dictionary<string, bool>();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        return await JsonSerializer.DeserializeAsync<Dictionary<string, bool>>(stream, ApiJson.Default, cancellationToken).ConfigureAwait(false)
               ?? new Dictionary<string, bool>();
    }

    public async Task<bool> CheckHealthAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            using var response = await _httpClient.GetAsync("/api/health", cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode) return false;
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken).ConfigureAwait(false);
            var root = document.RootElement;
            var status = root.TryGetProperty("status", out var statusNode) ? statusNode.GetString() : null;
            var database = root.TryGetProperty("database", out var databaseNode) ? databaseNode.GetString() : null;
            var redis = root.TryGetProperty("redis", out var redisNode) ? redisNode.GetString() : null;
            return string.Equals(status, "ok", StringComparison.OrdinalIgnoreCase)
                   && string.Equals(database, "up", StringComparison.OrdinalIgnoreCase)
                   && string.Equals(redis, "up", StringComparison.OrdinalIgnoreCase);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return false;
        }
        catch (HttpRequestException)
        {
            return false;
        }
    }

    public async Task<ApiUserProfile?> GetCurrentUserAsync(CancellationToken cancellationToken = default)
    {
        var token = JwtToken?.Trim();
        if (string.IsNullOrWhiteSpace(token)) return null;
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/users/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) return null;
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken).ConfigureAwait(false);
        var displayName = document.RootElement.TryGetProperty("displayName", out var displayNameNode)
            ? displayNameNode.GetString()
            : null;
        if (string.IsNullOrWhiteSpace(displayName)) return null;
        return new ApiUserProfile(displayName);
    }

    public async Task SendLiveLocationAsync(LocationData payload, CancellationToken cancellationToken = default)
    {
        var response = await SendAsync("/api/map/update-telemetry", payload, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
    }

    public async Task<IReadOnlyList<ChatMessageItem>> GetChatMessagesAsync(
        int limit = 100,
        CancellationToken cancellationToken = default)
    {
        var token = JwtToken?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(token)) throw new InvalidOperationException("Anmeldung erforderlich.");

        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/chat/messages?limit={Math.Clamp(limit, 1, 200)}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        var result = await JsonSerializer.DeserializeAsync<ChatMessagesResponse>(stream, ApiJson.Default, cancellationToken).ConfigureAwait(false);
        return result?.Messages ?? [];
    }

    public async Task SendChatMessageAsync(string body, CancellationToken cancellationToken = default)
    {
        using var response = await SendAsync("/api/chat/messages", new { body = body.Trim() }, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
    }

    private async Task<HttpResponseMessage> SendAsync<T>(string path, T payload, CancellationToken cancellationToken)
    {
        var token = JwtToken?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Anmeldung erforderlich.");
        }

        var rawPayload = JsonSerializer.Serialize(payload, ApiJson.Default);
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        var nonce = Guid.NewGuid().ToString("N", CultureInfo.InvariantCulture);
        var signature = ComputeSignature(rawPayload, timestamp, nonce, token);

        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = new StringContent(rawPayload, Encoding.UTF8, "application/json"),
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.TryAddWithoutValidation("x-timestamp", timestamp);
        request.Headers.TryAddWithoutValidation("x-nonce", nonce);
        request.Headers.TryAddWithoutValidation("x-client-signature", signature);

        return await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    private static string ComputeSignature(string body, string timestamp, string nonce, string signingKey)
    {
        var signingPayload = $"{body}{timestamp}{nonce}";

        var secretBytes = Encoding.UTF8.GetBytes(signingKey);
        var payloadBytes = Encoding.UTF8.GetBytes(signingPayload);

        using var hmac = new HMACSHA256(secretBytes);
        var hash = hmac.ComputeHash(payloadBytes);

        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string NormalizeBaseUrl(string baseUrl)
    {
        var trimmed = baseUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return "http://localhost:3001/";
        }

        return trimmed.EndsWith('/') ? trimmed : trimmed + '/';
    }

    private static string Base64Url(byte[] value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static bool FixedTimeEquals(string expected, string actual)
    {
        var left = Encoding.UTF8.GetBytes(expected);
        var right = Encoding.UTF8.GetBytes(actual);
        return left.Length == right.Length && CryptographicOperations.FixedTimeEquals(left, right);
    }

    private static Dictionary<string, string> ParseQuery(string query)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            result[Uri.UnescapeDataString(parts[0])] = Uri.UnescapeDataString(parts.Length > 1 ? parts[1].Replace('+', ' ') : string.Empty);
        }
        return result;
    }

    private static async Task WriteBrowserResponseAsync(NetworkStream stream, bool success, CancellationToken cancellationToken)
    {
        var title = success ? "VTC Hub login completed" : "VTC Hub login failed";
        var body = $"<!doctype html><html><head><meta charset=\"utf-8\"><title>{title}</title></head><body style=\"background:#090b0d;color:#f2cd67;font-family:Segoe UI;text-align:center;padding:64px\"><h1>{title}</h1><p>You can close this window and return to the desktop client.</p></body></html>";
        var bodyBytes = Encoding.UTF8.GetBytes(body);
        var headers = Encoding.ASCII.GetBytes($"HTTP/1.1 {(success ? "200 OK" : "400 Bad Request")}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {bodyBytes.Length}\r\nConnection: close\r\n\r\n");
        await stream.WriteAsync(headers, cancellationToken).ConfigureAwait(false);
        await stream.WriteAsync(bodyBytes, cancellationToken).ConfigureAwait(false);
        await stream.FlushAsync(cancellationToken).ConfigureAwait(false);
    }

    private static class ApiJson
    {
        public static readonly JsonSerializerOptions Default = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false,
        };
    }
}

public sealed record ApiUserProfile(string DisplayName);

public sealed class ChatMessagesResponse
{
    public List<ChatMessageItem> Messages { get; init; } = [];
}

public sealed class ChatMessageItem
{
    public string Id { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public DateTimeOffset CreatedAt { get; init; }
    public ChatMessageSender Sender { get; init; } = new();
}

public sealed class ChatMessageSender
{
    public string Id { get; init; } = string.Empty;
    public string DisplayName { get; init; } = "Unbekannter Fahrer";
    public string? AvatarUrl { get; init; }
    public string? CompanyRole { get; init; }
}
