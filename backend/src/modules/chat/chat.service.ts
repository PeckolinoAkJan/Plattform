import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getMessages(userId: string, requestedLimit = 100) {
    const user = await this.getCompanyUser(userId);
    const limit = Math.min(Math.max(requestedLimit, 1), 200);
    const messages = await this.prisma.companyChatMessage.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        sender: {
          select: { id: true, displayName: true, avatarUrl: true, companyRole: true },
        },
      },
    });

    return {
      companyId: user.companyId,
      messages: messages.reverse(),
    };
  }

  async createMessage(userId: string, rawBody: string) {
    const user = await this.getCompanyUser(userId);
    const body = rawBody.trim();
    if (!body) throw new BadRequestException("Nachricht darf nicht leer sein.");

    return this.prisma.companyChatMessage.create({
      data: {
        companyId: user.companyId,
        senderUserId: user.id,
        body,
      },
      include: {
        sender: {
          select: { id: true, displayName: true, avatarUrl: true, companyRole: true },
        },
      },
    });
  }

  private async getCompanyUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, companyId: true },
    });
    if (!user) throw new NotFoundException("Benutzer nicht gefunden.");
    if (!user.companyId) throw new BadRequestException("Für den Speditionschat ist eine aktive Spedition erforderlich.");
    return { id: user.id, companyId: user.companyId };
  }
}
