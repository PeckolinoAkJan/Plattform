import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from "./image-upload.filters";

@Injectable()
export class ImageUploadValidationPipe implements PipeTransform {
  transform(file: { mimetype?: string; size?: number } | undefined) {
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }

    if (!file.mimetype || !ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("Only JPEG, PNG and WEBP files are allowed.");
    }

    if (!file.size || file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException("File too large. Maximum is 2 MB.");
    }

    return file;
  }
}
