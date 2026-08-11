import React, { useState, useEffect } from "react";
import { 
  BarChart3, Users, ShieldCheck, Star, 
  Clock, AlertTriangle, Search, Filter,
  Check, X, ArrowUpRight, TrendingUp, RefreshCw, Lock,
  ExternalLink, Code, Terminal, Info, Play, Server, FileText,
  User, MoreVertical, ShieldAlert,
  Trash2, Wallet, Send, Mail, Tag, Plus, Megaphone, Pencil, Save, Phone, Copy, MapPin, Activity,
  GripVertical
} from "lucide-react";
import { Seller, Product } from "../types";
import { CategoryIcon } from "../lib/categoryIcons";
import { useCategories, addCategory, renameCategory, removeCategory, setCategoryColor } from "../lib/categoryStore";
import { getAnnouncement, setAnnouncement } from "../lib/announcementStore";

// --- small chart helpers (no external chart library — kept dependency-free) ---
function buildLinePoints(values: number[], width: number, height: number, padding = 8): string {
  if (values.length === 0) return "";
  const max = Math.max(1, ...values);
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (v / max) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// Cloud Monitoring-style area chart: given values plotted against a SHARED
// max (so multiple series stay honestly comparable on one axis), returns
// the coordinate array plus ready-to-use SVG path strings for the line and
// the gradient-filled area beneath it.
function buildChartGeometry(values: number[], max: number, width: number, height: number, padding = 10) {
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (max > 0 ? (v / max) * (height - padding * 2) : 0);
    return { x, y, value: v };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = points.length > 0
    ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${(height - padding).toFixed(1)} L${points[0].x.toFixed(1)},${(height - padding).toFixed(1)} Z`
    : "";
  return { points, linePath, areaPath };
}

// "Nice" round numbers for a Y-axis: picks grid values that read cleanly
// (0, 5, 10... or 0, 25, 50...) instead of raw fractions of the max.
function buildYAxisTicks(max: number, tickCount = 4): number[] {
  if (max <= 0) return [0];
  if (max <= tickCount) {
    // Small integer domains (e.g. a handful of visits) — just count by 1s.
    return Array.from({ length: max + 1 }, (_, i) => i);
  }
  const rawStep = max / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const niceStep = (normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1) * magnitude;
  const ticks: number[] = [];
  for (let v = 0; v <= max + niceStep * 0.01; v += niceStep) {
    ticks.push(Math.round(v));
  }
  return Array.from(new Set(ticks));
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface AdminStats {
  visitorCount: number;
  loginSuccessCount: number;
  registerSuccessCount: number;
  logs: {
    id: string;
    timestamp: string;
    action: string;
    details: string;
  }[];
  totalSellers: number;
  totalProducts: number;
  totalReports: number;
  reports?: {
    id: string;
    sellerId: string;
    productId: string;
    reason: string;
    description: string;
    reporterEmail: string;
    createdAt: string;
    sellerName: string;
    productTitle: string;
    status?: string;
  }[];
  planSummary?: {
    founding: number;
    foundingLimit: number;
    foundingSlotsLeft: number;
    trial: number;
    trialsEndingSoon: number;
    paid: number;
    expired: number;
    pending: number;
    monthlyFeeRM: number;
    estimatedMonthlyRevenueRM: number;
  };
}

interface AdminPanelProps {
  onRefreshMarket: () => void;
  onLockAdmin?: () => void;
}

export default function AdminPanel({ onRefreshMarket, onLockAdmin }: AdminPanelProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"metrics" | "merchants" | "revisions" | "publish" | "logs" | "admins" | "yaml" | "categories" | "contacts">("metrics");

  // --- Category management (admin-editable business categories) ---
  const { categories: adminCategories, colors: adminCategoryColors } = useCategories();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [announcementDraft, setAnnouncementDraft] = useState<string>(() => getAnnouncement()?.message || "");
  const [announcementSavedMsg, setAnnouncementSavedMsg] = useState("");
  const [contactCopyMsg, setContactCopyMsg] = useState("");

  // Live marketing analytics (visits + WhatsApp contact clicks, by date & district)
  const [analytics, setAnalytics] = useState<{
    totalVisits: number;
    totalContactClicks: number;
    daily: { date: string; visits: number; contactClicks: number }[];
    byLocation: { location: string; visits: number; contactClicks: number }[];
    recentEvents: { id: string; eventType: string; businessName?: string; location?: string; createdAt: string }[];
  } | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState<number>(30);
  const [analyticsLastUpdated, setAnalyticsLastUpdated] = useState<Date | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string>("");
  const [chartHoverIndex, setChartHoverIndex] = useState<number | null>(null);

  // Full, unfiltered, unpaginated seller list — used for the Contact List tab and
  // the all-time growth/engagement charts below (the `sellers` state above is
  // paginated + filtered for the Merchants table and isn't a safe source for either).
  const [allSellers, setAllSellers] = useState<Seller[]>([]);
  const fetchAllSellers = async () => {
    try {
      const res = await fetch("/api/sellers?showAll=true&limit=1000", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setAllSellers(data);
    } catch (error) {
      console.error("Failed to load full seller list", error);
    }
  };

  // Normalizes a raw MY phone number to +60 international format for WhatsApp/Contacts import
  const normalizePhone = (raw: string): string => {
    let clean = (raw || "").replace(/\D/g, "");
    if (clean.startsWith("0")) clean = "6" + clean;
    else if (clean.startsWith("1")) clean = "60" + clean;
    else if (clean.length > 0 && !clean.startsWith("60")) clean = "60" + clean;
    return clean ? `+${clean}` : "";
  };

  const sellersByJoinDate = [...allSellers].sort((a: any, b: any) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });

  // Cumulative sellers-joined-over-time (all history) for the growth chart
  const sellerGrowth = (() => {
    const byDate = new Map<string, number>();
    sellersByJoinDate.forEach((s: any) => {
      if (!s.createdAt) return;
      const key = new Date(s.createdAt).toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) || 0) + 1);
    });
    const dates = Array.from(byDate.keys()).sort();
    let running = 0;
    return dates.map((date) => {
      running += byDate.get(date)!;
      return { date, cumulative: running };
    });
  })();

  // Top sellers by lifetime WhatsApp contact clicks
  const topContactedSellers = [...allSellers]
    .filter((s: any) => (s.contactCount || 0) > 0)
    .sort((a: any, b: any) => (b.contactCount || 0) - (a.contactCount || 0))
    .slice(0, 10);

  const copyToClipboard = async (text: string, successLabel: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setContactCopyMsg(successLabel);
      setTimeout(() => setContactCopyMsg(""), 2500);
    } catch (e) {
      console.error("Clipboard write failed", e);
      setContactCopyMsg("Couldn't copy — select the text below and copy manually.");
      setTimeout(() => setContactCopyMsg(""), 3500);
    }
  };
  
  // Search and filter states
  const [sellerSearch, setSellerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [sellerFilter, setSellerFilter] = useState<"all" | "verified" | "unverified">("all");

  // --- Broadcast email ---
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastPlanFilter, setBroadcastPlanFilter] = useState("all");
  const [broadcastMode, setBroadcastMode] = useState<"text" | "html">("text");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  const personalizePreview = (template: string) =>
    template.replaceAll("{{ownerName}}", "Ahmad").replaceAll("{{businessName}}", "Kedai Ahmad");

  const handlePreviewBroadcast = () => {
    if (!broadcastBody.trim()) return;
    const html =
      broadcastMode === "html"
        ? personalizePreview(broadcastBody)
        : `<div style="font-family:Arial,sans-serif;max-width:600px;margin:40px auto;padding:24px;">${personalizePreview(
            broadcastBody
          )
            .split("\n")
            .map((line) => `<p style="font-size:15px;line-height:1.6;color:#334155;">${line}</p>`)
            .join("")}</div>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastSubject.trim() || !broadcastBody.trim()) {
      setBroadcastError("Subject and message body are required.");
      return;
    }
    setBroadcastSending(true);
    setBroadcastError(null);
    setBroadcastResult(null);
    try {
      const bodyHtml =
        broadcastMode === "html"
          ? broadcastBody
          : broadcastBody
              .split("\n")
              .map((line) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">${line}</p>`)
              .join("");
      const res = await fetch("/api/admin/broadcast-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: broadcastSubject,
          bodyHtml,
          planFilter: broadcastPlanFilter,
          rawHtml: broadcastMode === "html",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send broadcast.");
      setBroadcastResult(`Sending to ${data.queued} seller(s) in the background — check the Logs tab shortly for the final result.`);
      setBroadcastSubject("");
      setBroadcastBody("");
    } catch (err: any) {
      setBroadcastError(err.message || "Failed to send broadcast.");
    } finally {
      setBroadcastSending(false);
    }
  };
  const [productFilter, setProductFilter] = useState<"all" | "pinned" | "regular">("all");

  // Admin Pagination states
  const [sellersPage, setSellersPage] = useState<number>(1);
  const [productsPage, setProductsPage] = useState<number>(1);
  const [sellersHasMore, setSellersHasMore] = useState<boolean>(false);
  const [productsHasMore, setProductsHasMore] = useState<boolean>(false);
  const [sellersTotal, setSellersTotal] = useState<number>(0);
  const [productsTotal, setProductsTotal] = useState<number>(0);

  // Debounced states for admin search queries
  const [debouncedSellerSearch, setDebouncedSellerSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSellerSearch(sellerSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [sellerSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedProductSearch(productSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [productSearch]);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [yamlEditorContent, setYamlEditorContent] = useState<string>("");

  // --- Publish requests (sellers asking to publish more than 1 product) ---
  const [publishRequests, setPublishRequests] = useState<any[]>([]);
  const [publishRequestFilter, setPublishRequestFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [pendingPublishCount, setPendingPublishCount] = useState<number>(0);

  const fetchPublishRequests = async (statusFilter = publishRequestFilter) => {
    try {
      const res = await fetch(`/api/admin/publish-requests?status=${statusFilter}`);
      const data = await res.json();
      if (res.ok) setPublishRequests(data);
    } catch (error) {
      console.error("Failed to load publish requests", error);
    }
  };

  const fetchPendingPublishCount = async () => {
    try {
      const res = await fetch(`/api/admin/publish-requests?status=pending`);
      const data = await res.json();
      if (res.ok) setPendingPublishCount(data.length);
    } catch (error) {
      console.error("Failed to load pending publish request count", error);
    }
  };

  useEffect(() => {
    fetchPublishRequests(publishRequestFilter);
    fetchPendingPublishCount();
  }, [publishRequestFilter]);

  useEffect(() => {
    if (activeTab === "publish") fetchPublishRequests(publishRequestFilter);
  }, [activeTab]);

  const handleApprovePublishRequest = async (requestId: string) => {
    try {
      setActionLoading(`pubreq-${requestId}`);
      const res = await fetch(`/api/admin/publish-requests/${requestId}/approve`, { method: "POST" });
      if (res.ok) {
        await fetchPublishRequests(publishRequestFilter);
        await fetchPendingPublishCount();
        await fetchAdminData();
        onRefreshMarket();
      } else {
        const errorData = await res.json().catch(() => ({}));
        window.alert(errorData.error || "Failed to approve publish request.");
      }
    } catch (error) {
      console.error("Error approving publish request", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPublishRequest = async (requestId: string) => {
    const confirmed = window.confirm("Reject this seller's request to publish an additional product?");
    if (!confirmed) return;
    try {
      setActionLoading(`pubreq-${requestId}`);
      const res = await fetch(`/api/admin/publish-requests/${requestId}/reject`, { method: "POST" });
      if (res.ok) {
        await fetchPublishRequests(publishRequestFilter);
        await fetchPendingPublishCount();
      } else {
        const errorData = await res.json().catch(() => ({}));
        window.alert(errorData.error || "Failed to reject publish request.");
      }
    } catch (error) {
      console.error("Error rejecting publish request", error);
    } finally {
      setActionLoading(null);
    }
  };

  const fetchSellersData = async () => {
    try {
      const queryParams = new URLSearchParams({
        page: sellersPage.toString(),
        limit: "50",
        search: debouncedSellerSearch,
        filter: sellerFilter,
        showAll: "true"
      });
      const res = await fetch(`/api/sellers?${queryParams.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setSellers(data);
        setSellersHasMore(res.headers.get("X-Has-More") === "true" || data.length === 50);
        const total = res.headers.get("X-Total-Count");
        if (total) setSellersTotal(parseInt(total));
      }
    } catch (error) {
      console.error("Failed to load admin sellers", error);
    }
  };

  const fetchProductsData = async () => {
    try {
      const queryParams = new URLSearchParams({
        page: productsPage.toString(),
        limit: "50",
        search: debouncedProductSearch,
        showAll: "true"
      });
      const res = await fetch(`/api/products?${queryParams.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setProducts(data);
        setProductsHasMore(res.headers.get("X-Has-More") === "true" || data.length === 50);
        const total = res.headers.get("X-Total-Count");
        if (total) setProductsTotal(parseInt(total));
      }
    } catch (error) {
      console.error("Failed to load admin products", error);
    }
  };

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      // Fetch stats
      const statsRes = await fetch("/api/admin/stats");
      const statsData = await statsRes.json();
      setStats(statsData);

      await Promise.all([
        fetchSellersData(),
        fetchProductsData()
      ]);
    } catch (error) {
      console.error("Failed to load admin dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`/api/admin/analytics?days=${analyticsDays}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setAnalyticsError(
          body.error ||
            `Failed to load analytics (HTTP ${res.status}). If this is the first time, make sure you've run the latest supabase/schema.sql — it adds the "analytics_events" table this chart needs.`
        );
        return;
      }
      const data = await res.json();
      setAnalytics(data);
      setAnalyticsError("");
      setAnalyticsLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to load analytics", error);
      setAnalyticsError("Couldn't reach the server to load analytics. Check your connection and try again.");
    }
  };

  // Reset page numbers on filters change
  useEffect(() => {
    setSellersPage(1);
  }, [debouncedSellerSearch, sellerFilter]);

  useEffect(() => {
    setProductsPage(1);
  }, [debouncedProductSearch]);

  // Reactive data fetching
  useEffect(() => {
    fetchSellersData();
  }, [sellersPage, debouncedSellerSearch, sellerFilter]);

  useEffect(() => {
    fetchProductsData();
  }, [productsPage, debouncedProductSearch]);

  useEffect(() => {
    fetchAdminData();
    fetchAllSellers();
  }, []);

  // Live-refresh the marketing analytics chart + full seller list every 20s
  // while the Metrics or Contact List tab is open, so both stay current every
  // time you check the admin panel.
  useEffect(() => {
    fetchAnalytics();
    if (activeTab === "metrics" || activeTab === "contacts") fetchAllSellers();
    if (activeTab !== "metrics" && activeTab !== "contacts") return;
    const interval = setInterval(() => {
      fetchAnalytics();
      fetchAllSellers();
    }, 20000);
    return () => clearInterval(interval);
  }, [activeTab, analyticsDays]);

  // Set initial YAML config
  useEffect(() => {
    if (stats) {
      const yaml = `apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: tamu-bah-microservices-container
  namespace: tamu-bah-prod
  labels:
    cloud.googleapis.com/location: asia-east1
    app: tamu-bah-marketplace
    environment: production
    developer: duha050211@gmail.com
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "100"
        run.googleapis.com/client-name: "ai-studio"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      serviceAccountName: tamu-bah-compute-sa@tamu-bah-prod.iam.gserviceaccount.com
      containers:
      - image: gcr.io/tamu-bah-prod/main-applet-v2:latest
        ports:
        - name: http1
          containerPort: 3000
        resources:
          limits:
            cpu: "2"
            memory: 4Gi
        env:
        - name: NODE_ENV
          value: production
        - name: REGISTRATION_VERIFICATION_TYPE
          value: LOCAL_TRADING_LICENSE_AND_SSM
        - name: ACTIVE_SELLERS_COUNT
          value: "${sellers.length}"
        - name: TOTAL_PRODUCTS_LISTED
          value: "${products.length}"
        - name: ACCUMULATED_VISITOR_TRAFFIC
          value: "${stats.visitorCount}"`;
      setYamlEditorContent(yaml);
    }
  }, [stats, sellers, products]);

  const handleToggleApproval = async (sellerId: string, currentStatus: boolean) => {
    try {
      setActionLoading(`approve-${sellerId}`);
      const res = await fetch(`/api/admin/sellers/${sellerId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: !currentStatus })
      });
      if (res.ok) {
        // Refresh local state
        await fetchAdminData();
        onRefreshMarket();
      }
    } catch (error) {
      console.error("Error toggling approval status", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateVerificationTier = async (sellerId: string, tier: "None" | "Bronze" | "Silver" | "Gold") => {
    try {
      setActionLoading(`tier-${sellerId}`);
      const res = await fetch(`/api/admin/sellers/${sellerId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationTier: tier })
      });
      if (res.ok) {
        // Refresh local state
        await fetchAdminData();
        onRefreshMarket();
      }
    } catch (error) {
      console.error("Error updating verification tier", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateSellerPlan = async (sellerId: string, planStatus: "founding" | "trial" | "paid" | "expired") => {
    try {
      setActionLoading(`plan-${sellerId}`);
      const res = await fetch(`/api/admin/sellers/${sellerId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planStatus })
      });
      if (res.ok) {
        await fetchAdminData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        window.alert(errorData.error || "Failed to update plan status.");
      }
    } catch (error) {
      console.error("Error updating seller plan", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleOfficial = async (sellerId: string, currentValue: boolean) => {
    try {
      setActionLoading(`official-${sellerId}`);
      const res = await fetch(`/api/admin/sellers/${sellerId}/official`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOfficial: !currentValue })
      });
      if (res.ok) {
        await fetchAdminData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        window.alert(errorData.error || "Failed to update official status.");
      }
    } catch (error) {
      console.error("Error updating official status", error);
    } finally {
      setActionLoading(null);
    }
  };

  // --- Admin: reset a seller's password (forgot-password support) ---
  const [resetPasswordSeller, setResetPasswordSeller] = useState<{ id: string; businessName: string; ownerName: string } | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [resetPasswordSuccessMsg, setResetPasswordSuccessMsg] = useState("");

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    setResetPasswordValue(pass);
    setResetPasswordConfirm(pass);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordSeller) return;
    setResetPasswordError("");

    if (!resetPasswordValue || resetPasswordValue.length < 6) {
      setResetPasswordError("New password must be at least 6 characters long.");
      return;
    }
    if (resetPasswordValue !== resetPasswordConfirm) {
      setResetPasswordError("Password and confirmation don't match.");
      return;
    }

    try {
      setActionLoading(`reset-password-${resetPasswordSeller.id}`);
      const res = await fetch(`/api/admin/sellers/${resetPasswordSeller.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetPasswordValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResetPasswordError(data.error || "Failed to reset password.");
        return;
      }
      setResetPasswordSuccessMsg(`Password reset for ${resetPasswordSeller.businessName}. Share the new password with them securely — it won't be shown again.`);
      setResetPasswordValue("");
      setResetPasswordConfirm("");
    } catch (error) {
      console.error("Error resetting password", error);
      setResetPasswordError("Couldn't reach the server. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSeller = async (sellerId: string, businessName: string) => {
    const confirmed = window.confirm(`Delete merchant "${businessName}" and all associated listings? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      setActionLoading(`delete-${sellerId}`);
      const res = await fetch(`/api/admin/sellers/${sellerId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        await fetchAdminData();
        onRefreshMarket();
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("Error deleting seller", errorData);
        window.alert(errorData.error || "Failed to delete merchant.");
      }
    } catch (error) {
      console.error("Error deleting seller", error);
      window.alert("Failed to delete merchant.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePin = async (productId: string, currentStatus: boolean) => {
    try {
      setActionLoading(`pin-${productId}`);
      const res = await fetch(`/api/admin/products/${productId}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !currentStatus })
      });
      if (res.ok) {
        // Refresh local state
        await fetchAdminData();
        onRefreshMarket();
      }
    } catch (error) {
      console.error("Error toggling product pin status", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteProduct = async (productId: string, title: string) => {
    const confirmed = window.confirm(`Delete listing "${title}"? This action cannot be undone.`);
    if (!confirmed) return;
    try {
      setActionLoading(`delete-product-${productId}`);
      const res = await fetch(`/api/admin/products/${productId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchAdminData();
        onRefreshMarket();
      } else {
        const errorData = await res.json().catch(() => ({}));
        window.alert(errorData.error || "Failed to delete listing.");
      }
    } catch (error) {
      console.error("Error deleting product", error);
      window.alert("Failed to delete listing.");
    } finally {
      setActionLoading(null);
    }
  };

  // --- Drag-to-reorder for the Revisions & Products table ---
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);
  const [isSavingProductOrder, setIsSavingProductOrder] = useState(false);

  const persistProductOrder = async (orderedIds: string[]) => {
    try {
      setIsSavingProductOrder(true);
      const res = await fetch("/api/admin/products/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: orderedIds })
      });
      if (res.ok) {
        onRefreshMarket();
      } else {
        const errorData = await res.json().catch(() => ({}));
        window.alert(errorData.error || "Failed to save the new order.");
        await fetchAdminData();
      }
    } catch (error) {
      console.error("Error saving product order", error);
      window.alert("Failed to save the new order.");
      await fetchAdminData();
    } finally {
      setIsSavingProductOrder(false);
    }
  };

  const handleProductDrop = (targetProductId: string) => {
    const sourceId = draggedProductId;
    setDraggedProductId(null);
    setDragOverProductId(null);
    if (!sourceId || sourceId === targetProductId) return;

    // Reorder within whatever's currently visible (respects search/pin filter);
    // items outside the current filter keep their existing slot untouched.
    const visibleIds = filteredProducts.map((p) => p.id);
    const fromIndex = visibleIds.indexOf(sourceId);
    const toIndex = visibleIds.indexOf(targetProductId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reorderedVisibleIds = [...visibleIds];
    reorderedVisibleIds.splice(fromIndex, 1);
    reorderedVisibleIds.splice(toIndex, 0, sourceId);

    const visibleSet = new Set(reorderedVisibleIds);
    const byId = new Map(products.map((p) => [p.id, p]));
    let cursor = 0;
    const nextProducts = products.map((p) =>
      visibleSet.has(p.id) ? byId.get(reorderedVisibleIds[cursor++])! : p
    );

    setProducts(nextProducts);
    persistProductOrder(reorderedVisibleIds);
  };

  const handleReportStatus = async (reportId: string, status: "resolved" | "dismissed") => {
    try {
      setActionLoading(`report-${reportId}`);
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        await fetchAdminData();
      }
    } catch (error) {
      console.error("Error updating report", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    const confirmed = window.confirm("Remove this report from the queue?");
    if (!confirmed) return;
    try {
      setActionLoading(`report-${reportId}`);
      const res = await fetch(`/api/admin/reports/${reportId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchAdminData();
      }
    } catch (error) {
      console.error("Error deleting report", error);
    } finally {
      setActionLoading(null);
    }
  };

  // --- Admin account management ---
  const [admins, setAdmins] = useState<{ id: string; username: string; createdAt: string }[]>([]);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPasscode, setNewAdminPasscode] = useState("");
  const [adminFormError, setAdminFormError] = useState("");
  const [newPasscodeForSelf, setNewPasscodeForSelf] = useState("");
  const [passcodeChangeMessage, setPasscodeChangeMessage] = useState("");

  const fetchAdmins = async () => {
    try {
      const res = await fetch("/api/admin/admins");
      if (res.ok) setAdmins(await res.json());
    } catch (error) {
      console.error("Failed to load admin accounts", error);
    }
  };

  useEffect(() => {
    if (activeTab === "admins") fetchAdmins();
  }, [activeTab]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFormError("");
    try {
      setActionLoading("add-admin");
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newAdminUsername, passcode: newAdminPasscode })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewAdminUsername("");
        setNewAdminPasscode("");
        await fetchAdmins();
      } else {
        setAdminFormError(data.error || "Failed to create admin account.");
      }
    } catch (error) {
      setAdminFormError("Failed to create admin account.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAdmin = async (adminId: string, username: string) => {
    const confirmed = window.confirm(`Remove admin account "${username}"?`);
    if (!confirmed) return;
    try {
      setActionLoading(`del-admin-${adminId}`);
      const res = await fetch(`/api/admin/admins/${adminId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetchAdmins();
      } else {
        window.alert(data.error || "Failed to remove admin account.");
      }
    } catch (error) {
      window.alert("Failed to remove admin account.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeOwnPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeChangeMessage("");
    try {
      setActionLoading("change-passcode");
      const res = await fetch("/api/admin/change-passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPasscode: newPasscodeForSelf })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewPasscodeForSelf("");
        setPasscodeChangeMessage("Passcode updated successfully.");
      } else {
        setPasscodeChangeMessage(data.error || "Failed to change passcode.");
      }
    } catch (error) {
      setPasscodeChangeMessage("Failed to change passcode.");
    } finally {
      setActionLoading(null);
    }
  };

  // Sellers are already filtered and paginated on the server side
  const filteredSellers = sellers;

  // Products search is handled on the server side; apply pin filter locally if specified
  const filteredProducts = products.filter(product => {
    const isProductPinned = (product as any).isPinned;
    if (productFilter === "pinned") return isProductPinned;
    if (productFilter === "regular") return !isProductPinned;
    return true;
  });

  return (
    <div className="bg-[#202124] min-h-screen text-[#e8eaed] font-sans antialiased selection:bg-[#8ab4f8]/30 selection:text-[#e8eaed]">

      {/* 2. BREADCRUMBS & BARS (DARK THEME) */}
      <section className="bg-[#202124] border-b border-[#3c4043] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* Breadcrumb path */}
          <div className="flex items-center gap-1.5 text-xs text-[#9aa0a6] font-medium mb-1.5">
            <span className="hover:text-[#8ab4f8] cursor-pointer transition-colors">Cloud Run</span>
            <span>&gt;</span>
            <span className="hover:text-[#8ab4f8] cursor-pointer transition-colors">Services</span>
            <span>&gt;</span>
            <span className="text-slate-300 font-bold">tamu-bah-microservices-container</span>
          </div>

          {/* Service Title */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-[#8ab4f8] rounded-md flex items-center justify-center text-[#202124] shrink-0 shadow-sm font-bold">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#f1f3f4] tracking-tight flex flex-wrap items-center gap-2.5">
                tamu-bah-microservices-container
                <span className="bg-[#137333]/20 text-[#81c995] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#137333]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#81c995]"></span>
                  Active / Serving
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* GCP Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#5f6368] bg-[#202124] text-[#8ab4f8] hover:bg-[#8ab4f8]/10 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Reload Status</span>
          </button>

          <button 
            onClick={() => {
              const element = document.getElementById("gcp-quick-info");
              if (element) {
                element.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#5f6368] bg-[#202124] text-[#9aa0a6] hover:bg-[#303134] hover:text-[#f1f3f4] font-semibold text-xs transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Service Info</span>
          </button>

          {onLockAdmin && (
            <button
              onClick={onLockAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa] font-bold text-xs transition-colors cursor-pointer shadow-sm"
              title="Lock administrative console"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Admin Session</span>
            </button>
          )}
        </div>
      </section>

      {/* 3. METADATA DETAIL ROW (DARK THEME) */}
      <section id="gcp-quick-info" className="bg-[#2a2b2f] border-b border-[#3c4043] px-6 py-3.5 text-xs font-normal">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-y-3.5 gap-x-4">
          <div className="border-r border-[#3c4043] pr-3 last:border-none">
            <span className="text-[#9aa0a6] block text-[10px] uppercase font-bold tracking-wider mb-0.5">URL</span>
            <a 
              href="https://tamu-bah-service-asia-east1.a.run.app" 
              target="_blank" 
              rel="noreferrer" 
              className="text-[#8ab4f8] hover:underline font-semibold break-all flex items-center gap-1"
            >
              <span>ais-pre-jclsh...</span>
              <ExternalLink className="w-3 h-3 inline shrink-0 text-[#8ab4f8]" />
            </a>
          </div>
          
          <div className="border-r border-[#3c4043] pr-3 last:border-none">
            <span className="text-[#9aa0a6] block text-[10px] uppercase font-bold tracking-wider mb-0.5">Region</span>
            <span className="font-semibold text-[#e8eaed]">asia-east1 (Taiwan)</span>
          </div>

          <div className="border-r border-[#3c4043] pr-3 last:border-none">
            <span className="text-[#9aa0a6] block text-[10px] uppercase font-bold tracking-wider mb-0.5">Authentication</span>
            <span className="font-semibold text-[#81c995] bg-[#137333]/15 border border-[#137333]/30 px-1.5 py-0.2 rounded">Allow unauthenticated</span>
          </div>

          <div className="border-r border-[#3c4043] pr-3 last:border-none">
            <span className="text-[#9aa0a6] block text-[10px] uppercase font-bold tracking-wider mb-0.5">Memory Allocation</span>
            <span className="font-semibold text-slate-300 font-mono">4 GiB Limit</span>
          </div>

          <div className="border-r border-[#3c4043] pr-3 last:border-none">
            <span className="text-[#9aa0a6] block text-[10px] uppercase font-bold tracking-wider mb-0.5">CPU Limit</span>
            <span className="font-semibold text-slate-300 font-mono">2 vCPU</span>
          </div>

          <div className="border-r border-[#3c4043] pr-3 last:border-none col-span-2">
            <span className="text-[#9aa0a6] block text-[10px] uppercase font-bold tracking-wider mb-0.5">Active Revision Image</span>
            <span className="font-mono font-medium text-slate-300 truncate block bg-[#202124] px-1.5 py-0.5 rounded border border-[#3c4043]" title="gcr.io/tamu-bah-prod/main-applet-v2:latest">
              gcr.io/tamu-bah-prod/main-applet-v2@sha256:0d15b1...
            </span>
          </div>
        </div>
      </section>

      {/* 4. GOOGLE CLOUD TAB CONTAINER (DARK THEME) */}
      <div className="bg-[#202124] border-b border-[#3c4043] px-6 flex items-center overflow-x-auto select-none gap-4">
        <button
          onClick={() => setActiveTab("metrics")}
          className={`py-3.5 px-3 font-semibold text-[13px] tracking-wide transition-all whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === "metrics"
              ? "border-[#8ab4f8] text-[#8ab4f8] font-bold"
              : "border-transparent text-[#9aa0a6] hover:text-[#f1f3f4]"
          }`}
        >
          METRICS
        </button>

        <button
          onClick={() => setActiveTab("merchants")}
          className={`py-3.5 px-3 font-semibold text-[13px] tracking-wide transition-all whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === "merchants"
              ? "border-[#8ab4f8] text-[#8ab4f8] font-bold"
              : "border-transparent text-[#9aa0a6] hover:text-[#f1f3f4]"
          }`}
        >
          <span>MERCHANTS & PERMITS</span>
          <span className="bg-[#2d3033] text-[#9aa0a6] text-[10px] px-2 py-0.5 rounded-full font-bold">
            {sellers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("revisions")}
          className={`py-3.5 px-3 font-semibold text-[13px] tracking-wide transition-all whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === "revisions"
              ? "border-[#8ab4f8] text-[#8ab4f8] font-bold"
              : "border-transparent text-[#9aa0a6] hover:text-[#f1f3f4]"
          }`}
        >
          <span>REVISIONS & PRODUCTS</span>
          <span className="bg-[#2d3033] text-[#9aa0a6] text-[10px] px-2 py-0.5 rounded-full font-bold">
            {products.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("publish")}
          className={`py-3.5 px-3 font-semibold text-[13px] tracking-wide transition-all whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === "publish"
              ? "border-[#8ab4f8] text-[#8ab4f8] font-bold"
              : "border-transparent text-[#9aa0a6] hover:text-[#f1f3f4]"
          }`}
        >
          <span>PUBLISH REQUESTS</span>
          {pendingPublishCount > 0 && (
            <span className="bg-amber-500/10 text-[#fdd663] text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-[#ffe088]/20">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              {pendingPublishCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`py-3.5 px-3 font-semibold text-[13px] tracking-wide transition-all whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === "logs"
              ? "border-[#8ab4f8] text-[#8ab4f8] font-bold"
              : "border-transparent text-[#9aa0a6] hover:text-[#f1f3f4]"
          }`}
        >
          <span>LOGS EXPLORER</span>
          {stats && stats.totalReports > 0 && (
            <span className="bg-amber-500/10 text-[#fdd663] text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-[#ffe088]/20">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              {stats.totalReports} reports
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("admins")}
          className={`py-3.5 px-3 font-semibold text-[13px] tracking-wide transition-all whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === "admins"
              ? "border-[#8ab4f8] text-[#8ab4f8] font-bold"
              : "border-transparent text-[#9aa0a6] hover:text-[#f1f3f4]"
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>ADMINS</span>
        </button>

        <button
          onClick={() => setActiveTab("yaml")}
          className={`py-3.5 px-3 font-semibold text-[13px] tracking-wide transition-all whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === "yaml"
              ? "border-[#8ab4f8] text-[#8ab4f8] font-bold"
              : "border-transparent text-[#9aa0a6] hover:text-[#f1f3f4]"
          }`}
        >
          <span>YAML CONFIG</span>
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`py-3.5 px-3 font-semibold text-[13px] tracking-wide transition-all whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === "categories"
              ? "border-[#8ab4f8] text-[#8ab4f8] font-bold"
              : "border-transparent text-[#9aa0a6] hover:text-[#f1f3f4]"
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>CATEGORIES & ANNOUNCEMENTS</span>
        </button>

        <button
          onClick={() => setActiveTab("contacts")}
          className={`py-3.5 px-3 font-semibold text-[13px] tracking-wide transition-all whitespace-nowrap cursor-pointer border-b-2 flex items-center gap-1.5 ${
            activeTab === "contacts"
              ? "border-[#8ab4f8] text-[#8ab4f8] font-bold"
              : "border-transparent text-[#9aa0a6] hover:text-[#f1f3f4]"
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>CONTACT LIST</span>
        </button>
      </div>

      {/* 5. LIVE TAB CONTAINER OR SPINNER */}
      <main className="p-6 max-w-7xl mx-auto">
        {loading && !stats ? (
          <div className="flex flex-col items-center justify-center py-24 bg-[#202124] border border-[#3c4043] rounded-lg shadow-md">
            <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-[#8ab4f8] animate-spin mb-4"></div>
            <span className="text-xs font-semibold text-slate-400 font-mono">Querying Stackdriver Monitoring / Metadata...</span>
          </div>
        ) : (
          <>
            {/* TAB 1: METRICS / STATS COMPARISON */}
            {activeTab === "metrics" && (
              <div className="space-y-6 animate-in fade-in duration-200">

                {/* Seller Plan / Revenue Tracker */}
                {stats?.planSummary && (
                  <div className="bg-[#202124] border border-[#3c4043] rounded-md shadow-md p-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <h3 className="text-[#e8eaed] font-bold text-sm flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-[#81c995]" />
                          Seller Plans &amp; Revenue
                        </h3>
                        <p className="text-[10px] text-[#9aa0a6] mt-0.5">
                          First {stats.planSummary.foundingLimit} sellers get their first year free. After that: {stats.planSummary.trial > 0 || stats.planSummary.paid > 0 ? "1-month trial, then " : ""}RM{stats.planSummary.monthlyFeeRM}/month.
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-[#9aa0a6] uppercase tracking-wider font-bold block">Est. Monthly Revenue</span>
                        <span className="text-2xl font-bold font-mono text-[#81c995]">RM {stats.planSummary.estimatedMonthlyRevenueRM}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      <div className="bg-[#2a2b2f] border border-[#3c4043] rounded-lg p-3">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#8ab4f8] block mb-1">Founding (Free)</span>
                        <span className="text-xl font-bold font-mono text-[#e8eaed]">{stats.planSummary.founding}</span>
                        <span className="text-[9px] text-[#9aa0a6] block mt-0.5">{stats.planSummary.foundingSlotsLeft} slots left of {stats.planSummary.foundingLimit}</span>
                      </div>
                      <div className="bg-[#2a2b2f] border border-[#3c4043] rounded-lg p-3">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#fdd663] block mb-1">On Trial</span>
                        <span className="text-xl font-bold font-mono text-[#e8eaed]">{stats.planSummary.trial}</span>
                        <span className="text-[9px] text-[#9aa0a6] block mt-0.5">
                          {stats.planSummary.trialsEndingSoon > 0 ? `${stats.planSummary.trialsEndingSoon} ending within 7 days` : "none ending soon"}
                        </span>
                      </div>
                      <div className="bg-[#2a2b2f] border border-[#3c4043] rounded-lg p-3">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#81c995] block mb-1">Paying</span>
                        <span className="text-xl font-bold font-mono text-[#e8eaed]">{stats.planSummary.paid}</span>
                        <span className="text-[9px] text-[#9aa0a6] block mt-0.5">RM{stats.planSummary.monthlyFeeRM}/mo each</span>
                      </div>
                      <div className="bg-[#2a2b2f] border border-[#3c4043] rounded-lg p-3">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#f28b82] block mb-1">Expired</span>
                        <span className="text-xl font-bold font-mono text-[#e8eaed]">{stats.planSummary.expired}</span>
                        <span className="text-[9px] text-[#9aa0a6] block mt-0.5">needs renewal</span>
                      </div>
                      <div className="bg-[#2a2b2f] border border-[#3c4043] rounded-lg p-3">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#9aa0a6] block mb-1">Pending Approval</span>
                        <span className="text-xl font-bold font-mono text-[#e8eaed]">{stats.planSummary.pending}</span>
                        <span className="text-[9px] text-[#9aa0a6] block mt-0.5">not yet assigned a plan</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Real Platform Stats — every number here comes straight from the database */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="bg-[#202124] border border-[#3c4043] p-4 rounded-md shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#9aa0a6] text-[10px] font-bold uppercase tracking-wider">Total Sellers</span>
                      <Users className="w-4 h-4 text-[#8ab4f8]" />
                    </div>
                    <span className="text-3xl font-bold font-mono text-[#f1f3f4]">{stats?.totalSellers ?? 0}</span>
                  </div>

                  <div className="bg-[#202124] border border-[#3c4043] p-4 rounded-md shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#9aa0a6] text-[10px] font-bold uppercase tracking-wider">Total Products</span>
                      <FileText className="w-4 h-4 text-[#8ab4f8]" />
                    </div>
                    <span className="text-3xl font-bold font-mono text-[#f1f3f4]">{stats?.totalProducts ?? 0}</span>
                  </div>

                  <div className="bg-[#202124] border border-[#3c4043] p-4 rounded-md shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#9aa0a6] text-[10px] font-bold uppercase tracking-wider">Visitor Requests</span>
                      <TrendingUp className="w-4 h-4 text-[#81c995]" />
                    </div>
                    <span className="text-3xl font-bold font-mono text-[#f1f3f4]">{stats?.visitorCount ?? 0}</span>
                  </div>

                  <div className="bg-[#202124] border border-[#3c4043] p-4 rounded-md shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#9aa0a6] text-[10px] font-bold uppercase tracking-wider">WhatsApp Clicks</span>
                      <ExternalLink className="w-4 h-4 text-[#fdd663]" />
                    </div>
                    <span className="text-3xl font-bold font-mono text-[#f1f3f4]">{(stats as any)?.contactSellerCount ?? 0}</span>
                  </div>

                  <div className="bg-[#202124] border border-[#3c4043] p-4 rounded-md shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#9aa0a6] text-[10px] font-bold uppercase tracking-wider">Reports Filed</span>
                      <AlertTriangle className="w-4 h-4 text-[#f28b82]" />
                    </div>
                    <span className="text-3xl font-bold font-mono text-[#f1f3f4]">{stats?.totalReports ?? 0}</span>
                  </div>
                </div>

                {/* Live Marketing Analytics — visits & WhatsApp clicks by date + district */}
                <div className="bg-[#202124] border border-[#3c4043] rounded-md overflow-hidden shadow-md">
                  <div className="bg-[#2a2b2f] px-4 py-3 border-b border-[#3c4043] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#8ab4f8]" />
                      <div>
                        <h3 className="text-[#e8eaed] font-bold text-sm">Live Marketing Analytics</h3>
                        <p className="text-[10px] text-[#9aa0a6] mt-0.5">
                          {analyticsError ? "Couldn't load" : analyticsLastUpdated ? `Updated ${timeAgo(analyticsLastUpdated.toISOString())} · auto-refreshes every 20s` : "Loading..."}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {[7, 30, 90].map((d) => (
                        <button
                          key={d}
                          onClick={() => setAnalyticsDays(d)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                            analyticsDays === d
                              ? "bg-[#8ab4f8] border-[#8ab4f8] text-[#1a1a1a]"
                              : "border-[#5f6368] text-[#9aa0a6] hover:text-[#e8eaed]"
                          }`}
                        >
                          {d}D
                        </button>
                      ))}
                      <button
                        onClick={fetchAnalytics}
                        title="Refresh now"
                        className="p-1.5 rounded border border-[#5f6368] text-[#9aa0a6] hover:text-[#e8eaed] hover:border-[#8ab4f8] transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-6">
                    {analyticsError ? (
                      <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-lg text-xs leading-relaxed">
                        {analyticsError}
                      </div>
                    ) : !analytics ? (
                      <div className="py-10 text-center text-slate-400 text-xs italic">Loading analytics…</div>
                    ) : (
                      <>
                        {/* Totals for the selected range */}
                        <div className="flex flex-wrap gap-4">
                          <div className="flex items-center gap-2 bg-[#2a2b2f] border border-[#3c4043] rounded-lg px-3 py-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#8ab4f8] shrink-0" />
                            <span className="text-[#e8eaed] font-bold text-sm font-mono">{analytics.totalVisits}</span>
                            <span className="text-[10px] text-[#9aa0a6]">visits ({analyticsDays}d)</span>
                          </div>
                          <div className="flex items-center gap-2 bg-[#2a2b2f] border border-[#3c4043] rounded-lg px-3 py-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#81c995] shrink-0" />
                            <span className="text-[#e8eaed] font-bold text-sm font-mono">{analytics.totalContactClicks}</span>
                            <span className="text-[10px] text-[#9aa0a6]">WhatsApp clicks ({analyticsDays}d)</span>
                          </div>
                        </div>

                        {/* Trend line: visits vs contact clicks over time */}
                        {analytics.daily.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No activity recorded yet for this range.</p>
                        ) : (() => {
                          const CHART_W = 600;
                          const CHART_H = 180;
                          const chartMax = Math.max(1, ...analytics.daily.map((d) => d.visits), ...analytics.daily.map((d) => d.contactClicks));
                          const yTicks = buildYAxisTicks(chartMax);
                          const visitsGeo = buildChartGeometry(analytics.daily.map((d) => d.visits), chartMax, CHART_W, CHART_H);
                          const clicksGeo = buildChartGeometry(analytics.daily.map((d) => d.contactClicks), chartMax, CHART_W, CHART_H);
                          const hovered = chartHoverIndex !== null ? analytics.daily[chartHoverIndex] : null;
                          const hoverX = chartHoverIndex !== null && visitsGeo.points[chartHoverIndex] ? visitsGeo.points[chartHoverIndex].x : null;

                          const handleChartMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relX = (e.clientX - rect.left) / rect.width;
                            const viewBoxX = relX * CHART_W;
                            const plotW = CHART_W - 20;
                            const idx = Math.round(((viewBoxX - 10) / plotW) * (analytics.daily.length - 1));
                            setChartHoverIndex(Math.max(0, Math.min(analytics.daily.length - 1, idx)));
                          };

                          return (
                            <div>
                              <div className="flex items-center gap-4 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6]">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#8ab4f8]" />Visits</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#81c995]" />WhatsApp Clicks</span>
                              </div>
                              <div className="flex gap-2">
                                {/* Y-axis value labels */}
                                <div className="flex flex-col justify-between text-right text-[9px] text-[#9aa0a6] font-mono h-44 py-[10px] w-6 shrink-0">
                                  {[...yTicks].reverse().map((tick) => (
                                    <span key={tick}>{tick}</span>
                                  ))}
                                </div>
                                <div className="relative flex-grow">
                                  <svg
                                    viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                                    className="w-full h-44 cursor-crosshair"
                                    preserveAspectRatio="none"
                                    onMouseMove={handleChartMouseMove}
                                    onMouseLeave={() => setChartHoverIndex(null)}
                                  >
                                    <defs>
                                      <linearGradient id="visitsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8ab4f8" stopOpacity={0.28} />
                                        <stop offset="100%" stopColor="#8ab4f8" stopOpacity={0} />
                                      </linearGradient>
                                      <linearGradient id="clicksAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#81c995" stopOpacity={0.28} />
                                        <stop offset="100%" stopColor="#81c995" stopOpacity={0} />
                                      </linearGradient>
                                    </defs>

                                    {/* horizontal gridlines, one per Y-axis tick */}
                                    {yTicks.map((tick) => {
                                      const y = CHART_H - 10 - (chartMax > 0 ? (tick / chartMax) * (CHART_H - 20) : 0);
                                      return <line key={tick} x1={10} x2={CHART_W - 10} y1={y} y2={y} stroke="#3c4043" strokeWidth={1} />;
                                    })}

                                    {/* gradient-filled areas beneath each line */}
                                    <path d={visitsGeo.areaPath} fill="url(#visitsAreaGradient)" stroke="none" />
                                    <path d={clicksGeo.areaPath} fill="url(#clicksAreaGradient)" stroke="none" />

                                    {/* the lines themselves */}
                                    <path d={visitsGeo.linePath} fill="none" stroke="#8ab4f8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                                    <path d={clicksGeo.linePath} fill="none" stroke="#81c995" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

                                    {/* hover crosshair + point markers */}
                                    {hoverX !== null && (
                                      <>
                                        <line x1={hoverX} x2={hoverX} y1={10} y2={CHART_H - 10} stroke="#9aa0a6" strokeWidth={1} strokeDasharray="3 3" />
                                        <circle cx={visitsGeo.points[chartHoverIndex!].x} cy={visitsGeo.points[chartHoverIndex!].y} r={3.5} fill="#8ab4f8" stroke="#202124" strokeWidth={1.5} />
                                        <circle cx={clicksGeo.points[chartHoverIndex!].x} cy={clicksGeo.points[chartHoverIndex!].y} r={3.5} fill="#81c995" stroke="#202124" strokeWidth={1.5} />
                                      </>
                                    )}
                                  </svg>

                                  {/* Hover tooltip — exact date + values, Cloud Monitoring style */}
                                  {hovered && hoverX !== null && (
                                    <div
                                      className="absolute top-1 z-10 bg-[#2a2b2f] border border-[#5f6368] rounded-md shadow-lg px-2.5 py-2 text-[10px] pointer-events-none whitespace-nowrap"
                                      style={{
                                        left: `${(hoverX / CHART_W) * 100}%`,
                                        transform: hoverX > CHART_W * 0.7 ? "translateX(-100%)" : hoverX < CHART_W * 0.15 ? "translateX(0)" : "translateX(-50%)"
                                      }}
                                    >
                                      <div className="text-[#e8eaed] font-bold mb-1">{formatShortDate(hovered.date)}</div>
                                      <div className="flex items-center gap-1.5 text-[#9aa0a6]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#8ab4f8]" />
                                        Visits <span className="text-[#e8eaed] font-mono font-bold ml-auto">{hovered.visits}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[#9aa0a6]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#81c995]" />
                                        WhatsApp <span className="text-[#e8eaed] font-mono font-bold ml-auto">{hovered.contactClicks}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex justify-between text-[9px] text-[#9aa0a6] font-mono mt-1 pl-8">
                                <span>{formatShortDate(analytics.daily[0].date)}</span>
                                {analytics.daily.length > 2 && (
                                  <span>{formatShortDate(analytics.daily[Math.floor(analytics.daily.length / 2)].date)}</span>
                                )}
                                <span>{formatShortDate(analytics.daily[analytics.daily.length - 1].date)}</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* By district — where the engagement is coming from */}
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6] mb-2 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3" />
                            Engagement by District
                          </h4>
                          {analytics.byLocation.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No location data yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {analytics.byLocation.slice(0, 8).map((row) => {
                                const maxTotal = Math.max(1, ...analytics.byLocation.map((r) => r.visits + r.contactClicks));
                                const total = row.visits + row.contactClicks;
                                return (
                                  <div key={row.location} className="flex items-center gap-3">
                                    <span className="w-28 shrink-0 text-[10px] text-[#bdc1c6] truncate">{row.location}</span>
                                    <div className="flex-1 h-4 bg-[#2a2b2f] rounded overflow-hidden flex">
                                      <div
                                        className="h-full bg-[#8ab4f8]"
                                        style={{ width: `${(row.visits / maxTotal) * 100}%` }}
                                        title={`${row.visits} visits`}
                                      />
                                      <div
                                        className="h-full bg-[#81c995]"
                                        style={{ width: `${(row.contactClicks / maxTotal) * 100}%` }}
                                        title={`${row.contactClicks} clicks`}
                                      />
                                    </div>
                                    <span className="w-8 shrink-0 text-[10px] text-[#9aa0a6] font-mono text-right">{total}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Live activity feed */}
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6] mb-2">Recent Activity</h4>
                          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                            {analytics.recentEvents.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">Nothing recorded yet.</p>
                            ) : (
                              analytics.recentEvents.slice(0, 30).map((ev) => (
                                <div key={ev.id} className="flex items-center gap-2 text-[10px] py-1 border-b border-[#2a2b2f]">
                                  {ev.eventType === "contact_click" ? (
                                    <ExternalLink className="w-3 h-3 text-[#81c995] shrink-0" />
                                  ) : (
                                    <Users className="w-3 h-3 text-[#8ab4f8] shrink-0" />
                                  )}
                                  <span className="text-[#bdc1c6] flex-1 truncate">
                                    {ev.eventType === "contact_click"
                                      ? `WhatsApp click on ${ev.businessName || "a seller"}`
                                      : "Site visit"}
                                    {ev.location ? ` · ${ev.location}` : ""}
                                  </span>
                                  <span className="text-[#9aa0a6] font-mono shrink-0">{timeAgo(ev.createdAt)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* All-Time Seller Growth & Engagement — uses real historical data (join dates,
                    lifetime contact counts), unlike the chart above which only tracks from the
                    day analytics_events was created. Refreshes alongside the panel above. */}
                <div className="bg-[#202124] border border-[#3c4043] rounded-md overflow-hidden shadow-md">
                  <div className="bg-[#2a2b2f] px-4 py-3 border-b border-[#3c4043] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#8ab4f8]" />
                    <div>
                      <h3 className="text-[#e8eaed] font-bold text-sm">Seller Growth & Engagement (All-Time)</h3>
                      <p className="text-[10px] text-[#9aa0a6] mt-0.5">Built from real sign-up dates &amp; lifetime WhatsApp click counts — covers your full history, not just since the chart above started tracking.</p>
                    </div>
                  </div>

                  <div className="p-5 space-y-6">
                    {/* Cumulative growth line */}
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6] mb-2">
                        Total Sellers Over Time ({sellerGrowth.length > 0 ? sellerGrowth[sellerGrowth.length - 1].cumulative : 0} total)
                      </h4>
                      {sellerGrowth.length < 2 ? (
                        <p className="text-xs text-slate-400 italic">Not enough history yet to chart a trend.</p>
                      ) : (
                        <>
                          <svg viewBox="0 0 600 140" className="w-full h-36" preserveAspectRatio="none">
                            {[0, 1, 2, 3].map((i) => (
                              <line key={i} x1={8} x2={592} y1={8 + i * 41.3} y2={8 + i * 41.3} stroke="#3c4043" strokeWidth={1} />
                            ))}
                            <polyline
                              points={buildLinePoints(sellerGrowth.map((d) => d.cumulative), 600, 140)}
                              fill="none"
                              stroke="#fdd663"
                              strokeWidth={2}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="flex justify-between text-[9px] text-[#9aa0a6] font-mono mt-1">
                            <span>{formatShortDate(sellerGrowth[0].date)}</span>
                            <span>{formatShortDate(sellerGrowth[sellerGrowth.length - 1].date)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Top sellers by lifetime WhatsApp clicks */}
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6] mb-2 flex items-center gap-1.5">
                        <ExternalLink className="w-3 h-3" />
                        Top Sellers by WhatsApp Clicks (All-Time)
                      </h4>
                      {topContactedSellers.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No WhatsApp clicks recorded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {topContactedSellers.map((s: any) => {
                            const maxClicks = Math.max(1, ...topContactedSellers.map((x: any) => x.contactCount || 0));
                            return (
                              <div key={s.id} className="flex items-center gap-3">
                                <span className="w-36 shrink-0 text-[10px] text-[#bdc1c6] truncate">{s.businessName}</span>
                                <div className="flex-1 h-4 bg-[#2a2b2f] rounded overflow-hidden">
                                  <div
                                    className="h-full bg-[#81c995]"
                                    style={{ width: `${((s.contactCount || 0) / maxClicks) * 100}%` }}
                                  />
                                </div>
                                <span className="w-8 shrink-0 text-[10px] text-[#9aa0a6] font-mono text-right">{s.contactCount || 0}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main stackdriver metrics table list */}
                <div className="bg-[#202124] border border-[#3c4043] rounded-md overflow-hidden shadow-md">
                  <div className="bg-[#2a2b2f] px-4 py-3 border-b border-[#3c4043] flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-[#f1f3f4] text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4 text-[#8ab4f8]" /> Live Container Endpoint Analytics
                      </h3>
                    </div>
                    <span className="text-[10px] bg-[#202124] border border-[#5f6368] text-[#9aa0a6] px-2.5 py-0.5 rounded font-mono font-bold">
                      Stackdriver Trace
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#3c4043] bg-[#202124] text-[#9aa0a6] font-bold uppercase tracking-wider text-[9px]">
                          <th className="py-3.5 px-4">Endpoint Identifier</th>
                          <th className="py-3.5 px-4">Query Protocol</th>
                          <th className="py-3.5 px-4">Total Request Traffic</th>
                          <th className="py-3.5 px-4">Response Status Code</th>
                          <th className="py-3.5 px-4">Latest Registered Log Payload</th>
                          <th className="py-3.5 px-4 text-right">Debugging Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3c4043] text-[#bdc1c6] font-medium font-mono text-[11px]">
                        
                        {/* Row 1: Visitor Traffic */}
                        <tr className="hover:bg-[#2d3033] transition-colors">
                          <td className="py-4 px-4 text-[#8ab4f8] font-bold">
                            /api/products & client views
                          </td>
                          <td className="py-4 px-4 text-slate-400">GET HTTP/1.1</td>
                          <td className="py-4 px-4 text-[#e8eaed] font-bold">
                            {stats?.visitorCount ?? 0}
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-1 text-[#81c995] bg-[#137333]/20 px-2 py-0.5 rounded border border-[#137333]/30 text-[10px] font-bold font-sans">
                              200 OK
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-400 max-w-xs truncate font-sans font-normal" title="Visitor loaded product grid and system statistics">
                            Visitor loaded product catalog and filtered districts
                          </td>
                          <td className="py-4 px-4 text-right font-sans">
                            <button 
                              onClick={() => setActiveTab("logs")}
                              className="text-[#8ab4f8] hover:text-[#aecbfa] hover:underline text-[11px] font-bold cursor-pointer"
                            >
                              Open Log Terminal
                            </button>
                          </td>
                        </tr>

                        {/* Row 2: Seller Logins */}
                        <tr className="hover:bg-[#2d3033] transition-colors">
                          <td className="py-4 px-4 text-[#8ab4f8] font-bold">
                            /api/sellers/login
                          </td>
                          <td className="py-4 px-4 text-slate-400">POST HTTP/1.1</td>
                          <td className="py-4 px-4 text-[#e8eaed] font-bold">
                            {stats?.loginSuccessCount ?? 0}
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-1 text-[#81c995] bg-[#137333]/20 px-2 py-0.5 rounded border border-[#137333]/30 text-[10px] font-bold font-sans">
                              200 OK
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-400 max-w-xs truncate font-sans font-normal" title={stats?.logs.find(l => l.action === "seller_logged_in")?.details || "No recent logins registered"}>
                            {stats?.logs.find(l => l.action === "seller_logged_in")?.details || "No logins recorded yet"}
                          </td>
                          <td className="py-4 px-4 text-right font-sans">
                            <button 
                              onClick={() => setActiveTab("logs")}
                              className="text-[#8ab4f8] hover:text-[#aecbfa] hover:underline text-[11px] font-bold cursor-pointer"
                            >
                              Open Log Terminal
                            </button>
                          </td>
                        </tr>

                        {/* Row 3: Successful Signs */}
                        <tr className="hover:bg-[#2d3033] transition-colors">
                          <td className="py-4 px-4 text-[#8ab4f8] font-bold">
                            /api/sellers (POST)
                          </td>
                          <td className="py-4 px-4 text-slate-400">POST HTTP/1.1</td>
                          <td className="py-4 px-4 text-[#e8eaed] font-bold">
                            {stats?.registerSuccessCount ?? 0}
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-1 text-[#81c995] bg-[#137333]/20 px-2 py-0.5 rounded border border-[#137333]/30 text-[10px] font-bold font-sans">
                              201 Created
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-400 max-w-xs truncate font-sans font-normal" title={stats?.logs.find(l => l.action === "seller_registered")?.details || "No registrations logged"}>
                            {stats?.logs.find(l => l.action === "seller_registered")?.details || "No registrations recorded yet"}
                          </td>
                          <td className="py-4 px-4 text-right font-sans">
                            <button 
                              onClick={() => setActiveTab("logs")}
                              className="text-[#8ab4f8] hover:text-[#aecbfa] hover:underline text-[11px] font-bold cursor-pointer"
                            >
                              Open Log Terminal
                            </button>
                          </td>
                        </tr>

                        {/* Row 4: Platform Reports */}
                        <tr className="hover:bg-[#2d3033] transition-colors">
                          <td className="py-4 px-4 text-rose-400 font-bold">
                            /api/reports
                          </td>
                          <td className="py-4 px-4 text-slate-400">GET HTTP/1.1</td>
                          <td className="py-4 px-4 font-bold text-[#fdd663]">
                            {stats?.totalReports ?? 0}
                          </td>
                          <td className="py-4 px-4">
                            {stats?.totalReports && stats.totalReports > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[#fdd663] bg-amber-500/10 px-2 py-0.5 rounded border border-[#ffe088]/20 text-[10px] font-bold font-sans">
                                409 Flagged
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[#81c995] bg-[#137333]/20 px-2 py-0.5 rounded border border-[#137333]/30 text-[10px] font-bold font-sans">
                                200 OK
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-slate-400 max-w-xs truncate font-sans font-normal" title={stats?.reports && stats.reports.length > 0 ? `Report: ${stats.reports[0].reason} (${stats.reports[0].reporterEmail})` : "No complaints recorded"}>
                            {stats?.reports && stats.reports.length > 0 
                              ? `Report received: "${stats.reports[0].reason}" on ${stats.reports[0].sellerName}` 
                              : "No customer reports submitted"
                            }
                          </td>
                          <td className="py-4 px-4 text-right font-sans">
                            <button 
                              onClick={() => setActiveTab("logs")}
                              className="text-[#8ab4f8] hover:text-[#aecbfa] hover:underline text-[11px] font-bold cursor-pointer"
                            >
                              Open Log Terminal
                            </button>
                          </td>
                        </tr>

                        {/* Row 5: WhatsApp contact clicks */}
                        <tr className="hover:bg-[#2d3033] transition-colors">
                          <td className="py-4 px-4 text-[#8ab4f8] font-bold">
                            /api/sellers/:id/contact-click
                          </td>
                          <td className="py-4 px-4 text-slate-400">POST HTTP/1.1</td>
                          <td className="py-4 px-4 text-[#e8eaed] font-bold">
                            {(stats as any)?.contactSellerCount ?? 0}
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-1 text-[#81c995] bg-[#137333]/20 px-2 py-0.5 rounded border border-[#137333]/30 text-[10px] font-bold font-sans">
                              200 OK
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-400 max-w-xs truncate font-sans font-normal" title={stats?.logs.find(l => l.action === "seller_contact_click")?.details || "No recent contacts logged"}>
                            {stats?.logs.find(l => l.action === "seller_contact_click")?.details || "No WhatsApp clicks recorded yet"}
                          </td>
                          <td className="py-4 px-4 text-right font-sans">
                            <button 
                              onClick={() => setActiveTab("logs")}
                              className="text-[#8ab4f8] hover:text-[#aecbfa] hover:underline text-[11px] font-bold cursor-pointer"
                            >
                              Open Log Terminal
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Info summary helper block */}
                <div className="bg-[#185abc]/10 border border-[#185abc]/30 p-4 rounded-md flex items-start gap-3 text-[#aecbfa]">
                  <Info className="w-5 h-5 text-[#8ab4f8] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-[#aecbfa] text-xs">Stackdriver Telemetry Metrics Integration Note</h4>
                    <p className="text-xs text-[#bdc1c6] mt-1 leading-relaxed">
                      This service runs fully on-demand in the <strong className="font-mono text-slate-300">asia-east1</strong> zone with dynamic server-side autoscaling. Whenever a Sabahan micro-shop registers, a sandbox container is verified, and the live customer requests are automatically routed here.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: MERCHANTS & PERMITS (SELLER LIST) */}
            {activeTab === "merchants" && (
              <div className="bg-[#202124] border border-[#3c4043] rounded-md shadow-md animate-in fade-in duration-200">
                
                {/* Search & filters GCP layout header */}
                <div className="bg-[#2a2b2f] px-4 py-3 border-b border-[#3c4043] flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="relative flex-grow max-w-md">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter sellers by business name, owner name, location..."
                      value={sellerSearch}
                      onChange={(e) => setSellerSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 rounded border border-[#5f6368] bg-[#202124] text-xs text-white focus:outline-none focus:border-[#8ab4f8]"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <select
                      value={sellerFilter}
                      onChange={(e: any) => setSellerFilter(e.target.value)}
                      className="border border-[#5f6368] text-xs rounded bg-[#202124] p-1.5 focus:outline-none focus:border-[#8ab4f8] font-medium text-[#e8eaed]"
                    >
                      <option value="all">All Registered Merchants</option>
                      <option value="verified">Verified Only (Approved Permits)</option>
                      <option value="unverified">Unverified Only (Pending Audit)</option>
                    </select>
                    <button
                      onClick={() => setShowBroadcastModal(true)}
                      className="flex items-center gap-1.5 border border-[#5f6368] hover:border-[#8ab4f8] text-xs font-bold rounded px-3 py-1.5 text-[#e8eaed] transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Broadcast Email
                    </button>
                  </div>
                </div>

                {/* Table list */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#3c4043] bg-[#202124] text-[#9aa0a6] font-bold uppercase tracking-wider text-[9px]">
                        <th className="py-3 px-4">Business Profile & ID</th>
                        <th className="py-3 px-4">Primary Category</th>
                        <th className="py-3 px-4">Trading License / SSM Reg No.</th>
                        <th className="py-3 px-4">Origin / Location</th>
                        <th className="py-3 px-4">Badge Tier</th>
                        <th className="py-3 px-4 text-center">Contact Clicks</th>
                        <th className="py-3 px-4">Account Status</th>
                        <th className="py-3 px-4">Plan</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3c4043] text-[#bdc1c6]">
                      {filteredSellers.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                            No registered sellers found matching the query filters.
                          </td>
                        </tr>
                      ) : (
                        filteredSellers.map((seller) => (
                          <tr key={seller.id} className="hover:bg-[#2d3033] transition-colors">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div>
                                  <h4 className="font-bold text-[#e8eaed] text-xs flex items-center gap-1.5">
                                    {seller.businessName}
                                  </h4>
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    Owner: {seller.ownerName} &bull; {seller.email}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 font-semibold">
                              <span className="bg-[#2d3033] text-slate-300 px-2 py-0.5 rounded text-[10px] border border-[#3c4043]">
                                {seller.category}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-mono font-bold">
                              {seller.ssmNumber ? (
                                <span className="text-[#81c995] bg-[#137333]/20 px-2 py-0.5 rounded border border-[#137333]/30">
                                  {seller.ssmNumber}
                                </span>
                              ) : (
                                <span className="text-[#f28b82] bg-[#f28b82]/10 px-2 py-0.5 rounded border border-[#f28b82]/20 text-[10px] font-medium font-sans">
                                  Missing (Pending verification)
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-slate-300 font-medium font-sans text-[11px]">
                              {seller.location}
                            </td>
                            <td className="py-4 px-4">
                              {seller.verificationTier === "Gold" ? (
                                <span className="inline-flex items-center gap-1 text-[#fbc02d] bg-[#fbc02d]/10 px-2 py-0.5 rounded border border-[#fbc02d]/30 text-[10px] font-bold">
                                  ★ Gold Badge
                                </span>
                              ) : seller.verificationTier === "Silver" ? (
                                <span className="inline-flex items-center gap-1 text-[#bdc1c6] bg-[#bdc1c6]/10 px-2 py-0.5 rounded border border-[#bdc1c6]/30 text-[10px] font-bold">
                                  ◈ Silver Badge
                                </span>
                              ) : seller.verificationTier === "Bronze" ? (
                                <span className="inline-flex items-center gap-1 text-[#e18e56] bg-[#e18e56]/10 px-2 py-0.5 rounded border border-[#e18e56]/30 text-[10px] font-bold">
                                  ● Bronze Badge
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-400/10 px-2 py-0.5 rounded border border-slate-500/20 text-[10px]">
                                  None / Standard
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center font-mono font-bold text-emerald-400">
                              {seller.contactCount || 0}
                            </td>
                            <td className="py-4 px-4 font-mono font-bold">
                              {seller.isApproved ? (
                                <span className="inline-flex items-center gap-1 text-[#81c995] bg-[#137333]/20 px-2 py-0.5 rounded border border-[#137333]/30 text-[10px]">
                                  Approved
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[#fdd663] bg-amber-500/10 px-2 py-0.5 rounded border border-[#ffe088]/20 text-[10px]">
                                  Pending Review
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              {(seller as any).planStatus === "founding" ? (
                                <span className="inline-flex items-center gap-1 text-[#8ab4f8] bg-[#8ab4f8]/10 px-2 py-0.5 rounded border border-[#8ab4f8]/30 text-[10px] font-bold mb-1.5">
                                  Founding (Free)
                                </span>
                              ) : (seller as any).planStatus === "trial" ? (
                                <span className="inline-flex items-center gap-1 text-[#fdd663] bg-[#fdd663]/10 px-2 py-0.5 rounded border border-[#fdd663]/30 text-[10px] font-bold mb-1.5">
                                  On Trial
                                </span>
                              ) : (seller as any).planStatus === "paid" ? (
                                <span className="inline-flex items-center gap-1 text-[#81c995] bg-[#81c995]/10 px-2 py-0.5 rounded border border-[#81c995]/30 text-[10px] font-bold mb-1.5">
                                  Paying
                                </span>
                              ) : (seller as any).planStatus === "expired" ? (
                                <span className="inline-flex items-center gap-1 text-[#f28b82] bg-[#f28b82]/10 px-2 py-0.5 rounded border border-[#f28b82]/30 text-[10px] font-bold mb-1.5">
                                  Expired
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-400/10 px-2 py-0.5 rounded border border-slate-500/20 text-[10px] mb-1.5">
                                  Not Yet Approved
                                </span>
                              )}
                              {((seller as any).planStatus === "founding" || (seller as any).planStatus === "trial") && (seller as any).trialEndsAt && (
                                <span className="block text-[9px] text-[#9aa0a6] mb-1.5">
                                  Free until {new Date((seller as any).trialEndsAt).toLocaleDateString("en-MY", { year: "numeric", month: "short", day: "numeric" })}
                                </span>
                              )}
                              {seller.isApproved && (
                                <select
                                  value={(seller as any).planStatus || "pending"}
                                  disabled={actionLoading === `plan-${seller.id}`}
                                  onChange={(e) => handleUpdateSellerPlan(seller.id, e.target.value as any)}
                                  className="block border border-[#5f6368] text-[10px] rounded bg-[#202124] p-1 focus:outline-none focus:border-[#8ab4f8] font-bold text-[#e8eaed] cursor-pointer"
                                >
                                  <option value="founding">Founding</option>
                                  <option value="trial">Trial</option>
                                  <option value="paid">Paid (RM20/mo received)</option>
                                  <option value="expired">Expired</option>
                                </select>
                              )}
                              {seller.isApproved && (
                                <button
                                  onClick={() => handleToggleOfficial(seller.id, !!(seller as any).isOfficial)}
                                  disabled={actionLoading === `official-${seller.id}`}
                                  title="Mark as the official TamuBah account — shows a special badge in the Community forum"
                                  className={`mt-1.5 block w-full text-[9px] font-bold rounded px-1.5 py-1 border transition-colors cursor-pointer ${
                                    (seller as any).isOfficial
                                      ? "bg-emerald-500/15 text-[#81c995] border-[#81c995]/30"
                                      : "bg-transparent text-[#9aa0a6] border-[#5f6368] hover:border-[#8ab4f8]"
                                  }`}
                                >
                                  {(seller as any).isOfficial ? "★ Official TamuBah Account" : "Mark as Official"}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setResetPasswordSeller({ id: seller.id, businessName: seller.businessName, ownerName: seller.ownerName });
                                  setResetPasswordValue("");
                                  setResetPasswordConfirm("");
                                  setResetPasswordError("");
                                  setResetPasswordSuccessMsg("");
                                }}
                                title="Reset this seller's password — for forgot-password support"
                                className="mt-1.5 flex items-center justify-center gap-1 w-full text-[9px] font-bold rounded px-1.5 py-1 border border-[#5f6368] text-[#9aa0a6] hover:border-[#8ab4f8] hover:text-[#e8eaed] transition-colors cursor-pointer"
                              >
                                <Lock className="w-2.5 h-2.5" />
                                Reset Password
                              </button>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <select
                                  value={seller.verificationTier || "None"}
                                  disabled={actionLoading === `tier-${seller.id}`}
                                  onChange={(e) => handleUpdateVerificationTier(seller.id, e.target.value as any)}
                                  className="border border-[#5f6368] text-[10px] rounded bg-[#202124] p-1.5 focus:outline-none focus:border-[#8ab4f8] font-bold text-[#e8eaed] h-8 cursor-pointer"
                                >
                                  <option value="None">None (Standard)</option>
                                  <option value="Bronze">Bronze Tier</option>
                                  <option value="Silver">Silver Tier</option>
                                  <option value="Gold">Gold Tier</option>
                                </select>

                                <button
                                  onClick={() => handleToggleApproval(seller.id, !!seller.isApproved)}
                                  disabled={actionLoading === `approve-${seller.id}`}
                                  className={`px-3 h-8 rounded text-[10px] font-bold tracking-wide uppercase transition-all ${
                                    seller.isApproved
                                      ? "bg-[#f28b82]/10 hover:bg-[#f28b82]/20 text-[#f28b82] border border-[#f28b82]/30"
                                      : "bg-[#81c995]/20 hover:bg-[#81c995]/30 text-[#81c995] border border-[#81c995]/30"
                                  } disabled:opacity-50 cursor-pointer`}
                                >
                                  {actionLoading === `approve-${seller.id}` ? (
                                    "..."
                                  ) : seller.isApproved ? (
                                    "Suspend Account"
                                  ) : (
                                    "Approve Account"
                                  )}
                                </button>

                                <button
                                  onClick={() => handleDeleteSeller(seller.id, seller.businessName)}
                                  disabled={actionLoading === `delete-${seller.id}`}
                                  className="px-3 h-8 rounded text-[10px] font-bold tracking-wide uppercase transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-400/30 disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1"
                                >
                                  {actionLoading === `delete-${seller.id}` ? (
                                    "..."
                                  ) : (
                                    <>
                                      <Trash2 className="w-3 h-3" />
                                      Delete
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Merchants / Sellers Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 bg-[#2a2b2f] border border-[#3c4043] rounded p-4 text-[#e8eaed] select-none">
                  <div className="text-xs text-[#9aa0a6] font-mono">
                    Showing page <span className="font-bold text-[#e8eaed]">{sellersPage}</span> {sellersTotal > 0 && <span>of up to <span className="font-bold text-[#e8eaed]">{Math.ceil(sellersTotal / 50)}</span> pages</span>} (<span className="font-bold text-[#e8eaed]">{sellersTotal}</span> total merchants registered)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={sellersPage === 1}
                      onClick={() => {
                        setSellersPage((prev) => Math.max(prev - 1, 1));
                      }}
                      className={`px-3 py-1.5 rounded border border-[#5f6368] font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        sellersPage === 1
                          ? "bg-[#202124] text-slate-500 border-slate-700 cursor-not-allowed"
                          : "bg-[#202124] text-[#8ab4f8] hover:bg-[#2d3033] active:scale-95"
                      }`}
                    >
                      Prev Page
                    </button>
                    <span className="text-xs font-mono font-bold text-[#e8eaed] px-2.5 py-1 bg-[#202124] border border-[#3c4043] rounded">
                      {sellersPage}
                    </span>
                    <button
                      type="button"
                      disabled={!sellersHasMore}
                      onClick={() => {
                        if (sellersHasMore) {
                          setSellersPage((prev) => prev + 1);
                        }
                      }}
                      className={`px-3 py-1.5 rounded border border-[#5f6368] font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        !sellersHasMore
                          ? "bg-[#202124] text-slate-500 border-slate-700 cursor-not-allowed"
                          : "bg-[#8ab4f8] border-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa] active:scale-95 shadow-sm"
                      }`}
                    >
                      Next Page
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: REVISIONS & PRODUCTS (MANAGE PINNED/PROMOTED) */}
            {activeTab === "revisions" && (
              <div className="bg-[#202124] border border-[#3c4043] rounded-md shadow-md animate-in fade-in duration-200">
                
                {/* Search & filters GCP layout header */}
                <div className="bg-[#2a2b2f] px-4 py-3 border-b border-[#3c4043] flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="relative flex-grow max-w-md">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter products by title, business name, category..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 rounded border border-[#5f6368] bg-[#202124] text-xs text-white focus:outline-none focus:border-[#8ab4f8]"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <select
                      value={productFilter}
                      onChange={(e: any) => setProductFilter(e.target.value)}
                      className="border border-[#5f6368] text-xs rounded bg-[#202124] p-1.5 focus:outline-none focus:border-[#8ab4f8] font-medium text-[#e8eaed]"
                    >
                      <option value="all">All Products</option>
                      <option value="pinned">Pinned Revisions (Featured)</option>
                      <option value="regular">Regular Revisions Only</option>
                    </select>
                  </div>
                </div>

                <div className="px-4 py-2 bg-[#2a2b2f] border-b border-[#3c4043] flex items-center gap-1.5 text-[10px] text-slate-400 font-sans">
                  <GripVertical className="w-3 h-3 shrink-0" />
                  Drag rows by the handle to reorder how listings appear on the market.
                  {isSavingProductOrder && <span className="text-[#8ab4f8] font-bold ml-1">Saving order…</span>}
                </div>

                {/* Table list */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#3c4043] bg-[#202124] text-[#9aa0a6] font-bold uppercase tracking-wider text-[9px]">
                        <th className="py-3 px-4 w-8" title="Drag to reorder">
                          <GripVertical className="w-3.5 h-3.5 text-slate-500" />
                        </th>
                        <th className="py-3 px-4">Local Product Artifact Details</th>
                        <th className="py-3 px-4">Local Creator (Service Namespace)</th>
                        <th className="py-3 px-4">Standard Pricing (MYR)</th>
                        <th className="py-3 px-4">Assigned Category Tag</th>
                        <th className="py-3 px-4 text-right">Traffic Configuration Weight (Pin)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3c4043] text-[#bdc1c6]">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                            No products match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((product) => {
                          const isProductPinned = (product as any).isPinned;
                          const isDragging = draggedProductId === product.id;
                          const isDragOver = dragOverProductId === product.id && draggedProductId !== product.id;
                          return (
                            <tr
                              key={product.id}
                              draggable
                              onDragStart={(e) => {
                                setDraggedProductId(product.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragEnter={() => {
                                if (draggedProductId && draggedProductId !== product.id) {
                                  setDragOverProductId(product.id);
                                }
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                handleProductDrop(product.id);
                              }}
                              onDragEnd={() => {
                                setDraggedProductId(null);
                                setDragOverProductId(null);
                              }}
                              className={`hover:bg-[#2d3033] transition-colors font-mono text-[11px] cursor-grab active:cursor-grabbing ${
                                isDragging ? "opacity-40" : ""
                              } ${isDragOver ? "border-t-2 border-t-[#8ab4f8]" : ""}`}
                            >
                              <td className="py-4 px-4 text-slate-500">
                                <GripVertical className="w-3.5 h-3.5" />
                              </td>
                              <td className="py-4 px-4 font-sans">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded bg-[#2a2b2f] border border-[#3c4043] overflow-hidden shrink-0">
                                    <img src={product.imageUrl} alt="" className="w-full h-full object-cover animate-fade-in" />
                                  </div>
                                  <div className="max-w-xs">
                                    <h4 className="font-bold text-[#e8eaed] text-xs flex items-center gap-1.5">
                                      {product.title}
                                      {(product as any).isPublished ? (
                                        <span className="bg-[#81c995]/10 text-[#81c995] text-[9px] font-bold px-1.5 py-0.2 rounded border border-[#81c995]/30">
                                          Published
                                        </span>
                                      ) : (
                                        <span className="bg-[#5f6368]/20 text-[#9aa0a6] text-[9px] font-bold px-1.5 py-0.2 rounded border border-[#5f6368]/30">
                                          Unpublished
                                        </span>
                                      )}
                                      {isProductPinned && (
                                        <span className="bg-[#ffeebb]/10 text-[#fdd663] text-[9px] font-bold px-1.5 py-0.2 rounded border border-[#fdd663]/20 flex items-center gap-0.5">
                                          <Star className="w-2.5 h-2.5 fill-amber-500 stroke-amber-500" /> Featured (Top)
                                        </span>
                                      )}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 line-clamp-1">{product.description}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 font-sans">
                                <span className="font-bold text-[#e8eaed] text-xs block">
                                  {product.businessName}
                                </span>
                                <span className="text-[10px] text-slate-400 block font-mono">creator: {product.sellerName}</span>
                              </td>
                              <td className="py-4 px-4 font-bold text-[#e8eaed] text-xs font-mono">
                                RM {product.price.toFixed(2)}
                              </td>
                              <td className="py-4 px-4">
                                <span className="bg-[#2d3033] text-[#bdc1c6] px-2 py-0.5 rounded text-[10px] font-bold font-sans border border-[#3c4043] inline-flex items-center gap-1">
                                  <CategoryIcon category={product.category} className="w-3 h-3 shrink-0" />
                                  {product.category}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right font-sans">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleTogglePin(product.id, !!isProductPinned)}
                                    disabled={actionLoading === `pin-${product.id}`}
                                    className={`px-2.5 py-1.5 rounded text-[10px] font-bold uppercase transition-all tracking-wide ${
                                      isProductPinned
                                        ? "bg-[#fdd663]/10 text-[#fdd663] border border-[#fdd663]/30 hover:bg-[#fdd663]/20"
                                        : "bg-[#2d3033] text-slate-300 border border-[#3c4043] hover:bg-[#3c4043]"
                                    } disabled:opacity-50 cursor-pointer`}
                                  >
                                    {actionLoading === `pin-${product.id}` ? (
                                      "SAVING..."
                                    ) : isProductPinned ? (
                                      "UNPIN / SET 0%"
                                    ) : (
                                      "PIN TO TOP"
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(product.id, product.title)}
                                    disabled={actionLoading === `delete-product-${product.id}`}
                                    title="Delete this listing"
                                    className="p-1.5 rounded text-[#f28b82] border border-[#3c4043] hover:bg-[#f28b82]/10 hover:border-[#f28b82]/30 disabled:opacity-50 cursor-pointer transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Revisions / Products Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 bg-[#2a2b2f] border border-[#3c4043] rounded p-4 text-[#e8eaed] select-none">
                  <div className="text-xs text-[#9aa0a6] font-mono">
                    Showing page <span className="font-bold text-[#e8eaed]">{productsPage}</span> {productsTotal > 0 && <span>of up to <span className="font-bold text-[#e8eaed]">{Math.ceil(productsTotal / 50)}</span> pages</span>} (<span className="font-bold text-[#e8eaed]">{productsTotal}</span> total listings deployed)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={productsPage === 1}
                      onClick={() => {
                        setProductsPage((prev) => Math.max(prev - 1, 1));
                      }}
                      className={`px-3 py-1.5 rounded border border-[#5f6368] font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        productsPage === 1
                          ? "bg-[#202124] text-slate-500 border-slate-700 cursor-not-allowed"
                          : "bg-[#202124] text-[#8ab4f8] hover:bg-[#2d3033] active:scale-95"
                      }`}
                    >
                      Prev Page
                    </button>
                    <span className="text-xs font-mono font-bold text-[#e8eaed] px-2.5 py-1 bg-[#202124] border border-[#3c4043] rounded">
                      {productsPage}
                    </span>
                    <button
                      type="button"
                      disabled={!productsHasMore}
                      onClick={() => {
                        if (productsHasMore) {
                          setProductsPage((prev) => prev + 1);
                        }
                      }}
                      className={`px-3 py-1.5 rounded border border-[#5f6368] font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        !productsHasMore
                          ? "bg-[#202124] text-slate-500 border-slate-700 cursor-not-allowed"
                          : "bg-[#8ab4f8] border-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa] active:scale-95 shadow-sm"
                      }`}
                    >
                      Next Page
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* TAB: PUBLISH REQUESTS — sellers asking to publish beyond the 1-product limit */}
            {activeTab === "publish" && (
              <div className="bg-[#202124] border border-[#3c4043] rounded-md shadow-md animate-in fade-in duration-200">

                <div className="bg-[#2a2b2f] px-4 py-3 border-b border-[#3c4043] flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[#e8eaed] font-bold text-sm">Publish Permission Requests</h3>
                    <p className="text-[10px] text-[#9aa0a6] mt-0.5">Sellers may only publish 1 live product by default. Approve to let them publish an extra one.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <select
                      value={publishRequestFilter}
                      onChange={(e: any) => setPublishRequestFilter(e.target.value)}
                      className="border border-[#5f6368] text-xs rounded bg-[#202124] p-1.5 focus:outline-none focus:border-[#8ab4f8] font-medium text-[#e8eaed]"
                    >
                      <option value="pending">Pending Review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="all">All Requests</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#3c4043] bg-[#202124] text-[#9aa0a6] font-bold uppercase tracking-wider text-[9px]">
                        <th className="py-3 px-4">Requested Product</th>
                        <th className="py-3 px-4">Seller</th>
                        <th className="py-3 px-4">Message</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3c4043] text-[#bdc1c6]">
                      {publishRequests.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                            No {publishRequestFilter !== "all" ? publishRequestFilter : ""} publish requests found.
                          </td>
                        </tr>
                      ) : (
                        publishRequests.map((request) => (
                          <tr key={request.id} className="hover:bg-[#2d3033] transition-colors font-mono text-[11px]">
                            <td className="py-4 px-4 font-sans">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded bg-[#2a2b2f] border border-[#3c4043] overflow-hidden shrink-0">
                                  {request.productImageUrl ? (
                                    <img src={request.productImageUrl} alt="" className="w-full h-full object-cover" />
                                  ) : null}
                                </div>
                                <div className="max-w-xs">
                                  <h4 className="font-bold text-[#e8eaed] text-xs">{request.productTitle}</h4>
                                  <p className="text-[10px] text-slate-400">RM {Number(request.productPrice || 0).toFixed(2)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 font-sans">
                              <span className="font-bold text-[#e8eaed] text-xs block">{request.businessName}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">owner: {request.sellerName}</span>
                            </td>
                            <td className="py-4 px-4 font-sans max-w-xs">
                              <span className="text-[10px] text-slate-300 leading-relaxed line-clamp-3">
                                {request.message || <span className="italic text-slate-500">No message provided</span>}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans border uppercase ${
                                request.status === "pending"
                                  ? "bg-[#fdd663]/10 text-[#fdd663] border-[#fdd663]/30"
                                  : request.status === "approved"
                                  ? "bg-[#81c995]/10 text-[#81c995] border-[#81c995]/30"
                                  : "bg-[#f28b82]/10 text-[#f28b82] border-[#f28b82]/30"
                              }`}>
                                {request.status}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right font-sans">
                              {request.status === "pending" ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleApprovePublishRequest(request.id)}
                                    disabled={actionLoading === `pubreq-${request.id}`}
                                    className="px-2.5 py-1.5 rounded text-[10px] font-bold uppercase transition-all tracking-wide bg-[#81c995]/10 text-[#81c995] border border-[#81c995]/30 hover:bg-[#81c995]/20 disabled:opacity-50 cursor-pointer"
                                  >
                                    {actionLoading === `pubreq-${request.id}` ? "..." : "Approve"}
                                  </button>
                                  <button
                                    onClick={() => handleRejectPublishRequest(request.id)}
                                    disabled={actionLoading === `pubreq-${request.id}`}
                                    className="px-2.5 py-1.5 rounded text-[10px] font-bold uppercase transition-all tracking-wide bg-[#f28b82]/10 text-[#f28b82] border border-[#f28b82]/30 hover:bg-[#f28b82]/20 disabled:opacity-50 cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">
                                  {request.resolvedAt ? new Date(request.resolvedAt).toLocaleDateString("en-MY") : "—"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: LOGS EXPLORER (MOCK LIVE AUDIT TERMINAL) */}
            {activeTab === "logs" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                
                {/* Simulated Logs Filter block */}
                <div className="bg-[#2d3033] border border-[#3c4043] rounded-md p-4 text-[#e8eaed] font-mono text-xs shadow-md space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-700 pb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold text-slate-200">Query builder (Knative Logs Service API)</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Resource type: Cloud Run Revision</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-slate-800">
                    <div className="bg-white/5 rounded px-2.5 py-1.5 flex items-center justify-between text-white border border-white/10">
                      <span className="text-slate-400">Severity</span>
                      <span className="font-bold text-[10px] text-[#8ab4f8] bg-[#8ab4f8]/10 border border-[#8ab4f8]/30 px-1.5 rounded">All severity</span>
                    </div>

                    <div className="bg-white/5 rounded px-2.5 py-1.5 flex items-center justify-between text-white border border-white/10">
                      <span className="text-slate-400">Trace Mode</span>
                      <span className="font-bold text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-400/30 px-1.5 rounded">Live Tail</span>
                    </div>

                    <div className="bg-white/5 rounded px-2.5 py-1.5 flex items-center justify-between text-white border border-white/10 col-span-2">
                      <span className="text-slate-400">Filter text</span>
                      <input 
                        type="text" 
                        placeholder="e.g. error, latency, verify" 
                        className="bg-transparent border-none text-xs text-white focus:outline-none placeholder-white/20 text-right w-full ml-4"
                      />
                    </div>
                  </div>
                </div>

                {/* Simulated Stackdriver Log rows list */}
                <div className="bg-[#202124] border border-[#3c4043] rounded-md overflow-hidden shadow-md">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#3c4043] bg-[#202124] text-[#9aa0a6] font-bold uppercase tracking-wider text-[9px] font-mono">
                          <th className="py-2.5 px-4 w-28">Severity</th>
                          <th className="py-2.5 px-4 w-44">Timestamp</th>
                          <th className="py-2.5 px-4">Log Message Payload / Action</th>
                          <th className="py-2.5 px-4 text-right">Inspect Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3c4043] font-mono text-[11px] text-[#bdc1c6]">
                        
                        {/* Reports alerts on top if they exist (resolved/dismissed reports are hidden here) */}
                        {stats?.reports && stats.reports.filter((r: any) => !r.status || r.status === "open").map((report) => (
                          <React.Fragment key={`report-row-${report.id}`}>
                            <tr className="bg-amber-500/5 hover:bg-amber-500/10 border-l-2 border-[#fdd663] transition-colors">
                              <td className="py-2.5 px-4 font-bold">
                                <span className="bg-[#fdd663]/10 text-[#fdd663] border border-[#fdd663]/30 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide">
                                  WARNING
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-400">
                                {new Date(report.createdAt).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="text-[#fdd663] font-bold">[USER_REPORT]</span> Flagged shop: <strong className="text-white font-semibold">{report.sellerName}</strong>. Reason: <span className="text-[#f28b82]">"{report.reason}"</span>.
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2.5 flex-wrap">
                                  <button
                                    onClick={() => handleReportStatus(report.id, "resolved")}
                                    disabled={actionLoading === `report-${report.id}`}
                                    className="text-[#81c995] hover:underline font-bold text-[10px] disabled:opacity-50"
                                  >
                                    Resolve
                                  </button>
                                  <button
                                    onClick={() => handleReportStatus(report.id, "dismissed")}
                                    disabled={actionLoading === `report-${report.id}`}
                                    className="text-[#9aa0a6] hover:underline font-bold text-[10px] disabled:opacity-50"
                                  >
                                    Dismiss
                                  </button>
                                  <button
                                    onClick={() => handleDeleteReport(report.id)}
                                    disabled={actionLoading === `report-${report.id}`}
                                    className="text-[#f28b82] hover:underline font-bold text-[10px] disabled:opacity-50"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => setSelectedLogId(selectedLogId === `report-${report.id}` ? null : `report-${report.id}`)}
                                    className="text-[#8ab4f8] hover:underline font-bold text-[10px]"
                                  >
                                    {selectedLogId === `report-${report.id}` ? "Hide Details" : "Expand JSON"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {selectedLogId === `report-${report.id}` && (
                              <tr>
                                <td colSpan={4} className="bg-slate-950 text-[#ce9178] p-4 font-mono text-[11px] leading-relaxed select-text overflow-x-auto whitespace-pre border-t border-b border-[#3c4043]">
{JSON.stringify({
  resource: {
    type: "cloud_run_revision",
    labels: {
      service_name: "tamu-bah-microservices-container",
      location: "asia-east1",
      revision_name: "tamu-bah-0004-v2f"
    }
  },
  severity: "WARNING",
  timestamp: report.createdAt,
  payload: {
    event: "customer_complaint_flagged",
    reason: report.reason,
    description: report.description,
    reporter: report.reporterEmail,
    target_seller_id: report.sellerId,
    target_product_id: report.productId,
    moderation_status: "AWAITING_ADMIN_ACTION"
  }
}, null, 2)}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}

                        {/* Standard Audit Logs */}
                        {stats?.logs && stats.logs.map((log) => (
                          <React.Fragment key={`log-row-${log.id}`}>
                            <tr className="hover:bg-[#2d3033] transition-colors">
                              <td className="py-2.5 px-4">
                                {log.action === "seller_registered" || log.action === "seller_verification_changed" ? (
                                  <span className="bg-[#137333]/20 text-[#81c995] border border-[#137333]/30 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide">
                                    INFO
                                  </span>
                                ) : (
                                  <span className="bg-[#1a73e8]/20 text-[#8ab4f8] border border-[#1a73e8]/30 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide">
                                    DEBUG
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-slate-400">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="text-slate-400 font-bold">[{log.action.toUpperCase()}]</span> {log.details}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <button
                                  onClick={() => setSelectedLogId(selectedLogId === log.id ? null : log.id)}
                                  className="text-[#8ab4f8] hover:underline font-bold text-[10px]"
                                >
                                  {selectedLogId === log.id ? "Hide Details" : "Expand JSON"}
                                </button>
                              </td>
                            </tr>
                            {selectedLogId === log.id && (
                              <tr>
                                <td colSpan={4} className="bg-slate-950 text-[#9cdcfe] p-4 font-mono text-[11px] leading-relaxed select-text overflow-x-auto whitespace-pre border-t border-b border-[#3c4043]">
{JSON.stringify({
  insertId: log.id,
  resource: {
    type: "cloud_run_revision",
    labels: {
      service_name: "tamu-bah-microservices-container",
      location: "asia-east1"
    }
  },
  severity: "INFO",
  timestamp: log.timestamp,
  jsonPayload: {
    action: log.action,
    details: log.details,
    triggered_by: "system_gateway_proxy",
    latency_ms: Math.floor(Math.random() * 45) + 5
  }
}, null, 2)}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB: ADMINS — manage who can access this panel */}
            {activeTab === "admins" && (
              <div className="space-y-6 animate-in fade-in duration-200 max-w-2xl">
                <div className="bg-[#202124] border border-[#3c4043] rounded-md shadow-md p-5">
                  <h3 className="text-sm font-bold text-[#f1f3f4] mb-1 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#8ab4f8]" /> Admin Accounts
                  </h3>
                  <p className="text-[11px] text-[#9aa0a6] mb-4">
                    Anyone listed here can sign in to this Admin Panel with their own passcode. Add one account per person, and remove access instantly by deleting an account below.
                  </p>

                  <div className="divide-y divide-[#3c4043] border border-[#3c4043] rounded-md overflow-hidden mb-5">
                    {admins.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[#9aa0a6] italic">Loading admin accounts...</div>
                    ) : (
                      admins.map((a) => (
                        <div key={a.id} className="flex items-center justify-between px-4 py-3 bg-[#2a2b2f]">
                          <div>
                            <div className="text-xs font-bold text-[#e8eaed]">{a.username}</div>
                            <div className="text-[10px] text-[#9aa0a6] font-mono">Created {new Date(a.createdAt).toLocaleDateString()}</div>
                          </div>
                          <button
                            onClick={() => handleDeleteAdmin(a.id, a.username)}
                            disabled={actionLoading === `del-admin-${a.id}`}
                            className="p-1.5 rounded text-[#f28b82] border border-[#3c4043] hover:bg-[#f28b82]/10 hover:border-[#f28b82]/30 disabled:opacity-50 cursor-pointer transition-all"
                            title="Remove this admin account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddAdmin} className="space-y-3 bg-[#2a2b2f] border border-[#3c4043] rounded-md p-4">
                    <h4 className="text-xs font-bold text-[#e8eaed] uppercase tracking-wide">Add a new admin</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Username"
                        value={newAdminUsername}
                        onChange={(e) => setNewAdminUsername(e.target.value)}
                        required
                        className="px-3 py-2 rounded border border-[#5f6368] bg-[#202124] text-xs text-white focus:outline-none focus:border-[#8ab4f8]"
                      />
                      <input
                        type="password"
                        placeholder="Passcode (min. 6 characters)"
                        value={newAdminPasscode}
                        onChange={(e) => setNewAdminPasscode(e.target.value)}
                        required
                        minLength={6}
                        className="px-3 py-2 rounded border border-[#5f6368] bg-[#202124] text-xs text-white focus:outline-none focus:border-[#8ab4f8]"
                      />
                    </div>
                    {adminFormError && <p className="text-[11px] text-[#f28b82] font-semibold">{adminFormError}</p>}
                    <button
                      type="submit"
                      disabled={actionLoading === "add-admin"}
                      className="px-4 py-2 rounded bg-[#8ab4f8] text-[#202124] text-xs font-bold hover:bg-[#aecbfa] disabled:opacity-50 cursor-pointer transition-all"
                    >
                      {actionLoading === "add-admin" ? "Adding..." : "Add Admin Account"}
                    </button>
                  </form>
                </div>

                <div className="bg-[#202124] border border-[#3c4043] rounded-md shadow-md p-5">
                  <h3 className="text-sm font-bold text-[#f1f3f4] mb-1 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#8ab4f8]" /> Change My Passcode
                  </h3>
                  <p className="text-[11px] text-[#9aa0a6] mb-4">Update the passcode for the admin account you're currently signed in as.</p>
                  <form onSubmit={handleChangeOwnPasscode} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="password"
                      placeholder="New passcode (min. 6 characters)"
                      value={newPasscodeForSelf}
                      onChange={(e) => setNewPasscodeForSelf(e.target.value)}
                      required
                      minLength={6}
                      className="flex-grow px-3 py-2 rounded border border-[#5f6368] bg-[#202124] text-xs text-white focus:outline-none focus:border-[#8ab4f8]"
                    />
                    <button
                      type="submit"
                      disabled={actionLoading === "change-passcode"}
                      className="px-4 py-2 rounded bg-[#2d3033] text-[#e8eaed] border border-[#5f6368] text-xs font-bold hover:bg-[#3c4043] disabled:opacity-50 cursor-pointer transition-all"
                    >
                      {actionLoading === "change-passcode" ? "Saving..." : "Update Passcode"}
                    </button>
                  </form>
                  {passcodeChangeMessage && <p className="text-[11px] text-[#8ab4f8] font-semibold mt-2">{passcodeChangeMessage}</p>}
                </div>
              </div>
            )}

            {/* TAB 5: YAML CONFIG EDITOR */}
            {activeTab === "yaml" && (
              <div className="bg-[#1e1e1e] border border-slate-800 rounded-md shadow-lg overflow-hidden animate-in duration-200">
                <div className="bg-[#2d2d2d] px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs select-none">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-mono text-slate-300 font-bold">service-definition.yaml</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[10px]">Read-Only / Generated via Knative spec</span>
                </div>

                {/* Pseudo Monaco Editor / syntax styling */}
                <div className="p-4 overflow-x-auto max-h-[500px]">
                  <pre className="font-mono text-xs text-[#d4d4d4] leading-relaxed select-all">
                    {yamlEditorContent}
                  </pre>
                </div>

                <div className="bg-[#252526] px-4 py-2 border-t border-slate-800 text-[10px] text-slate-400 font-mono text-right select-none">
                  Line 42, Col 1 &bull; UTF-8 &bull; YAML (Kubernetes Cloud Run Service)
                </div>
              </div>
            )}

            {/* TAB 6: CATEGORY MANAGEMENT + PLATFORM ANNOUNCEMENT */}
            {activeTab === "categories" && (
              <div className="space-y-6 animate-in duration-200">

                {/* Business categories */}
                <section className="bg-[#202124] border border-[#3c4043] rounded-lg shadow-md overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#3c4043] flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#8ab4f8]" />
                    <h3 className="font-bold text-sm text-[#e8eaed]">Seller Business Categories</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <p className="text-[11px] text-[#9aa0a6] leading-relaxed">
                      Add, rename, recolor, or remove the categories sellers can pick from when they register or edit their shop.
                      Changes apply instantly across the market, seller directory, and filters for everyone browsing the site.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {adminCategories.map((cat) => {
                        const color = adminCategoryColors[cat] || "#64748b";
                        const isEditing = editingCategory === cat;
                        return (
                          <div
                            key={cat}
                            className="flex items-center gap-2 bg-[#2a2b2f] border border-[#3c4043] rounded-xl pl-2 pr-1.5 py-1.5"
                          >
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => setCategoryColor(cat, e.target.value)}
                              className="w-5 h-5 rounded cursor-pointer bg-transparent border border-[#3c4043]"
                              title="Category color"
                            />
                            {isEditing ? (
                              <input
                                autoFocus
                                value={editingCategoryName}
                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    renameCategory(cat, editingCategoryName);
                                    setEditingCategory(null);
                                  } else if (e.key === "Escape") {
                                    setEditingCategory(null);
                                  }
                                }}
                                className="bg-[#1a1b1e] border border-[#5f6368] rounded px-2 py-1 text-xs text-[#e8eaed] w-32 focus:outline-none focus:border-[#8ab4f8]"
                              />
                            ) : (
                              <span className="text-xs font-semibold text-[#e8eaed]">{cat}</span>
                            )}
                            {isEditing ? (
                              <button
                                onClick={() => { renameCategory(cat, editingCategoryName); setEditingCategory(null); }}
                                className="text-emerald-400 hover:text-emerald-300 cursor-pointer p-1"
                                title="Save"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => { setEditingCategory(cat); setEditingCategoryName(cat); }}
                                className="text-[#9aa0a6] hover:text-[#e8eaed] cursor-pointer p-1"
                                title="Rename"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (window.confirm(`Remove category "${cat}"? Sellers already using it will keep it on their profile until changed.`)) {
                                  removeCategory(cat);
                                }
                              }}
                              className="text-[#9aa0a6] hover:text-red-400 cursor-pointer p-1"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#3c4043]">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newCategoryName.trim()) {
                            addCategory(newCategoryName);
                            setNewCategoryName("");
                          }
                        }}
                        placeholder="New category name (e.g. Pets & Supplies)"
                        className="flex-1 bg-[#202124] border border-[#5f6368] rounded-lg px-3 py-2 text-xs text-[#e8eaed] focus:outline-none focus:border-[#8ab4f8]"
                      />
                      <button
                        onClick={() => {
                          if (!newCategoryName.trim()) return;
                          addCategory(newCategoryName);
                          setNewCategoryName("");
                        }}
                        disabled={!newCategoryName.trim()}
                        className="bg-[#8ab4f8] hover:bg-[#729fee] disabled:opacity-40 text-[#1a1a1a] font-bold px-3.5 py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Category
                      </button>
                    </div>
                  </div>
                </section>

                {/* Platform announcement */}
                <section className="bg-[#202124] border border-[#3c4043] rounded-lg shadow-md overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#3c4043] flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-amber-400" />
                    <h3 className="font-bold text-sm text-[#e8eaed]">Platform Announcement</h3>
                  </div>
                  <div className="p-5 space-y-3">
                    <p className="text-[11px] text-[#9aa0a6] leading-relaxed">
                      Shown as a red notification dot on the Announcement icon in the header for every signed-in seller until they open it.
                      Leave blank and save to clear the current announcement.
                    </p>
                    <textarea
                      rows={3}
                      value={announcementDraft}
                      onChange={(e) => setAnnouncementDraft(e.target.value)}
                      placeholder="e.g. TamuBah will be down for maintenance this Sunday 12am-2am."
                      className="w-full border border-[#5f6368] text-xs rounded bg-[#202124] p-2.5 focus:outline-none focus:border-[#8ab4f8] text-[#e8eaed] resize-none"
                    />
                    {announcementSavedMsg && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-2 rounded-lg text-xs">
                        {announcementSavedMsg}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setAnnouncement(announcementDraft);
                        setAnnouncementSavedMsg(announcementDraft.trim() ? "Announcement published." : "Announcement cleared.");
                        setTimeout(() => setAnnouncementSavedMsg(""), 2500);
                      }}
                      className="bg-amber-500 hover:bg-amber-400 text-[#1a1a1a] font-bold px-4 py-2.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Publish Announcement
                    </button>
                  </div>
                </section>
              </div>
            )}

            {/* TAB 7: CONTACT LIST — WhatsApp numbers, first sign-in to latest, copy-ready */}
            {activeTab === "contacts" && (
              <div className="bg-[#202124] border border-[#3c4043] rounded-lg shadow-md animate-in duration-200">
                <div className="px-5 py-4 border-b border-[#3c4043] flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#8ab4f8]" />
                    <div>
                      <h3 className="font-bold text-sm text-[#e8eaed]">Seller WhatsApp Contact List</h3>
                      <p className="text-[10px] text-[#9aa0a6] mt-0.5">
                        Ordered by sign-up date — first registered seller to most recent. {sellersByJoinDate.length} total.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        copyToClipboard(
                          sellersByJoinDate.map((s: any) => normalizePhone(s.phoneNumber)).filter(Boolean).join("\n"),
                          "Copied numbers only!"
                        )
                      }
                      className="flex items-center gap-1.5 border border-[#5f6368] hover:border-[#8ab4f8] text-xs font-bold rounded px-3 py-1.5 text-[#e8eaed] transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Numbers Only
                    </button>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          sellersByJoinDate
                            .map((s: any, i: number) => `${i + 1}. ${s.businessName} (${s.ownerName}) — ${normalizePhone(s.phoneNumber)}`)
                            .join("\n"),
                          "Copied list with names!"
                        )
                      }
                      className="flex items-center gap-1.5 bg-[#8ab4f8] hover:bg-[#729fee] text-[#1a1a1a] text-xs font-bold rounded px-3 py-1.5 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy With Names
                    </button>
                  </div>
                </div>

                {contactCopyMsg && (
                  <div className="mx-5 mt-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-2 rounded-lg text-xs">
                    {contactCopyMsg}
                  </div>
                )}

                <div className="p-5">
                  <div className="max-h-[520px] overflow-y-auto rounded-lg border border-[#3c4043]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0">
                        <tr className="border-b border-[#3c4043] bg-[#2a2b2f] text-[#9aa0a6] font-bold uppercase tracking-wider text-[9px]">
                          <th className="py-2.5 px-3 w-10">#</th>
                          <th className="py-2.5 px-3">Business / Owner</th>
                          <th className="py-2.5 px-3">WhatsApp Number</th>
                          <th className="py-2.5 px-3">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3c4043] text-[#bdc1c6]">
                        {sellersByJoinDate.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-10 text-center text-slate-400 italic">
                              No sellers registered yet.
                            </td>
                          </tr>
                        ) : (
                          sellersByJoinDate.map((s: any, i: number) => (
                            <tr key={s.id} className="hover:bg-[#2d3033] transition-colors">
                              <td className="py-2.5 px-3 font-mono text-[#9aa0a6]">{i + 1}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-[#e8eaed]">{s.businessName}</div>
                                <div className="text-[10px] text-[#9aa0a6]">{s.ownerName}</div>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[#81c995]">{normalizePhone(s.phoneNumber) || "—"}</td>
                              <td className="py-2.5 px-3 text-[10px] text-[#9aa0a6]">
                                {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Raw copy-ready block, selectable by hand as a fallback */}
                  <div className="mt-4">
                    <label className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-wider block mb-1.5">
                      Or select manually
                    </label>
                    <textarea
                      readOnly
                      rows={4}
                      value={sellersByJoinDate.map((s: any) => normalizePhone(s.phoneNumber)).filter(Boolean).join("\n")}
                      onFocus={(e) => e.target.select()}
                      className="w-full border border-[#5f6368] text-xs rounded bg-[#151619] p-2.5 focus:outline-none focus:border-[#8ab4f8] text-[#81c995] font-mono resize-y"
                    />
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </main>

      {/* Reset Seller Password Modal */}
      {resetPasswordSeller && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#202124] rounded-2xl shadow-xl border border-[#3c4043] max-w-md w-full overflow-hidden text-[#e8eaed]">
            <div className="bg-[#2a2b2f] px-5 py-4 border-b border-[#3c4043] flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/15 rounded-lg text-amber-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Reset Password</h3>
                <p className="text-[10px] text-[#9aa0a6]">{resetPasswordSeller.businessName} ({resetPasswordSeller.ownerName})</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {resetPasswordSuccessMsg ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-3 rounded-lg text-xs leading-relaxed">
                  {resetPasswordSuccessMsg}
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-[#9aa0a6] leading-relaxed">
                    Set a new password for this seller — no need for their old one. Share it with them directly (WhatsApp, phone call) once set; it won't be shown again after this.
                  </p>

                  {resetPasswordError && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-3 py-2 rounded-lg text-xs">
                      {resetPasswordError}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-wider">New Password</label>
                      <button
                        onClick={generateRandomPassword}
                        className="text-[10px] font-bold text-[#8ab4f8] hover:text-[#a8c7fa] cursor-pointer"
                      >
                        Generate random
                      </button>
                    </div>
                    <input
                      type="text"
                      value={resetPasswordValue}
                      onChange={(e) => setResetPasswordValue(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full border border-[#5f6368] text-xs rounded bg-[#151619] p-2.5 focus:outline-none focus:border-[#8ab4f8] text-[#e8eaed] font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-wider block mb-1.5">Confirm New Password</label>
                    <input
                      type="text"
                      value={resetPasswordConfirm}
                      onChange={(e) => setResetPasswordConfirm(e.target.value)}
                      className="w-full border border-[#5f6368] text-xs rounded bg-[#151619] p-2.5 focus:outline-none focus:border-[#8ab4f8] text-[#e8eaed] font-mono"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[#3c4043] flex items-center justify-end gap-2">
              <button
                onClick={() => setResetPasswordSeller(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-[#9aa0a6] hover:text-[#e8eaed] transition-colors cursor-pointer"
              >
                {resetPasswordSuccessMsg ? "Close" : "Cancel"}
              </button>
              {!resetPasswordSuccessMsg && (
                <button
                  onClick={handleResetPassword}
                  disabled={actionLoading === `reset-password-${resetPasswordSeller.id}`}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-[#1a1a1a] font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  {actionLoading === `reset-password-${resetPasswordSeller.id}` ? "Resetting..." : "Reset Password"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Email Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#202124] rounded-2xl shadow-xl border border-[#3c4043] max-w-lg w-full overflow-hidden text-[#e8eaed]">
            <div className="bg-[#2a2b2f] px-5 py-4 border-b border-[#3c4043] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#8ab4f8]" />
                <h3 className="font-bold text-sm">Broadcast Email to Sellers</h3>
              </div>
              <button
                onClick={() => { setShowBroadcastModal(false); setBroadcastResult(null); setBroadcastError(null); }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="flex gap-2 bg-[#2a2b2f] p-1 rounded-lg w-fit">
                <button
                  onClick={() => setBroadcastMode("text")}
                  className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    broadcastMode === "text" ? "bg-[#8ab4f8] text-[#1a1a1a]" : "text-[#9aa0a6] hover:text-white"
                  }`}
                >
                  Plain Text
                </button>
                <button
                  onClick={() => setBroadcastMode("html")}
                  className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    broadcastMode === "html" ? "bg-[#8ab4f8] text-[#1a1a1a]" : "text-[#9aa0a6] hover:text-white"
                  }`}
                >
                  Custom HTML
                </button>
              </div>

              <p className="text-[11px] text-[#9aa0a6] leading-relaxed">
                {broadcastMode === "text" ? (
                  <>Simple messages — each line becomes a paragraph, auto-wrapped in your TamuBah brand template.</>
                ) : (
                  <>Paste a complete HTML email (e.g. one of your branded templates) — sent exactly as-is, no extra wrapping.</>
                )}
                {" "}Use <code className="bg-[#2a2b2f] px-1 rounded">{"{{ownerName}}"}</code> and <code className="bg-[#2a2b2f] px-1 rounded">{"{{businessName}}"}</code> anywhere — each seller gets their own personalized copy.
              </p>

              {broadcastError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-3 py-2 rounded-lg text-xs">{broadcastError}</div>
              )}
              {broadcastResult && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-2 rounded-lg text-xs">{broadcastResult}</div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6] mb-1.5">Send to</label>
                <select
                  value={broadcastPlanFilter}
                  onChange={(e) => setBroadcastPlanFilter(e.target.value)}
                  className="w-full border border-[#5f6368] text-xs rounded bg-[#202124] p-2 focus:outline-none focus:border-[#8ab4f8] text-[#e8eaed]"
                >
                  <option value="all">All Approved Sellers</option>
                  <option value="founding">Founding Sellers</option>
                  <option value="trial">Trial Sellers</option>
                  <option value="paid">Paying Sellers</option>
                  <option value="expired">Expired Sellers</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6] mb-1.5">Subject</label>
                <input
                  type="text"
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                  placeholder="e.g. New feature on TamuBah, {{businessName}}!"
                  className="w-full border border-[#5f6368] text-xs rounded bg-[#202124] p-2.5 focus:outline-none focus:border-[#8ab4f8] text-[#e8eaed]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9aa0a6] mb-1.5">
                  {broadcastMode === "text" ? "Message" : "HTML Template"}
                </label>
                <textarea
                  rows={broadcastMode === "text" ? 6 : 10}
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder={
                    broadcastMode === "text"
                      ? "Hi {{ownerName}},\n\nWrite your message here..."
                      : "<table>...paste your full HTML email template here...</table>"
                  }
                  className="w-full border border-[#5f6368] text-xs rounded bg-[#202124] p-2.5 focus:outline-none focus:border-[#8ab4f8] text-[#e8eaed] resize-none font-mono"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePreviewBroadcast}
                  disabled={!broadcastBody.trim()}
                  className="flex-1 border border-[#5f6368] hover:border-[#8ab4f8] text-[#e8eaed] font-bold py-2.5 rounded-lg text-xs transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Preview in New Tab
                </button>
                <button
                  onClick={handleSendBroadcast}
                  disabled={broadcastSending}
                  className="flex-1 bg-[#8ab4f8] hover:bg-[#729fee] text-[#1a1a1a] font-bold py-2.5 rounded-lg text-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {broadcastSending ? "Sending..." : "Send Broadcast"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Simple placeholder icon to prevent import compilation issues
function FileCode2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="m10 13-2 2 2 2" />
      <path d="m14 17 2-2-2-2" />
    </svg>
  );
}
