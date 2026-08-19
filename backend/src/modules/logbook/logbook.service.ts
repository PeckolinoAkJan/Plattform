import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TripClassifierService, TripCategory } from "./trip-classifier.service";
import { SubmitTripDto } from "./dto/submit-trip.dto";

@Injectable()
export class LogbookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classifier: TripClassifierService,
  ) {}

  async getTripsForUser(userId: string) {
    const trips = await this.prisma.tripRecord.findMany({
      where: { userId },
      orderBy: { startTs: "desc" },
      take: 100,
    });

    return trips.map((trip) => ({
      id: trip.id,
      startTs: trip.startTs,
      endTs: trip.endTs,
      game: trip.game,
      cargo: trip.cargo,
      sourceCity: trip.startCity,
      destinationCity: trip.destinationCity,
      truckModel: trip.truckModel,
      distanceKm: trip.distanceKm,
      maxSpeedKmh: trip.maxSpeedKmh,
      avgSpeedKmh: trip.avgSpeedKmh,
      damageDelta: trip.damageDelta,
      mode: trip.mode,
      isWotr: trip.isWotr,
      isValidForScore: trip.isValidForScore,
      payload: {
        distanceKm: trip.distanceKm,
        maxSpeedKmh: trip.maxSpeedKmh,
        avgSpeedKmh: trip.avgSpeedKmh,
        cargo: trip.cargo,
        truckModel: trip.truckModel,
        sourceCity: trip.startCity,
        destinationCity: trip.destinationCity,
        game: trip.game,
        createdAt: trip.createdAt.toISOString(),
      },
    }));
  }

  async submitTrip(userId: string, data: SubmitTripDto) {
    const classification = this.classifier.classifyTrip(
      data.game,
      data.maxSpeedKmh,
      data.isWotr,
    );

    const damagePct = this.classifier.calculateDamagePercentage(data.damage);

    const trip = await this.prisma.tripRecord.create({
      data: {
        userId,
        game: data.game,
        cargo: data.cargo,
        startCity: data.sourceCity,
        destinationCity: data.destinationCity,
        truckModel: data.truckModel,
        distanceKm: data.distanceKm,
        maxSpeedKmh: data.maxSpeedKmh,
        avgSpeedKmh: data.distanceKm > 0 ? data.maxSpeedKmh * 0.75 : 0,
        fuelUsedL: data.fuelConsumed,
        damageDelta: damagePct,
        mode: this.classifier.mapCategoryToPrismaMode(classification.category),
        isValidForScore: classification.category !== TripCategory.INVALID && !classification.isWotr,
        scoreKmPoints: classification.category === TripCategory.INVALID ? 0 : data.distanceKm,
        isWotr: classification.isWotr,
        startTs: new Date(),
      },
    });

      if (classification.category !== TripCategory.INVALID) {
      await this.updateUserStats(userId, data.distanceKm);
    }

    return {
      ...trip,
      payload: {
        distanceKm: trip.distanceKm,
        maxSpeedKmh: trip.maxSpeedKmh,
        avgSpeedKmh: trip.avgSpeedKmh,
        cargo: trip.cargo,
        cargoName: trip.cargo,
        sourceCity: trip.startCity,
        destinationCity: trip.destinationCity,
        truckModel: trip.truckModel,
        game: trip.game,
        createdAt: trip.createdAt.toISOString(),
      },
    };
  }

  private async updateUserStats(userId: string, distanceKm: number) {
    await this.prisma.userStat.upsert({
      where: { userId },
      create: {
        userId,
        totalDistance: distanceKm,
        totalDeliveries: 1,
      },
      update: {
        totalDistance: {
          increment: distanceKm,
        },
        totalDeliveries: {
          increment: 1,
        },
      },
    });
  }
}
