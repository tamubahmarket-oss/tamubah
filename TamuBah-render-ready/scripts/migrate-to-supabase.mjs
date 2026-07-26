// One-off migration: reads your existing db.json and inserts everything into
// Supabase. Existing seller passwords are stored in plain text in db.json
// (as noted in the original server.ts comment) — this script hashes every
// password with bcrypt before it lands in Supabase, so nothing plain-text
// ever gets written to the new database.
//
// Usage:
//   1. npm install
//   2. Fill in .env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
//   3. Run the schema.sql file in the Supabase SQL editor first
//   4. node scripts/migrate-to-supabase.mjs
//
// Safe to re-run: existing rows are upserted by id, so running it twice
// won't create duplicates.

import "dotenv/config";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env before running this script.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DB_PATH = path.join(process.cwd(), "db.json");

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`No db.json found at ${DB_PATH}. Nothing to migrate.`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  const sellers = raw.sellers || [];
  const products = raw.products || [];
  const reviews = raw.reviews || [];
  const reports = raw.reports || [];
  const stats = raw.stats || {};

  console.log(`Found ${sellers.length} sellers, ${products.length} products, ${reviews.length} reviews, ${reports.length} reports.`);

  // --- sellers (hash plaintext passwords along the way) ---
  console.log("Migrating sellers...");
  for (const s of sellers) {
    const alreadyHashed = typeof s.passwordHash === "string" && s.passwordHash.startsWith("$2");
    const passwordHash = alreadyHashed ? s.passwordHash : await bcrypt.hash(s.passwordHash || "changeme123", 10);

    const { error } = await supabase.from("sellers").upsert({
      id: s.id,
      owner_name: s.ownerName,
      email: s.email,
      business_name: s.businessName,
      category: s.category,
      ssm_number: s.ssmNumber || "",
      address: s.address,
      phone_number: s.phoneNumber,
      location: s.location,
      password_hash: passwordHash,
      logo_url: s.logoUrl || null,
      established_year: s.establishedYear || null,
      dream: s.dream || null,
      is_verified: !!s.isVerified,
      is_approved: !!s.isApproved,
      verification_tier: s.verificationTier || "None",
      show_phone_publicly: s.showPhonePublicly !== undefined ? !!s.showPhonePublicly : true,
      contact_count: s.contactCount || 0,
    });
    if (error) console.error(`  Failed seller ${s.id} (${s.businessName}):`, error.message);
  }
  console.log("Sellers done.");

  // --- products ---
  console.log("Migrating products...");
  for (const p of products) {
    const { error } = await supabase.from("products").upsert({
      id: p.id,
      title: p.title,
      category: p.category,
      description: p.description,
      price: p.price,
      image_url: p.imageUrl,
      is_available: p.isAvailable !== undefined ? !!p.isAvailable : true,
      is_pinned: !!p.isPinned,
      seller_id: p.sellerId,
      created_at: p.createdAt || new Date().toISOString(),
    });
    if (error) console.error(`  Failed product ${p.id} (${p.title}):`, error.message);
  }
  console.log("Products done.");

  // --- reviews ---
  console.log("Migrating reviews...");
  for (const r of reviews) {
    const { error } = await supabase.from("reviews").upsert({
      id: r.id,
      seller_id: r.sellerId,
      rating: r.rating,
      comment: r.comment || "",
      reviewer_name: r.reviewerName,
      created_at: r.createdAt || new Date().toISOString(),
    });
    if (error) console.error(`  Failed review ${r.id}:`, error.message);
  }
  console.log("Reviews done.");

  // --- reports ---
  console.log("Migrating reports...");
  for (const r of reports) {
    const { error } = await supabase.from("reports").upsert({
      id: r.id,
      seller_id: r.sellerId,
      product_id: r.productId || "",
      reason: r.reason,
      description: r.description,
      reporter_email: r.reporterEmail,
      status: r.status || "open",
      created_at: r.createdAt || new Date().toISOString(),
    });
    if (error) console.error(`  Failed report ${r.id}:`, error.message);
  }
  console.log("Reports done.");

  // --- stats ---
  console.log("Migrating stats...");
  {
    const { error } = await supabase
      .from("app_stats")
      .update({
        visitor_count: stats.visitorCount || 0,
        login_success_count: stats.loginSuccessCount || 0,
        register_success_count: stats.registerSuccessCount || 0,
        contact_seller_count: stats.contactSellerCount || 0,
      })
      .eq("id", 1);
    if (error) console.error("  Failed stats:", error.message);
  }

  // --- admin logs (best-effort, first 500 to avoid a huge insert) ---
  if (Array.isArray(stats.logs) && stats.logs.length > 0) {
    console.log(`Migrating ${Math.min(stats.logs.length, 500)} admin logs...`);
    const logsToInsert = stats.logs.slice(0, 500).map((l) => ({
      id: l.id,
      action: l.action,
      details: l.details,
      created_at: l.timestamp || new Date().toISOString(),
    }));
    const { error } = await supabase.from("admin_logs").upsert(logsToInsert);
    if (error) console.error("  Failed admin logs:", error.message);
  }

  console.log("\nMigration complete!");
  console.log("Next: set ADMIN_BOOTSTRAP_USERNAME / ADMIN_BOOTSTRAP_PASSCODE in .env,");
  console.log("start the server once, and it will create your first admin account automatically.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
