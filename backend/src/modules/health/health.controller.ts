import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  @Get()
  async check() {
    try {
      await Promise.all([this.prisma.$queryRaw`SELECT 1`, this.redis.ping()]);
      return { status: "ok", database: "up", redis: "up", timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: "degraded", database: "unknown", redis: "unknown" });
    }
  }
}
