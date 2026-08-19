ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerEmail" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegacyImportAudit" (
    "id" TEXT NOT NULL,
    "exportId" TEXT NOT NULL,
    "manifestSha256" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "importedCounts" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegacyImportAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialAccount_provider_providerUserId_key" ON "SocialAccount"("provider", "providerUserId");
CREATE INDEX "SocialAccount_userId_provider_idx" ON "SocialAccount"("userId", "provider");
CREATE UNIQUE INDEX "LegacyImportAudit_exportId_key" ON "LegacyImportAudit"("exportId");

ALTER TABLE "SocialAccount"
ADD CONSTRAINT "SocialAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
