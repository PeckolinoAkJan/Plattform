-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('LONER', 'EMPLOYEE', 'DISPATCHER', 'OWNER', 'PREMIUM', 'ADMIN');

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('DRIVER', 'DISPATCHER', 'OWNER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CompanyApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Game" AS ENUM ('ETS2', 'ATS');

-- CreateEnum
CREATE TYPE "TripMode" AS ENUM ('REAL', 'RACE', 'INVALID');

-- CreateEnum
CREATE TYPE "DispatchJobType" AS ENUM ('PERSONAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "DispatchJobStatus" AS ENUM ('OPEN', 'ASSIGNED', 'ACCEPTED', 'DRIVING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobVisibility" AS ENUM ('OPEN', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "ConvoyStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConvoyParticipantRole" AS ENUM ('DRIVER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "AggregationScope" AS ENUM ('PLAYER', 'COMPANY', 'COUNTRY');

-- CreateEnum
CREATE TYPE "LeaderboardPeriod" AS ENUM ('MONTH', 'YEAR', 'ALL_TIME');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "steamId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "globalRoles" "GlobalRole"[],
    "companyId" TEXT,
    "companyRole" "CompanyRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profileVisibility" TEXT NOT NULL DEFAULT 'private',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SteamAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "personaName" TEXT NOT NULL,
    "profileUrl" TEXT,
    "avatarUrl" TEXT,
    "visibilityState" INTEGER NOT NULL DEFAULT 0,
    "hasPublicProfile" BOOLEAN NOT NULL DEFAULT false,
    "ownsETS2" BOOLEAN NOT NULL DEFAULT false,
    "ownsATS" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SteamAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "countryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "logoUrl" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyRole" "CompanyRole" NOT NULL DEFAULT 'DRIVER',
    "membershipStatus" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "monthlyKmLimit" INTEGER,
    "monthlyKmCurrent" INTEGER NOT NULL DEFAULT 0,
    "invitedById" TEXT,
    "invitedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPost" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyPostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyJoinRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "formPayload" JSONB,
    "reviewMessage" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "CompanyApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchJob" (
    "id" TEXT NOT NULL,
    "type" "DispatchJobType" NOT NULL DEFAULT 'PERSONAL',
    "game" "Game" NOT NULL,
    "cargo" TEXT NOT NULL,
    "originCity" TEXT NOT NULL,
    "destinationCity" TEXT NOT NULL,
    "sourceName" TEXT,
    "destinationName" TEXT,
    "payloadTons" DOUBLE PRECISION NOT NULL,
    "isWotr" BOOLEAN NOT NULL DEFAULT false,
    "targetDistanceKm" DOUBLE PRECISION,
    "rewardCoins" INTEGER,
    "notes" TEXT,
    "visibility" "JobVisibility" NOT NULL DEFAULT 'OPEN',
    "status" "DispatchJobStatus" NOT NULL DEFAULT 'OPEN',
    "plannedStartAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creatorId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assignedToId" TEXT,

    CONSTRAINT "DispatchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "game" "Game" NOT NULL,
    "cargo" TEXT NOT NULL,
    "startCity" TEXT NOT NULL,
    "destinationCity" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxSpeedKmh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgSpeedKmh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fuelUsedL" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "truckModel" TEXT NOT NULL,
    "damageDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startTs" TIMESTAMP(3) NOT NULL,
    "endTs" TIMESTAMP(3),
    "mode" "TripMode" NOT NULL DEFAULT 'INVALID',
    "isValidForScore" BOOLEAN NOT NULL DEFAULT false,
    "scoreKmPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "routeCaptured" BOOLEAN NOT NULL DEFAULT false,
    "isWotr" BOOLEAN NOT NULL DEFAULT false,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceJobId" TEXT,
    "driverProfileId" TEXT,

    CONSTRAINT "TripRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalDistance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteTrack" (
    "id" TEXT NOT NULL,
    "tripRecordId" TEXT NOT NULL,
    "gameVersion" TEXT,
    "isPremiumRequired" BOOLEAN NOT NULL DEFAULT false,
    "isSampled" BOOLEAN NOT NULL DEFAULT false,
    "pathPoints" JSONB,
    "gpxData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryPoint" (
    "id" TEXT NOT NULL,
    "tripRecordId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speedKmh" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION,
    "blinker" TEXT,
    "damage" DOUBLE PRECISION,
    "fuelL" DOUBLE PRECISION,

    CONSTRAINT "TelemetryPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivePosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speedKmh" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION,
    "blinker" TEXT,
    "damage" DOUBLE PRECISION,
    "inConvoy" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LivePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convoy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedRoute" TEXT,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "status" "ConvoyStatus" NOT NULL DEFAULT 'PLANNED',
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Convoy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConvoyParticipant" (
    "id" TEXT NOT NULL,
    "convoyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ConvoyParticipantRole" NOT NULL DEFAULT 'DRIVER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicle" TEXT,

    CONSTRAINT "ConvoyParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryIngestionAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripRecordId" TEXT,
    "clientVersion" TEXT,
    "payloadHash" TEXT,
    "payload" JSONB,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryIngestionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardSnapshot" (
    "id" TEXT NOT NULL,
    "scope" "AggregationScope" NOT NULL,
    "period" "LeaderboardPeriod" NOT NULL,
    "game" "Game" NOT NULL,
    "mode" "TripMode" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "companyId" TEXT,
    "countryCode" TEXT,
    "playerId" TEXT,
    "totalKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTrips" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyRankHistory" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "entityType" "AggregationScope" NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "totalDistance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyRankHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_steamId_key" ON "User"("steamId");

-- CreateIndex
CREATE INDEX "User_steamId_idx" ON "User"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "SteamAccount_userId_key" ON "SteamAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SteamAccount_steamId_key" ON "SteamAccount"("steamId");

-- CreateIndex
CREATE INDEX "SteamAccount_steamId_idx" ON "SteamAccount"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_slug_idx" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_ownerId_idx" ON "Company"("ownerId");

-- CreateIndex
CREATE INDEX "CompanyMembership_companyId_companyRole_membershipStatus_idx" ON "CompanyMembership"("companyId", "companyRole", "membershipStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMembership_userId_companyId_key" ON "CompanyMembership"("userId", "companyId");

-- CreateIndex
CREATE INDEX "CompanyPost_companyId_createdAt_idx" ON "CompanyPost"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyApplication_companyId_status_idx" ON "CompanyApplication"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyApplication_userId_companyId_key" ON "CompanyApplication"("userId", "companyId");

-- CreateIndex
CREATE INDEX "DispatchJob_companyId_status_visibility_idx" ON "DispatchJob"("companyId", "status", "visibility");

-- CreateIndex
CREATE INDEX "DispatchJob_creatorId_game_status_idx" ON "DispatchJob"("creatorId", "game", "status");

-- CreateIndex
CREATE INDEX "TripRecord_userId_startTs_idx" ON "TripRecord"("userId", "startTs");

-- CreateIndex
CREATE INDEX "TripRecord_game_mode_isValidForScore_idx" ON "TripRecord"("game", "mode", "isValidForScore");

-- CreateIndex
CREATE INDEX "TripRecord_isValidForScore_scoreKmPoints_idx" ON "TripRecord"("isValidForScore", "scoreKmPoints");

-- CreateIndex
CREATE UNIQUE INDEX "UserStat_userId_key" ON "UserStat"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteTrack_tripRecordId_key" ON "RouteTrack"("tripRecordId");

-- CreateIndex
CREATE INDEX "TelemetryPoint_tripRecordId_ts_idx" ON "TelemetryPoint"("tripRecordId", "ts");

-- CreateIndex
CREATE INDEX "LivePosition_companyId_isActive_ts_idx" ON "LivePosition"("companyId", "isActive", "ts");

-- CreateIndex
CREATE INDEX "Convoy_companyId_departureAt_status_idx" ON "Convoy"("companyId", "departureAt", "status");

-- CreateIndex
CREATE INDEX "ConvoyParticipant_convoyId_role_idx" ON "ConvoyParticipant"("convoyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ConvoyParticipant_convoyId_userId_key" ON "ConvoyParticipant"("convoyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Award_code_key" ON "Award"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserAward_userId_awardId_key" ON "UserAward"("userId", "awardId");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_scope_period_game_mode_year_month_idx" ON "LeaderboardSnapshot"("scope", "period", "game", "mode", "year", "month");

-- CreateIndex
CREATE INDEX "MonthlyRankHistory_year_month_entityType_idx" ON "MonthlyRankHistory"("year", "month", "entityType");

-- CreateIndex
CREATE INDEX "MonthlyRankHistory_companyId_year_month_idx" ON "MonthlyRankHistory"("companyId", "year", "month");

-- CreateIndex
CREATE INDEX "MonthlyRankHistory_userId_year_month_idx" ON "MonthlyRankHistory"("userId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyRankHistory_year_month_entityType_companyId_userId_key" ON "MonthlyRankHistory"("year", "month", "entityType", "companyId", "userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SteamAccount" ADD CONSTRAINT "SteamAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPost" ADD CONSTRAINT "CompanyPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPost" ADD CONSTRAINT "CompanyPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPostComment" ADD CONSTRAINT "CompanyPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CompanyPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPostComment" ADD CONSTRAINT "CompanyPostComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyJoinRequest" ADD CONSTRAINT "CompanyJoinRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyJoinRequest" ADD CONSTRAINT "CompanyJoinRequest_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyJoinRequest" ADD CONSTRAINT "CompanyJoinRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyApplication" ADD CONSTRAINT "CompanyApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyApplication" ADD CONSTRAINT "CompanyApplication_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchJob" ADD CONSTRAINT "DispatchJob_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchJob" ADD CONSTRAINT "DispatchJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchJob" ADD CONSTRAINT "DispatchJob_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripRecord" ADD CONSTRAINT "TripRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripRecord" ADD CONSTRAINT "TripRecord_sourceJobId_fkey" FOREIGN KEY ("sourceJobId") REFERENCES "DispatchJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStat" ADD CONSTRAINT "UserStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteTrack" ADD CONSTRAINT "RouteTrack_tripRecordId_fkey" FOREIGN KEY ("tripRecordId") REFERENCES "TripRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryPoint" ADD CONSTRAINT "TelemetryPoint_tripRecordId_fkey" FOREIGN KEY ("tripRecordId") REFERENCES "TripRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivePosition" ADD CONSTRAINT "LivePosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivePosition" ADD CONSTRAINT "LivePosition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convoy" ADD CONSTRAINT "Convoy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convoy" ADD CONSTRAINT "Convoy_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvoyParticipant" ADD CONSTRAINT "ConvoyParticipant_convoyId_fkey" FOREIGN KEY ("convoyId") REFERENCES "Convoy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvoyParticipant" ADD CONSTRAINT "ConvoyParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAward" ADD CONSTRAINT "UserAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAward" ADD CONSTRAINT "UserAward_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryIngestionAudit" ADD CONSTRAINT "TelemetryIngestionAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryIngestionAudit" ADD CONSTRAINT "TelemetryIngestionAudit_tripRecordId_fkey" FOREIGN KEY ("tripRecordId") REFERENCES "TripRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyRankHistory" ADD CONSTRAINT "MonthlyRankHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyRankHistory" ADD CONSTRAINT "MonthlyRankHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

