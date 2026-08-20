import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateUserProfileDto } from "./dto/update-user-profile.dto";
import { compare, hash } from "bcryptjs";

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
        passwordHash: true,
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
        socialAccounts: {
          select: {
            provider: true,
            createdAt: true,
          },
          orderBy: {
            provider: "asc",
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
      connectedAccounts: user.socialAccounts.map((account) => ({
        provider: account.provider,
        connectedAt: account.createdAt,
      })),
      passwordConfigured: Boolean(user.passwordHash),
      passwordHash: undefined,
      socialAccounts: undefined,
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

    if (
      typeof data.profileVisibility === "string" &&
      ["private", "public"].includes(data.profileVisibility)
    ) {
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

  async setPassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string,
  ) {
    if (typeof newPassword !== "string" || newPassword.length < 10) {
      throw new BadRequestException(
        "Das neue Passwort muss mindestens 10 Zeichen lang sein.",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException("User wurde nicht gefunden.");

    if (user.passwordHash) {
      if (
        !currentPassword ||
        !user.passwordHash.startsWith("$2") ||
        !(await compare(currentPassword, user.passwordHash))
      ) {
        throw new ForbiddenException(
          "Das aktuelle Passwort ist nicht korrekt.",
        );
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(newPassword, 12) },
    });

    return { passwordConfigured: true };
  }
}
