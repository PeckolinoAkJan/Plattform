import { IsOptional, IsString, MinLength } from "class-validator";

export class SetUserPasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(10)
  newPassword!: string;
}
