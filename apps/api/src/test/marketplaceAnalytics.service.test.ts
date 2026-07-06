/**
 * Impression & Click count increment tests
 * Part of Day 4 marketplace analytics testing checklist.
 *
 * Assumes:
 *  - Vitest
 *  - A real (test) Postgres DB reachable via DATABASE_URL, migrated with
 *    the MarketplaceImpression / MarketplaceClick models from schema.prisma
 *  - The Prisma client is re-exported from the @funtush/database workspace
 *    package (adjust the import below if your package name differs)
 *  - marketplaceAnalytics.service.ts (same directory) exports:
 *      recordImpression(agencyId: string)
 *      recordClick(agencyId: string, trekkerId: string | null, destination: string, searchQuery?: string)
 *
 * Setup notes specific to this schema:
 *  - Agency requires a tierId (FK -> SubscriptionTier), so we create a
 *    throwaway SubscriptionTier first.
 *  - Trekker does NOT have its own name/email — it has a userId (FK -> User).
 *    So we create a User first, then a Trekker pointing at it.
 *  - MarketplaceClick's FK field to Trekker is `treklerId` (this typo exists
 *    in the schema itself, not introduced by this test file).
 */

import { PrismaClient } from "@funtush/database";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  recordImpression,
  recordClick,
} from "../services/marketplaceAnalytics.service.js";


const prisma = new PrismaClient();

// We deliberately avoid constructing an exact "today" Date to query by,
// since recordImpression's internal date truncation (local time vs UTC)
// may not match a date we compute here. Instead we look up the most
// recent impression row for the agency — safe because each test clears
// rows for this agency in beforeEach, so at most one row exists.
async function getImpressionRow(agencyId: string) {
  return prisma.marketplaceImpression.findFirst({
    where: { agencyId },
    orderBy: { updatedAt: "desc" },
  });
}

// Creates a throwaway Agency (and the SubscriptionTier it requires).
// Returns both ids so callers can clean up the tier too if desired.
async function createTestAgency(label: string) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const tier = await prisma.subscriptionTier.create({
    data: {
      name: `Test Tier ${suffix}`,
      maxStaff: 5,
      maxGuides: 5,
      monthlyPrice: 0,
      features: {},
    },
  });

  const agency = await prisma.agency.create({
    data: {
      name: `${label} ${suffix}`,
      email: `agency-${suffix}@example.test`,
      slug: `agency-${suffix}`,
      tierId: tier.id,
    },
  });

  return { agencyId: agency.id, tierId: tier.id };
}

async function deleteTestAgency(agencyId: string, tierId: string) {
  await prisma.marketplaceClick.deleteMany({ where: { agencyId } });
  await prisma.marketplaceImpression.deleteMany({ where: { agencyId } });
  await prisma.agency.delete({ where: { id: agencyId } });
  await prisma.subscriptionTier.delete({ where: { id: tierId } });
}

// Creates a throwaway User + Trekker pair. Returns the Trekker id
// (the id that MarketplaceClick.treklerId points at).
async function createTestTrekker() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const user = await prisma.user.create({
    data: {
      email: `trekker-${suffix}@example.test`,
      passwordHash: "test-hash",
      role: "STAFF",
      roleType: "TREKKER",
    },
  });

  const trekker = await prisma.trekker.create({
    data: {
      userId: user.id,
      fullName: "Test Trekker",
    },
  });

  return { trekkerId: trekker.id, userId: user.id };
}

async function deleteTestTrekker(trekkerId: string, userId: string) {
  await prisma.trekker.delete({ where: { id: trekkerId } });
  await prisma.user.delete({ where: { id: userId } });
}

