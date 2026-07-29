import "dotenv/config";
import express from "express";
import path from "path";
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

  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // ---------------------------------------------------------------------
  // PUBLIC: Sellers
  // ---------------------------------------------------------------------
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
      res.status(500).json({ error: "Failed to create receipt." });
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
      res.status(500).json({ error: "Failed to load receipts." });
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
      res.status(500).json({ error: "Failed to load receipt." });
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
      const { data: sellers } = await supabase.from("sellers").select("id, business_name");
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
      });
    } catch (err: any) {
      console.error("GET /api/admin/stats", err);
      res.status(500).json({ error: "Failed to load admin stats." });
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

      res.json({ success: true, seller: sellerToApi(updated as SellerRow) });
    } catch (err: any) {
      console.error("POST /api/admin/sellers/:id/verify", err);
      res.status(500).json({ error: "Failed to update seller." });
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
  // VITE DEV / PRODUCTION HANDLERS
  // ---------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
