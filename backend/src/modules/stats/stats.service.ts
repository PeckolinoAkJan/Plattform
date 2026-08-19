import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  getLeaderboard(requestedLimit: number) {
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 25;
    return this.prisma.leaderboardSnapshot.findMany({
      orderBy: [{ generatedAt: "desc" }, { score: "desc" }],
      take: limit,
    });
  }
}