describe("marketplaceAnalytics.service — impression & click counting", () => {
  let agencyId: string;
  let tierId: string;
  let trekkerId: string;
  let userId: string;

  beforeAll(async () => {
    const agencySetup = await createTestAgency("Test Agency - Impression Counts");
    agencyId = agencySetup.agencyId;
    tierId = agencySetup.tierId;

    const trekkerSetup = await createTestTrekker();
    trekkerId = trekkerSetup.trekkerId;
    userId = trekkerSetup.userId;
  });

  afterAll(async () => {
    await deleteTestAgency(agencyId, tierId);
    await deleteTestTrekker(trekkerId, userId);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset counters between tests so each test starts from zero.
    await prisma.marketplaceClick.deleteMany({ where: { agencyId } });
    await prisma.marketplaceImpression.deleteMany({ where: { agencyId } });
  });

  test("recordImpression creates a row with impressionCount = 1 on first call", async () => {
    await recordImpression(agencyId);

    const row = await getImpressionRow(agencyId);

    expect(row).not.toBeNull();
    expect(row?.impressionCount).toBe(1);
    expect(row?.clickCount).toBe(0);
    expect(row?.conversionCount).toBe(0);
  });

  test("recordImpression increments impressionCount on repeated calls for the same day", async () => {
    await recordImpression(agencyId);
    await recordImpression(agencyId);
    await recordImpression(agencyId);

    const row = await getImpressionRow(agencyId);

    expect(row?.impressionCount).toBe(3);
  });

  test("recordImpression for multiple agencies does not cross-contaminate counts", async () => {
    const other = await createTestAgency("Test Agency - Other");

    try {
      await recordImpression(agencyId);
      await recordImpression(agencyId);
      await recordImpression(other.agencyId);

      const mine = await getImpressionRow(agencyId);
      const otherRow = await getImpressionRow(other.agencyId);

      expect(mine?.impressionCount).toBe(2);
      expect(otherRow?.impressionCount).toBe(1);
    } finally {
      await deleteTestAgency(other.agencyId, other.tierId);
    }
  });

  test("recordClick creates a MarketplaceClick row with correct fields", async () => {
    const click = await recordClick(agencyId, trekkerId, "everest-base-camp", "everest");

    expect(click).toBeTruthy();
    expect(click.agencyId).toBe(agencyId);
    expect(click.treklerId).toBe(trekkerId);
    expect(click.destination).toBe("everest-base-camp");
    expect(click.searchQuery).toBe("everest");

    const rows = await prisma.marketplaceClick.findMany({ where: { agencyId } });
    expect(rows).toHaveLength(1);
  });

  test("recordClick increments the same day's clickCount on the impressions summary row", async () => {
    // Simulate: agency was impressed once, then clicked twice
    await recordImpression(agencyId);
    await recordClick(agencyId, trekkerId, "everest-base-camp", "everest");
    await recordClick(agencyId, trekkerId, "annapurna-circuit", "annapurna");

    const row = await getImpressionRow(agencyId);

    expect(row?.impressionCount).toBe(1);
    expect(row?.clickCount).toBe(2);

    const clicks = await prisma.marketplaceClick.findMany({ where: { agencyId } });
    expect(clicks).toHaveLength(2);
  });

  test("recordClick works even with no prior impression recorded (creates/upserts the day row)", async () => {
    await recordClick(agencyId, trekkerId, "everest-base-camp", "everest");

    const row = await getImpressionRow(agencyId);

    // Depending on implementation this may create a fresh row with
    // impressionCount 0 and clickCount 1 — adjust expectation if your
    // recordClick implementation intentionally requires a prior impression.
    expect(row).not.toBeNull();
    expect(row?.clickCount).toBe(1);
  });

  test("recordClick with an anonymous (no trekker) click still increments counts", async () => {
    await recordClick(agencyId, null, "everest-base-camp", "everest");

    const row = await getImpressionRow(agencyId);
    const clicks = await prisma.marketplaceClick.findMany({ where: { agencyId } });

    expect(row?.clickCount).toBe(1);
    expect(clicks).toHaveLength(1);
    expect(clicks[0].treklerId).toBeNull();
  });
});