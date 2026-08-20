-- CreateTable
CREATE TABLE "CompanyChatMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyChatMessage_companyId_createdAt_idx" ON "CompanyChatMessage"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyChatMessage_senderUserId_createdAt_idx" ON "CompanyChatMessage"("senderUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "CompanyChatMessage" ADD CONSTRAINT "CompanyChatMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyChatMessage" ADD CONSTRAINT "CompanyChatMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
