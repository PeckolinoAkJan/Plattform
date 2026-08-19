import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";

export class UpdateUserProfileDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsIn(["private", "public"])
  @IsOptional()
  profileVisibility?: string;
}
