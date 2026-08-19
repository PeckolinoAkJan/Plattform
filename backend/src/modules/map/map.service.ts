import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateConvoyDto } from "./dto/create-convoy.dto";
import {
  resolveTelemetryCargo,
  resolveTelemetryCoordinates,
  resolveTelemetrySpeed,
  resolveTelemetryTimestamp,
  UpdateTelemetryDto,
} from "./interfaces/telemetry-payload.interface";

type GetLivePositionsParams = {
  companyId?: string | null;
  maxAgeMinutes?: number;
};

@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  async getLivePositions(params: GetLivePositionsParams = {}) {
    const companyId = typeof params.companyId === "string" ? params.companyId.trim() : params.companyId;
    const now = new Date();
    const maxAgeMinutes = this.resolvePositiveInteger(params.maxAgeMinutes, 60);
    const since = new Date(now.getTime() - maxAgeMinutes * 60 * 1000);

    const where: Prisma.LivePositionWhereInput = {
      isActive: true,
      ts: {
        gte: since,
      },
    };

    if (companyId === null) {
      where.companyId = null;
    } else if (companyId) {
      where.companyId = companyId;
    }

    const positions = await this.prisma.livePosition.findMany({
      where,
      orderBy: {
        ts: "desc",
      },
      take: 400,
      include: {
        user: {
          select: {
            displayName: true,
            avatarUrl: true,
            companyRole: true,
          },
        },
      },
    });

    return {
      source: companyId ? "company" : "unassigned",
      requestedCompanyId: companyId ?? null,
      generatedAt: now.toISOString(),
      points: positions.map((position) => ({
        id: position.id,
        userId: position.userId,
        companyId: position.companyId,
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speedKmh,
        speedKmh: position.speedKmh,
        heading: position.heading,
        inConvoy: position.inConvoy,
        isActive: position.isActive,
        timestamp: position.ts.toISOString(),
        driver: {
          name: position.user.displayName,
          role: position.user.companyRole,
          avatarUrl: position.user.avatarUrl,
        },
      })),
      totalCount: positions.length,
    };
  }

  async updateLiveTelemetry(userId: string, payload: UpdateTelemetryDto) {
    const [user, targetCoordinates, speedKmh, cargoName] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          displayName: true,
          companyId: true,
        },
      }),
      resolveTelemetryCoordinates(payload),
      resolveTelemetrySpeed(payload),
      resolveTelemetryCargo(payload),
    ]);

    if (!user) {
      throw new NotFoundException("User nicht gefunden.");
    }

    if (!targetCoordinates || speedKmh === null || speedKmh < 0) {
      throw new BadRequestException("Ungültiger Live-Telemetrie-Payload.");
    }

    const payloadCompanyId = this.normalizeCompanyId(payload.companyId);
    if (payloadCompanyId && payloadCompanyId !== user.companyId) {
      throw new ForbiddenException("Du darfst nur Telemetrie deiner eigenen Spedition senden.");
    }

    const resolvedCompanyId = user.companyId;
    const driverName = this.normalizeString(payload.driverName) ?? user.displayName;
    const truckModel = this.normalizeString(payload.truckModel) ?? "Unbekannt";
    const sourceCity = this.normalizeString(payload.sourceCity);
    const destinationCity = this.normalizeString(payload.destinationCity);
    const heading = this.normalizeNumber(payload.heading);
    const blinker = null;
    const damage = 0;
    const inConvoy = false;
    const roomCompanyId = resolvedCompanyId ?? null;
    const timestamp = new Date(resolveTelemetryTimestamp(payload)).toISOString();

    const persisted = await this.prisma.$transaction(async (transaction) => {
      await transaction.livePosition.deleteMany({
        where: {
          userId,
        },
      });

      return transaction.livePosition.create({
        data: {
          user: {
            connect: {
              id: userId,
            },
          },
          company: roomCompanyId ? { connect: { id: roomCompanyId } } : undefined,
          latitude: targetCoordinates.latitude,
          longitude: targetCoordinates.longitude,
          speedKmh,
          heading,
          blinker,
          damage,
          inConvoy,
          isActive: true,
          ts: new Date(timestamp),
        },
      });
    });

    const room = this.resolveCompanyRoom(resolvedCompanyId);

    return {
      room,
      driverId: user.id,
      driverName,
      userId: user.id,
      x: targetCoordinates.longitude,
      y: targetCoordinates.latitude,
      latitude: targetCoordinates.latitude,
      longitude: targetCoordinates.longitude,
      speed: speedKmh,
      speedKmh,
      truckModel,
      heading,
      timestamp,
      companyId: roomCompanyId ?? undefined,
      cargoName,
      sourceCity,
      destinationCity,
      createdAt: persisted.ts.toISOString(),
    };
  }

  private normalizeNumber(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    return value;
  }

  private normalizeString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeCompanyId(value: unknown): string | null {
    const normalized = this.normalizeString(value);
    if (!normalized) {
      return null;
    }

    return normalized;
  }

  private resolveCompanyRoom(companyId: string | null | undefined): string {
    if (!companyId) {
      return "global";
    }

    return `room_company_${companyId}`;
  }

  async createConvoy(userId: string, payload: CreateConvoyDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    if (!user || !user.companyId) {
      throw new BadRequestException("Du hast aktuell keine aktive Spedition.");
    }

    const convoy = await this.prisma.convoy.create({
      data: {
        name: payload.name.trim(),
        plannedRoute: payload.plannedRoute?.trim() || null,
        departureAt: payload.departureAt ? new Date(payload.departureAt) : new Date(),
        companyId: user.companyId,
        creatorId: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    return {
      id: convoy.id,
      name: convoy.name,
      plannedRoute: convoy.plannedRoute,
      departureAt: convoy.departureAt.toISOString(),
      status: convoy.status,
      creator: {
        id: convoy.creator.id,
        displayName: convoy.creator.displayName,
      },
    };
  }

  private resolvePositiveInteger(value: unknown, fallback: number): number {
    const numeric = typeof value === "number" ? value : Number.parseInt(`${value}`, 10);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric <= 0) {
      return fallback;
    }

    return numeric;
  }
}
