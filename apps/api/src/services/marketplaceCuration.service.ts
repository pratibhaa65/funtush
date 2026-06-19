import { db } from "@funtush/database";
import { LISTABLE_AGENCY, roundRating } from "./marketplaceDirectory.service.js";

/**
 * ── Marketplace curation service (Week 3 · Day 4) ────────────────────────────
 *
 * Powers the PUBLIC, curated homepage sections of the central marketplace:
 *
 *   GET /marketplace/featured   → a mix of Sponsored (Large-tier boosted),
 *                                 highest-rated, and most-booked-this-month packages
 *   GET /marketplace/trending   → packages with the most inquiries in the last 7 days
 *   GET /marketplace/seasonal   → packages whose destination's best season matches
 *                                 the current month
 *
 * Why Postgres and not Meilisearch?
 * ─────────────────────────────────
 * Like the Day 3 directory pages, these are NOT free-text searches — they are
 * deterministic curation queries built from aggregations (rating averages,
 * booking counts) and joins. Postgres is exactly the right tool, so we query
 * Prisma directly. (The Backend Guide rule "search goes through Meilisearch" is
 * about the search box, not these browse/curate surfaces.)
 *
 * Visibility rule (Backend Guide §6 & §14)
 * ────────────────────────────────────────
 * Every query reuses `LISTABLE_AGENCY` (ACTIVE, non-FREE) so a Trial / Locked /
 * FREE agency can never surface in a curated section.
 */

/* ── Shared package shape returned by every curated section ──────────────────
 *
 * Keeping one shape means the homepage can render any section with the same card
 * component, and the `sponsored` flag is consistently present everywhere.
 */
export interface CuratedPackage {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  durationDays: number;
  pricePerPerson: number;
  difficulty: string;
  destinations: string[];
  agency: {
    id: string;
    name: string;
    slug: string;
    tier: string;
    /** Correction #2: true whenever the agency's priority_override is above baseline. */
    sponsored: boolean;
  };
}

/**
 * The exact set of relations every curated query needs to build a CuratedPackage.
 * Declared once and reused by every query below so the SELECT stays in lockstep
 * with the `toCuratedPackage` mapper.
 */
const CURATED_PACKAGE_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  durationDays: true,
  pricePerPerson: true,
  difficulty: true,
  destinations: { select: { name: true } },
  agency: {
    select: {
      id: true,
      name: true,
      slug: true,
      priorityOverride: true,
      tier: { select: { name: true } },
    },
  },
} as const;

/** The row shape produced by `CURATED_PACKAGE_SELECT`. */
type CuratedPackageRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  durationDays: number;
  pricePerPerson: unknown; // Prisma Decimal
  difficulty: string;
  destinations: { name: string }[];
  agency: {
    id: string;
    name: string;
    slug: string;
    priorityOverride: number;
    tier: { name: string };
  };
};

/** Turn a raw Prisma row into the flat CuratedPackage the API returns. */
function toCuratedPackage(row: CuratedPackageRow): CuratedPackage {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    durationDays: row.durationDays,
    pricePerPerson: Number(row.pricePerPerson),
    difficulty: row.difficulty,
    destinations: row.destinations.map((d) => d.name),
    agency: {
      id: row.agency.id,
      name: row.agency.name,
      slug: row.agency.slug,
      tier: row.agency.tier.name,
      sponsored: row.agency.priorityOverride > 0,
    },
  };
}

/** "An agency that may be listed AND is published" — the base filter for any package query. */
const PUBLISHED_LISTABLE_PACKAGE = {
  status: "PUBLISHED" as const,
  agency: LISTABLE_AGENCY,
};

/* ── 1. Featured ──────────────────────────────────────────────────────────── */

export interface FeaturedResult {
  sponsored: CuratedPackage[];
  topRated: (CuratedPackage & { rating: number | null; reviewCount: number })[];
  mostBookedThisMonth: (CuratedPackage & { bookingsThisMonth: number })[];
}

/** How many packages each featured section returns. */
const FEATURED_PER_SECTION = 8;

