import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CompanyRole, DispatchJobStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateJobDto } from "./dto/create-job.dto";
import { UpdateJobStatusDto } from "./dto/update-job-status.dto";

@Injectable()
export class DispatchService {
  constructor(private readonly prisma: PrismaService) {}

  async createJob(userId: string, dto: CreateJobDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        companyId: true,
        companyRole: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User wurde nicht gefunden.");
    }

    if (!user.companyId) {
      throw new BadRequestException("Du bist noch keinem Unternehmen zugeordnet.");
    }

    if (
      user.companyRole !== CompanyRole.DISPATCHER &&
      user.companyRole !== CompanyRole.OWNER
    ) {
      throw new ForbiddenException("Nur Dispatcher oder Owner können Aufträge erstellen.");
    }

    if (dto.assignedToId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assignedToId },
        select: { companyId: true, companyRole: true },
      });

      if (!assignee) {
        throw new NotFoundException("Zugeteilter Fahrer wurde nicht gefunden.");
      }

      if (assignee.companyId !== user.companyId) {
        throw new BadRequestException("Der zugeordnete Fahrer ist nicht in deiner Firma.");
      }

      if (assignee.companyRole !== CompanyRole.DRIVER) {
        throw new BadRequestException("Du kannst nur Fahrer als Beauftragte zuweisen.");
      }
    }

    return this.prisma.dispatchJob.create({
      data: {
        game: dto.game,
        cargo: dto.cargo,
        originCity: dto.sourceCity,
          destinationCity: dto.destinationCity,
          payloadTons: dto.payloadTons ?? 0,
        creatorId: user.id,
        companyId: user.companyId,
        assignedToId: dto.assignedToId,
        status: DispatchJobStatus.OPEN,
      },
    });
  }

  async getAvailableJobs(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException("Firma wurde nicht gefunden.");
    }

    return this.prisma.dispatchJob.findMany({
      where: {
        companyId,
        status: DispatchJobStatus.OPEN,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async acceptJob(userId: string, jobId: string) {
    const driver = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, companyId: true, companyRole: true },
    });

    if (!driver) {
      throw new NotFoundException("User wurde nicht gefunden.");
    }

    if (!driver.companyId) {
      throw new BadRequestException("Du bist noch keinem Unternehmen zugeordnet.");
    }

    if (driver.companyRole !== CompanyRole.DRIVER) {
      throw new ForbiddenException("Nur Fahrer können offene Aufträge annehmen.");
    }

    const job = await this.prisma.dispatchJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException("Auftrag wurde nicht gefunden.");
    }

    if (job.companyId !== driver.companyId) {
      throw new ForbiddenException("Der Auftrag gehört nicht zu deiner Firma.");
    }

    if (job.status !== DispatchJobStatus.OPEN) {
      throw new BadRequestException("Der Auftrag ist nicht mehr offen.");
    }

    return this.prisma.dispatchJob.update({
      where: { id: jobId },
      data: {
        assignedToId: driver.id,
        status: DispatchJobStatus.ACCEPTED,
      },
    });
  }

  async updateJobStatus(userId: string, jobId: string, dto: UpdateJobStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, companyId: true, companyRole: true },
    });

    if (!user) {
      throw new NotFoundException("User wurde nicht gefunden.");
    }

    if (!user.companyId) {
      throw new BadRequestException("Du bist noch keinem Unternehmen zugeordnet.");
    }

    const job = await this.prisma.dispatchJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException("Auftrag wurde nicht gefunden.");
    }

    if (job.companyId !== user.companyId) {
      throw new ForbiddenException("Der Auftrag gehört nicht zu deiner Firma.");
    }

    if (
      user.companyRole !== CompanyRole.DISPATCHER &&
      user.companyRole !== CompanyRole.OWNER
    ) {
      throw new ForbiddenException("Nur Dispatcher oder Owner können Auftragsstatus ändern.");
    }

    return this.prisma.dispatchJob.update({
      where: { id: jobId },
      data: { status: dto.status },
    });
  }
}
