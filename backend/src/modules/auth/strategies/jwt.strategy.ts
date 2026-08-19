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

@Injectable()
export class JwtStrategy extends PassportStrategy(PassportJwtStrategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>("JWT_SECRET");
    if (!secret) {
      throw new Error("JWT_SECRET ist nicht gesetzt.");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