/**
 * The featured homepage block. Returns three independently-curated lists
 * (Backend Guide: "Homepage sections return curated content"):
 *
 *   • sponsored          — Large-tier agencies a Super Admin has boosted
 *   • topRated           — packages from the highest-rated agencies
 *   • mostBookedThisMonth — packages with the most bookings since the 1st of the month
 */
export async function getFeatured(): Promise<FeaturedResult> {
  const [sponsored, topRated, mostBookedThisMonth] = await Promise.all([
    getSponsoredPackages(),
    getTopRatedPackages(),
    getMostBookedThisMonth(),
  ]);
  return { sponsored, topRated, mostBookedThisMonth };
}

/** Published packages from LARGE-tier agencies that a Super Admin has boosted (priority_override > 0). */
async function getSponsoredPackages(): Promise<CuratedPackage[]> {
  const rows = await db.trekPackage.findMany({
    where: {
      status: "PUBLISHED",
      agency: { ...LISTABLE_AGENCY, tier: { name: "LARGE" }, priorityOverride: { gt: 0 } },
    },
    // Boost order: the strongest override first, then newest.
    orderBy: [{ agency: { priorityOverride: "desc" } }, { createdAt: "desc" }],
    take: FEATURED_PER_SECTION,
    select: CURATED_PACKAGE_SELECT,
  });
  return rows.map(toCuratedPackage);
}

/**
 * Packages from the highest-rated agencies. Reviews live at the agency level, so
 * we rank agencies by their average review score, then surface one-or-more
 * packages from the best agencies.
 */
async function getTopRatedPackages(): Promise<
  (CuratedPackage & { rating: number | null; reviewCount: number })[]
