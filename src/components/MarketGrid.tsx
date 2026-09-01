import React, { useState, useEffect } from "react";
import { 
  MapPin, Phone, Layers, AlertCircle, ShoppingBag, 
  ExternalLink, Grid, ArrowUpRight, HelpCircle,
  X, User, ShieldCheck, ShieldAlert, Flag, AlertTriangle,
  Share2, Check, Store, Star, Navigation
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, SABAH_LOCATIONS } from "../types";
import ShareModal from "./ShareModal";
import { useLanguage } from "../lib/LanguageContext";
import { CategoryIcon, getCategoryColor, getCategoryTint } from "../lib/categoryIcons";
import { useCategories } from "../lib/categoryStore";
import StoryBar from "./StoryBar";
import NearMeMap from "./NearMeMap";
import tamubahLogo from "../assets/images/traditional_bag_logo_1784122537315.jpg";

interface MarketGridProps {
  products: Product[];
  loading: boolean;
  onRefreshProducts: () => void;
  selectedLocation?: string;
  onLocationChange?: (location: string) => void;
  initialSearchQuery?: string;
  onViewSellerShop?: (sellerId: string, businessName?: string) => void;
}

interface HeroShopCardProps {
  language: string;
  heroShowcaseProducts: Product[];
  heroShowcaseIndex: number;
  tickerHeightClass: string;
}

