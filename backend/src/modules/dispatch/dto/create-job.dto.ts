import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { Game } from "@prisma/client";

export class CreateJobDto {
  @IsString()
  cargo: string;

  @IsString()
  sourceCity: string;

  @IsString()
  destinationCity: string;

  @IsEnum(Game)
  game: Game;

  @IsNumber()
  @IsOptional()
  payloadTons?: number;

  @IsString()
  @IsOptional()
  assignedToId?: string;
}
