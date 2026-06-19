import express from "express";
import {
  searchMarketplace,
  getAgencies,
  getAgency,
  getDestinations,
  getDestination,
  featured,
  trending,
  seasonal,
} from "../controllers/marketplace.controller.js";

/**
 * Public marketplace routes (Week 3 · Day 2).
 *
 * No auth middleware: the marketplace is open to the public. The controller
 * still *optionally* reads a Bearer token to personalize results for logged-in
 * trekkers, but a request without one is perfectly valid.
 */
const router = express.Router();

// GET /marketplace/packages            → all published packages, ranked by visibility score
// GET /marketplace/packages?q=everest&difficulty=moderate&price_max=1500 → full-text + filters
router.get("/packages", searchMarketplace);

// ── Agency directory (Day 3) ────────────────────────────────────────────────
// GET /marketplace/agencies            → all agencies with tier, rating, top destination tags
// GET /marketplace/agencies/:slug      → public agency profile (packages, reviews, badges)
router.get("/agencies", getAgencies);
router.get("/agencies/:slug", getAgency);

// ── Destination directory (Day 3) ──────────────────────────────────────────
// GET /marketplace/destinations        → all master destinations with package count
// GET /marketplace/destinations/:slug  → master destination page (agencies operating there)
router.get("/destinations", getDestinations);
router.get("/destinations/:slug", getDestination);

// ── Curated homepage sections (Day 4) ───────────────────────────────────────
// GET /marketplace/featured   → Sponsored (Large-tier boosted) + highest-rated + most-booked-this-month
// GET /marketplace/trending   → packages with the most inquiries in the last 7 days
// GET /marketplace/seasonal   → packages whose destination's best season matches the current month
router.get("/featured", featured);
router.get("/trending", trending);
router.get("/seasonal", seasonal);

export default router;