// The hero's "shop window" card — a small icon-badge for the TamuBah brand
// (not a full header) so almost all of the card's height goes to actually
// showing off a real product/service, like looking through a shop window
// rather than reading a business card.
function HeroShopCard({ language, heroShowcaseProducts, heroShowcaseIndex, tickerHeightClass }: HeroShopCardProps) {
  const current = heroShowcaseProducts[heroShowcaseIndex];
  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      {/* Slim brand strip — icon-sized logo, not a full header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
        <img src={tamubahLogo} alt="TamuBah" className="w-6 h-6 rounded-full object-cover shrink-0" />
        <span className="font-display font-bold text-slate-900 text-sm">TamuBah</span>
        <span className="flex items-center gap-1 ml-auto text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-bold uppercase tracking-wide">
            {language === "EN" ? "Live" : "Aktif"}
          </span>
        </span>
      </div>

      {/* The shop window itself — the product/service fills almost the
          entire card, full-bleed image with the details captioned over it. */}
      <div className={`relative ${tickerHeightClass} bg-slate-100`}>
        {current ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ duration: 1, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <img src={current.imageUrl} alt={current.title} className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-10 pb-3">
                <p className="text-white font-bold text-base leading-tight truncate">{current.title}</p>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-white/75 text-xs truncate">{current.businessName}</p>
                  <p className="text-white font-bold text-sm shrink-0">RM {current.price?.toFixed(2)}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-slate-400">
              {language === "EN" ? "New listings coming soon" : "Penyenaraian baharu tidak lama lagi"}
            </p>
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        <a href="#market-grid-container" className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 w-fit">
          {language === "EN" ? "Browse all shops" : "Lihat semua kedai"} <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export default function MarketGrid({ 
  products, 
  loading, 
  onRefreshProducts,
  selectedLocation: propSelectedLocation,
  onLocationChange,
  initialSearchQuery,
  onViewSellerShop
}: MarketGridProps) {
  const { t, language } = useLanguage();
  const { categories: BUSINESS_CATEGORIES } = useCategories();
  const [searchQuery, setSearchQuery] = useState(() => {
    if (initialSearchQuery) return initialSearchQuery;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("search") || "";
    }
    return "";
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [showNearMeMap, setShowNearMeMap] = useState(false);
  const [localLocation, setLocalLocation] = useState<string>("All");

  // Hero section timed animation — text shifts left 2s after mount, then a
  // branded shop panel slides in on the right with a rotating live-product
  // showcase. Desktop/tablet only (md:+) — see render below.
  const [heroShifted, setHeroShifted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setHeroShifted(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const heroShowcaseProducts = React.useMemo(() => {
    const eligible = (products || []).filter((p) => p.isAvailable !== false && !!p.imageUrl);
    // Shuffle (not just take the first N) so every available product/service
    // gets a fair chance to appear over time, instead of always looping the
    // same fixed creation-order subset. Re-shuffles whenever the product
    // list itself changes (new listing added/removed).
    const shuffled = [...eligible];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [products]);
  const [heroShowcaseIndex, setHeroShowcaseIndex] = useState(0);
  useEffect(() => {
    if (heroShowcaseProducts.length < 2) return;
    // 2s static display + 1s slide transition = 3s per item, looping forever.
    const interval = setInterval(() => {
      setHeroShowcaseIndex((i) => (i + 1) % heroShowcaseProducts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [heroShowcaseProducts.length]);

  // Auto-play background music on page load
  useEffect(() => {
    const audio = new Audio('/paling-cantik-di-dunia- 3.mp3');
    audio.play().catch((err) => {
      console.log("Audio autoplay blocked or failed:", err);
    });
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);
  
  const selectedLocation = propSelectedLocation !== undefined ? propSelectedLocation : localLocation;
  const setSelectedLocation = (loc: string) => {
    if (onLocationChange) {
      onLocationChange(loc);
    } else {
      setLocalLocation(loc);
    }
  };

  // Unified share modal state
  const [shareModalData, setShareModalData] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    shareUrl: string;
    shareText: string;
  } | null>(null);

  // Shared Link Product details states and hook
  const [sharedProduct, setSharedProduct] = useState<Product | null>(null);
  const [loadingSharedProduct, setLoadingSharedProduct] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      // A shared product link is either the pretty /product/:id path, or
      // the older ?productId=... query param (kept working for any links
      // already shared before the pretty-path rollout).
      const pathMatch = window.location.pathname.match(/^\/product\/([^/]+)/);
      const sharedId = pathMatch ? pathMatch[1] : params.get("productId");
      if (sharedId) {
        setLoadingSharedProduct(true);
        fetch(`/api/products/${sharedId}`)
          .then((res) => {
            if (res.ok) {
              return res.json();
            }
            throw new Error("Product not found");
          })
          .then((data) => {
            setSharedProduct(data);
          })
          .catch((err) => {
            console.error("Error loading shared product:", err);
          })
          .finally(() => {
            setLoadingSharedProduct(false);
          });
      }

      // A shared seller link opened while already on the Market tab (e.g. via
      // client-side navigation) — send them to that seller's real shop.
      const sharedSellerId = params.get("sellerId");
      if (sharedSellerId) {
        onViewSellerShop?.(sharedSellerId);
      }
    }
  }, []);

  const handleCloseSharedProduct = () => {
    setSharedProduct(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("productId");
      const cleanPath = url.pathname.startsWith("/product/") ? "/" : url.pathname;
      window.history.replaceState({}, "", cleanPath + url.search);
    }
  };

  // Open a product's detail view directly from a click on its card — no
  // fetch needed since we already have the product in hand. Also updates
  // the URL so the exact product stays deep-linkable/shareable/refreshable.
  const handleOpenProductDetail = (p: Product) => {
    setSharedProduct(p);
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", `/product/${p.id}`);
    }
  };

  const handleViewSharedProductSeller = () => {
    if (sharedProduct) {
      onViewSellerShop?.(sharedProduct.sellerId, sharedProduct.businessName);
      handleCloseSharedProduct();
    }
  };

  // Pagination and local loading states
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [localLoading, setLocalLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const limit = 100;

  // Debounced search query to prevent excessive database hits on every keystroke
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const fetchLocalProducts = async () => {
    setLocalLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: debouncedSearchQuery,
        category: selectedCategory,
        location: selectedLocation,
      });
      const response = await fetch(`/api/products?${queryParams.toString()}`);
      const data = await response.json();
      if (response.ok) {
        setLocalProducts(data);
        setHasMore(response.headers.get("X-Has-More") === "true" || data.length === limit);
        const total = response.headers.get("X-Total-Count");
        if (total) {
          setTotalCount(parseInt(total));
        }
      }
    } catch (err) {
      console.error("Failed to fetch products in MarketGrid:", err);
    } finally {
      setLocalLoading(false);
    }
  };

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, selectedCategory, selectedLocation]);

  // Fetch when page or filters change
  useEffect(() => {
    fetchLocalProducts();
  }, [page, debouncedSearchQuery, selectedCategory, selectedLocation]);

  // Seller reporting states
  const [reportingProduct, setReportingProduct] = useState<Product | null>(null);
  const [reportReason, setReportReason] = useState<string>("");
  const [reportDescription, setReportDescription] = useState<string>("");
  const [reporterEmail, setReporterEmail] = useState<string>("");
  const [reportSubmitting, setReportSubmitting] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string>("");

  const handleOpenReportModal = (product: Product) => {
    setReportingProduct(product);
    setReportReason("");
    setReportDescription("");
    setReporterEmail("");
    setReportSuccess(false);
    setReportError("");
  };

  const handleCloseReportModal = () => {
    setReportingProduct(null);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason) {
      setReportError("Please select a reason for reporting.");
      return;
    }
    setReportSubmitting(true);
    setReportError("");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId: reportingProduct?.sellerId,
          productId: reportingProduct?.id,
          reason: reportReason,
          description: reportDescription,
          reporterEmail: reporterEmail,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setReportSuccess(true);
        // Refresh products list to show warning alert count if any
        setTimeout(() => {
          onRefreshProducts();
          fetchLocalProducts();
          handleCloseReportModal();
        }, 1500);
      } else {
        setReportError(data.error || "Failed to submit report. Please try again.");
      }
    } catch (err) {
      console.error("Error submitting report:", err);
      setReportError("Network error. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  // Product sharing state and handler
  const [copiedProductId, setCopiedProductId] = useState<string | null>(null);

  const handleShareProduct = async (p: Product) => {
    const shareUrl = `${window.location.origin}/product/${p.id}`;
    const shareText = `Check out "${p.title}" (RM ${p.price.toFixed(2)}) from "${p.businessName}" on TamuBah Sabah Entrepreneur Marketplace! Click here to see it:\n\n${shareUrl}`;

    setShareModalData({
      isOpen: true,
      title: p.title,
      subtitle: `By ${p.businessName} • RM ${p.price.toFixed(2)}`,
      shareUrl,
      shareText: `Check out "${p.title}" (RM ${p.price.toFixed(2)}) from "${p.businessName}" on TamuBah!`
    });

    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedProductId(p.id);
      setTimeout(() => setCopiedProductId(null), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  // Products are filtered and paginated on the database/server side
  const filteredProducts = localProducts;

  // Categories helper for chips
  const categoryChips = ["All", ...BUSINESS_CATEGORIES];

  // Track contact click
  const handleTrackContactClick = async (sellerId: string) => {
    try {
      await fetch(`/api/sellers/${sellerId}/contact-click`, {
        method: "POST"
      });
    } catch (err) {
      console.error("Error tracking contact click:", err);
    }
  };

  // WhatsApp Link formatter
  const getWhatsAppLink = (p: Product) => {
    let cleanPhone = p.contactNumber.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "6" + cleanPhone;
    } else if (cleanPhone.startsWith("1")) {
      cleanPhone = "60" + cleanPhone;
    } else if (cleanPhone.length > 0 && !cleanPhone.startsWith("60")) {
      cleanPhone = "60" + cleanPhone;
    }
    const message = `Hi ${p.sellerName} (${p.businessName}), I saw your product "${p.title}" (RM ${p.price.toFixed(2)}) listed on the Tamu Bah Marketplace and would like to make an inquiry!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div id="market-grid-container" className="max-w-7xl mx-auto px-4 py-8">
      {/* Seller Stories */}
      <div className="mb-8">
        <StoryBar />
      </div>

      {/* Hero Intro Section — mobile: unchanged simple centered layout */}
      <div className="relative text-center max-w-3xl mx-auto mb-12 py-2 md:hidden">
        <div className="absolute inset-0 -mx-6 -my-4 weave-texture rounded-[2.5rem] pointer-events-none" aria-hidden="true"></div>
        <div className="relative flex items-center justify-center gap-3 mb-4">
          <span className="h-px w-8 bg-amber-400/60"></span>
          <span className="text-amber-700 text-[11px] font-bold uppercase tracking-[0.2em]">
            {t("from_sabahan")}
          </span>
          <span className="h-px w-8 bg-amber-400/60"></span>
        </div>
        <h1 className="relative text-4xl font-display font-semibold tracking-tight text-slate-900 leading-[1.08]">
          {language === "EN" ? (
            <>Support Our Local Sabahan <span className="bg-gradient-to-r from-emerald-700 to-amber-600 bg-clip-text text-transparent italic">Business</span></>
          ) : (
            <>Sokong <span className="bg-gradient-to-r from-emerald-700 to-amber-600 bg-clip-text text-transparent italic">Perniagaan</span> Tempatan Orang Kita</>
          )}
        </h1>
        <p className="relative text-slate-500 text-sm mt-4 font-sans leading-relaxed">
          {t("order_authentic")}
        </p>

        {/* Mobile shop showcase — same branded card + rotating live-product
            ticker as desktop, but stacked below the (still centered) text
            instead of sliding in beside it, since there's no room for a
            side-by-side split on a phone screen. Slides up + fades in 2s
            after mount, same trigger as the desktop shift. */}
        <AnimatePresence>
          {heroShifted && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative mt-6 text-left"
            >
              <HeroShopCard
                language={language}
                heroShowcaseProducts={heroShowcaseProducts}
                heroShowcaseIndex={heroShowcaseIndex}
                tickerHeightClass="h-56"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hero Intro Section — desktop/tablet: timed shift + live shop showcase.
          0-2s: centered. After 2s: text shifts left (~56% width), a branded
          TamuBah shop panel slides in from the right (~38% width) with a
          continuously looping live-product ticker inside it. */}
      <div className="hidden md:block relative mb-12 py-10 min-h-[420px]">
        <div className="absolute inset-0 -mx-6 -my-4 weave-texture rounded-[2.5rem] pointer-events-none" aria-hidden="true"></div>
        <div className={`relative flex items-center gap-6 transition-[justify-content] duration-700 ${heroShifted ? "justify-between" : "justify-center"}`}>
          <motion.div
            layout
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className={heroShifted ? "text-left w-[56%]" : "text-center w-full max-w-3xl"}
          >
            <div className={`relative flex items-center gap-3 mb-4 ${heroShifted ? "justify-start" : "justify-center"}`}>
              <span className="h-px w-8 bg-amber-400/60"></span>
              <span className="text-amber-700 text-[11px] font-bold uppercase tracking-[0.2em]">
                {t("from_sabahan")}
              </span>
              {!heroShifted && <span className="h-px w-8 bg-amber-400/60"></span>}
            </div>
            <h1 className="relative text-5xl lg:text-6xl font-display font-semibold tracking-tight text-slate-900 leading-[1.08]">
              {language === "EN" ? (
                <>Support Our Local Sabahan <span className="bg-gradient-to-r from-emerald-700 to-amber-600 bg-clip-text text-transparent italic">Business</span></>
              ) : (
                <>Sokong <span className="bg-gradient-to-r from-emerald-700 to-amber-600 bg-clip-text text-transparent italic">Perniagaan</span> Tempatan Orang Kita</>
              )}
            </h1>
            <p className="relative text-slate-500 text-base mt-4 font-sans leading-relaxed max-w-xl">
              {t("order_authentic")}
            </p>
          </motion.div>

          <AnimatePresence>
            {heroShifted && (
              <motion.div
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 60 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                className="w-[38%] shrink-0"
              >
                <HeroShopCard
                  language={language}
                  heroShowcaseProducts={heroShowcaseProducts}
                  heroShowcaseIndex={heroShowcaseIndex}
                  tickerHeightClass="h-72"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Minimalist Filter Bar: category icons + location */}
      <div className="bg-white rounded-3xl p-4 md:p-5 shadow-md border border-slate-100 mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-4">

          {/* Category chips — icon + name label, so categories are identifiable
              at a glance instead of relying on icon shape alone */}
          <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            {categoryChips.map((cat) => {
              const label = cat === "All" ? t("all_categories") : (t(cat) !== cat ? t(cat) : cat.replace(/&/g, " & "));
              return (
                <button
                  key={cat}
                  id={`category-chip-${cat.replace(/\s+/g, "-")}`}
                  onClick={() => setSelectedCategory(cat)}
                  title={label}
                  className={`h-11 shrink-0 rounded-2xl flex items-center gap-2 px-4 transition-all cursor-pointer border whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-sm scale-105"
                      : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {cat === "All" ? (
                    <Grid className="w-5 h-5 shrink-0" />
                  ) : (
                    <CategoryIcon category={cat} className="w-5 h-5 shrink-0" />
                  )}
                  <span className="text-sm font-semibold">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Location */}
          <div className="relative w-full md:w-56 shrink-0">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <MapPin className="w-4 h-4" />
            </span>
            <select
              id="market-location-select"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm font-medium appearance-none"
            >
              <option value="All">{t("all_districts")}</option>
              {SABAH_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* "Near Me" live map — shows nearby sellers on an actual map
              instead of just filtering by district */}
          <button
            id="near-me-button"
            onClick={() => setShowNearMeMap(true)}
            title={language === "EN" ? "Shops Near Me" : "Kedai Berhampiran Saya"}
            className="h-11 shrink-0 rounded-2xl flex items-center gap-2 px-4 border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all cursor-pointer whitespace-nowrap"
          >
            <Navigation className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">{language === "EN" ? "Near Me" : "Berhampiran"}</span>
          </button>
        </div>

        {/* Active search chip (search itself lives in the header) */}
        {searchQuery && (
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full pl-3 pr-1.5 py-1 text-xs font-semibold">
              {language === "EN" ? "Searching" : "Mencari"}: "{searchQuery}"
              <button
                onClick={() => setSearchQuery("")}
                className="w-4 h-4 rounded-full bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          </div>
        )}
      </div>

      {selectedCategory === "Transport & Runners" && (
        <div id="services-runners-warning-banner" className="mb-6 bg-amber-50 border border-amber-200 rounded-3xl p-5 flex items-start gap-3.5 text-amber-900 shadow-sm animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="bg-amber-100 text-amber-800 rounded-2xl p-2 shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm tracking-tight text-amber-950 font-sans mb-1">
              {t("safety_disclaimer_title")}
            </h4>
            <p className="text-xs leading-relaxed text-amber-850 font-sans">
              <strong>TamuBah {language === "EN" ? "is a directory only." : "adalah direktori sahaja."}</strong> {t("safety_disclaimer_desc")}
            </p>
          </div>
        </div>
      )}

      {/* Product Grid Listings */}
      {(loading || localLoading) ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <svg className="animate-spin h-8 w-8 text-emerald-600 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-semibold">{t("tuning_market")}</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4 border border-slate-100">
            <ShoppingBag className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">{t("no_products_found")}</h3>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">
            {language === "EN" 
              ? `We couldn't find any listings matching "${searchQuery}" in ${selectedLocation === "All" ? "Sabah" : selectedLocation}. Try broadening your search or selection!`
              : `Kami tidak menemui sebarang senarai yang sepadan dengan "${searchQuery}" di ${selectedLocation === "All" ? "Sabah" : selectedLocation}. Cuba luaskan carian atau pilihan anda!`
            }
          </p>
          <button
            id="reset-filters-btn"
            onClick={() => { setSearchQuery(""); setSelectedCategory("All"); setSelectedLocation("All"); }}
            className="mt-5 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            {t("reset_filters")}
          </button>
        </div>
      ) : (
        <div>
          {/* Active stats */}
          <div className="flex justify-between items-center mb-6">
            <p className="text-xs text-slate-500 font-sans">
              {t("showing_items_count", { count: filteredProducts.length })}
            </p>
          </div>

          {/* Product cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                id={`market-product-card-${p.id}`}
                style={{ backgroundColor: getCategoryTint(p.category, 0.05), borderColor: getCategoryTint(p.category, 0.35) }}
                className="group rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-full relative"
              >
                {/* Category accent bar */}
                <div className="h-1 w-full shrink-0" style={{ backgroundColor: getCategoryColor(p.category) }} />

                {/* Image Section — click to view this product */}
                <div
                  onClick={() => handleOpenProductDetail(p)}
                  className="h-28 sm:h-32 overflow-hidden relative bg-slate-50 shrink-0 cursor-pointer"
                  title={`View ${p.title}`}
                >
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Category Chip overlay */}
                  <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-1">
                    <span className="bg-slate-900/85 backdrop-blur-md text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider line-clamp-1 max-w-[90px] flex items-center gap-1">
                      <CategoryIcon category={p.category} className="w-2.5 h-2.5 shrink-0" />
                      {p.category}
                    </span>
                  </div>

                  {/* Availability Badge overlay */}
                  <div className="absolute top-1.5 right-1.5 z-10">
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm ${
                      p.isAvailable 
                        ? "bg-emerald-500 text-white" 
                        : "bg-slate-600 text-slate-100"
                    }`}>
                      {p.isAvailable ? t("available") : t("sold_out")}
                    </span>
                  </div>
                </div>

                {/* Card Info Content */}
                <div className="p-2.5 flex flex-col flex-grow">
                  {/* Price and Title — click to view this product */}
                  <div onClick={() => handleOpenProductDetail(p)} className="cursor-pointer" title={`View ${p.title}`}>
                    <h3 className="font-bold text-slate-900 text-xs group-hover:text-emerald-700 transition-colors leading-snug line-clamp-2 mb-1">
                      {p.title}
                    </h3>
                    <span className="text-xs font-extrabold text-slate-900 shrink-0 bg-amber-50 text-amber-950 px-1.5 py-0.5 rounded-md border border-amber-200 w-fit mb-2">
                      RM {p.price.toFixed(2)}
                    </span>
                  </div>

                  {/* Seller Brand & Info */}
                  <div className="border-t border-slate-50 pt-2 flex flex-col gap-1.5 mt-auto">
                    <button
                      type="button"
                      onClick={() => onViewSellerShop?.(p.sellerId, p.businessName)}
                      title={`Click to view ${p.businessName} full business profile`}
                      className="flex items-center gap-1 cursor-pointer text-left group/btn hover:opacity-90"
                    >
                      <div className="w-4 h-4 rounded overflow-hidden bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-[7px] font-bold text-emerald-800 shrink-0">
                        {p.sellerLogoUrl ? (
                          <img src={p.sellerLogoUrl} alt={p.businessName} referrerPolicy="no-referrer" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          p.businessName.charAt(0)
                        )}
                      </div>
                      <span className="font-bold text-slate-700 group-hover/btn:text-emerald-700 transition-colors line-clamp-1 text-[9px] flex items-center gap-0.5 min-w-0">
                        {p.businessName}
                        {p.sellerVerificationTier === "Gold" ? (
                          <ShieldCheck className="w-2.5 h-2.5 shrink-0" style={{ color: "#0f9d58" }} title="Gold Verified Seller" />
                        ) : p.sellerVerificationTier === "Silver" ? (
                          <ShieldCheck className="w-2.5 h-2.5 shrink-0" style={{ color: "#c0c0c0" }} title="Silver Verified Seller" />
                        ) : p.sellerVerificationTier === "Bronze" ? (
                          <ShieldCheck className="w-2.5 h-2.5 shrink-0" style={{ color: "#cd7f32" }} title="Bronze Verified Seller" />
                        ) : p.sellerVerificationTier === "Licensed" ? (
                          <ShieldCheck className="w-2.5 h-2.5 shrink-0" style={{ color: "#059669" }} title="Licensed Verified Business" />
                        ) : null}
                      </span>
                    </button>

                    <span className="flex items-center gap-0.5 text-slate-500 text-[8px] font-medium">
                      <MapPin className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                      <span className="line-clamp-1">{p.availableArea}</span>
                    </span>

                    {/* Report Warnings if seller has been flagged */}
                    {p.reportCount && p.reportCount > 0 ? (
                      <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-lg p-1.5 flex items-start gap-1 text-[8px] leading-snug">
                        <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          Reported <span className="font-extrabold text-rose-700">{p.reportCount}x</span>
                        </div>
                      </div>
                    ) : null}

                    {/* WhatsApp Contact & Report Actions */}
                    <div className="flex gap-1">
                      <a
                        id={`whatsapp-link-${p.id}`}
                        href={getWhatsAppLink(p)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleTrackContactClick(p.sellerId)}
                        className={`flex-grow py-1.5 px-2 rounded-lg font-bold text-[9px] flex items-center justify-center gap-1 transition-all border ${
                          p.isAvailable
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 hover:shadow-md cursor-pointer"
                            : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed pointer-events-none"
                        }`}
                      >
                        <Phone className="w-3 h-3 shrink-0" />
                        {p.isAvailable ? t("order_whatsapp") : t("sold_out")}
                      </a>

                      <button
                        type="button"
                        onClick={() => handleShareProduct(p)}
                        className={`px-1.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                          copiedProductId === p.id
                            ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                            : "border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
                        }`}
                        title={copiedProductId === p.id ? "Link Copied!" : "Share this product with friends"}
                      >
                        {copiedProductId === p.id ? (
                          <Check className="w-3 h-3 shrink-0" />
                        ) : (
                          <Share2 className="w-3 h-3 shrink-0" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenReportModal(p)}
                        className="px-1.5 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer flex items-center justify-center shrink-0"
                        title="Report scam or fraudulent behavior"
                      >
                        <Flag className="w-3 h-3 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>

          {/* Public Feed Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-12 bg-white rounded-3xl p-5 shadow-md border border-slate-100 select-none">
            <div className="text-xs text-slate-500 font-sans">
              Showing <span className="font-bold text-slate-800">{filteredProducts.length}</span> of up to <span className="font-bold text-slate-800">{totalCount}</span> homemade items in Sabah
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => {
                  setPage((prev) => Math.max(prev - 1, 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`px-5 py-3 rounded-2xl border font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  page === 1
                    ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95"
                }`}
              >
                Previous Page
              </button>
              <span className="text-xs font-bold text-slate-800 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl min-w-[40px] text-center">
                {page}
              </span>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => {
                  if (hasMore) {
                    setPage((prev) => prev + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className={`px-5 py-3 rounded-2xl border font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  !hasMore
                    ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                    : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-sm"
                }`}
              >
                Next Page
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Report Seller Modal Overlay */}
      {reportingProduct && (
        <div id="report-seller-modal-overlay" className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden text-slate-800">
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-rose-900 to-red-950 p-5 text-white relative">
              <button
                type="button"
                id="close-report-modal-btn"
                onClick={handleCloseReportModal}
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-1.5 transition-colors cursor-pointer"
                title="Close Report Form"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-rose-300" />
                <h3 className="font-extrabold text-lg leading-tight">
                  Report Suspicious Behavior
                </h3>
              </div>
              <p className="text-xs text-rose-100 mt-1">
                Help keep the Sabah Entrepreneur community safe. Your reports are evaluated securely.
              </p>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitReport} className="p-6 space-y-4">
              {reportSuccess ? (
                <div className="py-6 text-center space-y-3 animate-in zoom-in-95">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Report Submitted</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed px-4">
                      Thank you. We have received your report for <span className="font-bold text-slate-700">{reportingProduct.businessName}</span>. Our administrators will review the provided details to maintain safety.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-rose-50/50 border border-rose-100/65 rounded-xl p-3 flex gap-2.5 items-start text-xs text-slate-600 leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      Reporting business: <span className="font-bold text-slate-800">{reportingProduct.businessName}</span> (Owner: {reportingProduct.sellerName}).
                    </div>
                  </div>

                  {reportError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>{reportError}</span>
                    </div>
                  )}

                  {/* Reason Selection */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Reason for Report <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="report-reason-select"
                      required
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 px-3.5 py-2.5 bg-white shadow-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-slate-800"
                    >
                      <option value="">-- Choose a safety reason --</option>
                      <option value="scam_attempt">Suspicious behavior / suspected fraud scammer</option>
                      <option value="fake_info">Incorrect contact number / misleading physical base</option>
                      <option value="abuse_spam">Price gouging or commercial spamming listing</option>
                      <option value="wrong_category">Invalid/Inappropriate product category</option>
                      <option value="other">Other policy violations</option>
                    </select>
                  </div>

                  {/* Reporter Email */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Your Email Address (Confidential)
                    </label>
                    <input
                      id="report-email-input"
                      type="email"
                      required
                      placeholder="e.g. buyer@example.com"
                      value={reporterEmail}
                      onChange={(e) => setReporterEmail(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 px-3.5 py-2.5 shadow-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-slate-800"
                    />
                    <p className="text-[10px] text-slate-400">
                      Your contact information remains strictly hidden from the seller.
                    </p>
                  </div>

                  {/* Explanation description */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Detail of Suspicious Incident <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="report-description-textarea"
                      required
                      rows={3}
                      placeholder="Describe what occurred. Mention if they asked for advance bank transfers before delivery, if the contact number is fake, or any other warning signs..."
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 px-3.5 py-2.5 shadow-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-slate-800"
                    />
                  </div>

                  {/* Warnings Notice */}
                  <div className="text-[10px] text-slate-400 leading-normal border-t border-slate-100 pt-3 bg-slate-50 p-2.5 rounded-xl">
                    By submitting, you certify this is an honest report. False reports for malicious commercial competition reasons may result in immediate access restriction.
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      id="cancel-report-btn"
                      onClick={handleCloseReportModal}
                      disabled={reportSubmitting}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer text-center disabled:opacity-55"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      id="submit-report-btn"
                      disabled={reportSubmitting}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1 text-xs cursor-pointer disabled:opacity-55"
                    >
                      {reportSubmitting ? "Submitting..." : "Submit Report"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Shared Product Highlight Modal */}
      <AnimatePresence>
        {sharedProduct && (
          <div
            id="shared-product-modal-backdrop"
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleCloseSharedProduct}
          >
            <motion.div
              id="shared-product-modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full border border-slate-100 flex flex-col md:flex-row text-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image Section */}
              <div className="w-full md:w-1/2 h-64 md:h-auto bg-slate-50 relative min-h-[250px]">
                <img
                  src={sharedProduct.imageUrl}
                  alt={sharedProduct.title}
                  referrerPolicy="no-referrer"
                  decoding="async"
                  className="w-full h-full object-cover absolute inset-0"
                />
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
                  <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                    <CategoryIcon category={sharedProduct.category} className="w-3 h-3 shrink-0" />
                    {sharedProduct.category}
                  </span>
                </div>
                <div className="absolute top-4 right-4 z-10">
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full shadow-sm ${
                    sharedProduct.isAvailable 
                      ? "bg-emerald-500 text-white" 
                      : "bg-slate-600 text-slate-100"
                  }`}>
                    {sharedProduct.isAvailable ? "Available" : "Sold Out"}
                  </span>
                </div>
              </div>

              {/* Info Section */}
              <div className="p-6 md:p-8 w-full md:w-1/2 flex flex-col justify-between">
                <div>
                  {/* Close button */}
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider">
                      Shared Link Item
                    </span>
                    <button
                      type="button"
                      onClick={handleCloseSharedProduct}
                      className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Title and Price */}
                  <h3 className="font-bold text-slate-950 text-lg md:text-xl leading-snug mb-2">
                    {sharedProduct.title}
                  </h3>
                  <div className="text-xl font-black text-emerald-700 font-mono mb-4">
                    RM {sharedProduct.price.toFixed(2)}
                  </div>

                  {/* Description */}
                  <p className="text-slate-600 text-xs leading-relaxed mb-6 bg-slate-50 p-3 rounded-2xl border border-slate-100 max-h-36 overflow-y-auto">
                    {sharedProduct.description}
                  </p>

                  {/* Seller Details Card */}
                  <div className="bg-emerald-50/40 border border-emerald-100/60 rounded-2xl p-3.5 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-emerald-200 flex items-center justify-center font-bold text-emerald-800 text-sm shrink-0 shadow-sm">
                        {sharedProduct.sellerLogoUrl ? (
                          <img src={sharedProduct.sellerLogoUrl} alt={sharedProduct.businessName} referrerPolicy="no-referrer" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          sharedProduct.businessName.charAt(0)
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-extrabold text-slate-900 text-xs truncate flex items-center gap-1">
                          {sharedProduct.businessName}
                          {sharedProduct.sellerVerificationTier === "Gold" ? (
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "#0f9d58" }} />
                          ) : sharedProduct.sellerVerificationTier === "Silver" ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          ) : sharedProduct.sellerVerificationTier === "Bronze" ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          ) : sharedProduct.sellerVerificationTier === "Licensed" ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : null}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium truncate">
                          By {sharedProduct.sellerName} • {sharedProduct.availableArea}
                        </p>
                        {sharedProduct.sellerAverageRating && sharedProduct.sellerAverageRating > 0 ? (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded w-max">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
                            <span>{sharedProduct.sellerAverageRating.toFixed(1)} ({sharedProduct.sellerReviewCount})</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct Actions */}
                <div className="space-y-2">
                  <a
                    href={getWhatsAppLink(sharedProduct)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleTrackContactClick(sharedProduct.sellerId)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    Contact Seller on WhatsApp
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  </a>

                  <button
                    type="button"
                    onClick={handleViewSharedProductSeller}
                    className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Store className="w-4 h-4 text-emerald-600" />
                    View Business Profile & Ratings
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleCloseSharedProduct}
                    className="w-full text-slate-400 hover:text-slate-600 font-semibold text-[11px] pt-1.5 text-center cursor-pointer hover:underline"
                  >
                    Browse Other Products
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {shareModalData && (
        <ShareModal
          isOpen={shareModalData.isOpen}
          onClose={() => setShareModalData(null)}
          title={shareModalData.title}
          subtitle={shareModalData.subtitle}
          shareUrl={shareModalData.shareUrl}
          shareText={shareModalData.shareText}
        />
      )}

      <NearMeMap
        open={showNearMeMap}
        onClose={() => setShowNearMeMap(false)}
        onViewSellerShop={onViewSellerShop}
      />

    </div>
  );
}
