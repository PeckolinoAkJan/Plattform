import { IsEnum } from "class-validator";
import { DispatchJobStatus } from "@prisma/client";

export class UpdateJobStatusDto {
  @IsEnum(DispatchJobStatus)
  status: DispatchJobStatus;
}

