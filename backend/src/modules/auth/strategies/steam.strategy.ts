import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy as SteamStrategyBase } from "passport-steam";
import { SocialAuthProfile } from "../auth.service";

@Injectable()
export class SteamStrategy extends PassportStrategy(
  SteamStrategyBase,
  "steam",
) {
  constructor(configService: ConfigService) {
    const steamApiKey =
      configService.get<string>("STEAM_API_KEY") || "oauth-disabled";

    const returnURL =
      configService.get<string>("STEAM_CALLBACK_URL") ??
      `${configService.get<string>("BACKEND_URL") ?? "http://localhost:3001"}/api/auth/steam/callback`;

    const realm =
      configService.get<string>("STEAM_REALM") ?? new URL(returnURL).origin;

    super({
      returnURL,
      realm,
      apiKey: steamApiKey,
    });
  }

  validate(
    identifier: string,
    profile: Record<string, any>,
  ): SocialAuthProfile {
    const steamId = this.extractSteamId(identifier, profile);

    const userProfile: SocialAuthProfile = {
      id: steamId,
      provider: "steam",
      externalId: steamId,
      email: null,
      emailVerified: false,
      displayName:
        profile.personaname ||
        profile.displayName ||
        profile.steamid ||
        steamId,
      avatarUrl:
        profile.avatarfull || profile.avatarmedium || profile.avatar || null,
    };

    return userProfile;
  }

  private extractSteamId(
    identifier: string,
    profile: Record<string, any>,
  ): string {
    return (
      profile.steamid ||
      profile.id ||
      identifier.split("/").at(-1) ||
      identifier
    );
  }
}
