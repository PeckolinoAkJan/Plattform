import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { NextFunction, Request, Response } from "express";
import { join, resolve } from "node:path";
import { AppModule } from "./app.module";

const isPlaceholder = (value: string): boolean => /(?:change_me|replace_with|your_)/i.test(value.trim());

function validateProductionConfig(config: ConfigService): void {
  if (config.get<string>("NODE_ENV") !== "production") return;

  const required = ["DATABASE_URL", "REDIS_PASSWORD", "JWT_SECRET", "BACKEND_URL", "FRONTEND_URL"] as const;
  for (const key of required) {
    const value = config.get<string>(key)?.trim();
    if (!value || isPlaceholder(value)) {
      throw new Error(`${key} muss für den Produktionsbetrieb sicher gesetzt sein.`);
    }
  }

  if ((config.get<string>("JWT_SECRET")?.trim().length ?? 0) < 64) {
    throw new Error("JWT_SECRET muss im Produktionsbetrieb mindestens 64 Zeichen lang sein.");
  }

  for (const key of ["BACKEND_URL", "FRONTEND_URL"] as const) {
    const url = new URL(config.get<string>(key)!);
    if (url.protocol !== "https:") {
      throw new Error(`${key} muss im Produktionsbetrieb HTTPS verwenden.`);
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  validateProductionConfig(app.get(ConfigService));
  app.set("trust proxy", 1);
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") {
      response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  app.enableCors({
    origin: frontendUrl.split(",").map((origin) => origin.trim()),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-timestamp", "x-nonce", "x-client-signature"],
  });
  const uploadRoot = resolve(process.env.UPLOAD_ROOT || join(process.cwd(), "uploads"));
  app.useStaticAssets(uploadRoot, { prefix: "/uploads/", fallthrough: false });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env.PORT || 3001, process.env.HOST || "0.0.0.0");
}

void bootstrap();
