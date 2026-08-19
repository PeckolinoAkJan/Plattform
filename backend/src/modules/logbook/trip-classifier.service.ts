import { Injectable } from "@nestjs/common";
import { Game, TripMode } from "@prisma/client";

export { Game as GameType };

export enum TripCategory {
  REAL = "REAL",
  RACE = "RACE",
  INVALID = "INVALID",
}

export interface TripClassification {
  category: TripCategory;
  isWotr: boolean;
}

@Injectable()
export class TripClassifierService {
  classifyTrip(game: Game, maxSpeedKmh: number, isWotr: boolean): TripClassification {
    if (maxSpeedKmh > 180) {
      return {
        category: TripCategory.INVALID,
        isWotr,
      };
    }

    if (game === Game.ETS2) {
      if (maxSpeedKmh <= 100) {
        return { category: TripCategory.REAL, isWotr };
      }

      return { category: TripCategory.RACE, isWotr };
    }

    if (game === Game.ATS) {
      if (maxSpeedKmh <= 130) {
        return { category: TripCategory.REAL, isWotr };
      }

      return { category: TripCategory.RACE, isWotr };
    }

    return {
      category: TripCategory.INVALID,
      isWotr,
    };
  }

  calculateDamagePercentage(damageValue: number): number {
    return Math.min(100, Math.max(0, Math.round(damageValue * 10000) / 100));
  }

  mapCategoryToPrismaMode(category: TripCategory): TripMode {
    if (category === TripCategory.REAL) return TripMode.REAL;
    if (category === TripCategory.RACE) return TripMode.RACE;
    return TripMode.INVALID;
  }
}
