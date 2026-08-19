import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt } from "passport-jwt";
import { Strategy as PassportJwtStrategy } from "passport-jwt";

export interface JwtPayload {
  userId: string;
  steamId: string;
  role?: string;
  companyId?: string;
}

const sessionCookieExtractor = (request: { headers?: { cookie?: string } } | undefined): string | null => {
  const cookieHeader = request?.headers?.cookie;
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== "vtc_session") {
      continue;
    }

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(PassportJwtStrategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>("JWT_SECRET");
    if (!secret) {
      throw new Error("JWT_SECRET ist nicht gesetzt.");
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        sessionCookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload) {
    if (!payload?.userId) {
      throw new UnauthorizedException("Ungültiger JWT-Payload.");
    }

    return {
      userId: payload.userId,
      role: payload.role,
      companyId: payload.companyId,
      steamId: payload.steamId,
    };
  }
}
