import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class GetLivePositionsQueryDto {
  @IsString()
  @IsOptional()
  companyId?: string;

  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => (typeof value === "string" ? Number.parseInt(value, 10) : value))
  @IsInt()
  @Min(1)
  maxAgeMinutes?: number;
}
