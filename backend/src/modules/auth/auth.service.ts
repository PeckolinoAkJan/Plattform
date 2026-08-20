import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { compare as compareBcrypt } from "bcryptjs";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { GlobalRole, User } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";

@Injectable()
export class AuthService {
  private readonly localLoginPassword?: string;
  private readonly localLoginPasswordHash?: string;
  private readonly localLoginPasswordSalt?: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    const developmentLoginEnabled =
      this.configService.get<string>("NODE_ENV") !== "production";
    this.localLoginPassword = developmentLoginEnabled
      ? this.configService.get<string>("LOCAL_LOGIN_PASSWORD")?.trim()
      : undefined;
    this.localLoginPasswordHash = developmentLoginEnabled
      ? this.configService.get<string>("LOCAL_LOGIN_PASSWORD_HASH")?.trim()
      : undefined;
    this.localLoginPasswordSalt = this.configService
      .get<string>("LOCAL_LOGIN_PASSWORD_SALT")
      ?.trim();
  }

  sanitizeReturnTo(value: unknown): string {
    if (typeof value !== "string") {
      return "/dashboard";
    }

    if (!value.startsWith("/")) {
      return "/dashboard";
    }

    if (value.startsWith("//") || value.startsWith("/api/")) {
      return "/dashboard";
    }

    return value;
  }

  async loginWithEmailPassword(input: LocalLoginInput) {
    const email = this.normalizeEmail(input?.email);
    const password = `${input?.password ?? ""}`;

    if (!email || !password) {
      throw new BadRequestException("E-Mail und Passwort sind erforderlich.");
    }

    const user = await this.prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException("Ungültige Zugangsdaten.");
    }

    const userPasswordHash = user.passwordHash;
    if (typeof userPasswordHash === "string" && userPasswordHash.length > 0) {
      if (
        userPasswordHash.startsWith("$2") &&
        (await compareBcrypt(password, userPasswordHash))
      ) {
        return {
          token: this.generateToken(user),
          user,
        };
      }

      const expectedHash = this.hashPassword(
        password,
        this.localLoginPasswordSalt,
      );
      if (
        expectedHash &&
        this.compareStringConstantTime(expectedHash, userPasswordHash)
      ) {
        return {
          token: this.generateToken(user),
          user,
        };
      }
    }

    if (
      this.localLoginPassword &&
      this.compareStringConstantTime(password, this.localLoginPassword)
    ) {
      return {
        token: this.generateToken(user),
        user,
      };
    }

    if (this.localLoginPasswordHash) {
      const expectedHash = this.hashPassword(
        password,
        this.localLoginPasswordSalt,
      );
      if (
        expectedHash &&
        this.compareStringConstantTime(
          expectedHash,
          this.localLoginPasswordHash,
        )
      ) {
        return {
          token: this.generateToken(user),
          user,
        };
      }
    }

    throw new UnauthorizedException("Ungültige Zugangsdaten.");
  }

  async handleOAuthProfile(profile: SocialAuthProfile): Promise<User> {
    if (!profile.externalId?.trim()) {
      throw new BadRequestException("OAuth-Profile fehlt eine externe ID.");
    }

    const externalId = profile.externalId.trim();
    const existingAccount = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: externalId,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      return existingAccount.user;
    }

    if (profile.provider === "steam") {
      const legacySteam = await this.prisma.user.findFirst({
        where: { steamId: externalId },
      });

      if (legacySteam) {
        return this.linkSocialAccount(legacySteam, profile);
      }
    }

    const normalizedEmail = this.normalizeEmail(profile.email);
    if (normalizedEmail) {
      const byEmail = await this.prisma.user.findFirst({
        where: { email: normalizedEmail },
      });

      if (byEmail) {
        if (!profile.emailVerified) {
          throw new BadRequestException(
            "Der Anbieter hat diese E-Mail nicht verifiziert. Bitte verknüpfe den Anbieter im Profil.",
          );
        }
        return this.linkSocialAccount(byEmail, profile);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: profile.emailVerified ? normalizedEmail : null,
          steamId:
            profile.provider === "steam"
              ? externalId
              : `${profile.provider}:${externalId}`,
          displayName: this.getDisplayName(profile),
          avatarUrl: profile.avatarUrl,
          globalRoles: [GlobalRole.LONER],
          isPremium: false,
        },
      });
      await tx.socialAccount.create({
        data: {
          userId: user.id,
          provider: profile.provider,
          providerUserId: externalId,
          providerEmail: normalizedEmail,
          avatarUrl: profile.avatarUrl,
        },
      });
      return user;
    });
  }

  createOAuthFlow(
    provider: AuthProvider,
    query: Record<string, unknown>,
  ): OAuthFlowStart {
    const mode = query.client === "desktop" ? "desktop" : "web";
    const csrf = randomBytes(24).toString("base64url");
    const flow: OAuthFlowPayload = {
      kind: "oauth-flow",
      provider,
      mode,
      csrf,
      returnTo: this.sanitizeReturnTo(query.returnTo),
    };

    if (mode === "desktop") {
      flow.callback = this.validateDesktopCallback(query.callback);
      flow.challenge = this.validatePkceChallenge(query.challenge);
      flow.clientState = this.validateClientState(query.state);
    }

    return this.signOAuthFlow(flow);
  }

  createOAuthLinkFlow(
    provider: AuthProvider,
    query: Record<string, unknown>,
    userId: string,
  ): OAuthFlowStart {
    if (!userId)
      throw new UnauthorizedException(
        "Anmeldung fuer die Kontoverknuepfung fehlt.",
      );
    const flow: OAuthFlowPayload = {
      kind: "oauth-flow",
      provider,
      mode: "link",
      csrf: randomBytes(24).toString("base64url"),
      returnTo: this.sanitizeReturnTo(query.returnTo || "/dashboard/profile"),
      linkUserId: userId,
    };
    return this.signOAuthFlow(flow);
  }

  private signOAuthFlow(flow: OAuthFlowPayload): OAuthFlowStart {
    return {
      csrf: flow.csrf,
      token: this.jwtService.sign(flow, {
        secret: this.jwtSecret(),
        expiresIn: "10m",
        audience: "vtc-oauth-flow",
      }),
    };
  }

  verifyOAuthFlow(
    token: string | undefined,
    provider: AuthProvider,
    returnedState?: string,
  ): OAuthFlowPayload {
    if (!token)
      throw new UnauthorizedException("OAuth-Flow fehlt oder ist abgelaufen.");
    let flow: OAuthFlowPayload;
    try {
      flow = this.jwtService.verify<OAuthFlowPayload>(token, {
        secret: this.jwtSecret(),
        audience: "vtc-oauth-flow",
      });
    } catch {
      throw new UnauthorizedException(
        "OAuth-Flow ist ungueltig oder abgelaufen.",
      );
    }
    if (flow.kind !== "oauth-flow" || flow.provider !== provider)
      throw new UnauthorizedException("OAuth-Provider stimmt nicht ueberein.");
    if (flow.mode === "link" && !flow.linkUserId)
      throw new UnauthorizedException("Kontoverknuepfung ist unvollstaendig.");
    if (
      provider !== "steam" &&
      (!returnedState ||
        !this.compareStringConstantTime(returnedState, flow.csrf))
    ) {
      throw new UnauthorizedException("OAuth-State ist ungueltig.");
    }
    return flow;
  }

  async linkOAuthProfile(
    userId: string,
    profile: SocialAuthProfile,
  ): Promise<User> {
    const externalId = profile.externalId?.trim();
    if (!externalId)
      throw new BadRequestException("OAuth-Profile fehlt eine externe ID.");

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user)
        throw new UnauthorizedException(
          "Der angemeldete Benutzer wurde nicht gefunden.",
        );

      const existingAccount = await tx.socialAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider: profile.provider,
            providerUserId: externalId,
          },
        },
      });
      if (existingAccount?.userId === userId) return user;
      if (existingAccount)
        throw new BadRequestException(
          "Dieses Anbieter-Konto ist bereits mit einem anderen VTC-Hub-Konto verknuepft.",
        );

      const existingProvider = await tx.socialAccount.findFirst({
        where: { userId, provider: profile.provider },
      });
      if (existingProvider)
        throw new BadRequestException(
          `Mit ${profile.provider} ist bereits ein anderes Konto verknuepft.`,
        );

      if (profile.provider === "steam") {
        const steamOwner = await tx.user.findUnique({
          where: { steamId: externalId },
        });
        if (steamOwner && steamOwner.id !== userId) {
          throw new BadRequestException(
            "Dieses Steam-Konto ist bereits einem anderen VTC-Hub-Konto zugeordnet.",
          );
        }
      }

      await tx.socialAccount.create({
        data: {
          userId,
          provider: profile.provider,
          providerUserId: externalId,
          providerEmail: this.normalizeEmail(profile.email),
          avatarUrl: profile.avatarUrl,
        },
      });

      return tx.user.update({
        where: { id: userId },
        data: {
          steamId: profile.provider === "steam" ? externalId : undefined,
          avatarUrl: user.avatarUrl || profile.avatarUrl || undefined,
        },
      });
    });
  }

  async createDesktopLoginRedirect(
    flow: OAuthFlowPayload,
    user: User,
  ): Promise<string> {
    if (
      flow.mode !== "desktop" ||
      !flow.callback ||
      !flow.challenge ||
      !flow.clientState
    ) {
      throw new BadRequestException("Desktop-OAuth-Flow ist unvollstaendig.");
    }
    const code = randomBytes(32).toString("base64url");
    const key = `oauth-code:${sha256(code)}`;
    const stored = await this.redis.storeOneTime(
      key,
      JSON.stringify({
        token: this.generateToken(user),
        challenge: flow.challenge,
      }),
      120,
    );
    if (!stored)
      throw new InternalServerErrorException(
        "OAuth-Code konnte nicht gespeichert werden.",
      );
    const callback = new URL(flow.callback);
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", flow.clientState);
    return callback.toString();
  }

  async exchangeDesktopCode(
    code: unknown,
    verifier: unknown,
  ): Promise<{ token: string }> {
    if (
      typeof code !== "string" ||
      typeof verifier !== "string" ||
      code.length < 32 ||
      verifier.length < 43
    ) {
      throw new BadRequestException(
        "OAuth-Code oder PKCE-Verifier ist ungueltig.",
      );
    }
    const raw = await this.redis.takeOneTime(`oauth-code:${sha256(code)}`);
    if (!raw)
      throw new UnauthorizedException(
        "OAuth-Code ist ungueltig oder wurde bereits verwendet.",
      );
    const payload = JSON.parse(raw) as { token?: string; challenge?: string };
    const actualChallenge = createHash("sha256")
      .update(verifier)
      .digest("base64url");
    if (
      !payload.challenge ||
      !this.compareStringConstantTime(actualChallenge, payload.challenge) ||
      !payload.token
    ) {
      throw new UnauthorizedException("PKCE-Pruefung fehlgeschlagen.");
    }
    return { token: payload.token };
  }

  generateToken(user: User) {
    const secret = this.configService.get<string>("JWT_SECRET");
    if (!secret) {
      throw new InternalServerErrorException("JWT_SECRET ist nicht gesetzt.");
    }

    const payload = {
      userId: user.id,
      steamId: user.steamId,
      companyId: user.companyId,
      role: this.resolveRole(user),
      sub: user.id,
    };

    return this.jwtService.sign(payload, {
      secret,
    });
  }

  private compareStringConstantTime(lhs: string, rhs: string): boolean {
    const lhsBuffer = Buffer.from(lhs, "utf8");
    const rhsBuffer = Buffer.from(rhs, "utf8");

    if (lhsBuffer.length !== rhsBuffer.length) {
      return false;
    }

    return timingSafeEqual(lhsBuffer, rhsBuffer);
  }

  private hashPassword(raw: string, salt?: string): string {
    if (!salt) return "";
    return scryptSync(raw, salt, 64).toString("hex");
  }

  private resolveRole(user: User): string | null {
    if (user.companyRole) {
      return user.companyRole;
    }

    return user.globalRoles?.[0] ?? GlobalRole.LONER;
  }

  private normalizeEmail(value: string | undefined | null): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private getDisplayName(profile: SocialAuthProfile): string {
    if (profile.displayName?.trim()) {
      return profile.displayName.trim();
    }

    return `${profile.provider}-${profile.externalId}`;
  }

  private async linkSocialAccount(
    user: User,
    profile: SocialAuthProfile,
  ): Promise<User> {
    const externalId = profile.externalId.trim();
    const email = this.normalizeEmail(profile.email);
    return this.prisma.$transaction(async (tx) => {
      await tx.socialAccount.create({
        data: {
          userId: user.id,
          provider: profile.provider,
          providerUserId: externalId,
          providerEmail: email,
          avatarUrl: profile.avatarUrl,
        },
      });
      return tx.user.update({
        where: { id: user.id },
        data: {
          email: user.email || (profile.emailVerified ? email : undefined),
          displayName: user.displayName || this.getDisplayName(profile),
          avatarUrl: user.avatarUrl || profile.avatarUrl || undefined,
        },
      });
    });
  }

  private validateDesktopCallback(value: unknown): string {
    if (typeof value !== "string")
      throw new BadRequestException("Desktop-Callback fehlt.");
    let callback: URL;
    try {
      callback = new URL(value);
    } catch {
      throw new BadRequestException("Desktop-Callback ist ungueltig.");
    }
    if (
      callback.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(callback.hostname) ||
      !callback.port ||
      callback.username ||
      callback.password ||
      callback.hash
    ) {
      throw new BadRequestException(
        "Desktop-Callback muss eine lokale HTTP-Adresse mit Port sein.",
      );
    }
    return callback.toString();
  }

  private validatePkceChallenge(value: unknown): string {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(value))
      throw new BadRequestException("PKCE-Challenge ist ungueltig.");
    return value;
  }

  private validateClientState(value: unknown): string {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(value))
      throw new BadRequestException("Desktop-State ist ungueltig.");
    return value;
  }

  private jwtSecret(): string {
    const secret = this.configService.get<string>("JWT_SECRET");
    if (!secret)
      throw new InternalServerErrorException("JWT_SECRET ist nicht gesetzt.");
    return secret;
  }
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export type AuthProvider = "google" | "discord" | "steam";

export interface SocialAuthProfile {
  id: string;
  provider: AuthProvider;
  externalId: string;
  email?: string | null;
  emailVerified?: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface OAuthFlowStart {
  csrf: string;
  token: string;
}

export interface OAuthFlowPayload {
  kind: "oauth-flow";
  provider: AuthProvider;
  mode: "web" | "desktop" | "link";
  csrf: string;
  returnTo: string;
  callback?: string;
  challenge?: string;
  clientState?: string;
  linkUserId?: string;
}

interface LocalLoginInput {
  email: string;
  password: string;
}
