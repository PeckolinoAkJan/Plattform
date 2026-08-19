import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateUserProfileDto } from "./dto/update-user-profile.dto";

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        isPremium: true,
        globalRoles: true,
        companyId: true,
        companyRole: true,
        profileVisibility: true,
        createdAt: true,
        updatedAt: true,
        company: {
          select: {
            id: true,
            name: true,
            tag: true,
            logoUrl: true,
          },
        },
        stats: {
          select: {
            totalDistance: true,
            totalDeliveries: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User wurde nicht gefunden.");
    }

    return {
      ...user,
      stats: user.stats ?? {
        totalDistance: 0,
        totalDeliveries: 0,
      },
    };
  }

  async updateProfile(userId: string, data: UpdateUserProfileDto) {
    if (!data || Object.keys(data).length === 0) {
      throw new BadRequestException("Keine upzudatenden Felder übergeben.");
    }

    const payload: Record<string, unknown> = {};
    if (typeof data.displayName === "string") {
      const displayName = data.displayName.trim();
      if (displayName.length > 0) {
        payload.displayName = displayName;
      }
    }

    if (typeof data.email === "string") {
      const email = data.email.trim().toLowerCase();
      if (email.length > 0) {
        payload.email = email;
      }
    }

    if (typeof data.profileVisibility === "string" && ["private", "public"].includes(data.profileVisibility)) {
      payload.profileVisibility = data.profileVisibility;
    }

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException("Keine gültigen Felder übergeben.");
    }

    if (payload.email) {
      const existing = await this.prisma.user.findFirst({
        where: {
          email: payload.email as string,
          NOT: { id: userId },
        },
      });

      if (existing) {
        throw new ForbiddenException("Diese E-Mail ist bereits vergeben.");
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: payload,
    });

    return this.getProfile(userId);
  }
}
