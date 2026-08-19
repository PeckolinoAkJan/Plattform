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
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { CookieOptions, Request, Response } from "express";
import { User } from "@prisma/client";
import { AuthProvider, AuthService } from "./auth.service";
import { LocalLoginDto } from "./dto/local-login.dto";

const OAUTH_FLOW_COOKIE = "vtc_oauth_flow";

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
  constructor(private readonly authService: AuthService, private readonly config: ConfigService) { super(); }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const flow = this.authService.createOAuthFlow("google", req.query as Record<string, unknown>);
    response.cookie(OAUTH_FLOW_COOKIE, flow.token, flowCookieOptions(this.config));
    return {
      scope: ["openid", "email", "profile"],
      state: flow.csrf,
      session: false,
    };
  }
}

@Injectable()
export class DiscordLoginGuard extends AuthGuard("discord") {
  constructor(private readonly authService: AuthService, private readonly config: ConfigService) { super(); }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const flow = this.authService.createOAuthFlow("discord", req.query as Record<string, unknown>);
    response.cookie(OAUTH_FLOW_COOKIE, flow.token, flowCookieOptions(this.config));
    return {
      scope: ["identify", "email"],
      state: flow.csrf,
      session: false,
    };
  }
}

@Injectable()
export class SteamLoginGuard extends AuthGuard("steam") {
  constructor(private readonly authService: AuthService, private readonly config: ConfigService) { super(); }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const flow = this.authService.createOAuthFlow("steam", req.query as Record<string, unknown>);
    response.cookie(OAUTH_FLOW_COOKIE, flow.token, flowCookieOptions(this.config));
    return { session: false };
  }
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly config: ConfigService) {}

  @Get("google/login")
  @UseGuards(GoogleLoginGuard)
  googleLogin(): void {
    return;
  }

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleCallback(
    @Req() req: Request & { user?: User | null },
    @Query("state") state: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = req.user;
    if (!user || !("id" in user)) {
      throw new BadRequestException("OAuth login failed: missing user data.");
    }

    await this.completeOAuth(response, req, user, "google", state);
  }

  @Get("discord/login")
  @UseGuards(DiscordLoginGuard)
  discordLogin(): void {
    return;
  }

  @Get("discord/callback")
  @UseGuards(AuthGuard("discord"))
  async discordCallback(
    @Req() req: Request & { user?: User | null },
    @Query("state") state: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = req.user;
    if (!user || !("id" in user)) {
      throw new BadRequestException("OAuth login failed: missing user data.");
    }

    await this.completeOAuth(response, req, user, "discord", state);
  }

  @Get("steam/login")
  @UseGuards(SteamLoginGuard)
  steamLogin(): void {
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
    @Req() req: Request & { user?: User | null },
    @Res() response: Response,
  ): Promise<void> {
    const user = req.user;
    if (!user || !("id" in user)) {
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
    const configured = (key: string) => {
      const value = this.config.get<string>(key)?.trim();
      return Boolean(value && value !== "oauth-disabled" && !value.startsWith("your_"));
    };
    return {
      google: configured("GOOGLE_CLIENT_ID") && configured("GOOGLE_CLIENT_SECRET"),
      discord: configured("DISCORD_CLIENT_ID") && configured("DISCORD_CLIENT_SECRET"),
      steam: configured("STEAM_API_KEY"),
    };
  }

  private async completeOAuth(
    response: Response,
    request: Request,
    user: User,
    provider: AuthProvider,
    returnedState?: string,
  ): Promise<void> {
    const flow = this.authService.verifyOAuthFlow(this.readCookie(request, OAUTH_FLOW_COOKIE), provider, returnedState);
    response.clearCookie(OAUTH_FLOW_COOKIE, this.flowCookieClearOptions());
    if (flow.mode === "desktop") {
      response.redirect(await this.authService.createDesktopLoginRedirect(flow, user));
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
    const frontend = this.config.get<string>("FRONTEND_URL", "http://localhost:3000");
    response.redirect(new URL(flow.returnTo, frontend).toString());
  }

  private readCookie(request: Request, name: string): string | undefined {
    const raw = request.headers.cookie;
    if (!raw) return undefined;
    for (const part of raw.split(";")) {
      const separator = part.indexOf("=");
      if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
    return undefined;
  }

  private flowCookieClearOptions(): CookieOptions {
    const { maxAge: _maxAge, ...options } = flowCookieOptions(this.config);
    return options;
  }
}
