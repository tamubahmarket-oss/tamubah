import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createServer as createViteServer } from "vite";
import { createRequire } from "module";

// ============================================================================
// WEBSOCKET POLYFILL — @supabase/realtime-js requires a native WebSocket
// implementation (available in Node 22+) even if you never open a realtime
// channel, since it checks for one at client construction time. This repo is
// pinned to Node 22+ (see .nvmrc / package.json "engines" / render.yaml
// NODE_VERSION), so this is just a safety net in case a host ignores that
// pin and runs an older Node version. Uses a synchronous require (via
// createRequire) rather than top-level await, since the build's esbuild step
// bundles to CommonJS, which doesn't support top-level await.
// ============================================================================
if (typeof globalThis.WebSocket === "undefined") {
  const require = createRequire(import.meta.url);
  const { WebSocket } = require("ws");
  // @ts-expect-error - ws's WebSocket is close enough to the DOM one for realtime-js's purposes
  globalThis.WebSocket = WebSocket;
}

// ============================================================================
// SUPABASE CLIENT (server-side only — uses the service role key, which
// bypasses Row Level Security. This key must NEVER be sent to the browser.)
// ============================================================================
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "TamuBah <support@tamubah.com>";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://www.tamubah.com";
const COMMUNITY_CATEGORIES = ["General Discussion", "Business Tips", "Marketing & Sales", "Success Stories", "Questions & Help"];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
    "Copy .env.example to .env and fill them in from your Supabase project settings."
  );
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
// ============================================================================
// ADMIN AUTH
// Admin accounts now live in the `admin_users` table (managed from the Admin
// Panel's "Admins" tab) instead of a single shared ADMIN_PASSCODE env var.
// On first boot, if admin_users is empty, we bootstrap one admin account
// from ADMIN_BOOTSTRAP_USERNAME / ADMIN_BOOTSTRAP_PASSCODE so you're never
// locked out of a fresh database.
// ============================================================================
const ADMIN_SESSION_COOKIE = "tamubah_admin_session";
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const STORAGE_BUCKET = "tamubah-images";

// Creates the public storage bucket used for product photos & business
// logos if it doesn't exist yet. Safe to run on every boot.
async function ensureStorageBucket() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error("Could not list storage buckets:", error.message);
      return;
    }
    const exists = (buckets || []).some((b) => b.name === STORAGE_BUCKET);
    if (exists) return;

    const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: "10MB",
    });
    if (createError) {
      console.error("Failed to create storage bucket:", createError.message);
    } else {
      console.log(`Created public storage bucket "${STORAGE_BUCKET}".`);
    }
  } catch (err: any) {
    console.error("ensureStorageBucket error:", err.message);
  }
}

// Uploads a base64 data URL (e.g. from client-side canvas compression) to
// Supabase Storage and returns its public URL.
async function uploadDataUrlToStorage(dataUrl: string, pathPrefix: string): Promise<string> {
  const match = dataUrl.match(/^data:((?:image|video)\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image or video data URL.");
  const mime = match[1];
  const base64Data = match[2];
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "webp";
  const buffer = Buffer.from(base64Data, "base64");

  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).substr(2, 8)}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// One-time (per-row) migration: any product/seller image still stored as a
// giant base64 data URL directly in the database gets uploaded to Storage
// and swapped for a lightweight public URL instead. Idempotent — rows
// already migrated are skipped, so this is safe to run on every boot.
// Deletes story rows that expired more than 2 days ago. Recently-expired
// rows are left a little longer just in case, but this keeps the table from
// growing forever. Safe to run on every boot.
function storagePathFromPublicUrl(mediaUrl: string): string | null {
  const publicPrefix = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/`;
  return mediaUrl && mediaUrl.startsWith(publicPrefix) ? mediaUrl.slice(publicPrefix.length) : null;
}

async function deleteStoryMediaFile(mediaUrl: string) {
  const path = storagePathFromPublicUrl(mediaUrl);
  if (!path) return;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) console.error("Failed to remove story file from Storage:", error.message);
}

// Deletes both the database row AND the actual photo/video file in Storage
// for any story that has passed its 24-hour expires_at. Runs at boot and
// again every hour so cleanup happens promptly even if the server stays up
// for days without a fresh deploy (e.g. kept alive by an uptime pinger).
async function pruneExpiredStories() {
  try {
    const { data: expired, error: fetchError } = await supabase
      .from("stories")
      .select("id, media_url")
      .lte("expires_at", new Date().toISOString());
    if (fetchError) throw fetchError;
    if (!expired || expired.length === 0) return;

    // Delete the actual media files from Storage first
    const storagePaths = expired
      .map((s: any) => storagePathFromPublicUrl(s.media_url))
      .filter((p: string | null): p is string => !!p);

    if (storagePaths.length > 0) {
      const { error: removeError } = await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);
      if (removeError) console.error("Failed to remove expired story files from Storage:", removeError.message);
    }

    // Then remove the now-orphaned database rows
    const ids = expired.map((s: any) => s.id);
    const { error: deleteError } = await supabase.from("stories").delete().in("id", ids);
    if (deleteError) throw deleteError;

    console.log(`Deleted ${expired.length} expired stor${expired.length === 1 ? "y" : "ies"} (file + record).`);
  } catch (err: any) {
    console.error("pruneExpiredStories error:", err.message);
  }
}

async function migrateBase64ImagesToStorage() {
  try {
    const { data: products } = await supabase
      .from("products")
      .select("id, image_url")
      .like("image_url", "data:%");

    for (const p of products || []) {
      try {
        const url = await uploadDataUrlToStorage(p.image_url, "products/legacy");
        await supabase.from("products").update({ image_url: url }).eq("id", p.id);
      } catch (err: any) {
        console.error(`Failed to migrate image for product ${p.id}:`, err.message);
      }
    }

    const { data: sellers } = await supabase
      .from("sellers")
      .select("id, logo_url")
      .like("logo_url", "data:%");

    for (const s of sellers || []) {
      try {
        const url = await uploadDataUrlToStorage(s.logo_url, "sellers/legacy");
        await supabase.from("sellers").update({ logo_url: url }).eq("id", s.id);
      } catch (err: any) {
        console.error(`Failed to migrate logo for seller ${s.id}:`, err.message);
      }
    }

    const migratedCount = (products?.length || 0) + (sellers?.length || 0);
    if (migratedCount > 0) {
      console.log(`Migrated ${migratedCount} image(s) from inline base64 to Supabase Storage.`);
    }
  } catch (err: any) {
    console.error("migrateBase64ImagesToStorage error:", err.message);
  }
}

// ---------------------------------------------------------------------------
// EMAIL — sends via Resend's REST API directly (no SDK dependency needed).
// If RESEND_API_KEY isn't set, sends are silently skipped and logged, so the
// app keeps working locally/without email configured.
// ---------------------------------------------------------------------------
async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[email skipped — no RESEND_API_KEY set] would have sent "${subject}" to ${to}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: RESEND_FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend send failed (${res.status}) to ${to}:`, body);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error(`Failed to send email to ${to}:`, err.message);
    return false;
  }
}

// Injects per-page Open Graph / Twitter Card / <title> values into the SPA's
// index.html on the way out, so a shared /product/:id or /seller/:id link
// shows the actual product photo, title and price (or seller's shop info)
// as a rich preview card in WhatsApp/Facebook/Telegram — instead of every
// shared link showing the same generic TamuBah homepage preview.
function injectMetaTags(html: string, meta: { title: string; description: string; image: string; url: string }): string {
  const esc = (s: string) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const title = esc(meta.title);
  const description = esc(meta.description);
  const image = esc(meta.image);
  const url = esc(meta.url);

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${image}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${image}$2`);
}

function emailShell(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#f4f6f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:32px 0;">
  <tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);max-width:600px;">
    <tr><td style="padding:28px 40px 16px;text-align:center;border-bottom:1px solid #eef2f0;">
      <img src="${APP_BASE_URL}/tamubah-logo-email.png" alt="TamuBah" width="180" style="display:block;margin:0 auto;max-width:180px;height:auto;">
    </td></tr>
    <tr><td style="padding:0;"><div style="height:4px;background:linear-gradient(90deg,#059669,#f59e0b,#059669);"></div></td></tr>
    ${bodyHtml}
    <tr><td style="padding:24px 40px;background:#f8fafc;border-top:1px solid #eef2f0;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#94a3b8;">TamuBah — Sabah's Digital Tamu</p>
      <p style="margin:0;font-size:12px;color:#cbd5e1;">support@tamubah.com &nbsp;•&nbsp; www.tamubah.com</p>
    </td></tr>
  </table>
  </td></tr>
  </table>
  </body></html>`;
}

function renderSellerWelcomeEmail(seller: { ownerName: string; businessName: string }, planStatus: "founding" | "trial"): { subject: string; html: string } {
  const ownerFirstName = (seller.ownerName || "there").split(" ")[0];

  if (planStatus === "founding") {
    return {
      subject: `Welcome to TamuBah, ${seller.businessName}! You're one of our first 100 sellers 🎉`,
      html: emailShell(`
        <tr><td style="padding:36px 40px 8px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#059669;">Welcome to TamuBah</p>
          <h2 style="margin:0 0 20px;font-size:22px;color:#0f172a;">Your shop is live, ${ownerFirstName}! 🎉</h2>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
            Great news — <strong>${seller.businessName}</strong> has been approved and is now live on TamuBah!
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#065f46;">
                🌟 <strong>You're a Founding Seller</strong> — one of our first 100. Your account is <strong>free for your first year</strong> on TamuBah, no monthly fee.
              </p>
            </td></tr>
          </table>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">Here's how to get started:</p>
          <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.8;color:#334155;">
            <li>Log in to your seller dashboard</li>
            <li>Add your products and publish your first item</li>
            <li>Share your shop link with customers on WhatsApp and Facebook</li>
          </ul>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#059669;">
            <a href="${APP_BASE_URL}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Go to My Dashboard</a>
          </td></tr></table>
        </td></tr>`),
    };
  }

  return {
    subject: `Welcome to TamuBah, ${seller.businessName}! Your free trial has started`,
    html: emailShell(`
      <tr><td style="padding:36px 40px 8px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#059669;">Welcome to TamuBah</p>
        <h2 style="margin:0 0 20px;font-size:22px;color:#0f172a;">Your shop is live, ${ownerFirstName}!</h2>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
          <strong>${seller.businessName}</strong> has been approved and is now live on TamuBah!
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
          <tr><td style="padding:16px 18px;">
            <p style="margin:0;font-size:14px;line-height:1.6;color:#92400e;">
              🗓️ You're starting a <strong>30-day free trial</strong>. After that, staying active costs just <strong>RM20/month</strong> — this helps keep TamuBah running for sellers across Sabah.
            </p>
          </td></tr>
        </table>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">Here's how to get started:</p>
        <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.8;color:#334155;">
          <li>Log in to your seller dashboard</li>
          <li>Add your products and publish your first item</li>
          <li>Share your shop link with customers</li>
        </ul>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#059669;">
          <a href="${APP_BASE_URL}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Go to My Dashboard</a>
        </td></tr></table>
      </td></tr>`),
  };
}

async function bootstrapAdminIfNeeded() {
  const { count, error } = await supabase
    .from("admin_users")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Could not check admin_users table:", error.message);
    return;
  }
  if ((count || 0) > 0) return;

  const username = process.env.ADMIN_BOOTSTRAP_USERNAME || "admin";
  const passcode = process.env.ADMIN_BOOTSTRAP_PASSCODE || "";
  if (!passcode) {
    console.warn(
      "No admin accounts exist yet, and ADMIN_BOOTSTRAP_PASSCODE is not set. " +
      "Set it in .env and restart the server to create the first admin account."
    );
    return;
  }

  const passcodeHash = await bcrypt.hash(passcode, 10);
  const { error: insertError } = await supabase.from("admin_users").insert({
    id: "admin_" + crypto.randomBytes(8).toString("hex"),
    username,
    passcode_hash: passcodeHash,
  });
  if (insertError) {
    console.error("Failed to bootstrap admin account:", insertError.message);
  } else {
    console.log(`Bootstrapped initial admin account "${username}" from ADMIN_BOOTSTRAP_PASSCODE.`);
  }
}

function parseCookies(header?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx > -1) {
      const key = pair.slice(0, idx).trim();
      const val = decodeURIComponent(pair.slice(idx + 1).trim());
      cookies[key] = val;
    }
  });
  return cookies;
}

async function issueAdminSession(res: express.Response, adminId: string) {
  // Clean up expired sessions opportunistically
  await supabase.from("admin_sessions").delete().lt("expires_at", new Date().toISOString());

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS).toISOString();
  await supabase.from("admin_sessions").insert({ token, admin_id: adminId, expires_at: expiresAt });

  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${ADMIN_SESSION_TTL_MS / 1000}${secureFlag}`
  );
}

async function clearAdminSession(req: express.Request, res: express.Response) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[ADMIN_SESSION_COOKIE];
  if (token) await supabase.from("admin_sessions").delete().eq("token", token);
  res.setHeader("Set-Cookie", `${ADMIN_SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
}

