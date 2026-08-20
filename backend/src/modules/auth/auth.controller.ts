import {
  BadRequestException,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Query,
  Req,
  Res,
  Post,
  Body,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { CookieOptions, Request, Response } from "express";
import { AuthProvider, AuthService, SocialAuthProfile } from "./auth.service";
import { LocalLoginDto } from "./dto/local-login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

const OAUTH_FLOW_COOKIE = "vtc_oauth_flow";

const isConfiguredValue = (value: string | undefined): boolean => {
  const normalized = value?.trim();
  if (!normalized) return false;
  return !/^(?:oauth-disabled|your_|change_me|replace_with)/i.test(normalized);
};

const ensureProviderConfigured = (
  config: ConfigService,
  keys: string[],
): void => {
  if (!keys.every((key) => isConfiguredValue(config.get<string>(key)))) {
    throw new BadRequestException(
      "Dieser OAuth-Anbieter ist noch nicht konfiguriert.",
    );
  }
};

const flowCookieOptions = (config: ConfigService): CookieOptions => ({
  httpOnly: true,
  secure: config.get<string>("NODE_ENV") === "production",
  sameSite: "lax",
  domain: config.get<string>("OAUTH_COOKIE_DOMAIN") || undefined,
  path: "/api/auth",
  maxAge: 10 * 60 * 1000,
});

@Injectable()
export class GoogleLoginGuard extends AuthGuard("google") {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    ensureProviderConfigured(this.config, [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
    ]);
    const req = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const flow = this.authService.createOAuthFlow(
      "google",
      req.query as Record<string, unknown>,
    );
    response.cookie(
      OAUTH_FLOW_COOKIE,
      flow.token,
      flowCookieOptions(this.config),
    );
    return {
      scope: ["openid", "email", "profile"],
      state: flow.csrf,
      session: false,
    };
  }
}

@Injectable()
export class DiscordLoginGuard extends AuthGuard("discord") {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    ensureProviderConfigured(this.config, [
      "DISCORD_CLIENT_ID",
      "DISCORD_CLIENT_SECRET",
    ]);
    const req = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const flow = this.authService.createOAuthFlow(
      "discord",
      req.query as Record<string, unknown>,
    );
    response.cookie(
      OAUTH_FLOW_COOKIE,
      flow.token,
      flowCookieOptions(this.config),
    );
    return {
      scope: ["identify", "email"],
      state: flow.csrf,
      session: false,
    };
  }
}

@Injectable()
export class SteamLoginGuard extends AuthGuard("steam") {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    ensureProviderConfigured(this.config, ["STEAM_API_KEY"]);
    const req = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const flow = this.authService.createOAuthFlow(
      "steam",
      req.query as Record<string, unknown>,
    );
    response.cookie(
      OAUTH_FLOW_COOKIE,
      flow.token,
      flowCookieOptions(this.config),
    );
    return { session: false };
  }
}

const linkedUserId = (
  request: Request & { user?: { userId?: string } },
): string => {
  const userId = request.user?.userId;
  if (!userId)
    throw new UnauthorizedException(
      "Anmeldung fuer die Kontoverknuepfung fehlt.",
    );
  return userId;
};

@Injectable()
export class GoogleLinkGuard extends AuthGuard("google") {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    ensureProviderConfigured(this.config, [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
    ]);
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { userId?: string } }>();
    const response = context.switchToHttp().getResponse<Response>();
    const flow = this.authService.createOAuthLinkFlow(
      "google",
      req.query as Record<string, unknown>,
      linkedUserId(req),
    );
    response.cookie(
      OAUTH_FLOW_COOKIE,
      flow.token,
      flowCookieOptions(this.config),
    );
    return {
      scope: ["openid", "email", "profile"],
      state: flow.csrf,
      session: false,
    };
  }
}

@Injectable()
export class DiscordLinkGuard extends AuthGuard("discord") {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    ensureProviderConfigured(this.config, [
      "DISCORD_CLIENT_ID",
      "DISCORD_CLIENT_SECRET",
    ]);
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { userId?: string } }>();
    const response = context.switchToHttp().getResponse<Response>();
    const flow = this.authService.createOAuthLinkFlow(
      "discord",
      req.query as Record<string, unknown>,
      linkedUserId(req),
    );
    response.cookie(
      OAUTH_FLOW_COOKIE,
      flow.token,
      flowCookieOptions(this.config),
    );
    return { scope: ["identify", "email"], state: flow.csrf, session: false };
  }
}

