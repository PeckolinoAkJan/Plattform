import { IsEnum } from "class-validator";
import { CompanyRole } from "@prisma/client";

export class UpdateRoleDto {
  @IsEnum(CompanyRole)
  role: CompanyRole;
}
