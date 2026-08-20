import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const localEnvPath = path.resolve(scriptDir, "..", ".env");
if (!process.env.DATABASE_URL && existsSync(localEnvPath)) {
  for (const line of readFileSync(localEnvPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    if (key && process.env[key] === undefined) process.env[key] = line.slice(separator + 1).trim();
  }
}
const prisma = new PrismaClient();
const defaultExport = path.resolve(scriptDir, "..", "..", "..", "Neu Website", "migration", "export-2026-08-14");
const exportRoot = path.resolve(process.env.LEGACY_EXPORT_DIR || process.argv[2] || defaultExport);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const toDate = (value) => (value ? new Date(value) : undefined);
const normalizeEmail = (value) => value?.trim().toLowerCase() || null;

async function loadManifest() {
  const raw = await readFile(path.join(exportRoot, "manifest.json"));
  return { manifest: JSON.parse(raw.toString("utf8")), manifestSha256: sha256(raw) };
}

function safeExportPath(relativePath) {
  const resolved = path.resolve(exportRoot, ...relativePath.split(/[\\/]+/));
  if (resolved !== exportRoot && !resolved.startsWith(`${exportRoot}${path.sep}`)) {
    throw new Error(`Unsafe export path: ${relativePath}`);
  }
  return resolved;
}

async function verifyExport(manifest) {
  for (const entry of manifest.files) {
    const raw = await readFile(safeExportPath(entry.path));
    const lines = raw.toString("utf8").split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length !== entry.rows) throw new Error(`Row count mismatch: ${entry.path}`);
    if (sha256(raw) !== entry.sha256) throw new Error(`SHA-256 mismatch: ${entry.path}`);
  }
}

async function readJsonl(relativePath) {
  const raw = await readFile(safeExportPath(relativePath), "utf8");
  return raw.split(/\r?\n/).filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
}

function rankSteamOwner(userId, vtcs, members) {
  if (vtcs.some((vtc) => vtc.created_by === userId)) return 100;
  const role = members.find((member) => member.user_id === userId)?.role;
  return role === "owner" ? 90 : role === "admin" ? 80 : role === "driver" ? 70 : 0;
}

function buildSteamAssignments(profiles, vtcs, members) {
  const claims = new Map();
  for (const profile of profiles) {
    if (!profile.steam_id) continue;
    const current = claims.get(profile.steam_id) || [];
    current.push(profile.user_id);
    claims.set(profile.steam_id, current);
  }

  const winners = new Map();
  for (const [steamId, users] of claims) {
    users.sort((a, b) => rankSteamOwner(b, vtcs, members) - rankSteamOwner(a, vtcs, members) || a.localeCompare(b));
    winners.set(steamId, users[0]);
  }

  return new Map(profiles.map((profile) => [
    profile.user_id,
    profile.steam_id && winners.get(profile.steam_id) === profile.user_id
      ? profile.steam_id
      : `legacy:${profile.user_id}`,
  ]));
}

const membershipRole = (role) => role === "owner" ? "OWNER" : role === "admin" ? "DISPATCHER" : "DRIVER";
const globalRole = (role) => role === "owner" ? "OWNER" : role === "admin" ? "DISPATCHER" : "EMPLOYEE";

