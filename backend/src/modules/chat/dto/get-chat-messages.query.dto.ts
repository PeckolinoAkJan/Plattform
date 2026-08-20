import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class GetChatMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => (typeof value === "string" ? Number.parseInt(value, 10) : value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
