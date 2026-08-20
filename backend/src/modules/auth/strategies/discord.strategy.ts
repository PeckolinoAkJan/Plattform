import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy as OAuth2Strategy } from "passport-oauth2";
import { SocialAuthProfile } from "../auth.service";

type DiscordProfile = {
  id: string;
  username?: string;
  global_name?: string;
  avatar?: string;
  email?: string;
  verified?: boolean;
};

class DiscordOAuth2Strategy extends OAuth2Strategy {
  override userProfile(
    accessToken: string,
    done: (error: Error | null, profile?: DiscordProfile) => void,
  ): void {
    void fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "VTC-Hub/1.0",
      },
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            `Discord profile request failed with ${response.status}`,
          );
        return response.json() as Promise<DiscordProfile>;
      })
      .then((profile) => done(null, profile))
      .catch((error: unknown) =>
        done(
          error instanceof Error
            ? error
            : new Error("Discord profile request failed"),
        ),
      );
  }
}

@Injectable()
export class DiscordStrategy extends PassportStrategy(
  DiscordOAuth2Strategy,
  "discord",
) {
  constructor(configService: ConfigService) {
    const clientId =
      configService.get<string>("DISCORD_CLIENT_ID") || "oauth-disabled";
    const clientSecret =
      configService.get<string>("DISCORD_CLIENT_SECRET") || "oauth-disabled";

    const callbackUrl =
      configService.get<string>("DISCORD_CALLBACK_URL") ??
      `${configService.get<string>("BACKEND_URL") ?? "http://localhost:3001"}/api/auth/discord/callback`;

    super({
      clientID: clientId,
      clientSecret,
      callbackURL: callbackUrl,
      authorizationURL: "https://discord.com/oauth2/authorize",
      tokenURL: "https://discord.com/api/oauth2/token",
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: DiscordProfile,
  ): SocialAuthProfile {
    const userProfile: SocialAuthProfile = {
      id: profile.id,
      provider: "discord",
      externalId: profile.id,
      email: profile.email ?? null,
      emailVerified: profile.verified === true,
      displayName: profile.global_name || profile.username,
      avatarUrl: this.resolveAvatar(profile),
    };

    return userProfile;
  }

  private resolveAvatar(profile: DiscordProfile): string | null {
    if (!profile.id || !profile.avatar) {
      return null;
    }

    return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
  }
}
