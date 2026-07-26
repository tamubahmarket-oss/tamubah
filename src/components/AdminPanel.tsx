import React, { useState, useEffect } from "react";
import { 
  BarChart3, Users, ShieldCheck, Star, 
  Clock, AlertTriangle, Search, Filter,
  Check, X, ArrowUpRight, TrendingUp, RefreshCw, Lock,
  ExternalLink, Code, Terminal, Info, Settings, Play, Server, FileText,
  ChevronDown, HelpCircle, Bell, User, MoreVertical, Menu, ShieldAlert,
  Trash2
} from "lucide-react";
import { Seller, Product } from "../types";

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
  const [activeTab, setActiveTab] = useState<"metrics" | "merchants" | "revisions" | "logs" | "admins" | "yaml">("metrics");
  
  // Search and filter states
  const [sellerSearch, setSellerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [sellerFilter, setSellerFilter] = useState<"all" | "verified" | "unverified">("all");
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
  }, []);

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
      
      {/* 1. GOOGLE CLOUD BAR (DARK THEME) */}
      <header className="bg-[#18191d] text-white px-4 py-2 flex items-center justify-between text-xs font-medium border-b border-[#2d3033] shadow-md select-none">
        <div className="flex items-center gap-4">
          <button className="p-1.5 hover:bg-white/10 rounded-md transition-colors cursor-pointer text-slate-300 hover:text-white">
            <Menu className="w-4 h-4" />
          </button>
          
          {/* Logo segment */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 font-bold tracking-tight text-[13px] text-slate-100">
              {/* Colored polygon logo representing Google Cloud Console */}
              <div className="flex flex-wrap w-4 h-4 rotate-45 mr-1.5 shrink-0 scale-110">
                <div className="w-2 h-2 bg-[#ea4335]"></div>
                <div className="w-2 h-2 bg-[#4285f4]"></div>
                <div className="w-2 h-2 bg-[#f9ab00]"></div>
                <div className="w-2 h-2 bg-[#34a853]"></div>
              </div>
              <span className="font-extrabold text-slate-200">Google Cloud</span>
              <span className="text-white/40 font-normal mx-1">Console</span>
            </div>
          </div>

          <span className="text-white/20 text-sm">|</span>

          {/* Project selector dropdown */}
          <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-md cursor-pointer transition-colors max-w-[200px] truncate">
            <span className="text-emerald-400 font-bold font-mono text-[10px]">PROD</span>
            <span className="text-slate-200 font-semibold text-[11px]">tamu-bah-production</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Search Input bar */}
        <div className="hidden md:flex items-center bg-white/10 hover:bg-white/15 focus-within:bg-[#303134] focus-within:text-[#e8eaed] rounded-md px-3 py-1.5 w-full max-w-xl transition-all">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input 
            type="text" 
            placeholder="Search resources, services, APIs, and logs..." 
            className="bg-transparent border-none text-xs w-full focus:outline-none placeholder-white/40 text-[#e8eaed]"
          />
        </div>

        {/* Right tools items */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center bg-white/10 rounded-md px-2 py-0.5 text-[10px] text-slate-300 font-mono">
            <span>Terminal Active (port 3000)</span>
          </div>
          
          <button className="p-1.5 hover:bg-white/10 rounded-full text-slate-200 cursor-pointer relative">
            <Bell className="w-4 h-4 text-slate-300 hover:text-white" />
            {stats && stats.totalReports > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            )}
          </button>
          
          <button className="p-1.5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white cursor-pointer">
            <HelpCircle className="w-4 h-4" />
          </button>
          
          <button className="p-1.5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white cursor-pointer">
            <Settings className="w-4 h-4" />
          </button>
          
          <div className="h-6 w-px bg-white/20"></div>

          {/* User profile dropdown info */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:block text-right">
              <span className="text-[10px] block font-semibold text-slate-200">TamuBah Development Team</span>
              <span className="text-[8px] text-slate-400 block font-mono">Role: System Operator</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[#e8eaed] text-xs shadow-md border border-white/20 uppercase shrink-0">
              T
            </div>
          </div>
        </div>
      </header>

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
                
                {/* Visual Stackdriver Mock Telemetry Graphs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
                  {/* Metric Card 1: Request Count */}
                  <div className="bg-[#202124] border border-[#3c4043] p-4 rounded-md shadow-md flex flex-col justify-between min-h-[220px]">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#9aa0a6] text-[10px] font-bold uppercase tracking-wider block">Request count</span>
                        <span className="text-[9px] text-[#81c995] bg-[#137333]/15 border border-[#137333]/30 px-1.5 py-0.2 rounded font-semibold font-mono">Live</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-2">
                        <span className="text-3xl font-bold font-mono text-[#f1f3f4]">{stats?.visitorCount ?? 0}</span>
                        <span className="text-xs text-[#9aa0a6] font-medium font-mono">total requests</span>
                      </div>
                    </div>
                    
                    {/* SVG Line/Area Graph */}
                    <div className="h-24 w-full relative">
                      <svg className="w-full h-full" viewBox="0 0 280 90" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="blueAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8ab4f8" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#8ab4f8" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Gridlines */}
                        <line x1="0" y1="22" x2="280" y2="22" stroke="#3c4043" strokeDasharray="3,3" />
                        <line x1="0" y1="45" x2="280" y2="45" stroke="#3c4043" strokeDasharray="3,3" />
                        <line x1="0" y1="67" x2="280" y2="67" stroke="#3c4043" strokeDasharray="3,3" />
                        {/* Area */}
                        <path 
                          d="M 0,90 Q 30,85 60,70 T 120,78 T 180,45 T 240,30 T 280,18 L 280,90 Z" 
                          fill="url(#blueAreaGrad)" 
                        />
                        {/* Line */}
                        <path 
                          d="M 0,90 Q 30,85 60,70 T 120,78 T 180,45 T 240,30 T 280,18" 
                          fill="none" 
                          stroke="#8ab4f8" 
                          strokeWidth="2" 
                        />
                        {/* Active tooltip line and point */}
                        <line x1="240" y1="0" x2="240" y2="90" stroke="#8ab4f8" strokeOpacity="0.3" />
                        <circle cx="240" cy="30" r="4" fill="#8ab4f8" stroke="#202124" strokeWidth="1.5" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#2d3033] text-[10px]">
                      <span className="text-[#9aa0a6] font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#81c995]"></span>
                        2xx (OK): 100%
                      </span>
                      <span className="text-slate-500 font-mono">Interval: 1m</span>
                    </div>
                  </div>

                  {/* Metric Card 2: Request Latency */}
                  <div className="bg-[#202124] border border-[#3c4043] p-4 rounded-md shadow-md flex flex-col justify-between min-h-[220px]">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#9aa0a6] text-[10px] font-bold uppercase tracking-wider block">Request latencies</span>
                        <span className="text-[10px] text-[#aecbfa] font-mono">ms</span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-bold font-mono text-[#f1f3f4]">42</span>
                        <span className="text-xs text-[#9aa0a6] font-semibold font-mono">ms p95 avg</span>
                      </div>
                    </div>
                    
                    {/* SVG Multiple Line Graph */}
                    <div className="h-24 w-full relative">
                      <svg className="w-full h-full" viewBox="0 0 280 90" preserveAspectRatio="none">
                        {/* Gridlines */}
                        <line x1="0" y1="22" x2="280" y2="22" stroke="#3c4043" strokeDasharray="3,3" />
                        <line x1="0" y1="45" x2="280" y2="45" stroke="#3c4043" strokeDasharray="3,3" />
                        <line x1="0" y1="67" x2="280" y2="67" stroke="#3c4043" strokeDasharray="3,3" />
                        
                        {/* p50 Line (Light Blue) */}
                        <path 
                          d="M 0,80 Q 40,78 80,75 T 160,72 T 240,74 T 280,71" 
                          fill="none" 
                          stroke="#8ab4f8" 
                          strokeWidth="1.5" 
                          strokeOpacity="0.8"
                        />
                        {/* p95 Line (Purple) */}
                        <path 
                          d="M 0,65 Q 40,55 80,60 T 160,42 T 240,48 T 280,38" 
                          fill="none" 
                          stroke="#c5a3ff" 
                          strokeWidth="1.5" 
                        />
                        {/* p99 Line (Orange) */}
                        <path 
                          d="M 0,45 Q 40,30 80,35 T 160,18 T 240,25 T 280,12" 
                          fill="none" 
                          stroke="#ffbc00" 
                          strokeWidth="1.5" 
                          strokeOpacity="0.8"
                        />
                        <circle cx="240" cy="48" r="3" fill="#c5a3ff" stroke="#202124" strokeWidth="1" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#2d3033] text-[9px] font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-0.5 bg-[#8ab4f8]"></span> p50: 12ms
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-0.5 bg-[#c5a3ff]"></span> p95: 42ms
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-0.5 bg-[#ffbc00]"></span> p99: 135ms
                      </span>
                    </div>
                  </div>

                  {/* Metric Card 3: Container Instance Count */}
                  <div className="bg-[#202124] border border-[#3c4043] p-4 rounded-md shadow-md flex flex-col justify-between min-h-[220px]">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#9aa0a6] text-[10px] font-bold uppercase tracking-wider block">Container instance count</span>
                        <span className="text-[9px] text-[#81c995] font-mono font-bold uppercase">Autoscaled</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-2">
                        <span className="text-3xl font-bold font-mono text-[#f1f3f4]">1</span>
                        <span className="text-xs text-[#9aa0a6] font-semibold font-mono">active instance (max 100)</span>
                      </div>
                    </div>
                    
                    {/* SVG Step Curve Graph showing scale-to-zero when idle */}
                    <div className="h-24 w-full relative">
                      <svg className="w-full h-full" viewBox="0 0 280 90" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="greenAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#81c995" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#81c995" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Gridlines */}
                        <line x1="0" y1="22" x2="280" y2="22" stroke="#3c4043" strokeDasharray="3,3" />
                        <line x1="0" y1="45" x2="280" y2="45" stroke="#3c4043" strokeDasharray="3,3" />
                        <line x1="0" y1="67" x2="280" y2="67" stroke="#3c4043" strokeDasharray="3,3" />
                        {/* Step Area */}
                        <path 
                          d="M 0,90 L 40,90 L 40,55 L 120,55 L 120,25 L 200,25 L 200,55 L 240,55 L 240,90 L 280,90 L 280,90 Z" 
                          fill="url(#greenAreaGrad)" 
                        />
                        {/* Step Line */}
                        <path 
                          d="M 0,90 L 40,90 L 40,55 L 120,55 L 120,25 L 200,25 L 200,55 L 240,55 L 240,90 L 280,90" 
                          fill="none" 
                          stroke="#81c995" 
                          strokeWidth="2" 
                        />
                        <circle cx="160" cy="25" r="3" fill="#81c995" stroke="#202124" strokeWidth="1" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#2d3033] text-[10px]">
                      <span className="text-[#9aa0a6] font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#81c995]"></span>
                        Serving requests
                      </span>
                      <span className="text-slate-500 font-mono text-[9px]">Min: 0 &bull; Max: 100</span>
                    </div>
                  </div>

                  {/* Metric Card 4: CPU & Memory Utilization */}
                  <div className="bg-[#202124] border border-[#3c4043] p-4 rounded-md shadow-md flex flex-col justify-between min-h-[220px]">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#9aa0a6] text-[10px] font-bold uppercase tracking-wider block">Resource utilization</span>
                        <span className="text-[10px] text-slate-400 font-mono">Limits: 2 CPU | 4 GiB</span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-lg font-bold font-mono text-[#f1f3f4]">CPU: 4.8%</span>
                        <span className="text-slate-500 font-semibold text-xs font-sans">|</span>
                        <span className="text-lg font-bold font-mono text-[#f1f3f4]">Mem: 185 MiB</span>
                      </div>
                    </div>
                    
                    {/* SVG Dual CPU/Memory area lines */}
                    <div className="h-24 w-full relative">
                      <svg className="w-full h-full" viewBox="0 0 280 90" preserveAspectRatio="none">
                        {/* Gridlines */}
                        <line x1="0" y1="22" x2="280" y2="22" stroke="#3c4043" strokeDasharray="3,3" />
                        <line x1="0" y1="45" x2="280" y2="45" stroke="#3c4043" strokeDasharray="3,3" />
                        <line x1="0" y1="67" x2="280" y2="67" stroke="#3c4043" strokeDasharray="3,3" />
                        
                        {/* CPU Utilization Line (Blue) */}
                        <path 
                          d="M 0,82 Q 40,78 80,68 T 160,75 T 240,62 T 280,58" 
                          fill="none" 
                          stroke="#8ab4f8" 
                          strokeWidth="1.5" 
                        />
                        {/* Memory Utilization Line (Green) */}
                        <path 
                          d="M 0,60 Q 40,58 80,55 T 160,51 T 240,48 T 280,45" 
                          fill="none" 
                          stroke="#81c995" 
                          strokeWidth="1.5" 
                        />
                        <circle cx="240" cy="62" r="3" fill="#8ab4f8" stroke="#202124" strokeWidth="1" />
                        <circle cx="240" cy="48" r="3" fill="#81c995" stroke="#202124" strokeWidth="1" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#2d3033] text-[9px] font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-0.5 bg-[#8ab4f8]"></span> CPU avg (4.8%)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-0.5 bg-[#81c995]"></span> Memory avg (4.5%)
                      </span>
                    </div>
                  </div>

                  {/* Metric Card 5: Contact Seller Clicks */}
                  <div className="bg-[#202124] border border-[#3c4043] p-4 rounded-md shadow-md flex flex-col justify-between min-h-[220px]">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#9aa0a6] text-[10px] font-bold uppercase tracking-wider block">WhatsApp Clicks</span>
                        <span className="text-[9px] text-[#ffbc00] bg-[#f9ab00]/15 border border-[#f9ab00]/30 px-1.5 py-0.2 rounded font-semibold font-mono">Engagement</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-2">
                        <span className="text-3xl font-bold font-mono text-[#f1f3f4]">{(stats as any)?.contactSellerCount ?? 0}</span>
                        <span className="text-xs text-[#9aa0a6] font-medium font-mono">total clicks</span>
                      </div>
                    </div>
                    
                    {/* SVG Line/Area Graph for Clicks */}
                    <div className="h-24 w-full relative">
                      <svg className="w-full h-full" viewBox="0 0 280 90" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="yellowAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffbc00" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#ffbc00" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Gridlines */}
                        <line x1="0" y1="22" x2="280" y2="22" stroke="#3c4043" strokeDasharray="3,3" />
                        <line x1="0" y1="45" x2="280" y2="45" stroke="#3c4043" strokeDasharray="3,3" />
                        <line x1="0" y1="67" x2="280" y2="67" stroke="#3c4043" strokeDasharray="3,3" />
                        {/* Area */}
                        <path 
                          d="M 0,90 Q 30,80 60,65 T 120,70 T 180,50 T 240,40 T 280,25 L 280,90 Z" 
                          fill="url(#yellowAreaGrad)" 
                        />
                        {/* Line */}
                        <path 
                          d="M 0,90 Q 30,80 60,65 T 120,70 T 180,50 T 240,40 T 280,25" 
                          fill="none" 
                          stroke="#ffbc00" 
                          strokeWidth="2" 
                        />
                        {/* Active tooltip line and point */}
                        <line x1="240" y1="0" x2="240" y2="90" stroke="#ffbc00" strokeOpacity="0.3" />
                        <circle cx="240" cy="40" r="4" fill="#ffbc00" stroke="#202124" strokeWidth="1.5" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#2d3033] text-[10px]">
                      <span className="text-[#9aa0a6] font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#81c995]"></span>
                        Conversion Active
                      </span>
                      <span className="text-slate-500 font-mono text-[9px]">Interval: 1m</span>
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
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3c4043] text-[#bdc1c6]">
                      {filteredSellers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 italic">
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

                {/* Table list */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#3c4043] bg-[#202124] text-[#9aa0a6] font-bold uppercase tracking-wider text-[9px]">
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
                          <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                            No products match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((product) => {
                          const isProductPinned = (product as any).isPinned;
                          return (
                            <tr key={product.id} className="hover:bg-[#2d3033] transition-colors font-mono text-[11px]">
                              <td className="py-4 px-4 font-sans">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded bg-[#2a2b2f] border border-[#3c4043] overflow-hidden shrink-0">
                                    <img src={product.imageUrl} alt="" className="w-full h-full object-cover animate-fade-in" />
                                  </div>
                                  <div className="max-w-xs">
                                    <h4 className="font-bold text-[#e8eaed] text-xs flex items-center gap-1.5">
                                      {product.title}
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
                                <span className="bg-[#2d3033] text-[#bdc1c6] px-2 py-0.5 rounded text-[10px] font-bold font-sans border border-[#3c4043]">
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

          </>
        )}
      </main>

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