@Injectable()
export class SteamLinkGuard extends AuthGuard("steam") {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    ensureProviderConfigured(this.config, ["STEAM_API_KEY"]);
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { userId?: string } }>();
    const response = context.switchToHttp().getResponse<Response>();
    const flow = this.authService.createOAuthLinkFlow(
      "steam",
      req.query as Record<string, unknown>,
      linkedUserId(req),
    );
    response.cookie(
      OAUTH_FLOW_COOKIE,
      flow.token,
      flowCookieOptions(this.config),
    );
    return { session: false };
  }
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get("google/login")
  @UseGuards(GoogleLoginGuard)
  googleLogin(): void {
    return;
  }

  @Get("google/link")
  @UseGuards(JwtAuthGuard, GoogleLinkGuard)
  googleLink(): void {
    return;
  }

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleCallback(
    @Req() req: Request & { user?: SocialAuthProfile | null },
    @Query("state") state: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = req.user;
    if (!user?.externalId) {
      throw new BadRequestException("OAuth login failed: missing user data.");
    }

    await this.completeOAuth(response, req, user, "google", state);
  }

  @Get("discord/login")
  @UseGuards(DiscordLoginGuard)
  discordLogin(): void {
    return;
  }

  @Get("discord/link")
  @UseGuards(JwtAuthGuard, DiscordLinkGuard)
  discordLink(): void {
    return;
  }

  @Get("discord/callback")
  @UseGuards(AuthGuard("discord"))
  async discordCallback(
    @Req() req: Request & { user?: SocialAuthProfile | null },
    @Query("state") state: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = req.user;
    if (!user?.externalId) {
      throw new BadRequestException("OAuth login failed: missing user data.");
    }

    await this.completeOAuth(response, req, user, "discord", state);
  }

  @Get("steam/login")
  @UseGuards(SteamLoginGuard)
  steamLogin(): void {
    return;
  }

  @Get("steam/link")
  @UseGuards(JwtAuthGuard, SteamLinkGuard)
  steamLink(): void {
    return;
  }

  @Post("login")
  async login(@Body() body: LocalLoginDto) {
    const result = await this.authService.loginWithEmailPassword({
      email: body?.email ?? "",
      password: body?.password ?? "",
    });
    const safeUser = result.user
      ? {
          id: result.user.id,
          email: result.user.email,
          companyId: result.user.companyId,
          profileVisibility: result.user.profileVisibility,
          role: result.user.companyRole ?? result.user.globalRoles?.[0] ?? null,
        }
      : null;

    return {
      token: result.token,
      user: safeUser,
      returnTo: this.authService.sanitizeReturnTo(body?.returnTo),
    };
  }

  @Get("steam/callback")
  @UseGuards(AuthGuard("steam"))
  async steamCallback(
    @Req() req: Request & { user?: SocialAuthProfile | null },
    @Res() response: Response,
  ): Promise<void> {
    const user = req.user;
    if (!user?.externalId) {
      throw new BadRequestException("OAuth login failed: missing user data.");
    }

    await this.completeOAuth(response, req, user, "steam");
  }

  @Post("desktop/exchange")
  exchangeDesktopCode(@Body() body: { code?: unknown; verifier?: unknown }) {
    return this.authService.exchangeDesktopCode(body?.code, body?.verifier);
  }

  @Get("providers")
  providers() {
    return {
      google:
        isConfiguredValue(this.config.get<string>("GOOGLE_CLIENT_ID")) &&
        isConfiguredValue(this.config.get<string>("GOOGLE_CLIENT_SECRET")),
      discord:
        isConfiguredValue(this.config.get<string>("DISCORD_CLIENT_ID")) &&
        isConfiguredValue(this.config.get<string>("DISCORD_CLIENT_SECRET")),
      steam: isConfiguredValue(this.config.get<string>("STEAM_API_KEY")),
    };
  }

  private async completeOAuth(
    response: Response,
    request: Request,
    profile: SocialAuthProfile,
    provider: AuthProvider,
    returnedState?: string,
  ): Promise<void> {
    const flow = this.authService.verifyOAuthFlow(
      this.readCookie(request, OAUTH_FLOW_COOKIE),
      provider,
      returnedState,
    );
    response.clearCookie(OAUTH_FLOW_COOKIE, this.flowCookieClearOptions());
    const frontend = this.config.get<string>(
      "FRONTEND_URL",
      "http://localhost:3000",
    );
    if (flow.mode === "link") {
      await this.authService.linkOAuthProfile(flow.linkUserId!, profile);
      const target = new URL(flow.returnTo, frontend);
      target.searchParams.set("linked", provider);
      response.redirect(target.toString());
      return;
    }

    const user = await this.authService.handleOAuthProfile(profile);
    if (flow.mode === "desktop") {
      response.redirect(
        await this.authService.createDesktopLoginRedirect(flow, user),
      );
      return;
    }

    const token = this.authService.generateToken(user);
    const production = this.config.get<string>("NODE_ENV") === "production";
    const domain = this.config.get<string>("OAUTH_COOKIE_DOMAIN") || undefined;
    response.cookie("vtc_session", token, {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      domain,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    response.redirect(new URL(flow.returnTo, frontend).toString());
  }

  private readCookie(request: Request, name: string): string | undefined {
    const raw = request.headers.cookie;
    if (!raw) return undefined;
    for (const part of raw.split(";")) {
      const separator = part.indexOf("=");
      if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private flowCookieClearOptions(): CookieOptions {
    const { maxAge: _maxAge, ...options } = flowCookieOptions(this.config);
    return options;
  }
}