> {
  // Average rating + review count per agency, computed in one grouped query.
  const ratings = await db.review.groupBy({
    by: ["agencyId"],
    where: { verified: true, flags: { none: { status: "REMOVED" } } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  if (ratings.length === 0) return [];

  // Sort agencies by average rating (desc); a tie breaks toward more reviews.
  const rankedAgencies = ratings
    .sort((a, b) => (b._avg.rating ?? 0) - (a._avg.rating ?? 0) || b._count.rating - a._count.rating)
    .slice(0, FEATURED_PER_SECTION);

  const ratingByAgency = new Map(rankedAgencies.map((r) => [r.agencyId, r]));

  // One package per top agency (newest), keeping only agencies that are still listable.
  const rows = await db.trekPackage.findMany({
    where: {
      status: "PUBLISHED",
      agency: { ...LISTABLE_AGENCY, id: { in: rankedAgencies.map((r) => r.agencyId) } },
    },
    orderBy: { createdAt: "desc" },
    distinct: ["agencyId"], // at most one package per agency in this section
    select: CURATED_PACKAGE_SELECT,
  });

  return rows
    .map((row) => {
      const r = ratingByAgency.get(row.agency.id);
      return {
        ...toCuratedPackage(row),
        rating: roundRating(r?._avg.rating),
        reviewCount: r?._count.rating ?? 0,
      };
    })
    // Preserve the rating-ranked order (the findMany above ordered by date, not rating).
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount);
}

/** Packages with the most bookings created since the 1st of the current month. */
async function getMostBookedThisMonth(): Promise<(CuratedPackage & { bookingsThisMonth: number })[]> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Count bookings per package created this month, busiest first.
  const grouped = await db.booking.groupBy({
    by: ["packageId"],
    where: { createdAt: { gte: startOfMonth } },
    _count: { packageId: true },
    orderBy: { _count: { packageId: "desc" } },
    take: FEATURED_PER_SECTION,
  });
  if (grouped.length === 0) return [];

  const countByPackage = new Map(grouped.map((g) => [g.packageId, g._count.packageId]));

  const rows = await db.trekPackage.findMany({
    where: { ...PUBLISHED_LISTABLE_PACKAGE, id: { in: grouped.map((g) => g.packageId) } },
    select: CURATED_PACKAGE_SELECT,
  });

  return rows
    .map((row) => ({ ...toCuratedPackage(row), bookingsThisMonth: countByPackage.get(row.id) ?? 0 }))
    .sort((a, b) => b.bookingsThisMonth - a.bookingsThisMonth);
}

/* ── 2. Trending ──────────────────────────────────────────────────────────── */

/** Window (days) used to define "trending". */
const TRENDING_WINDOW_DAYS = 7;
const TRENDING_LIMIT = 12;

/**
 * Packages with the most inquiries in the last 7 days. Every booking begins life
 * as an inquiry (status INQUIRY), so counting bookings created in the window is
 * the inquiry count.
 */
export async function getTrending(): Promise<(CuratedPackage & { inquiriesLast7Days: number })[]> {
  const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const grouped = await db.booking.groupBy({
    by: ["packageId"],
    where: { createdAt: { gte: since } },
    _count: { packageId: true },
    orderBy: { _count: { packageId: "desc" } },
    take: TRENDING_LIMIT,
  });
  if (grouped.length === 0) return [];

  const countByPackage = new Map(grouped.map((g) => [g.packageId, g._count.packageId]));

  const rows = await db.trekPackage.findMany({
    where: { ...PUBLISHED_LISTABLE_PACKAGE, id: { in: grouped.map((g) => g.packageId) } },
    select: CURATED_PACKAGE_SELECT,
  });

  return rows
    .map((row) => ({ ...toCuratedPackage(row), inquiriesLast7Days: countByPackage.get(row.id) ?? 0 }))
    .sort((a, b) => b.inquiriesLast7Days - a.inquiriesLast7Days);
}

/* ── 3. Seasonal ──────────────────────────────────────────────────────────── */

const SEASONAL_LIMIT = 24;

// Northern-hemisphere season for each month (0 = January … 11 = December).
const SEASON_BY_MONTH = [
  "winter", "winter", "spring", "spring", "spring", "summer",
  "summer", "summer", "autumn", "autumn", "autumn", "winter",
];
const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Build the set of lowercase tokens that mean "this month" for a `best_season`
 * string. `best_season` is free-text per destination (e.g. "Autumn", "Mar-May",
 * "September-November"), so we match generously against: the full month name, its
 * 3-letter abbreviation, the season word, and a couple of common synonyms.
 */
function currentMonthTokens(now: Date): string[] {
  const m = now.getMonth();
  const monthName = MONTH_NAMES[m];
  const season = SEASON_BY_MONTH[m];
  const tokens = [monthName, monthName.slice(0, 3), season];
  if (season === "autumn") tokens.push("fall");
  if (season === "summer") tokens.push("monsoon"); // Nepal trekking calendar
  return tokens;
}

/** True if a destination's best-season text refers to the current month/season. */
function seasonMatches(bestSeason: string | null, tokens: string[]): boolean {
  if (!bestSeason) return false;
  const text = bestSeason.toLowerCase();
  return tokens.some((t) => text.includes(t));
}

/**
 * Packages whose destination's best season matches the current month. A package
 * qualifies if ANY of its destinations is in season right now.
 */
export async function getSeasonal(): Promise<(CuratedPackage & { matchedSeasons: string[] })[]> {
  const tokens = currentMonthTokens(new Date());

  // best_season is free-text, so we can't express the fuzzy match in SQL; fetch
  // published, listable packages with their destinations' seasons and filter in app.
  const rows = await db.trekPackage.findMany({
    where: PUBLISHED_LISTABLE_PACKAGE,
    orderBy: { createdAt: "desc" },
    select: {
      ...CURATED_PACKAGE_SELECT,
      destinations: { select: { name: true, bestSeason: true } },
    },
  });

  return rows
    .map((row) => {
      const matched = row.destinations
        .filter((d) => seasonMatches(d.bestSeason, tokens))
        .map((d) => d.bestSeason as string);
      return { row, matched };
    })
    .filter(({ matched }) => matched.length > 0)
    .slice(0, SEASONAL_LIMIT)
    .map(({ row, matched }) => ({
      ...toCuratedPackage(row as CuratedPackageRow),
      matchedSeasons: [...new Set(matched)],
    }));
}
