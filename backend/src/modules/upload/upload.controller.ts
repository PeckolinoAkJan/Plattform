import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { CompanyRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, type CurrentUserValue } from "../../common/decorators/current-user.decorator";
import {
  imageFileFilter,
  MAX_IMAGE_SIZE_BYTES,
} from "./image-upload.filters";
import { ImageUploadValidationPipe } from "./image-upload-validation.pipe";

const UPLOAD_ROOT = resolve(process.env.UPLOAD_ROOT || join(process.cwd(), "uploads"));
const AVATAR_UPLOAD_PATH = join(UPLOAD_ROOT, "avatars");
const LOGO_UPLOAD_PATH = join(UPLOAD_ROOT, "logos");

const imageExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function resolveFilename(originalname: string | undefined, mimetype: string) {
  const extension = imageExtensions[mimetype] ?? extname(originalname || "");
  return `${randomUUID()}${extension}`;
}

function ensureUploadFolder(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

@Controller("upload")
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("avatar")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: AVATAR_UPLOAD_PATH,
        filename: (_, file, callback) => {
          ensureUploadFolder(AVATAR_UPLOAD_PATH);
          callback(null, resolveFilename(file.originalname, file.mimetype));
        },
      }),
      limits: {
        fileSize: MAX_IMAGE_SIZE_BYTES,
      },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadAvatar(
    @UploadedFile(new ImageUploadValidationPipe()) file: { filename: string },
    @CurrentUser() user: CurrentUserValue,
  ) {
    const avatarUrl = `/uploads/avatars/${file.filename}`;

    await this.prisma.user.update({
      where: { id: user.userId },
      data: {
        avatarUrl,
      },
    });

    return { avatarUrl };
  }

  @Post("company-logo")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: LOGO_UPLOAD_PATH,
        filename: (_, file, callback) => {
          ensureUploadFolder(LOGO_UPLOAD_PATH);
          callback(null, resolveFilename(file.originalname, file.mimetype));
        },
      }),
      limits: {
        fileSize: MAX_IMAGE_SIZE_BYTES,
      },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadCompanyLogo(
    @UploadedFile(new ImageUploadValidationPipe()) file: { filename: string; path: string },
    @CurrentUser() user: CurrentUserValue,
  ) {
    const actor = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { companyId: true, companyRole: true },
    });

    const canManageLogo = actor?.companyRole === CompanyRole.OWNER || actor?.companyRole === CompanyRole.DISPATCHER;
    if (!actor?.companyId || actor.companyId !== user.companyId || !canManageLogo) {
      await rm(file.path, { force: true });
      throw new ForbiddenException("No company assigned to current user.");
    }

    const logoUrl = `/uploads/logos/${file.filename}`;

    await this.prisma.company.update({
      where: { id: actor.companyId },
      data: {
        logoUrl,
      },
    });

    return { logoUrl };
  }
}
