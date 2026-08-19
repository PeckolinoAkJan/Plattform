import { IsOptional, IsString, Length } from "class-validator";

export class ApplyCompanyDto {
  @IsString()
  @IsOptional()
  @Length(1, 500)
  message?: string;
}
