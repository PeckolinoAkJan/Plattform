import { IsEmail, IsOptional, IsString } from "class-validator";

export class LocalLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  @IsOptional()
  returnTo?: string;
}
