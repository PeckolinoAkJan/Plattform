import { IsOptional, IsString, Length } from "class-validator";

export class CreateCompanyDto {
  @IsString()
  @Length(3, 50)
  name: string;

  @IsString()
  @IsOptional()
  @Length(2, 6)
  tag?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
