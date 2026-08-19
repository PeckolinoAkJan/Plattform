import { IsBoolean, IsEnum, IsNumber, IsString, Min } from "class-validator";
import { GameType } from "../trip-classifier.service";

export class SubmitTripDto {
  @IsEnum(GameType)
  game: GameType;

  @IsString()
  cargo: string;

  @IsString()
  sourceCity: string;

  @IsString()
  destinationCity: string;

  @IsString()
  truckModel: string;

  @IsNumber()
  @Min(0)
  distanceKm: number;

  @IsNumber()
  @Min(0)
  maxSpeedKmh: number;

  @IsNumber()
  @Min(0)
  fuelConsumed: number;

  @IsNumber()
  damage: number;

  @IsBoolean()
  isWotr: boolean;
}
