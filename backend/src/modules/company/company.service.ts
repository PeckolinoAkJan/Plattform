import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  CompanyApplicationStatus,
  CompanyRole,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { ApplyCompanyDto } from "./dto/apply-company.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async createCompany(userId: string, data: CreateCompanyDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException("User wurde nicht gefunden.");
    }

    if (user.companyId) {
      throw new BadRequestException("Du bist bereits Mitglied einer Spedition.");
    }

    const existing = await this.prisma.company.findUnique({
      where: { name: data.name.trim() },
    });

    if (existing) {
      throw new BadRequestException("Dieser Speditionsname ist bereits vergeben.");
    }

    const slug = this.makeSlug(data.name);

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          owner: {
            connect: {
              id: userId,
            },
          },
          name: data.name.trim(),
          tag: data.tag?.trim(),
          description: data.description?.trim(),
          slug,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          companyId: company.id,
          companyRole: CompanyRole.OWNER,
        },
      });

      return company;
    });
  }

  async applyToCompany(userId: string, companyId: string, dto: ApplyCompanyDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User wurde nicht gefunden.");
    }

    if (user.companyId) {
      throw new BadRequestException("Du bist bereits Mitglied einer Spedition.");
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException("Spedition wurde nicht gefunden.");
    }

    const pendingApplication = await this.prisma.companyApplication.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
    });

    if (pendingApplication) {
      throw new BadRequestException("Für diese Spedition existiert bereits eine Bewerbung.");
    }

    return this.prisma.companyApplication.create({
      data: {
        userId,
        companyId,
        status: CompanyApplicationStatus.PENDING,
        message: dto.message?.trim() || "Keine Nachricht angegeben.",
      },
    });
  }

  async processApplication(
    ownerOrDispatcherId: string,
    applicationId: string,
    accept: boolean,
  ) {
    const application = await this.prisma.companyApplication.findUnique({
      where: { id: applicationId },
      include: {
        company: {
          select: { id: true },
        },
      },
    });

    if (!application) {
      throw new NotFoundException("Bewerbung wurde nicht gefunden.");
    }

    if (application.status !== CompanyApplicationStatus.PENDING) {
      throw new BadRequestException("Diese Bewerbung wurde bereits bearbeitet.");
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: ownerOrDispatcherId },
    });

    if (!actor || actor.companyId !== application.companyId) {
      throw new ForbiddenException("Du bist nicht berechtigt, diese Bewerbung zu bearbeiten.");
    }

    if (
      actor.companyRole !== CompanyRole.OWNER &&
      actor.companyRole !== CompanyRole.DISPATCHER
    ) {
      throw new ForbiddenException("Nur Owner oder Dispatcher können Bewerbungen bearbeiten.");
    }

    if (accept) {
      if (application.companyId) {
        const existingMember = await this.prisma.user.findUnique({
          where: { id: application.userId },
          select: { companyId: true },
        });

        if (existingMember?.companyId) {
          throw new BadRequestException("Der Bewerber ist bereits in einer Spedition.");
        }
      }

      return this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: application.userId },
          data: {
            companyId: application.companyId,
            companyRole: CompanyRole.DRIVER,
          },
        });

        return tx.companyApplication.update({
          where: { id: applicationId },
          data: {
            status: CompanyApplicationStatus.ACCEPTED,
          },
        });
      });
    }

    return this.prisma.companyApplication.update({
      where: { id: applicationId },
      data: {
        status: CompanyApplicationStatus.REJECTED,
      },
    });
  }

  async updateMemberRole(
    actorId: string,
    memberId: string,
    companyId: string,
    dto: UpdateRoleDto,
  ) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
    });

    if (!actor || actor.companyId !== companyId) {
      throw new ForbiddenException("Keine Berechtigung für diese Spedition.");
    }

    if (
      actor.companyRole !== CompanyRole.OWNER &&
      actor.companyRole !== CompanyRole.DISPATCHER
    ) {
      throw new ForbiddenException("Nur Owner oder Dispatcher können Rollen verwalten.");
    }

    const target = await this.prisma.user.findUnique({
      where: { id: memberId },
    });

    if (!target || target.companyId !== companyId) {
      throw new BadRequestException("Zielmitglied ist kein Mitglied der Spedition.");
    }

    if (target.companyRole === CompanyRole.OWNER && actor.companyRole !== CompanyRole.OWNER) {
      throw new ForbiddenException("Nur Owner kann Owner-Rollen ändern.");
    }

    if (
      actor.companyRole === CompanyRole.DISPATCHER &&
      dto.role === CompanyRole.OWNER
    ) {
      throw new ForbiddenException("Dispatcher dürfen keine Owner-Rolle vergeben.");
    }

    return this.prisma.user.update({
      where: { id: memberId },
      data: {
        companyRole: dto.role,
      },
    });
  }

  async getCurrentCompany(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    if (!user) {
      throw new UnauthorizedException("User nicht gefunden.");
    }

    if (!user.companyId) {
      throw new NotFoundException("Du hast aktuell keine Spedition.");
    }

    return this.getCompanyProfile(user.companyId);
  }

  async updateCurrentCompany(actorId: string, updateCompanyDto: UpdateCompanyDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { companyId: true, companyRole: true },
    });

    if (!user || !user.companyId) {
      throw new ForbiddenException("Du hast aktuell keine Spedition.");
    }

    if (user.companyRole !== CompanyRole.OWNER) {
      throw new ForbiddenException("Du hast keine Berechtigung, Speditionsdaten zu ändern.");
    }

    const data: Record<string, unknown> = {};
    if (typeof updateCompanyDto.name === "string") {
      const name = updateCompanyDto.name.trim();
      if (name.length > 0) {
        data.name = name;
      }
    }

    if (typeof updateCompanyDto.tag === "string") {
      data.tag = updateCompanyDto.tag.trim() || null;
    }

    if (typeof updateCompanyDto.description === "string") {
      data.description = updateCompanyDto.description.trim() || null;
    }

    if (typeof updateCompanyDto.countryCode === "string") {
      data.countryCode = updateCompanyDto.countryCode.trim() || null;
    }

    if (typeof updateCompanyDto.logoUrl === "string") {
      data.logoUrl = updateCompanyDto.logoUrl.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      const current = await this.getCompanyProfile(user.companyId);
      return current;
    }

    if (data.name) {
      const duplicate = await this.prisma.company.findFirst({
        where: {
          name: data.name,
          NOT: {
            id: user.companyId,
          },
        },
      });

      if (duplicate) {
        throw new BadRequestException("Dieser Speditionsname ist bereits vergeben.");
      }
    }

    await this.prisma.company.update({
      where: { id: user.companyId },
      data,
    });

    return this.getCompanyProfile(user.companyId);
  }

  async getCompanyProfile(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        members: {
          select: {
            id: true,
            displayName: true,
            companyRole: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException("Spedition wurde nicht gefunden.");
    }

    return {
      id: company.id,
      name: company.name,
      tag: company.tag,
      description: company.description,
      createdAt: company.createdAt,
      members: company.members,
    };
  }

  private makeSlug(name: string): string {
    const sanitized = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return sanitized.replace(/^-+|-+$/g, "").slice(0, 40) || "company";
  }
}