// Attaches req.adminId when valid; otherwise responds 401.
async function requireAdminAuth(req: express.Request & { adminId?: string }, res: express.Response, next: express.NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[ADMIN_SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: "Admin authentication required." });

  const { data: session } = await supabase
    .from("admin_sessions")
    .select("admin_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!session || new Date(session.expires_at) < new Date()) {
    return res.status(401).json({ error: "Admin authentication required." });
  }

  // Sliding expiry: extend session on activity
  const newExpiry = new Date(Date.now() + ADMIN_SESSION_TTL_MS).toISOString();
  await supabase.from("admin_sessions").update({ expires_at: newExpiry }).eq("token", token);

  req.adminId = session.admin_id;
  next();
}

// ============================================================================
// TYPES (API shapes — camelCase, matching what the frontend already expects)
// ============================================================================
interface SellerRow {
  id: string;
  owner_name: string;
  email: string;
  business_name: string;
  category: string;
  ssm_number: string | null;
  address: string;
  phone_number: string;
  location: string;
  password_hash: string;
  logo_url: string | null;
  established_year: string | null;
  dream: string | null;
  is_verified: boolean;
  is_approved: boolean;
  verification_tier: "None" | "Bronze" | "Silver" | "Gold";
  show_phone_publicly: boolean;
  contact_count: number;
  plan_status: "pending" | "founding" | "trial" | "paid" | "expired";
  approved_at: string | null;
  trial_ends_at: string | null;
  next_payment_due: string | null;
  latest_update: string | null;
  latest_update_at: string | null;
  is_official: boolean;
  created_at: string;
}

interface ProductRow {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
  is_pinned: boolean;
  is_published: boolean;
  seller_id: string;
  created_at: string;
}

// snake_case DB row -> camelCase API shape (drops password_hash)
function sellerToApi(s: SellerRow, extra: Record<string, any> = {}) {
  return {
    id: s.id,
    ownerName: s.owner_name,
    email: s.email,
    businessName: s.business_name,
    category: s.category,
    ssmNumber: s.ssm_number || "",
    address: s.address,
    phoneNumber: s.phone_number,
    location: s.location,
    logoUrl: s.logo_url || undefined,
    establishedYear: s.established_year || undefined,
    dream: s.dream || undefined,
    isVerified: !!s.is_verified,
    isApproved: !!s.is_approved,
    verificationTier: s.verification_tier || "None",
    showPhonePublicly: s.show_phone_publicly,
    contactCount: s.contact_count || 0,
    planStatus: s.plan_status || "pending",
    approvedAt: s.approved_at || undefined,
    trialEndsAt: s.trial_ends_at || undefined,
    nextPaymentDue: s.next_payment_due || undefined,
    latestUpdate: s.latest_update || undefined,
    latestUpdateAt: s.latest_update_at || undefined,
    isOfficial: !!s.is_official,
    createdAt: s.created_at,
    ...extra,
  };
}

function productToApi(p: ProductRow, extra: Record<string, any> = {}) {
  return {
    id: p.id,
    title: p.title,
    category: p.category,
    description: p.description,
    price: p.price,
    imageUrl: p.image_url,
    isAvailable: p.is_available,
    isPinned: p.is_pinned,
    isPublished: p.is_published,
    sellerId: p.seller_id,
    createdAt: p.created_at,
    ...extra,
  };
}

const MAX_PUBLISHED_PRODUCTS_PER_SELLER = 1;

// Community-empowerment rollout: the first 100 approved sellers get a free
// founding year ("founding"); every seller after that gets a 1-month free
// trial before they're expected to start paying RM20/month.
const FOUNDING_SELLER_LIMIT = 100;
const TRIAL_LENGTH_DAYS = 30;
const FOUNDING_FREE_YEAR_DAYS = 365;
const MONTHLY_SUBSCRIPTION_RM = 20;

async function countPublishedProducts(sellerId: string, excludeProductId?: string) {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", sellerId)
    .eq("is_published", true)
    .neq("id", excludeProductId || "__none__");
  if (error) throw error;
  return count || 0;
}

function generateReceiptNumber() {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD
  const randPart = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `TB-${datePart}-${randPart}`;
}

function storyToApi(s: any) {
  return {
    id: s.id,
    sellerId: s.seller_id,
    mediaUrl: s.media_url,
    mediaType: s.media_type,
    caption: s.caption || "",
    createdAt: s.created_at,
    expiresAt: s.expires_at,
  };
}

function receiptToApi(r: any, seller: any = null) {
  return {
    id: r.id,
    receiptNumber: r.id,
    sellerId: r.seller_id,
    customerName: r.customer_name || "",
    customerPhone: r.customer_phone || "",
    items: r.items || [],
    deliveryFee: r.delivery_fee,
    subtotal: r.subtotal,
    total: r.total,
    notes: r.notes || "",
    createdAt: r.created_at,
    businessName: seller ? seller.business_name : undefined,
    sellerName: seller ? seller.owner_name : undefined,
    sellerPhoneNumber: seller ? seller.phone_number : undefined,
    sellerLogoUrl: seller ? seller.logo_url : undefined,
    sellerAddress: seller ? seller.address : undefined,
  };
}

async function addAdminLog(action: string, details: string) {
  await supabase.from("admin_logs").insert({
    id: "log_" + Math.random().toString(36).substr(2, 9),
    action,
    details,
  });
}

async function getStats() {
  const { data } = await supabase.from("app_stats").select("*").eq("id", 1).maybeSingle();
  return (
    data || {
      visitor_count: 0,
      login_success_count: 0,
      register_success_count: 0,
      contact_seller_count: 0,
    }
  );
}

async function incrementStat(column: "visitor_count" | "login_success_count" | "register_success_count" | "contact_seller_count") {
  const stats = await getStats();
  const next = (stats as any)[column] + 1;
  await supabase.from("app_stats").update({ [column]: next }).eq("id", 1);
}

// Lightweight event log for the Admin "Live Marketing Analytics" chart —
// records every site visit and WhatsApp contact click with a timestamp
// and (best-effort) location, so an admin can see visits/clicks trending
// by day and by district. Never throws into the caller — analytics are a
// nice-to-have and should never break the request that triggered them.
async function logAnalyticsEvent(
  eventType: "visit" | "contact_click",
  opts: { sellerId?: string; location?: string } = {}
) {
  try {
    await supabase.from("analytics_events").insert({
      id: "evt_" + Math.random().toString(36).substr(2, 10),
      event_type: eventType,
      seller_id: opts.sellerId || null,
      location: opts.location || null,
    });
  } catch (err) {
    console.error("logAnalyticsEvent failed", err);
  }
}

// Computes { averageRating, reviewCount } for a seller from the reviews table
async function getSellerRatingSummary(sellerId: string) {
  const { data: reviews } = await supabase.from("reviews").select("rating").eq("seller_id", sellerId);
  const list = reviews || [];
  const total = list.reduce((sum, r: any) => sum + r.rating, 0);
  const averageRating = list.length > 0 ? parseFloat((total / list.length).toFixed(1)) : 0;
  return { averageRating, reviewCount: list.length };
}

