import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy as PassportGoogleStrategy } from "passport-google-oauth20";
import { AuthService, SocialAuthProfile } from "../auth.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(PassportGoogleStrategy, "google") {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const clientId = configService.get<string>("GOOGLE_CLIENT_ID") || "oauth-disabled";
    const clientSecret = configService.get<string>("GOOGLE_CLIENT_SECRET") || "oauth-disabled";

    const callbackUrl =
      configService.get<string>("GOOGLE_CALLBACK_URL") ??
      `${configService.get<string>("BACKEND_URL") ?? "http://localhost:3001"}/api/auth/google/callback`;

    super({
      clientID: clientId,
      clientSecret,
      callbackURL: callbackUrl,
      session: false,
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile): Promise<any> {
    const userProfile: SocialAuthProfile = {
      id: profile.id,
      provider: "google",
      externalId: profile.id,
      email: this.resolveEmail(profile),
      emailVerified: (profile._json as { email_verified?: boolean } | undefined)?.email_verified === true,
      displayName: profile.displayName,
      avatarUrl: this.resolveAvatar(profile),
    };

    return this.authService.handleOAuthProfile(userProfile);
  }

  private resolveEmail(profile: Profile): string | null {
    const email = profile.emails?.at(0)?.value;
    return email ?? null;
  }

  private resolveAvatar(profile: Profile): string | null {
    const image = profile.photos?.at(0)?.value;
    return image ?? null;
  }
}
