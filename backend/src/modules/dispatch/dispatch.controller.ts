import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, type CurrentUserValue } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateJobDto } from "./dto/create-job.dto";
import { UpdateJobStatusDto } from "./dto/update-job-status.dto";
import { DispatchService } from "./dispatch.service";

@Controller("dispatch")
@UseGuards(JwtAuthGuard)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post("jobs")
  async createJob(
    @CurrentUser() user: CurrentUserValue,
    @Body() createJobDto: CreateJobDto,
  ) {
    return this.dispatchService.createJob(user.userId, createJobDto);
  }

  @Get("jobs/:companyId")
  async getAvailableJobs(@Param("companyId") companyId: string) {
    return this.dispatchService.getAvailableJobs(companyId);
  }

  @Post("jobs/:id/accept")
  async acceptJob(@CurrentUser() user: CurrentUserValue, @Param("id") id: string) {
    return this.dispatchService.acceptJob(user.userId, id);
  }

  @Patch("jobs/:id/status")
  async updateJobStatus(
    @CurrentUser() user: CurrentUserValue,
    @Param("id") id: string,
    @Body() updateJobStatusDto: UpdateJobStatusDto,
  ) {
    return this.dispatchService.updateJobStatus(user.userId, id, updateJobStatusDto);
  }
}