async function main() {
  const { manifest, manifestSha256 } = await loadManifest();
  await verifyExport(manifest);

  const [authUsers, authIdentities, profiles, vtcs, members] = await Promise.all([
    readJsonl("private/auth_users/0001.jsonl"),
    readJsonl("private/auth_identities/0001.jsonl"),
    readJsonl("data/profiles/0001.jsonl"),
    readJsonl("data/vtcs/0001.jsonl"),
    readJsonl("data/vtc_members/0001.jsonl"),
  ]);

  for (const [name, rows] of Object.entries({ auth_users: authUsers, auth_identities: authIdentities, profiles, vtcs, vtc_members: members })) {
    if (rows.length !== manifest.expectedCounts[name]) throw new Error(`Expected count mismatch for ${name}`);
  }

  const profilesByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const authByUser = new Map(authUsers.map((user) => [user.id, user]));
  const steamAssignments = buildSteamAssignments(profiles, vtcs, members);
  let reusedExistingUsers = 0;
  let alreadyImported = false;

  await prisma.$transaction(async (tx) => {
    const previous = await tx.legacyImportAudit.findUnique({ where: { exportId: manifest.exportId } });
    if (previous) {
      if (previous.manifestSha256 !== manifestSha256) throw new Error("Export ID already imported with a different manifest");
      alreadyImported = true;
      console.log(`Legacy export ${manifest.exportId} is already imported.`);
      return;
    }

    const userIdMap = new Map();
    for (const authUser of authUsers) {
      const profile = profilesByUser.get(authUser.id);
      if (!profile) throw new Error(`Missing profile for user ${authUser.id}`);
      const email = normalizeEmail(authUser.email);
      const [existingByLegacyId, existingByEmail] = await Promise.all([
        tx.user.findUnique({ where: { id: authUser.id } }),
        email ? tx.user.findUnique({ where: { email } }) : null,
      ]);
      if (existingByLegacyId && existingByEmail && existingByLegacyId.id !== existingByEmail.id) {
        throw new Error(`Legacy ID and email resolve to different users for ${email}`);
      }
      const canonicalUserId = existingByLegacyId?.id || existingByEmail?.id || authUser.id;
      userIdMap.set(authUser.id, canonicalUserId);
      if (canonicalUserId !== authUser.id) reusedExistingUsers += 1;

      await tx.user.upsert({
        where: { id: canonicalUserId },
        create: {
          id: canonicalUserId,
          email,
          steamId: steamAssignments.get(authUser.id) || `legacy:${authUser.id}`,
          displayName: profile.display_name || email || authUser.id,
          avatarUrl: profile.avatar_url,
          passwordHash: authUser.encrypted_password || null,
          profileVisibility: profile.live_visibility || "private",
          globalRoles: ["LONER"],
          createdAt: toDate(authUser.created_at),
          updatedAt: toDate(authUser.updated_at),
        },
        update: {
          email,
          displayName: profile.display_name || email || authUser.id,
          avatarUrl: profile.avatar_url,
          passwordHash: authUser.encrypted_password || undefined,
          profileVisibility: profile.live_visibility || "private",
          updatedAt: toDate(authUser.updated_at),
        },
      });
    }

    for (const vtc of vtcs) {
      if (!authByUser.has(vtc.created_by)) throw new Error(`Missing company owner ${vtc.created_by}`);
      const ownerId = userIdMap.get(vtc.created_by);
      if (!ownerId) throw new Error(`Missing mapped company owner ${vtc.created_by}`);
      await tx.company.upsert({
        where: { id: vtc.id },
        create: {
          id: vtc.id,
          name: vtc.name,
          tag: vtc.tag,
          description: vtc.description,
          slug: vtc.slug,
          ownerId,
          logoUrl: vtc.logo_url,
          isActive: true,
          createdAt: toDate(vtc.created_at),
          updatedAt: toDate(vtc.updated_at),
        },
        update: {
          name: vtc.name,
          tag: vtc.tag,
          description: vtc.description,
          slug: vtc.slug,
          ownerId,
          logoUrl: vtc.logo_url,
          isActive: true,
          updatedAt: toDate(vtc.updated_at),
        },
      });
    }

    for (const member of members) {
      const role = membershipRole(member.role);
      const joinedAt = toDate(member.joined_at);
      const userId = userIdMap.get(member.user_id);
      if (!userId) throw new Error(`Missing mapped member ${member.user_id}`);
      await tx.companyMembership.upsert({
        where: { userId_companyId: { userId, companyId: member.vtc_id } },
        create: {
          userId,
          companyId: member.vtc_id,
          companyRole: role,
          membershipStatus: "ACTIVE",
          joinedAt,
          createdAt: joinedAt,
        },
        update: { companyRole: role, membershipStatus: "ACTIVE", joinedAt },
      });
      await tx.user.update({
        where: { id: userId },
        data: { companyId: member.vtc_id, companyRole: role, globalRoles: [globalRole(member.role)] },
      });
    }

    const socialAccounts = [];
    for (const identity of authIdentities.filter((item) => item.provider !== "email")) {
      const userId = userIdMap.get(identity.user_id);
      if (!userId) throw new Error(`Missing mapped identity user ${identity.user_id}`);
      socialAccounts.push({
        userId,
        provider: identity.provider,
        providerUserId: identity.provider_id,
        providerEmail: normalizeEmail(identity.email || identity.identity_data?.email),
        avatarUrl: identity.identity_data?.avatar_url || identity.identity_data?.picture || null,
        createdAt: toDate(identity.created_at),
      });
    }
    for (const profile of profiles) {
      const userId = userIdMap.get(profile.user_id);
      if (!userId) throw new Error(`Missing mapped profile user ${profile.user_id}`);
      if (profile.discord_id) socialAccounts.push({ userId, provider: "discord", providerUserId: profile.discord_id, providerEmail: null, avatarUrl: null, createdAt: toDate(profile.created_at) });
      if (profile.steam_id && steamAssignments.get(profile.user_id) === profile.steam_id) socialAccounts.push({ userId, provider: "steam", providerUserId: profile.steam_id, providerEmail: null, avatarUrl: profile.avatar_url, createdAt: toDate(profile.created_at) });
    }

    for (const account of socialAccounts) {
      const existing = await tx.socialAccount.findUnique({ where: { provider_providerUserId: { provider: account.provider, providerUserId: account.providerUserId } } });
      if (existing && existing.userId !== account.userId) throw new Error(`Provider conflict for ${account.provider}:${account.providerUserId}`);
      await tx.socialAccount.upsert({
        where: { provider_providerUserId: { provider: account.provider, providerUserId: account.providerUserId } },
        create: account,
        update: { providerEmail: account.providerEmail, avatarUrl: account.avatarUrl },
      });
    }

    await tx.legacyImportAudit.create({
      data: {
        exportId: manifest.exportId,
        manifestSha256,
        sourceSystem: `supabase:${manifest.sourceProjectRef}`,
        importedCounts: { users: authUsers.length, identities: socialAccounts.length, companies: vtcs.length, memberships: members.length },
      },
    });
  }, { timeout: 30_000 });

  if (!alreadyImported) {
    console.log(`Imported ${authUsers.length} users, ${vtcs.length} companies and ${members.length} memberships; reused ${reusedExistingUsers} existing user.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
