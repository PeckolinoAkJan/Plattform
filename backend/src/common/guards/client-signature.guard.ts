import { createHmac, timingSafeEqual } from "node:crypto";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class ClientSignatureGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headerSignature = this.getHeaderValue(
      request.headers["x-client-signature"],
    );
    const headerTimestamp = this.getHeaderValue(request.headers["x-timestamp"]);
    const headerNonce = this.getHeaderValue(request.headers["x-nonce"]);

    if (!headerSignature || !headerTimestamp || !headerNonce) {
      throw new ForbiddenException("Invalid client signature");
    }

    const authorization = this.getHeaderValue(request.headers.authorization);
    const secret = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : undefined;

    if (!secret) {
      throw new ForbiddenException("Invalid client signature");
    }

    if (!/^\d{10}$/.test(headerTimestamp) || headerNonce.length < 16 || headerNonce.length > 128) {
      throw new ForbiddenException("Request expired");
    }
    const requestTimestamp = Number(headerTimestamp);

    if (!Number.isFinite(requestTimestamp)) {
      throw new ForbiddenException("Request expired");
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - requestTimestamp) > 60) {
      throw new ForbiddenException("Request expired");
    }

    const payload = request.body ?? {};
    const payloadString = JSON.stringify(payload);
    const signedPayload = `${payloadString}${headerTimestamp}${headerNonce}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    let expectedBuffer: Buffer;
    let receivedBuffer: Buffer;

    try {
      if (!/^[a-fA-F0-9]{64}$/.test(headerSignature)) throw new Error("Malformed signature");
      expectedBuffer = Buffer.from(expectedSignature, "hex");
      receivedBuffer = Buffer.from(headerSignature, "hex");
    } catch {
      throw new ForbiddenException("Invalid client signature");
    }

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new ForbiddenException("Invalid client signature");
    }

    const nonceKey = `client-signature:nonce:${headerNonce}`;
    const claimed = await this.redis.claimNonce(nonceKey, 60);
    if (!claimed) {
      throw new ForbiddenException("Replay attack detected");
    }

    return true;
  }

  private getHeaderValue(
    headerValue: string | string[] | undefined,
  ): string | undefined {
    if (!headerValue) {
      return undefined;
    }

    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }

    return headerValue;
  }
}
