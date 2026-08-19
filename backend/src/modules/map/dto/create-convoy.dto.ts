import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateConvoyDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  plannedRoute?: string;

  @IsDateString()
  @IsOptional()
  departureAt?: string;
}