// ============================================================================
// SERVER
// ============================================================================
async function startServer() {
  await bootstrapAdminIfNeeded();
  await ensureStorageBucket();

  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const isProd = process.env.NODE_ENV === "production";
  const distPath = path.join(process.cwd(), "dist");

  // Created up-front (instead of only at the very end) so the SSR
  // meta-tag routes below can also run index.html through Vite's dev
  // transform, keeping HMR/dev behavior identical to the plain SPA route.
  const vite = isProd
    ? null
    : await createViteServer({ server: { middlewareMode: true }, appType: "spa" });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Lightweight health check — no DB calls. Intended for uptime pingers
  // (e.g. UptimeRobot / GitHub Actions) to keep the free-tier instance from
  // spinning down, and for basic "is it alive" checks.
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Uploads a client-side-compressed image (base64 data URL) to Supabase
  // Storage and returns a lightweight public URL. Used by the seller
  // dashboard for product photos and business logos, instead of storing
  // the full image as text in the database.
  app.post("/api/upload-image", async (req, res) => {
    try {
      const { dataUrl, folder } = req.body;
      const isImage = typeof dataUrl === "string" && dataUrl.startsWith("data:image/");
      const isVideo = typeof dataUrl === "string" && dataUrl.startsWith("data:video/");
      if (!dataUrl || !(isImage || isVideo)) {
        return res.status(400).json({ error: "A valid image or video data URL is required." });
      }
      const sizeLimit = isVideo ? 45_000_000 : 15_000_000;
      if (dataUrl.length > sizeLimit) {
        return res.status(400).json({ error: isVideo ? "Video is too large (max ~30MB)." : "Image is too large." });
      }
      const safeFolder = folder === "sellers" ? "sellers" : folder === "stories" ? "stories" : "products";
      const url = await uploadDataUrlToStorage(dataUrl, safeFolder);
      res.json({ success: true, url });
    } catch (err: any) {
      console.error("POST /api/upload-image", err);
      res.status(500).json({ error: err.message || "Failed to upload image." });
    }
  });

  // ---------------------------------------------------------------------
  // STORIES — ephemeral 24-hour photo/video posts (Instagram/WhatsApp-style)
  // ---------------------------------------------------------------------
  app.post("/api/stories", async (req, res) => {
    try {
      const { sellerId, mediaUrl, mediaType, caption } = req.body;
      if (!sellerId || !mediaUrl || (mediaType !== "image" && mediaType !== "video")) {
        return res.status(400).json({ error: "sellerId, mediaUrl and a valid mediaType are required." });
      }

      const { data: seller } = await supabase.from("sellers").select("id, is_approved").eq("id", sellerId).maybeSingle();
      if (!seller) return res.status(403).json({ error: "Unauthorized. Seller account not found." });
      if (!seller.is_approved) return res.status(403).json({ error: "Your account is pending admin approval." });

      const now = new Date();
      const newStory = {
        id: "story_" + Math.random().toString(36).substr(2, 10),
        seller_id: sellerId,
        media_url: mediaUrl,
        media_type: mediaType,
        caption: String(caption || "").slice(0, 200),
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      };
      const { data: inserted, error } = await supabase.from("stories").insert(newStory).select("*").single();
      if (error) throw error;

      res.json({ success: true, story: storyToApi(inserted) });
    } catch (err: any) {
      console.error("POST /api/stories", err);
      res.status(500).json({ error: err.message || "Failed to post story." });
    }
  });

  // Public feed: every non-expired story, newest first, enriched with seller info
  app.get("/api/stories", async (req, res) => {
    try {
      const { data: stories, error } = await supabase
        .from("stories")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;

      const sellerIds = [...new Set((stories || []).map((s: any) => s.seller_id))];
      const { data: sellers } = sellerIds.length
        ? await supabase.from("sellers").select("id, business_name, logo_url, verification_tier, location, phone_number").in("id", sellerIds)
        : { data: [] as any[] };
      const sellerById = new Map((sellers || []).map((s: any) => [s.id, s]));

      res.json(
        (stories || []).map((s: any) => ({
          ...storyToApi(s),
          businessName: sellerById.get(s.seller_id)?.business_name || "TamuBah Seller",
          sellerLogoUrl: sellerById.get(s.seller_id)?.logo_url || undefined,
          sellerVerificationTier: sellerById.get(s.seller_id)?.verification_tier || "None",
          sellerLocation: sellerById.get(s.seller_id)?.location || "",
          sellerPhoneNumber: sellerById.get(s.seller_id)?.phone_number || undefined,
        }))
      );
    } catch (err: any) {
      console.error("GET /api/stories", err);
      res.status(500).json({ error: "Failed to load stories." });
    }
  });

  app.delete("/api/stories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { sellerId } = req.query;
      const { data: story } = await supabase.from("stories").select("seller_id, media_url").eq("id", id).maybeSingle();
      if (!story) return res.status(404).json({ error: "Story not found." });
      if (story.seller_id !== sellerId) return res.status(403).json({ error: "Unauthorized to delete this story." });

      await deleteStoryMediaFile(story.media_url);

      const { error } = await supabase.from("stories").delete().eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/stories/:id", err);
      res.status(500).json({ error: "Failed to delete story." });
    }
  });

  // ---------------------------------------------------------------------
  // COMMUNITY FORUM — Reddit-style discussion space, approved sellers only
  // ---------------------------------------------------------------------

  async function requireApprovedSeller(sellerId: string): Promise<{ status: number; error: string } | null> {
    if (!sellerId) return { status: 400, error: "sellerId is required." };
    const { data: seller } = await supabase.from("sellers").select("id, is_approved").eq("id", sellerId).maybeSingle();
    if (!seller) return { status: 403, error: "Unauthorized. Seller account not found." };
    if (!seller.is_approved) return { status: 403, error: "Only approved sellers can access the community." };
    return null;
  }

  async function enrichCommunityAuthors<T extends { seller_id: string }>(rows: T[]) {
    const sellerIds = [...new Set(rows.map((r) => r.seller_id))];
    const { data: sellers } = sellerIds.length
      ? await supabase.from("sellers").select("id, business_name, logo_url, verification_tier, is_official").in("id", sellerIds)
      : { data: [] as any[] };
    return new Map((sellers || []).map((s: any) => [s.id, s]));
  }

  // List topics — requires an approved seller to view (community is members-only)
  app.get("/api/community/topics", async (req, res) => {
    try {
      const { sellerId, sort, category } = req.query;
      const check = await requireApprovedSeller(sellerId as string);
      if (check) return res.status(check.status).json({ error: check.error });

      let query = supabase.from("community_topics").select("*");
      if (category && category !== "all") query = query.eq("category", category);
      const { data: topics, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      const topicIds = (topics || []).map((t: any) => t.id);
      const [{ data: replies }, { data: votes }] = await Promise.all([
        topicIds.length ? supabase.from("community_replies").select("topic_id").in("topic_id", topicIds) : Promise.resolve({ data: [] as any[] }),
        topicIds.length ? supabase.from("community_votes").select("topic_id, seller_id").in("topic_id", topicIds) : Promise.resolve({ data: [] as any[] }),
      ]);

      const replyCountByTopic = new Map<string, number>();
      (replies || []).forEach((r: any) => replyCountByTopic.set(r.topic_id, (replyCountByTopic.get(r.topic_id) || 0) + 1));
      const voteCountByTopic = new Map<string, number>();
      const votedByCurrentSeller = new Set<string>();
      (votes || []).forEach((v: any) => {
        voteCountByTopic.set(v.topic_id, (voteCountByTopic.get(v.topic_id) || 0) + 1);
        if (v.seller_id === sellerId) votedByCurrentSeller.add(v.topic_id);
      });

      const sellerById = await enrichCommunityAuthors(topics || []);

      let enriched = (topics || []).map((t: any) => ({
        id: t.id,
        sellerId: t.seller_id,
        title: t.title,
        body: t.body,
        category: t.category,
        createdAt: t.created_at,
        replyCount: replyCountByTopic.get(t.id) || 0,
        voteCount: voteCountByTopic.get(t.id) || 0,
        hasVoted: votedByCurrentSeller.has(t.id),
        businessName: sellerById.get(t.seller_id)?.business_name || "Unknown Seller",
        sellerLogoUrl: sellerById.get(t.seller_id)?.logo_url || undefined,
        sellerVerificationTier: sellerById.get(t.seller_id)?.verification_tier || "None",
        sellerIsOfficial: !!sellerById.get(t.seller_id)?.is_official,
      }));

      if (sort === "top") {
        enriched = enriched.sort((a, b) => b.voteCount - a.voteCount);
      }

      res.json(enriched);
    } catch (err: any) {
      console.error("GET /api/community/topics", err);
      res.status(500).json({ error: "Failed to load community topics." });
    }
  });

  app.post("/api/community/topics", async (req, res) => {
    try {
      const { sellerId, title, body, category } = req.body;
      const check = await requireApprovedSeller(sellerId);
      if (check) return res.status(check.status).json({ error: check.error });
      if (!title || !title.trim() || !body || !body.trim()) {
        return res.status(400).json({ error: "Title and body are required." });
      }

      const newTopic = {
        id: "topic_" + Math.random().toString(36).substr(2, 10),
        seller_id: sellerId,
        title: String(title).trim().slice(0, 150),
        body: String(body).trim().slice(0, 5000),
        category: COMMUNITY_CATEGORIES.includes(category) ? category : "General Discussion",
      };
      const { data: inserted, error } = await supabase.from("community_topics").insert(newTopic).select("*").single();
      if (error) throw error;

      res.json({
        success: true,
        topic: { id: inserted.id, sellerId: inserted.seller_id, title: inserted.title, body: inserted.body, category: inserted.category, createdAt: inserted.created_at, replyCount: 0, voteCount: 0, hasVoted: false },
      });
    } catch (err: any) {
      console.error("POST /api/community/topics", err);
      res.status(500).json({ error: "Failed to create topic." });
    }
  });

  // Single topic + all its replies
  app.get("/api/community/topics/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { sellerId } = req.query;
      const check = await requireApprovedSeller(sellerId as string);
      if (check) return res.status(check.status).json({ error: check.error });

      const { data: topic } = await supabase.from("community_topics").select("*").eq("id", id).maybeSingle();
      if (!topic) return res.status(404).json({ error: "Topic not found." });

      const [{ data: replies }, { data: votes }] = await Promise.all([
        supabase.from("community_replies").select("*").eq("topic_id", id).order("created_at", { ascending: true }),
        supabase.from("community_votes").select("seller_id").eq("topic_id", id),
      ]);

      const allRows = [topic, ...(replies || [])];
      const sellerById = await enrichCommunityAuthors(allRows as any);

      res.json({
        topic: {
          id: topic.id,
          sellerId: topic.seller_id,
          title: topic.title,
          body: topic.body,
          category: topic.category,
          createdAt: topic.created_at,
          replyCount: (replies || []).length,
          voteCount: (votes || []).length,
          hasVoted: (votes || []).some((v: any) => v.seller_id === sellerId),
          businessName: sellerById.get(topic.seller_id)?.business_name || "Unknown Seller",
          sellerLogoUrl: sellerById.get(topic.seller_id)?.logo_url || undefined,
          sellerVerificationTier: sellerById.get(topic.seller_id)?.verification_tier || "None",
          sellerIsOfficial: !!sellerById.get(topic.seller_id)?.is_official,
        },
        replies: (replies || []).map((r: any) => ({
          id: r.id,
          topicId: r.topic_id,
          sellerId: r.seller_id,
          body: r.body,
          createdAt: r.created_at,
          businessName: sellerById.get(r.seller_id)?.business_name || "Unknown Seller",
          sellerLogoUrl: sellerById.get(r.seller_id)?.logo_url || undefined,
          sellerVerificationTier: sellerById.get(r.seller_id)?.verification_tier || "None",
          sellerIsOfficial: !!sellerById.get(r.seller_id)?.is_official,
        })),
      });
    } catch (err: any) {
      console.error("GET /api/community/topics/:id", err);
      res.status(500).json({ error: "Failed to load topic." });
    }
  });

  app.post("/api/community/topics/:id/replies", async (req, res) => {
    try {
      const { id } = req.params;
      const { sellerId, body } = req.body;
      const check = await requireApprovedSeller(sellerId);
      if (check) return res.status(check.status).json({ error: check.error });
      if (!body || !body.trim()) return res.status(400).json({ error: "Reply cannot be empty." });

      const { data: topic } = await supabase.from("community_topics").select("id").eq("id", id).maybeSingle();
      if (!topic) return res.status(404).json({ error: "Topic not found." });

      const newReply = {
        id: "reply_" + Math.random().toString(36).substr(2, 10),
        topic_id: id,
        seller_id: sellerId,
        body: String(body).trim().slice(0, 3000),
      };
      const { data: inserted, error } = await supabase.from("community_replies").insert(newReply).select("*").single();
      if (error) throw error;

      const { data: seller } = await supabase.from("sellers").select("business_name, logo_url, verification_tier, is_official").eq("id", sellerId).maybeSingle();

      res.json({
        success: true,
        reply: {
          id: inserted.id,
          topicId: inserted.topic_id,
          sellerId: inserted.seller_id,
          body: inserted.body,
          createdAt: inserted.created_at,
          businessName: seller?.business_name || "Unknown Seller",
          sellerLogoUrl: seller?.logo_url || undefined,
          sellerVerificationTier: seller?.verification_tier || "None",
          sellerIsOfficial: !!seller?.is_official,
        },
      });
    } catch (err: any) {
      console.error("POST /api/community/topics/:id/replies", err);
      res.status(500).json({ error: "Failed to post reply." });
    }
  });

  // Toggle upvote on a topic
  app.post("/api/community/topics/:id/vote", async (req, res) => {
    try {
      const { id } = req.params;
      const { sellerId } = req.body;
      const check = await requireApprovedSeller(sellerId);
      if (check) return res.status(check.status).json({ error: check.error });

      const { data: existing } = await supabase.from("community_votes").select("*").eq("topic_id", id).eq("seller_id", sellerId).maybeSingle();

      if (existing) {
        await supabase.from("community_votes").delete().eq("topic_id", id).eq("seller_id", sellerId);
        const { count } = await supabase.from("community_votes").select("*", { count: "exact", head: true }).eq("topic_id", id);
        return res.json({ success: true, voted: false, voteCount: count || 0 });
      } else {
        await supabase.from("community_votes").insert({ topic_id: id, seller_id: sellerId });
        const { count } = await supabase.from("community_votes").select("*", { count: "exact", head: true }).eq("topic_id", id);
        return res.json({ success: true, voted: true, voteCount: count || 0 });
      }
    } catch (err: any) {
      console.error("POST /api/community/topics/:id/vote", err);
      res.status(500).json({ error: "Failed to update vote." });
    }
  });

  app.delete("/api/community/topics/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { sellerId } = req.query;
      const { data: topic } = await supabase.from("community_topics").select("seller_id").eq("id", id).maybeSingle();
      if (!topic) return res.status(404).json({ error: "Topic not found." });
      if (topic.seller_id !== sellerId) return res.status(403).json({ error: "Unauthorized to delete this topic." });

      const { error } = await supabase.from("community_topics").delete().eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/community/topics/:id", err);
      res.status(500).json({ error: "Failed to delete topic." });
    }
  });

  app.delete("/api/community/replies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { sellerId } = req.query;
      const { data: reply } = await supabase.from("community_replies").select("seller_id").eq("id", id).maybeSingle();
      if (!reply) return res.status(404).json({ error: "Reply not found." });
      if (reply.seller_id !== sellerId) return res.status(403).json({ error: "Unauthorized to delete this reply." });

      const { error } = await supabase.from("community_replies").delete().eq("id", id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/community/replies/:id", err);
      res.status(500).json({ error: "Failed to delete reply." });
    }
  });

  // ---------------------------------------------------------------------
  // PUBLIC: Sellers
  // ---------------------------------------------------------------------
  // ---------------------------------------------------------------------
  // PUBLIC: lightweight analytics ping — one call per page load, used to
  // build the admin "Live Marketing Analytics" chart (date/time, location).
  // Location is optional and only ever sent if the visitor's browser grants
  // geolocation permission and it resolves to a known Sabah district.
  // ---------------------------------------------------------------------
  app.post("/api/track/visit", async (req, res) => {
    try {
      const location = typeof req.body?.location === "string" ? req.body.location : undefined;
      await logAnalyticsEvent("visit", { location });
      res.json({ success: true });
    } catch (err: any) {
      console.error("POST /api/track/visit", err);
      res.status(500).json({ error: "Failed to record visit." });
    }
  });

  app.get("/api/sellers", async (req, res) => {
    try {
      const search = ((req.query.search as string) || "").toLowerCase();
      const location = (req.query.location as string) || "All";
      const category = (req.query.category as string) || "All";
      const filterType = (req.query.filter as string) || "all"; // 'all' | 'verified' | 'unverified'
      const showAll = req.query.showAll === "true";
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      let query = supabase.from("sellers").select("*", { count: "exact" });

      if (location && location !== "All") query = query.eq("location", location);
      if (category && category !== "All") query = query.eq("category", category);
      if (filterType === "verified") query = query.neq("verification_tier", "None");
      if (filterType === "unverified") query = query.eq("verification_tier", "None");
      if (!showAll && filterType !== "unverified" && filterType !== "all") {
        query = query.eq("is_approved", true);
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      let sellers = rows as SellerRow[];
      if (search) {
        sellers = sellers.filter(
          (s) =>
            s.business_name.toLowerCase().includes(search) ||
            s.owner_name.toLowerCase().includes(search) ||
            (s.dream || "").toLowerCase().includes(search)
        );
      }

      const [{ data: allProducts }, { data: allReports }, { data: allReviews }] = await Promise.all([
        supabase.from("products").select("id, seller_id"),
        supabase.from("reports").select("id, seller_id"),
        supabase.from("reviews").select("rating, seller_id"),
      ]);

      const enriched = sellers.map((s) => {
        const productCount = (allProducts || []).filter((p: any) => p.seller_id === s.id).length;
        const reportCount = (allReports || []).filter((r: any) => r.seller_id === s.id).length;
        const sellerReviews = (allReviews || []).filter((r: any) => r.seller_id === s.id);
        const totalRating = sellerReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
        const averageRating = sellerReviews.length > 0 ? parseFloat((totalRating / sellerReviews.length).toFixed(1)) : 0;
        return sellerToApi(s, { productCount, reportCount, averageRating, reviewCount: sellerReviews.length });
      });

      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginated = enriched.slice(startIndex, endIndex);

      res.setHeader("X-Total-Count", enriched.length.toString());
      res.setHeader("X-Has-More", (endIndex < enriched.length).toString());
      res.json(paginated);
    } catch (err: any) {
      console.error("GET /api/sellers", err);
      res.status(500).json({ error: "Failed to load sellers." });
    }
  });

  app.get("/api/sellers/:id", async (req, res) => {
    try {
      const { data: seller, error } = await supabase.from("sellers").select("*").eq("id", req.params.id).maybeSingle();
      if (error) throw error;
      if (!seller) return res.status(404).json({ error: "Seller profile not found." });

      const { data: products } = await supabase.from("products").select("id").eq("seller_id", seller.id);
      const { data: reports } = await supabase.from("reports").select("id").eq("seller_id", seller.id);
      const { averageRating, reviewCount } = await getSellerRatingSummary(seller.id);

      res.json({
        success: true,
        seller: sellerToApi(seller as SellerRow, {
          productCount: (products || []).length,
          reportCount: (reports || []).length,
          averageRating,
          reviewCount,
        }),
      });
    } catch (err: any) {
      console.error("GET /api/sellers/:id", err);
      res.status(500).json({ error: "Failed to load seller profile." });
    }
  });

  // Lightweight "what's fresh today" status a seller can post any time,
  // shown on their storefront card while it's still recent.
  app.patch("/api/sellers/:id/latest-update", async (req, res) => {
    try {
      const { id } = req.params;
      const { update } = req.body;
      const cleanUpdate = String(update || "").trim().slice(0, 140);

      const { data: seller, error } = await supabase
        .from("sellers")
        .update({
          latest_update: cleanUpdate,
          latest_update_at: cleanUpdate ? new Date().toISOString() : null,
        })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!seller) return res.status(404).json({ error: "Seller profile not found." });

      res.json({ success: true, seller: sellerToApi(seller as SellerRow) });
    } catch (err: any) {
      console.error("PATCH /api/sellers/:id/latest-update", err);
      res.status(500).json({ error: "Failed to post update." });
    }
  });


  app.patch("/api/sellers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { logoUrl, establishedYear, dream, businessName, address, phoneNumber, location, ssmNumber, ownerName } = req.body;

      const update: Record<string, any> = {};
      if (logoUrl !== undefined) update.logo_url = logoUrl;
      if (establishedYear !== undefined) update.established_year = establishedYear;
      if (dream !== undefined) update.dream = dream;
      if (businessName) update.business_name = businessName;
      if (address) update.address = address;
      if (phoneNumber) update.phone_number = phoneNumber;
      if (location) update.location = location;
      if (ssmNumber !== undefined) {
        update.ssm_number = ssmNumber;
        update.is_verified = !!ssmNumber;
      }
      if (ownerName) update.owner_name = ownerName;

      const { data: seller, error } = await supabase.from("sellers").update(update).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      if (!seller) return res.status(404).json({ error: "Seller profile not found." });

      res.json({ success: true, seller: sellerToApi(seller as SellerRow) });
    } catch (err: any) {
      console.error("PATCH /api/sellers/:id", err);
      res.status(500).json({ error: "Failed to update seller profile." });
    }
  });

  // ---------------------------------------------------------------------
  // PUBLIC (seller self-service): change own password — requires the
  // current password, same as any normal "change password" flow.
  // ---------------------------------------------------------------------
  app.post("/api/sellers/:id/change-password", async (req, res) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password are required." });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters long." });
      }

      const { data: seller, error: fetchError } = await supabase.from("sellers").select("*").eq("id", id).maybeSingle();
      if (fetchError) throw fetchError;
      if (!seller) return res.status(404).json({ error: "Seller profile not found." });

      const currentOk = await bcrypt.compare(currentPassword, seller.password_hash);
      if (!currentOk) {
        return res.status(400).json({ error: "Current password is incorrect." });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      const { data: updated, error: updateError } = await supabase
        .from("sellers")
        .update({ password_hash: newHash })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (updateError) throw updateError;

      await addAdminLog("seller_changed_password", `Seller changed their own password: ${seller.business_name} (${seller.owner_name})`);

      res.json({ success: true, seller: sellerToApi(updated as SellerRow) });
    } catch (err: any) {
      console.error("POST /api/sellers/:id/change-password", err);
      res.status(500).json({ error: "Failed to change password." });
    }
  });

  app.post("/api/sellers/:id/contact-click", async (req, res) => {
    try {
      const { id } = req.params;
      await incrementStat("contact_seller_count");

      const { data: seller } = await supabase.from("sellers").select("*").eq("id", id).maybeSingle();
      let sellerContactCount = 0;
      if (seller) {
        sellerContactCount = (seller.contact_count || 0) + 1;
        await supabase.from("sellers").update({ contact_count: sellerContactCount }).eq("id", id);
        await addAdminLog("seller_contact_click", `User clicked contact line for ${seller.business_name} (Owner: ${seller.owner_name})`);
        logAnalyticsEvent("contact_click", { sellerId: seller.id, location: seller.location });
      }

      const stats = await getStats();
      res.json({ success: true, contactSellerCount: (stats as any).contact_seller_count, sellerContactCount });
    } catch (err: any) {
      console.error("POST /api/sellers/:id/contact-click", err);
      res.status(500).json({ error: "Failed to record contact click." });
    }
  });

  app.post("/api/sellers/:id/reviews", async (req, res) => {
    try {
      const { id } = req.params;
      const { rating, comment, reviewerName } = req.body;
      if (!rating || !reviewerName) return res.status(400).json({ error: "Rating and reviewer name are required." });

      const numRating = parseInt(rating);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ error: "Rating must be an integer between 1 and 5." });
      }

      const { data: seller } = await supabase.from("sellers").select("id, business_name").eq("id", id).maybeSingle();
      if (!seller) return res.status(404).json({ error: "Seller not found." });

      const newReview = {
        id: "rev_" + Math.random().toString(36).substr(2, 9),
        seller_id: id,
        rating: numRating,
        comment: comment || "",
        reviewer_name: reviewerName,
      };
      const { data: inserted, error } = await supabase.from("reviews").insert(newReview).select("*").single();
      if (error) throw error;

      await addAdminLog("seller_reviewed", `User "${reviewerName}" rated "${seller.business_name}" ${numRating}/5: "${comment || "No comment"}"`);

      res.json({
        success: true,
        review: {
          id: inserted.id,
          sellerId: inserted.seller_id,
          rating: inserted.rating,
          comment: inserted.comment,
          reviewerName: inserted.reviewer_name,
          createdAt: inserted.created_at,
        },
      });
    } catch (err: any) {
      console.error("POST /api/sellers/:id/reviews", err);
      res.status(500).json({ error: "Failed to submit review." });
    }
  });

  app.get("/api/sellers/:id/reviews", async (req, res) => {
    try {
      const { data: reviews, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("seller_id", req.params.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      res.json(
        (reviews || []).map((r: any) => ({
          id: r.id,
          sellerId: r.seller_id,
          rating: r.rating,
          comment: r.comment,
          reviewerName: r.reviewer_name,
          createdAt: r.created_at,
        }))
      );
    } catch (err: any) {
      console.error("GET /api/sellers/:id/reviews", err);
      res.status(500).json({ error: "Failed to load reviews." });
    }
  });

  // Full product catalog for a single seller (published + in-shop-only),
  // used by the seller shop modal so it isn't limited to Market-published items.
  app.get("/api/sellers/:id/products", async (req, res) => {
    try {
      const sellerId = req.params.id;

      const [{ data: seller, error: sellerErr }, { data: productRows, error: prodErr }, { data: reportRows }, { data: reviewRows }] =
        await Promise.all([
          supabase.from("sellers").select("*").eq("id", sellerId).maybeSingle(),
          supabase.from("products").select("*").eq("seller_id", sellerId),
          supabase.from("reports").select("id, seller_id").eq("seller_id", sellerId),
          supabase.from("reviews").select("rating, seller_id").eq("seller_id", sellerId),
        ]);
      if (sellerErr) throw sellerErr;
      if (prodErr) throw prodErr;

      const totalRating = (reviewRows || []).reduce((sum: number, r: any) => sum + r.rating, 0);
      const averageRating = (reviewRows || []).length > 0 ? parseFloat((totalRating / (reviewRows as any[]).length).toFixed(1)) : 0;

      const enriched = ((productRows || []) as ProductRow[]).map((p) =>
        productToApi(p, {
          sellerName: seller ? seller.owner_name : "Sabah Entrepreneur",
          businessName: seller ? seller.business_name : "Home Business",
          availableArea: seller ? seller.location : "Sabah",
          contactNumber: seller ? seller.phone_number : "",
          address: seller ? seller.address : "",
          sellerLogoUrl: seller ? seller.logo_url : undefined,
          sellerEstablishedYear: seller ? seller.established_year : undefined,
          sellerDream: seller ? seller.dream : undefined,
          sellerIsVerified: seller ? !!seller.is_verified : false,
          sellerIsApproved: seller ? !!seller.is_approved : false,
          sellerVerificationTier: seller ? seller.verification_tier || "None" : "None",
          ssmNumber: seller ? seller.ssm_number : "",
          reportCount: (reportRows || []).length,
          sellerAverageRating: averageRating,
          sellerReviewCount: (reviewRows || []).length,
        })
      );

      enriched.sort((a: any, b: any) => {
        const pinA = a.isPinned ? 1 : 0;
        const pinB = b.isPinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      res.json(enriched);
    } catch (err: any) {
      console.error("GET /api/sellers/:id/products", err);
      res.status(500).json({ error: "Failed to load this seller's products." });
    }
  });

  // ---------------------------------------------------------------------
  // PUBLIC: Products
  // ---------------------------------------------------------------------
  app.get("/api/products", async (req, res) => {
    try {
      await incrementStat("visitor_count");

      const search = ((req.query.search as string) || "").toLowerCase();
      const category = (req.query.category as string) || "All";
      const location = (req.query.location as string) || "All";
      const showAll = req.query.showAll === "true";
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const [{ data: productRows, error: prodErr }, { data: sellerRows, error: sellerErr }, { data: reportRows }, { data: reviewRows }] =
        await Promise.all([
          supabase.from("products").select("*"),
          supabase.from("sellers").select("*"),
          supabase.from("reports").select("id, seller_id"),
          supabase.from("reviews").select("rating, seller_id"),
        ]);
      if (prodErr) throw prodErr;
      if (sellerErr) throw sellerErr;

      const sellerById = new Map((sellerRows || []).map((s: any) => [s.id, s]));

      let enriched = (productRows as ProductRow[]).map((p) => {
        const seller = sellerById.get(p.seller_id);
        const sellerReports = (reportRows || []).filter((r: any) => r.seller_id === p.seller_id);
        const sellerReviews = (reviewRows || []).filter((r: any) => r.seller_id === p.seller_id);
        const totalRating = sellerReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
        const averageRating = sellerReviews.length > 0 ? parseFloat((totalRating / sellerReviews.length).toFixed(1)) : 0;

        return productToApi(p, {
          sellerName: seller ? seller.owner_name : "Sabah Entrepreneur",
          businessName: seller ? seller.business_name : "Home Business",
          availableArea: seller ? seller.location : "Sabah",
          contactNumber: seller ? seller.phone_number : "",
          address: seller ? seller.address : "",
          sellerLogoUrl: seller ? seller.logo_url : undefined,
          sellerEstablishedYear: seller ? seller.established_year : undefined,
          sellerDream: seller ? seller.dream : undefined,
          sellerIsVerified: seller ? !!seller.is_verified : false,
          sellerIsApproved: seller ? !!seller.is_approved : false,
          sellerVerificationTier: seller ? seller.verification_tier || "None" : "None",
          ssmNumber: seller ? seller.ssm_number : "",
          reportCount: sellerReports.length,
          sellerAverageRating: averageRating,
          sellerReviewCount: sellerReviews.length,
        });
      });

      if (search) {
        enriched = enriched.filter(
          (p: any) =>
            p.title.toLowerCase().includes(search) ||
            p.description.toLowerCase().includes(search) ||
            p.businessName.toLowerCase().includes(search)
        );
      }
      if (category && category !== "All") enriched = enriched.filter((p: any) => p.category === category);
      if (location && location !== "All") enriched = enriched.filter((p: any) => p.availableArea === location);
      if (!showAll) enriched = enriched.filter((p: any) => !!p.sellerIsApproved);
      if (!showAll) enriched = enriched.filter((p: any) => !!p.isPublished);

      enriched.sort((a: any, b: any) => {
        const pinA = a.isPinned ? 1 : 0;
        const pinB = b.isPinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginated = enriched.slice(startIndex, endIndex);

      res.setHeader("X-Total-Count", enriched.length.toString());
      res.setHeader("X-Has-More", (endIndex < enriched.length).toString());
      res.json(paginated);
    } catch (err: any) {
      console.error("GET /api/products", err);
      res.status(500).json({ error: "Failed to load products." });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { data: product, error } = await supabase.from("products").select("*").eq("id", req.params.id).maybeSingle();
      if (error) throw error;
      if (!product) return res.status(404).json({ error: "Product not found." });

      const { data: seller } = await supabase.from("sellers").select("*").eq("id", product.seller_id).maybeSingle();
      const { data: reports } = await supabase.from("reports").select("id").eq("seller_id", product.seller_id);
      const { averageRating, reviewCount } = await getSellerRatingSummary(product.seller_id);

      res.json(
        productToApi(product as ProductRow, {
          sellerName: seller ? seller.owner_name : "Sabah Entrepreneur",
          businessName: seller ? seller.business_name : "Home Business",
          availableArea: seller ? seller.location : "Sabah",
          contactNumber: seller ? seller.phone_number : "",
          address: seller ? seller.address : "",
          sellerLogoUrl: seller ? seller.logo_url : undefined,
          sellerEstablishedYear: seller ? seller.established_year : undefined,
          sellerDream: seller ? seller.dream : undefined,
          sellerIsVerified: seller ? !!seller.is_verified : false,
          sellerIsApproved: seller ? !!seller.is_approved : false,
          sellerVerificationTier: seller ? seller.verification_tier || "None" : "None",
          ssmNumber: seller ? seller.ssm_number : "",
          reportCount: (reports || []).length,
          sellerAverageRating: averageRating,
          sellerReviewCount: reviewCount,
        })
      );
    } catch (err: any) {
      console.error("GET /api/products/:id", err);
      res.status(500).json({ error: "Failed to load product." });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const { title, category, description, price, imageUrl, isAvailable, sellerId } = req.body;
      if (!title || !category || !description || !price || !imageUrl || !sellerId) {
        return res.status(400).json({ error: "All product fields are required, including an uploaded image." });
      }

      const { data: seller } = await supabase.from("sellers").select("id, is_approved").eq("id", sellerId).maybeSingle();
      if (!seller) return res.status(403).json({ error: "Unauthorized. Seller account not found." });
      if (!seller.is_approved) return res.status(403).json({ error: "Your account is pending admin approval. You cannot list new products yet." });

      const publishedCount = await countPublishedProducts(sellerId);

      const newProduct = {
        id: "prod_" + Math.random().toString(36).substr(2, 9),
        title,
        category,
        description,
        price: parseFloat(price),
        image_url: imageUrl,
        is_available: isAvailable !== undefined ? isAvailable : true,
        // Sellers may only have 1 published (live in the market) product at a
        // time. If they already have one, this new product is created but
        // stays unpublished in their shop until they free up their slot or
        // an admin approves a publish request for it.
        is_published: publishedCount < MAX_PUBLISHED_PRODUCTS_PER_SELLER,
        seller_id: sellerId,
      };
      const { data: inserted, error } = await supabase.from("products").insert(newProduct).select("*").single();
      if (error) throw error;

      res.json({ success: true, product: productToApi(inserted as ProductRow) });
    } catch (err: any) {
      console.error("POST /api/products", err);
      res.status(500).json({ error: "Failed to create product." });
    }
  });

  app.patch("/api/products/:id/toggle", async (req, res) => {
    try {
      const { id } = req.params;
      const { sellerId } = req.body;

      const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (!product) return res.status(404).json({ error: "Product not found." });
      if (product.seller_id !== sellerId) return res.status(403).json({ error: "Unauthorized to update this product." });

      const { data: seller } = await supabase.from("sellers").select("is_approved").eq("id", sellerId).maybeSingle();
      if (!seller || !seller.is_approved) return res.status(403).json({ error: "Unauthorized. Your account is pending admin approval." });

      const { data: updated, error } = await supabase
        .from("products")
        .update({ is_available: !product.is_available })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      res.json({ success: true, product: productToApi(updated as ProductRow) });
    } catch (err: any) {
      console.error("PATCH /api/products/:id/toggle", err);
      res.status(500).json({ error: "Failed to update product." });
    }
  });

  // Seller publishes a product to the live public market. Only 1 published
  // product per seller is allowed — if they're already at that limit, they
  // must use /api/publish-requests to ask an admin for an exception.
  app.patch("/api/products/:id/publish", async (req, res) => {
    try {
      const { id } = req.params;
      const { sellerId } = req.body;

      const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (!product) return res.status(404).json({ error: "Product not found." });
      if (product.seller_id !== sellerId) return res.status(403).json({ error: "Unauthorized to update this product." });

      const { data: seller } = await supabase.from("sellers").select("is_approved").eq("id", sellerId).maybeSingle();
      if (!seller || !seller.is_approved) return res.status(403).json({ error: "Unauthorized. Your account is pending admin approval." });

      if (product.is_published) {
        return res.json({ success: true, product: productToApi(product as ProductRow) });
      }

      const publishedCount = await countPublishedProducts(sellerId, id);
      if (publishedCount >= MAX_PUBLISHED_PRODUCTS_PER_SELLER) {
        return res.status(409).json({
          error: "You already have a published product in the market. Unpublish it first, or ask admin for permission to publish more than one.",
          limitReached: true,
        });
      }

      const { data: updated, error } = await supabase
        .from("products")
        .update({ is_published: true })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      res.json({ success: true, product: productToApi(updated as ProductRow) });
    } catch (err: any) {
      console.error("PATCH /api/products/:id/publish", err);
      res.status(500).json({ error: "Failed to publish product." });
    }
  });

  // Seller pulls a product back out of the market and into their private shop.
  app.patch("/api/products/:id/unpublish", async (req, res) => {
    try {
      const { id } = req.params;
      const { sellerId } = req.body;

      const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (!product) return res.status(404).json({ error: "Product not found." });
      if (product.seller_id !== sellerId) return res.status(403).json({ error: "Unauthorized to update this product." });

      const { data: updated, error } = await supabase
        .from("products")
        .update({ is_published: false })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      res.json({ success: true, product: productToApi(updated as ProductRow) });
    } catch (err: any) {
      console.error("PATCH /api/products/:id/unpublish", err);
      res.status(500).json({ error: "Failed to unpublish product." });
    }
  });

  // Seller asks an admin for permission to publish an additional product
  // beyond their normal 1-product limit.
  app.post("/api/publish-requests", async (req, res) => {
    try {
      const { sellerId, productId, message } = req.body;
      if (!sellerId || !productId) {
        return res.status(400).json({ error: "sellerId and productId are required." });
      }

      const { data: product } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
      if (!product) return res.status(404).json({ error: "Product not found." });
      if (product.seller_id !== sellerId) return res.status(403).json({ error: "Unauthorized to request publishing for this product." });
      if (product.is_published) return res.status(400).json({ error: "This product is already published." });

      const { data: existingPending } = await supabase
        .from("publish_requests")
        .select("id")
        .eq("product_id", productId)
        .eq("status", "pending")
        .maybeSingle();
      if (existingPending) {
        return res.status(409).json({ error: "You already have a pending request to publish this product." });
      }

      const newRequest = {
        id: "pubreq_" + Math.random().toString(36).substr(2, 9),
        seller_id: sellerId,
        product_id: productId,
        message: message || "",
        status: "pending",
      };
      const { data: inserted, error } = await supabase.from("publish_requests").insert(newRequest).select("*").single();
      if (error) throw error;

      const { data: seller } = await supabase.from("sellers").select("business_name").eq("id", sellerId).maybeSingle();
      await addAdminLog(
        "publish_request_created",
        `${seller?.business_name || "A seller"} requested permission to publish "${product.title}" (they already have a published product).`
      );

      res.json({
        success: true,
        request: {
          id: inserted.id,
          sellerId: inserted.seller_id,
          productId: inserted.product_id,
          message: inserted.message,
          status: inserted.status,
          createdAt: inserted.created_at,
        },
      });
    } catch (err: any) {
      console.error("POST /api/publish-requests", err);
      res.status(500).json({ error: "Failed to submit publish request." });
    }
  });

  // Seller checks the status of their own publish requests.
  app.get("/api/publish-requests", async (req, res) => {
    try {
      const { sellerId } = req.query;
      if (!sellerId) return res.status(400).json({ error: "sellerId is required." });

      const { data, error } = await supabase
        .from("publish_requests")
        .select("*")
        .eq("seller_id", sellerId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;

      res.json(
        (data || []).map((r: any) => ({
          id: r.id,
          sellerId: r.seller_id,
          productId: r.product_id,
          message: r.message,
          adminNote: r.admin_note,
          status: r.status,
          createdAt: r.created_at,
          resolvedAt: r.resolved_at,
        }))
      );
    } catch (err: any) {
      console.error("GET /api/publish-requests", err);
      res.status(500).json({ error: "Failed to load publish requests." });
    }
  });

  // ---------------------------------------------------------------------
  // SELLER: receipts — generate a shareable receipt/invoice for a customer
  // ---------------------------------------------------------------------
  app.post("/api/receipts", async (req, res) => {
    try {
      const { sellerId, customerName, customerPhone, items, deliveryFee, notes } = req.body;
      if (!sellerId) return res.status(400).json({ error: "sellerId is required." });
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Add at least one item to the receipt." });
      }

      const { data: seller } = await supabase.from("sellers").select("id, is_approved").eq("id", sellerId).maybeSingle();
      if (!seller) return res.status(403).json({ error: "Unauthorized. Seller account not found." });
      if (!seller.is_approved) return res.status(403).json({ error: "Your account is pending admin approval." });

      const cleanItems = items.map((it: any) => {
        const unitPrice = parseFloat(it.unitPrice) || 0;
        const quantity = Math.max(1, parseInt(it.quantity) || 1);
        return {
          title: String(it.title || "Item").slice(0, 200),
          unitPrice,
          quantity,
          type: it.type === "product" ? "product" : "service",
          productId: it.productId || null,
          lineTotal: parseFloat((unitPrice * quantity).toFixed(2)),
        };
      });

      const subtotal = parseFloat(cleanItems.reduce((sum: number, it: any) => sum + it.lineTotal, 0).toFixed(2));
      const cleanDeliveryFee = parseFloat(deliveryFee) || 0;
      const total = parseFloat((subtotal + cleanDeliveryFee).toFixed(2));

      let id = generateReceiptNumber();
      // Extremely unlikely collision, but guard against it anyway
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: existing } = await supabase.from("receipts").select("id").eq("id", id).maybeSingle();
        if (!existing) break;
        id = generateReceiptNumber();
      }

      const newReceipt = {
        id,
        seller_id: sellerId,
        customer_name: customerName || "",
        customer_phone: customerPhone || "",
        items: cleanItems,
        delivery_fee: cleanDeliveryFee,
        subtotal,
        total,
        notes: notes || "",
      };
      const { data: inserted, error } = await supabase.from("receipts").insert(newReceipt).select("*").single();
      if (error) throw error;

      res.json({ success: true, receipt: receiptToApi(inserted, seller as any) });
    } catch (err: any) {
      console.error("POST /api/receipts", err);
      res.status(500).json({ error: err.message ? `Failed to create receipt: ${err.message}` : "Failed to create receipt." });
    }
  });

  // Seller's own receipt history
  app.get("/api/receipts", async (req, res) => {
    try {
      const { sellerId } = req.query;
      if (!sellerId) return res.status(400).json({ error: "sellerId is required." });

      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("seller_id", sellerId as string)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      res.json((data || []).map((r: any) => receiptToApi(r)));
    } catch (err: any) {
      console.error("GET /api/receipts", err);
      res.status(500).json({ error: err.message ? `Failed to load receipts: ${err.message}` : "Failed to load receipts." });
    }
  });

  // Public receipt lookup — the receipt id/number itself acts as the share
  // token, so no auth is required. Used by the shareable customer-facing link.
  app.get("/api/receipts/:id", async (req, res) => {
    try {
      const { data: receipt, error } = await supabase.from("receipts").select("*").eq("id", req.params.id).maybeSingle();
      if (error) throw error;
      if (!receipt) return res.status(404).json({ error: "Receipt not found." });

      const { data: seller } = await supabase.from("sellers").select("*").eq("id", receipt.seller_id).maybeSingle();
      res.json(receiptToApi(receipt, seller as any));
    } catch (err: any) {
      console.error("GET /api/receipts/:id", err);
      res.status(500).json({ error: err.message ? `Failed to load receipt: ${err.message}` : "Failed to load receipt." });
    }
  });

  app.delete("/api/receipts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { sellerId } = req.query;
      if (!sellerId) return res.status(400).json({ error: "Seller ID is required." });

      const { data: receipt } = await supabase.from("receipts").select("seller_id").eq("id", id).maybeSingle();
      if (!receipt) return res.status(404).json({ error: "Receipt not found." });
      if (receipt.seller_id !== sellerId) return res.status(403).json({ error: "Unauthorized to delete this receipt." });

      const { error } = await supabase.from("receipts").delete().eq("id", id);
      if (error) throw error;

      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/receipts/:id", err);
      res.status(500).json({ error: "Failed to delete receipt." });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { sellerId } = req.query;
      if (!sellerId) return res.status(400).json({ error: "Seller ID is required for deletion." });

      const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (!product) return res.status(404).json({ error: "Product not found." });
      if (product.seller_id !== sellerId) return res.status(403).json({ error: "Unauthorized to delete this product." });

      const { data: seller } = await supabase.from("sellers").select("is_approved").eq("id", sellerId as string).maybeSingle();
      if (!seller || !seller.is_approved) return res.status(403).json({ error: "Unauthorized. Your account is pending admin approval." });

      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;

      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/products/:id", err);
      res.status(500).json({ error: "Failed to delete product." });
    }
  });

  // ---------------------------------------------------------------------
  // PUBLIC: Reports
  // ---------------------------------------------------------------------
  app.post("/api/reports", async (req, res) => {
    try {
      const { sellerId, productId, reason, description, reporterEmail } = req.body;
      if (!sellerId || !reason || !description || !reporterEmail) {
        return res.status(400).json({ error: "Missing required fields for submitting a report." });
      }

      const newReport = {
        id: "rep_" + Math.random().toString(36).substr(2, 9),
        seller_id: sellerId,
        product_id: productId || "",
        reason,
        description,
        reporter_email: reporterEmail,
      };
      const { data: inserted, error } = await supabase.from("reports").insert(newReport).select("*").single();
      if (error) throw error;

      res.json({
        success: true,
        report: {
          id: inserted.id,
          sellerId: inserted.seller_id,
          productId: inserted.product_id,
          reason: inserted.reason,
          description: inserted.description,
          reporterEmail: inserted.reporter_email,
          status: inserted.status,
          createdAt: inserted.created_at,
        },
      });
    } catch (err: any) {
      console.error("POST /api/reports", err);
      res.status(500).json({ error: "Failed to submit report." });
    }
  });

  // ---------------------------------------------------------------------
  // PUBLIC: SSM / trading-license validation (pure logic, unchanged, plus
  // a duplicate check against Supabase instead of db.json)
  // ---------------------------------------------------------------------
  app.get("/api/validate-ssm", async (req, res) => {
    try {
      const { ssm } = req.query;
      if (!ssm || typeof ssm !== "string") {
        return res.status(400).json({ isValid: false, error: "SSM number is required." });
      }

      const clean = ssm.replace(/[\s-]/g, "").toUpperCase();
      if (!clean) return res.status(400).json({ isValid: false, error: "SSM number cannot be empty." });

      const newFormatRegex = /^(19\d\d|20[0-2]\d)(0[1-6])(\d{6})$/;
      const oldCompanyRegex = /^(\d{1,7})([A-Z])$/;
      const oldBusinessRegex = /^([A-Z]{2}\d{7}|\d{9})([A-Z])$/;
      const oldLlpRegex = /^(LLP\d{7})([A-Z]*)$/;
      const sabahLicenseRegex = /^[A-Z0-9\/\-]{4,35}$/;

      let isValid = false;
      let format = "";
      let entityType = "Registered Entity";
      let yearOfIncorp = "Unknown";
      let regulatedBy = "Suruhanjaya Syarikat Malaysia (SSM)";

      if (newFormatRegex.test(clean)) {
        isValid = true;
        format = "new";
        const match = clean.match(newFormatRegex)!;
        yearOfIncorp = match[1];
        const typeCode = match[2];
        if (typeCode === "01") entityType = "Syarikat Sendirian Berhad (Sdn. Bhd.)";
        else if (typeCode === "02") entityType = "Syarikat Berhad (Bhd.) / Foreign Corp";
        else if (typeCode === "03") entityType = "Perniagaan Tunggal / Perkongsian (Sole Prop / Partnership)";
        else if (["04", "05", "06"].includes(typeCode)) entityType = "Perkongsian Liabiliti Terhad (LLP)";
      } else if (oldCompanyRegex.test(clean)) {
        isValid = true;
        format = "old_company";
        entityType = "Sdn. Bhd. / Berhad (Old Company Format)";
      } else if (oldBusinessRegex.test(clean)) {
        isValid = true;
        format = "old_business";
        entityType = "Sole Proprietorship / Partnership (Old Business Format)";
      } else if (oldLlpRegex.test(clean)) {
        isValid = true;
        format = "old_llp";
        entityType = "Limited Liability Partnership (Old LLP Format)";
      } else if (sabahLicenseRegex.test(clean)) {
        isValid = true;
        format = "sabah_license";
        entityType = "Sabah Trading License (Lesen Perniagaan Sabah)";
        regulatedBy = "Local Authority / Municipal Council / District Office (Sabah)";
      }

      if (!isValid) {
        return res.json({
          isValid: false,
          error:
            "Invalid format. Please enter a valid Sabah Trading License or SSM number (e.g. DBKK/12345/2026, KKS-12345, or 202603120150).",
        });
      }

      const cleanSsmInput = clean.replace(/[^A-Z0-9]/g, "");
      const { data: sellers } = await supabase.from("sellers").select("business_name, ssm_number");
      const duplicated = (sellers || []).find((s: any) => {
        if (!s.ssm_number) return false;
        return s.ssm_number.replace(/[^A-Z0-9]/g, "").toUpperCase() === cleanSsmInput;
      });

      if (duplicated) {
        return res.json({
          isValid: true,
          isDuplicated: true,
          duplicatedBusinessName: duplicated.business_name,
          error: `This license or SSM number is already registered under "${duplicated.business_name}".`,
        });
      }

      const months = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
      const randomMonth = months[Math.floor(Math.random() * months.length)];
      const randomDay = Math.floor(Math.random() * 28) + 1;
      const dateOfRegistration =
        yearOfIncorp !== "Unknown" ? `${randomDay} ${randomMonth} ${yearOfIncorp}` : `${randomDay} ${randomMonth} ${Math.floor(Math.random() * 10) + 2010}`;

      res.json({
        isValid: true,
        isDuplicated: false,
        format,
        entityType,
        registrationDate: dateOfRegistration,
        status: "ACTIVE",
        regulatedBy,
        message: "Business license/SSM verified successfully!",
      });
    } catch (err: any) {
      console.error("GET /api/validate-ssm", err);
      res.status(500).json({ isValid: false, error: "Validation failed. Please try again." });
    }
  });

  // ---------------------------------------------------------------------
  // PUBLIC: Seller registration & login
  // ---------------------------------------------------------------------
  app.post("/api/register", async (req, res) => {
    try {
      const { ownerName, email, businessName, category, ssmNumber, address, phoneNumber, password, location } = req.body;

      if (!ownerName || !email || !businessName || !category || !address || !phoneNumber || !password || !location) {
        return res.status(400).json({ error: "All required fields must be filled." });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }

      const { data: existing } = await supabase.from("sellers").select("email, owner_name, business_name");

      const emailLower = email.toLowerCase().trim();
      const ownerLower = ownerName.toLowerCase().trim();
      const businessLower = businessName.toLowerCase().trim();
      const conflict = (existing || []).find(
        (s: any) =>
          s.email.toLowerCase().trim() === emailLower ||
          s.owner_name.toLowerCase().trim() === ownerLower ||
          s.business_name.toLowerCase().trim() === businessLower
      );
      if (conflict) {
        if (conflict.email.toLowerCase().trim() === emailLower) {
          return res.status(400).json({ error: "An account with this email already exists." });
        }
        if (conflict.owner_name.toLowerCase().trim() === ownerLower) {
          return res.status(400).json({ error: "An account with this Owner/Entrepreneur Name already exists." });
        }
        return res.status(400).json({ error: "An account with this Business Name already exists." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newSeller = {
        id: "seller_" + Math.random().toString(36).substr(2, 9),
        owner_name: ownerName,
        email,
        business_name: businessName,
        category,
        ssm_number: ssmNumber || "",
        address,
        phone_number: phoneNumber,
        location,
        password_hash: passwordHash,
        is_verified: false,
        is_approved: false,
        verification_tier: "None",
      };

      const { data: inserted, error } = await supabase.from("sellers").insert(newSeller).select("*").single();
      if (error) throw error;

      await incrementStat("register_success_count");
      await addAdminLog("seller_registered", `Seller registered: ${businessName} (by ${ownerName})`);

      res.json({ success: true, seller: sellerToApi(inserted as SellerRow) });
    } catch (err: any) {
      console.error("POST /api/register", err);
      res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { identity, password } = req.body;
      if (!identity || !password) return res.status(400).json({ error: "Name/Email and password are required." });

      const { data: sellers } = await supabase.from("sellers").select("*");
      const identityLower = identity.toLowerCase();
      const seller = (sellers || []).find(
        (s: any) => s.email.toLowerCase() === identityLower || s.owner_name.toLowerCase() === identityLower
      );

      const passwordOk = seller ? await bcrypt.compare(password, seller.password_hash) : false;
      if (!seller || !passwordOk) {
        return res.status(400).json({ error: "Invalid credentials. Please check your name/email and password." });
      }

      await incrementStat("login_success_count");
      await addAdminLog("seller_logged_in", `Seller logged in: ${seller.business_name} (${seller.owner_name})`);

      res.json({ success: true, seller: sellerToApi(seller as SellerRow) });
    } catch (err: any) {
      console.error("POST /api/login", err);
      res.status(500).json({ error: "Login failed. Please try again." });
    }
  });

  // ---------------------------------------------------------------------
  // ADMIN: auth
  // ---------------------------------------------------------------------
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, passcode } = req.body;
      // Backward compatible with the existing single-field login form:
      // if no username is sent, try every admin account's passcode.
      const { data: admins } = await supabase.from("admin_users").select("*");
      if (!admins || admins.length === 0) {
        return res.status(500).json({ error: "No admin accounts are configured on the server yet." });
      }

      let matched = null;
      if (username) {
        const candidate = admins.find((a: any) => a.username.toLowerCase() === String(username).toLowerCase());
        if (candidate && (await bcrypt.compare(passcode || "", candidate.passcode_hash))) matched = candidate;
      } else {
        for (const a of admins) {
          if (await bcrypt.compare(passcode || "", a.passcode_hash)) {
            matched = a;
            break;
          }
        }
      }

      if (!matched) return res.status(401).json({ error: "Incorrect admin passcode. Access denied." });

      await issueAdminSession(res, matched.id);
      res.json({ success: true, username: matched.username });
    } catch (err: any) {
      console.error("POST /api/admin/login", err);
      res.status(500).json({ error: "Admin login failed." });
    }
  });

  app.post("/api/admin/logout", async (req, res) => {
    await clearAdminSession(req, res);
    res.json({ success: true });
  });

  app.get("/api/admin/check", requireAdminAuth, async (req, res) => {
    res.json({ success: true });
  });

  // ---------------------------------------------------------------------
  // ADMIN: manage admin accounts ("more" beyond the single shared passcode)
  // ---------------------------------------------------------------------
  app.get("/api/admin/admins", requireAdminAuth, async (req, res) => {
    const { data } = await supabase.from("admin_users").select("id, username, created_at").order("created_at", { ascending: true });
    res.json((data || []).map((a: any) => ({ id: a.id, username: a.username, createdAt: a.created_at })));
  });

  app.post("/api/admin/admins", requireAdminAuth, async (req: express.Request & { adminId?: string }, res) => {
    try {
      const { username, passcode } = req.body;
      if (!username || !passcode || passcode.length < 6) {
        return res.status(400).json({ error: "Username and a passcode of at least 6 characters are required." });
      }
      const passcodeHash = await bcrypt.hash(passcode, 10);
      const { data, error } = await supabase
        .from("admin_users")
        .insert({ id: "admin_" + crypto.randomBytes(8).toString("hex"), username, passcode_hash: passcodeHash })
        .select("id, username, created_at")
        .single();
      if (error) {
        if ((error as any).code === "23505") return res.status(400).json({ error: "That admin username is already taken." });
        throw error;
      }
      await addAdminLog("admin_account_created", `New admin account created: ${username}`);
      res.json({ success: true, admin: { id: data.id, username: data.username, createdAt: data.created_at } });
    } catch (err: any) {
      console.error("POST /api/admin/admins", err);
      res.status(500).json({ error: "Failed to create admin account." });
    }
  });

  app.delete("/api/admin/admins/:id", requireAdminAuth, async (req: express.Request & { adminId?: string }, res) => {
    try {
      const { count } = await supabase.from("admin_users").select("*", { count: "exact", head: true });
      if ((count || 0) <= 1) {
        return res.status(400).json({ error: "Cannot delete the last remaining admin account." });
      }
      if (req.params.id === req.adminId) {
        return res.status(400).json({ error: "You cannot delete the admin account you're currently logged in as." });
      }
      const { data: target } = await supabase.from("admin_users").select("username").eq("id", req.params.id).maybeSingle();
      const { error } = await supabase.from("admin_users").delete().eq("id", req.params.id);
      if (error) throw error;
      await addAdminLog("admin_account_deleted", `Admin account deleted: ${target?.username || req.params.id}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/admin/admins/:id", err);
      res.status(500).json({ error: "Failed to delete admin account." });
    }
  });

  app.post("/api/admin/change-passcode", requireAdminAuth, async (req: express.Request & { adminId?: string }, res) => {
    try {
      const { newPasscode } = req.body;
      if (!newPasscode || newPasscode.length < 6) {
        return res.status(400).json({ error: "New passcode must be at least 6 characters long." });
      }
      const passcodeHash = await bcrypt.hash(newPasscode, 10);
      const { error } = await supabase.from("admin_users").update({ passcode_hash: passcodeHash }).eq("id", req.adminId);
      if (error) throw error;
      await addAdminLog("admin_passcode_changed", `Admin ${req.adminId} changed their passcode`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("POST /api/admin/change-passcode", err);
      res.status(500).json({ error: "Failed to change passcode." });
    }
  });

  // ---------------------------------------------------------------------
  // ADMIN: stats / dashboard
  // ---------------------------------------------------------------------
  app.get("/api/admin/stats", requireAdminAuth, async (req, res) => {
    try {
      const stats = await getStats();
      const { data: logs } = await supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(200);
      const { data: sellers } = await supabase
        .from("sellers")
        .select("id, business_name, plan_status, trial_ends_at, next_payment_due");
      const { data: products } = await supabase.from("products").select("id");
      const { data: reports } = await supabase.from("reports").select("*").order("created_at", { ascending: false });

      const sellerById = new Map((sellers || []).map((s: any) => [s.id, s]));
      const productsById = new Map<string, any>();
      // fetch product titles for report enrichment
      const { data: allProducts } = await supabase.from("products").select("id, title");
      (allProducts || []).forEach((p: any) => productsById.set(p.id, p));

      const enrichedReports = (reports || []).map((r: any) => ({
        id: r.id,
        sellerId: r.seller_id,
        productId: r.product_id,
        reason: r.reason,
        description: r.description,
        reporterEmail: r.reporter_email,
        status: r.status,
        createdAt: r.created_at,
        sellerName: sellerById.get(r.seller_id)?.business_name || "Unknown Seller",
        productTitle: productsById.get(r.product_id)?.title || "Entire Store",
      }));

      const now = new Date();
      const planCounts = { pending: 0, founding: 0, trial: 0, paid: 0, expired: 0 };
      let trialsEndingSoon = 0; // trial or founding sellers with < 7 days left on their free period
      (sellers || []).forEach((s: any) => {
        const status = (s.plan_status || "pending") as keyof typeof planCounts;
        if (planCounts[status] !== undefined) planCounts[status]++;
        if ((status === "trial" || status === "founding") && s.trial_ends_at) {
          const daysLeft = (new Date(s.trial_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (daysLeft <= 7) trialsEndingSoon++;
        }
      });

      res.json({
        visitorCount: (stats as any).visitor_count || 0,
        loginSuccessCount: (stats as any).login_success_count || 0,
        registerSuccessCount: (stats as any).register_success_count || 0,
        contactSellerCount: (stats as any).contact_seller_count || 0,
        logs: (logs || []).map((l: any) => ({ id: l.id, timestamp: l.created_at, action: l.action, details: l.details })),
        totalSellers: (sellers || []).length,
        totalProducts: (products || []).length,
        totalReports: (reports || []).length,
        reports: enrichedReports,
        planSummary: {
          founding: planCounts.founding,
          foundingLimit: FOUNDING_SELLER_LIMIT,
          foundingSlotsLeft: Math.max(0, FOUNDING_SELLER_LIMIT - planCounts.founding),
          trial: planCounts.trial,
          trialsEndingSoon,
          paid: planCounts.paid,
          expired: planCounts.expired,
          pending: planCounts.pending,
          monthlyFeeRM: MONTHLY_SUBSCRIPTION_RM,
          estimatedMonthlyRevenueRM: planCounts.paid * MONTHLY_SUBSCRIPTION_RM,
        },
      });
    } catch (err: any) {
      console.error("GET /api/admin/stats", err);
      res.status(500).json({ error: "Failed to load admin stats." });
    }
  });

  // ---------------------------------------------------------------------
  // ADMIN: marketing analytics — visits & WhatsApp contact clicks over
  // time and by district, for the live chart in the Metrics tab.
  // ---------------------------------------------------------------------
  app.get("/api/admin/analytics", requireAdminAuth, async (req, res) => {
    try {
      const days = Math.min(180, Math.max(1, parseInt(req.query.days as string) || 30));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: events, error }, { data: sellers }] = await Promise.all([
        supabase
          .from("analytics_events")
          .select("id, event_type, seller_id, location, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: true }),
        supabase.from("sellers").select("id, business_name"),
      ]);
      if (error) throw error;

      const sellerNameById = new Map((sellers || []).map((s: any) => [s.id, s.business_name]));
      const rows = events || [];

      // Group by calendar date (YYYY-MM-DD) for the trend line/bar chart.
      const byDateMap = new Map<string, { date: string; visits: number; contactClicks: number }>();
      for (const ev of rows) {
        const dateKey = new Date(ev.created_at).toISOString().slice(0, 10);
        if (!byDateMap.has(dateKey)) byDateMap.set(dateKey, { date: dateKey, visits: 0, contactClicks: 0 });
        const bucket = byDateMap.get(dateKey)!;
        if (ev.event_type === "visit") bucket.visits++;
        else if (ev.event_type === "contact_click") bucket.contactClicks++;
      }
      const daily = Array.from(byDateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      // Group by district for the "where is my engagement coming from" bar chart.
      const byLocationMap = new Map<string, { location: string; visits: number; contactClicks: number }>();
      for (const ev of rows) {
        const loc = ev.location || "Unknown";
        if (!byLocationMap.has(loc)) byLocationMap.set(loc, { location: loc, visits: 0, contactClicks: 0 });
        const bucket = byLocationMap.get(loc)!;
        if (ev.event_type === "visit") bucket.visits++;
        else if (ev.event_type === "contact_click") bucket.contactClicks++;
      }
      const byLocation = Array.from(byLocationMap.values()).sort(
        (a, b) => b.visits + b.contactClicks - (a.visits + a.contactClicks)
      );

      // Most recent 100 raw events for a live activity feed.
      const recentEvents = rows
        .slice(-100)
        .reverse()
        .map((ev: any) => ({
          id: ev.id,
          eventType: ev.event_type,
          sellerId: ev.seller_id || undefined,
          businessName: ev.seller_id ? sellerNameById.get(ev.seller_id) || "Unknown Seller" : undefined,
          location: ev.location || undefined,
          createdAt: ev.created_at,
        }));

      res.json({
        rangeDays: days,
        totalVisits: rows.filter((e: any) => e.event_type === "visit").length,
        totalContactClicks: rows.filter((e: any) => e.event_type === "contact_click").length,
        daily,
        byLocation,
        recentEvents,
      });
    } catch (err: any) {
      console.error("GET /api/admin/analytics", err);
      res.status(500).json({ error: "Failed to load analytics." });
    }
  });

  // ---------------------------------------------------------------------
  // ADMIN: sellers
  // ---------------------------------------------------------------------
  app.post("/api/admin/sellers/:id/verify", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { isVerified, isApproved, verificationTier } = req.body;

      const { data: seller } = await supabase.from("sellers").select("*").eq("id", id).maybeSingle();
      if (!seller) return res.status(404).json({ error: "Seller not found." });

      const update: Record<string, any> = {};
      if (isApproved !== undefined) update.is_approved = !!isApproved;

      // First time this seller is approved, slot them into the plan:
      // founding (free for their first year) if we're still under the
      // founding cap, otherwise a 1-month trial that leads into the paid plan.
      if (isApproved === true && seller.plan_status === "pending") {
        const { count: foundingCount } = await supabase
          .from("sellers")
          .select("id", { count: "exact", head: true })
          .eq("plan_status", "founding");

        const now = new Date();
        update.approved_at = now.toISOString();
        if ((foundingCount || 0) < FOUNDING_SELLER_LIMIT) {
          update.plan_status = "founding";
          update.trial_ends_at = new Date(now.getTime() + FOUNDING_FREE_YEAR_DAYS * 24 * 60 * 60 * 1000).toISOString();
        } else {
          update.plan_status = "trial";
          update.trial_ends_at = new Date(now.getTime() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000).toISOString();
        }
      }

      if (verificationTier !== undefined) {
        update.verification_tier = verificationTier;
        update.is_verified = verificationTier !== "None";
      } else if (isVerified !== undefined) {
        update.is_verified = !!isVerified;
        if (isVerified && (!seller.verification_tier || seller.verification_tier === "None")) {
          update.verification_tier = "Bronze";
        } else if (!isVerified) {
          update.verification_tier = "None";
        }
      }

      const { data: updated, error } = await supabase.from("sellers").update(update).eq("id", id).select("*").single();
      if (error) throw error;

      await addAdminLog(
        "seller_verification_changed",
        `Changed approval/verification for ${updated.business_name}: Approved=${updated.is_approved}, Tier=${updated.verification_tier || "None"}`
      );

      // Fire the welcome email if this request just assigned a plan (i.e. this
      // was their first-ever approval). Doesn't block or fail the response.
      if (update.plan_status === "founding" || update.plan_status === "trial") {
        const { subject, html } = renderSellerWelcomeEmail(
          { ownerName: updated.owner_name, businessName: updated.business_name },
          update.plan_status
        );
        sendEmail({ to: updated.email, subject, html }).then((ok) => {
          addAdminLog(
            ok ? "welcome_email_sent" : "welcome_email_failed",
            ok
              ? `Sent welcome email to ${updated.business_name} (${updated.email}).`
              : `Failed to send welcome email to ${updated.business_name} (${updated.email}) — check RESEND_API_KEY is set and the domain is verified.`
          );
        });
      }

      res.json({ success: true, seller: sellerToApi(updated as SellerRow) });
    } catch (err: any) {
      console.error("POST /api/admin/sellers/:id/verify", err);
      res.status(500).json({ error: "Failed to update seller." });
    }
  });

  // Send a personalized email to many sellers at once. The subject/body can
  // use {{ownerName}} and {{businessName}} placeholders, which get swapped
  // in per-recipient — so it's one "campaign" but every email reads as if
  // written just for that seller.
  app.post("/api/admin/broadcast-email", requireAdminAuth, async (req, res) => {
    try {
      const { subject, bodyHtml, planFilter, rawHtml } = req.body;
      if (!subject || !bodyHtml) {
        return res.status(400).json({ error: "subject and bodyHtml are required." });
      }

      let query = supabase.from("sellers").select("id, email, owner_name, business_name, plan_status").eq("is_approved", true);
      if (planFilter && planFilter !== "all") {
        query = query.eq("plan_status", planFilter);
      }
      const { data: sellers, error } = await query;
      if (error) throw error;
      if (!sellers || sellers.length === 0) {
        return res.status(400).json({ error: "No matching sellers found." });
      }

      // Respond immediately — the actual sending happens in the background so
      // the admin isn't stuck waiting on a page that could take a minute or
      // more for a large seller list.
      res.json({ success: true, queued: sellers.length });

      const personalize = (template: string, s: any) =>
        template
          .replaceAll("{{ownerName}}", s.owner_name || "there")
          .replaceAll("{{businessName}}", s.business_name || "your shop");

      (async () => {
        let sent = 0;
        let failed = 0;
        for (const s of sellers) {
          try {
            const personalizedBody = personalize(bodyHtml, s);
            await sendEmail({
              to: s.email,
              subject: personalize(subject, s),
              // "Custom HTML" mode: the admin pasted a complete, self-contained
              // email template (their own header/logo/etc.) — send as-is rather
              // than wrapping it in the default brand shell a second time.
              html: rawHtml ? personalizedBody : emailShell(`<tr><td style="padding:36px 40px;">${personalizedBody}</td></tr>`),
            });
            sent++;
          } catch {
            failed++;
          }
        }
        await addAdminLog("broadcast_email_sent", `Sent broadcast email "${subject}" to ${sent} seller(s)${failed ? `, ${failed} failed` : ""}.`);
      })();
    } catch (err: any) {
      console.error("POST /api/admin/broadcast-email", err);
      res.status(500).json({ error: "Failed to send broadcast email." });
    }
  });

  app.delete("/api/admin/sellers/:id", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { data: seller } = await supabase.from("sellers").select("business_name").eq("id", id).maybeSingle();
      if (!seller) return res.status(404).json({ error: "Seller not found." });

      // products/reviews/reports cascade-delete via FK constraints
      const { error } = await supabase.from("sellers").delete().eq("id", id);
      if (error) throw error;

      await addAdminLog("seller_deleted", `Deleted merchant "${seller.business_name}" and all associated listings`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/admin/sellers/:id", err);
      res.status(500).json({ error: "Failed to delete seller." });
    }
  });

  // ---------------------------------------------------------------------
  // ADMIN: products — pin/feature, plus full edit & delete (new)
  // ---------------------------------------------------------------------
  app.post("/api/admin/products/:id/pin", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { isPinned } = req.body;

      const { data: updated, error } = await supabase
        .from("products")
        .update({ is_pinned: !!isPinned })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return res.status(404).json({ error: "Product not found." });

      await addAdminLog("product_pin_changed", `Changed pin status for "${updated.title}" to ${updated.is_pinned ? "PINNED (ON TOP)" : "UNPINNED"}`);
      res.json({ success: true, product: productToApi(updated as ProductRow) });
    } catch (err: any) {
      console.error("POST /api/admin/products/:id/pin", err);
      res.status(500).json({ error: "Failed to update product." });
    }
  });

  // NEW: admins can now edit any product's details directly (not just pin it)
  app.patch("/api/admin/products/:id", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, category, description, price, imageUrl, isAvailable } = req.body;

      const update: Record<string, any> = {};
      if (title !== undefined) update.title = title;
      if (category !== undefined) update.category = category;
      if (description !== undefined) update.description = description;
      if (price !== undefined) update.price = parseFloat(price);
      if (imageUrl !== undefined) update.image_url = imageUrl;
      if (isAvailable !== undefined) update.is_available = !!isAvailable;

      const { data: updated, error } = await supabase.from("products").update(update).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      if (!updated) return res.status(404).json({ error: "Product not found." });

      await addAdminLog("product_edited_by_admin", `Admin edited product "${updated.title}"`);
      res.json({ success: true, product: productToApi(updated as ProductRow) });
    } catch (err: any) {
      console.error("PATCH /api/admin/products/:id", err);
      res.status(500).json({ error: "Failed to update product." });
    }
  });

  // NEW: admins can now delete any product directly
  app.delete("/api/admin/products/:id", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { data: product } = await supabase.from("products").select("title").eq("id", id).maybeSingle();
      if (!product) return res.status(404).json({ error: "Product not found." });

      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;

      await addAdminLog("product_deleted_by_admin", `Admin deleted product "${product.title}"`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/admin/products/:id", err);
      res.status(500).json({ error: "Failed to delete product." });
    }
  });

  // Admin manually updates a seller's plan status — mainly used to mark a
  // trial seller as "paid" after receiving their RM20/month (e.g. bank
  // transfer), or "expired" if a trial/payment lapsed.
  app.post("/api/admin/sellers/:id/plan", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { planStatus, nextPaymentDue } = req.body;
      const allowed = ["pending", "founding", "trial", "paid", "expired"];
      if (!allowed.includes(planStatus)) {
        return res.status(400).json({ error: `planStatus must be one of: ${allowed.join(", ")}` });
      }

      const { data: seller } = await supabase.from("sellers").select("*").eq("id", id).maybeSingle();
      if (!seller) return res.status(404).json({ error: "Seller not found." });

      const update: Record<string, any> = { plan_status: planStatus };
      if (planStatus === "paid") {
        update.next_payment_due = nextPaymentDue
          ? new Date(nextPaymentDue).toISOString()
          : new Date(Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000).toISOString();
      }

      const { data: updated, error } = await supabase.from("sellers").update(update).eq("id", id).select("*").single();
      if (error) throw error;

      await addAdminLog("seller_plan_changed", `Set plan status for ${updated.business_name} to "${planStatus}".`);
      res.json({ success: true, seller: sellerToApi(updated as SellerRow) });
    } catch (err: any) {
      console.error("POST /api/admin/sellers/:id/plan", err);
      res.status(500).json({ error: "Failed to update seller plan." });
    }
  });

  // Marks a seller account as the "official" TamuBah presence — shows a
  // distinct badge wherever they post in the Community forum. Meant for a
  // single dedicated account (e.g. business name "TamuBah"), not regular sellers.
  app.post("/api/admin/sellers/:id/official", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { isOfficial } = req.body;

      const { data: updated, error } = await supabase
        .from("sellers")
        .update({ is_official: !!isOfficial })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      if (!updated) return res.status(404).json({ error: "Seller not found." });

      await addAdminLog("seller_official_changed", `${isOfficial ? "Marked" : "Unmarked"} ${updated.business_name} as the official TamuBah account.`);
      res.json({ success: true, seller: sellerToApi(updated as SellerRow) });
    } catch (err: any) {
      console.error("POST /api/admin/sellers/:id/official", err);
      res.status(500).json({ error: "Failed to update official status." });
    }
  });

  // ---------------------------------------------------------------------
  // ADMIN: reset a seller's password — for forgot-password support. No
  // current password required (that's the point — the seller can't supply
  // one), but it does require the admin's own session auth.
  // ---------------------------------------------------------------------
  app.post("/api/admin/sellers/:id/reset-password", requireAdminAuth, async (req: express.Request & { adminId?: string }, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters long." });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      const { data: updated, error } = await supabase
        .from("sellers")
        .update({ password_hash: newHash })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return res.status(404).json({ error: "Seller not found." });

      await addAdminLog("admin_reset_seller_password", `Admin reset the password for ${updated.business_name} (${updated.owner_name}).`);
      res.json({ success: true, seller: sellerToApi(updated as SellerRow) });
    } catch (err: any) {
      console.error("POST /api/admin/sellers/:id/reset-password", err);
      res.status(500).json({ error: "Failed to reset password." });
    }
  });

  // ---------------------------------------------------------------------
  // ADMIN: publish requests — sellers asking to publish more than 1 product
  // ---------------------------------------------------------------------
  app.get("/api/admin/publish-requests", requireAdminAuth, async (req, res) => {
    try {
      const statusFilter = (req.query.status as string) || "all";

      let query = supabase.from("publish_requests").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data: requests, error } = await query;
      if (error) throw error;

      const sellerIds = [...new Set((requests || []).map((r: any) => r.seller_id))];
      const productIds = [...new Set((requests || []).map((r: any) => r.product_id))];

      const [{ data: sellers }, { data: products }] = await Promise.all([
        sellerIds.length ? supabase.from("sellers").select("id, business_name, owner_name").in("id", sellerIds) : Promise.resolve({ data: [] }),
        productIds.length ? supabase.from("products").select("id, title, image_url, price").in("id", productIds) : Promise.resolve({ data: [] }),
      ]);

      const sellerById = new Map((sellers || []).map((s: any) => [s.id, s]));
      const productById = new Map((products || []).map((p: any) => [p.id, p]));

      res.json(
        (requests || []).map((r: any) => ({
          id: r.id,
          sellerId: r.seller_id,
          productId: r.product_id,
          message: r.message,
          adminNote: r.admin_note,
          status: r.status,
          createdAt: r.created_at,
          resolvedAt: r.resolved_at,
          businessName: sellerById.get(r.seller_id)?.business_name || "Unknown Seller",
          sellerName: sellerById.get(r.seller_id)?.owner_name || "",
          productTitle: productById.get(r.product_id)?.title || "Deleted product",
          productImageUrl: productById.get(r.product_id)?.image_url || "",
          productPrice: productById.get(r.product_id)?.price || 0,
        }))
      );
    } catch (err: any) {
      console.error("GET /api/admin/publish-requests", err);
      res.status(500).json({ error: "Failed to load publish requests." });
    }
  });

  app.post("/api/admin/publish-requests/:id/approve", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { data: request } = await supabase.from("publish_requests").select("*").eq("id", id).maybeSingle();
      if (!request) return res.status(404).json({ error: "Publish request not found." });
      if (request.status !== "pending") return res.status(400).json({ error: "This request has already been resolved." });

      const { data: product, error: productErr } = await supabase
        .from("products")
        .update({ is_published: true })
        .eq("id", request.product_id)
        .select("*")
        .maybeSingle();
      if (productErr) throw productErr;

      const { data: updatedRequest, error } = await supabase
        .from("publish_requests")
        .update({ status: "approved", resolved_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      await addAdminLog("publish_request_approved", `Approved publishing "${product?.title || request.product_id}" beyond the normal 1-product limit.`);
      res.json({ success: true, request: updatedRequest, product: product ? productToApi(product as ProductRow) : null });
    } catch (err: any) {
      console.error("POST /api/admin/publish-requests/:id/approve", err);
      res.status(500).json({ error: "Failed to approve publish request." });
    }
  });

  app.post("/api/admin/publish-requests/:id/reject", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { adminNote } = req.body;
      const { data: request } = await supabase.from("publish_requests").select("*").eq("id", id).maybeSingle();
      if (!request) return res.status(404).json({ error: "Publish request not found." });
      if (request.status !== "pending") return res.status(400).json({ error: "This request has already been resolved." });

      const { data: updatedRequest, error } = await supabase
        .from("publish_requests")
        .update({ status: "rejected", admin_note: adminNote || "", resolved_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      await addAdminLog("publish_request_rejected", `Rejected a seller's request to publish an additional product.`);
      res.json({ success: true, request: updatedRequest });
    } catch (err: any) {
      console.error("POST /api/admin/publish-requests/:id/reject", err);
      res.status(500).json({ error: "Failed to reject publish request." });
    }
  });

  // ---------------------------------------------------------------------
  // ADMIN: reports moderation (new — resolve / dismiss / delete)
  // ---------------------------------------------------------------------
  app.patch("/api/admin/reports/:id", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body; // 'open' | 'resolved' | 'dismissed'
      if (!["open", "resolved", "dismissed"].includes(status)) {
        return res.status(400).json({ error: "Status must be one of open, resolved, dismissed." });
      }
      const { data: updated, error } = await supabase.from("reports").update({ status }).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      if (!updated) return res.status(404).json({ error: "Report not found." });

      await addAdminLog("report_status_changed", `Report ${id} marked as ${status}`);
      res.json({ success: true, report: updated });
    } catch (err: any) {
      console.error("PATCH /api/admin/reports/:id", err);
      res.status(500).json({ error: "Failed to update report." });
    }
  });

  app.delete("/api/admin/reports/:id", requireAdminAuth, async (req, res) => {
    try {
      const { error } = await supabase.from("reports").delete().eq("id", req.params.id);
      if (error) throw error;
      await addAdminLog("report_deleted", `Report ${req.params.id} deleted`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/admin/reports/:id", err);
      res.status(500).json({ error: "Failed to delete report." });
    }
  });

  // ---------------------------------------------------------------------
  // ADMIN: review moderation (new — remove abusive/fake reviews)
  // ---------------------------------------------------------------------
  app.delete("/api/admin/reviews/:id", requireAdminAuth, async (req, res) => {
    try {
      const { error } = await supabase.from("reviews").delete().eq("id", req.params.id);
      if (error) throw error;
      await addAdminLog("review_deleted_by_admin", `Admin deleted review ${req.params.id}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/admin/reviews/:id", err);
      res.status(500).json({ error: "Failed to delete review." });
    }
  });

  // ---------------------------------------------------------------------
  // SSR META TAGS — /product/:id and /seller/:id
  // Pretty, shareable URLs that also carry the right Open Graph preview
  // (photo, title, description) for WhatsApp/Facebook/Telegram link
  // previews. The React app still renders the actual page client-side —
  // this only swaps in the right <title>/<meta> tags before the HTML
  // reaches the browser (or a chat app's link-preview crawler).
  // ---------------------------------------------------------------------
  async function readIndexHtmlForRequest(reqUrl: string): Promise<string> {
    if (isProd) {
      return fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
    }
    const raw = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8");
    return vite ? await vite.transformIndexHtml(reqUrl, raw) : raw;
  }

  app.get("/product/:id", async (req, res) => {
    try {
      let html = await readIndexHtmlForRequest(req.originalUrl);
      const { data: product } = await supabase.from("products").select("*").eq("id", req.params.id).maybeSingle();
      if (product) {
        const { data: seller } = await supabase.from("sellers").select("business_name").eq("id", product.seller_id).maybeSingle();
        const businessName = seller ? seller.business_name : "a local Sabah seller";
        html = injectMetaTags(html, {
          title: `${product.title} — RM${Number(product.price).toFixed(2)} | TamuBah`,
          description: (product.description && product.description.trim())
            ? product.description.slice(0, 200)
            : `Available now from ${businessName} on TamuBah — Sabah's home-based marketplace.`,
          image: product.image_url || `${APP_BASE_URL}/tamubah-logo-email.png`,
          url: `${APP_BASE_URL}/product/${product.id}`,
        });
      }
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (err) {
      console.error("GET /product/:id (SSR)", err);
      res.status(500).send("Failed to load page.");
    }
  });

  app.get("/seller/:id", async (req, res) => {
    try {
      let html = await readIndexHtmlForRequest(req.originalUrl);
      const { data: seller } = await supabase.from("sellers").select("*").eq("id", req.params.id).maybeSingle();
      if (seller) {
        html = injectMetaTags(html, {
          title: `${seller.business_name} | TamuBah`,
          description: (seller.dream && seller.dream.trim())
            ? seller.dream.slice(0, 200)
            : `A home-based business from ${seller.location || "Sabah"} on TamuBah — order directly via WhatsApp.`,
          image: seller.logo_url || `${APP_BASE_URL}/tamubah-logo-email.png`,
          url: `${APP_BASE_URL}/seller/${seller.id}`,
        });
      }
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (err) {
      console.error("GET /seller/:id (SSR)", err);
      res.status(500).send("Failed to load page.");
    }
  });

  // ---------------------------------------------------------------------
  // VITE DEV / PRODUCTION HANDLERS
  // ---------------------------------------------------------------------
  if (!isProd && vite) {
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Runs in the background so a large legacy-image backlog never delays
    // the server from binding to the port / passing a host's health check.
    migrateBase64ImagesToStorage();
    pruneExpiredStories();
    setInterval(pruneExpiredStories, 60 * 60 * 1000); // also re-check every hour
  });
}

startServer();
