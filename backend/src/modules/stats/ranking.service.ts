import { Injectable } from "@nestjs/common";
import { AggregationScope, TripMode } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

interface LeaderboardRow {
  totalDistance: number;
  totalTrips: number;
  rank: number;
}

@Injectable()
export class RankingService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompanyLeaderboard(month: number, year: number) {
    const period = this.getMonthWindow(month, year);
    const trips = await this.prisma.tripRecord.findMany({
      where: { createdAt: { gte: period.from, lt: period.to }, mode: { in: [TripMode.REAL, TripMode.RACE] } },
      select: { distanceKm: true, user: { select: { companyId: true, company: { select: { name: true } } } } },
    });
    const totals = new Map<string, { companyName: string | null; totalDistance: number; totalTrips: number }>();
    for (const trip of trips) {
      const id = trip.user.companyId;
      if (!id) continue;
      const current = totals.get(id) ?? { companyName: trip.user.company?.name ?? null, totalDistance: 0, totalTrips: 0 };
      current.totalDistance += trip.distanceKm;
      current.totalTrips += 1;
      totals.set(id, current);
    }
    return this.rank(Array.from(totals, ([companyId, value]) => ({ companyId, ...value })));
  }

  async getUserLeaderboard(month: number, year: number) {
    const period = this.getMonthWindow(month, year);
    const trips = await this.prisma.tripRecord.findMany({
      where: { createdAt: { gte: period.from, lt: period.to }, mode: { in: [TripMode.REAL, TripMode.RACE] } },
      select: { distanceKm: true, user: { select: { id: true, displayName: true, companyId: true } } },
    });
    const totals = new Map<string, { displayName: string; companyId: string | null; totalDistance: number; totalTrips: number }>();
    for (const trip of trips) {
      const current = totals.get(trip.user.id) ?? { displayName: trip.user.displayName, companyId: trip.user.companyId, totalDistance: 0, totalTrips: 0 };
      current.totalDistance += trip.distanceKm;
      current.totalTrips += 1;
      totals.set(trip.user.id, current);
    }
    return this.rank(Array.from(totals, ([userId, value]) => ({ userId, ...value })));
  }

  getHistoricalCompanyLeaderboard(month: number, year: number) {
    return this.prisma.monthlyRankHistory.findMany({
      where: { year, month, entityType: AggregationScope.COMPANY },
      orderBy: { rank: "asc" },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  getHistoricalUserLeaderboard(month: number, year: number) {
    return this.prisma.monthlyRankHistory.findMany({
      where: { year, month, entityType: AggregationScope.PLAYER },
      orderBy: { rank: "asc" },
      include: { user: { select: { id: true, displayName: true, companyId: true } } },
    });
  }

  async saveCompanyHistoryEntries(entries: CompanyHistoryEntry[]) {
    if (!entries.length) return;
    await this.prisma.monthlyRankHistory.createMany({
      data: entries.map((entry) => ({ ...entry, entityType: AggregationScope.COMPANY, userId: null })),
      skipDuplicates: true,
    });
  }

  async saveUserHistoryEntries(entries: UserHistoryEntry[]) {
    if (!entries.length) return;
    await this.prisma.monthlyRankHistory.createMany({
      data: entries.map((entry) => ({ ...entry, entityType: AggregationScope.PLAYER, companyId: null })),
      skipDuplicates: true,
    });
  }

  clearHistory(month: number, year: number) {
    return this.prisma.monthlyRankHistory.deleteMany({ where: { year, month } });
  }

  private rank<T extends { totalDistance: number; totalTrips: number }>(rows: T[]): Array<T & LeaderboardRow> {
    return rows.sort((a, b) => b.totalDistance - a.totalDistance).map((row, index) => ({
      ...row,
      totalDistance: Number(row.totalDistance.toFixed(2)),
      rank: index + 1,
    }));
  }

  private getMonthWindow(month: number, year: number) {
    return { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 1)) };
  }
}

interface CompanyHistoryEntry { year: number; month: number; companyId: string; totalDistance: number; rank: number }
interface UserHistoryEntry { year: number; month: number; userId: string; totalDistance: number; rank: number }
