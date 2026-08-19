import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { StatsService } from "./stats.service";

@Controller("stats")
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get("leaderboards")
  @UseGuards(JwtAuthGuard)
  leaderboards(@Query("limit") limit?: string) {
    return this.stats.getLeaderboard(Number(limit));
  }
}
