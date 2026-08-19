import { readFileSync } from "node:fs";
import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";

const envPath = new URL("../.env", import.meta.url);
for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/u)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const separator = line.indexOf("=");
  if (separator < 1) continue;
  const name = line.slice(0, separator).trim();
  let value = line.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[name] ??= value;
}

const jwtSecret = process.env.JWT_SECRET?.trim();
if (!jwtSecret) throw new Error("JWT_SECRET fehlt in backend/.env");

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("Kein Benutzer fuer den Smoke-Test vorhanden.");

  const token = new JwtService().sign({
    userId: user.id,
    sub: user.id,
    steamId: user.steamId,
    companyId: user.companyId,
    role: user.companyRole ?? user.globalRoles?.[0] ?? null,
  }, { secret: jwtSecret, expiresIn: "5m" });

  const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3001";
  const [bearerResponse, cookieResponse, providersResponse] = await Promise.all([
    fetch(`${baseUrl}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${baseUrl}/api/users/me`, { headers: { Cookie: `vtc_session=${token}` } }),
    fetch(`${baseUrl}/api/auth/providers`),
  ]);

  const result = {
    bearer: bearerResponse.status,
    cookie: cookieResponse.status,
    providers: providersResponse.status,
  };
  console.log(JSON.stringify(result));

  if (Object.values(result).some((status) => status !== 200)) {
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
