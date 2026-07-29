import React, { useState, useEffect } from "react";
import { 
  Search, MapPin, Phone, Layers, AlertCircle, ShoppingBag, 
  ExternalLink, SlidersHorizontal, ArrowUpRight, HelpCircle,
  X, Building, Calendar, User, Briefcase, FileText, ShieldCheck, ShieldAlert, Flag, AlertTriangle,
  Share2, Check, Store, Star, CheckCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, SABAH_LOCATIONS, BUSINESS_CATEGORIES } from "../types";
import ShareModal from "./ShareModal";
import { useLanguage } from "../lib/LanguageContext";
import { CategoryIcon, getCategoryColor, getCategoryTint } from "../lib/categoryIcons";

interface MarketGridProps {
  products: Product[];
  loading: boolean;
  onRefreshProducts: () => void;
  selectedLocation?: string;
  onLocationChange?: (location: string) => void;
}

export default function MarketGrid({ 
  products, 
  loading, 
  onRefreshProducts,
  selectedLocation: propSelectedLocation,
  onLocationChange
}: MarketGridProps) {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("search") || "";
    }
    return "";
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sellersList, setSellersList] = useState<any[]>([]);
  const [localLocation, setLocalLocation] = useState<string>("All");
  
  const selectedLocation = propSelectedLocation !== undefined ? propSelectedLocation : localLocation;
  const setSelectedLocation = (loc: string) => {
    if (onLocationChange) {
      onLocationChange(loc);
    } else {
      setLocalLocation(loc);
    }
  };

  const [showFilters, setShowFilters] = useState(true);
  const [selectedSellerProfile, setSelectedSellerProfile] = useState<Product | null>(null);

  // Unified share modal state
  const [shareModalData, setShareModalData] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    shareUrl: string;
    shareText: string;
  } | null>(null);

  const handleOpenSellerProfile = (p: Product) => {
    setSelectedSellerProfile(p);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("sellerId", p.sellerId);
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  };

  const handleCloseSellerProfile = () => {
    setSelectedSellerProfile(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("sellerId");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  };

  // Shared Link Product details states and hook
  const [sharedProduct, setSharedProduct] = useState<Product | null>(null);
  const [loadingSharedProduct, setLoadingSharedProduct] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sharedId = params.get("productId");
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

      // Load shared seller profile
      const sharedSellerId = params.get("sellerId");
      if (sharedSellerId) {
        fetch(`/api/sellers/${sharedSellerId}`)
          .then((res) => {
            if (res.ok) {
              return res.json();
            }
            throw new Error("Seller profile not found");
          })
          .then((data) => {
            if (data.success && data.seller) {
              const mappedProfile: Product = {
                id: `temp-${data.seller.id}`,
                title: "",
                category: data.seller.category || "Food&Tamu",
                description: "",
                price: 0,
                imageUrl: "",
                isAvailable: true,
                createdAt: new Date().toISOString(),
                sellerId: data.seller.id,
                sellerName: data.seller.ownerName,
                businessName: data.seller.businessName,
                availableArea: data.seller.location,
                contactNumber: data.seller.phoneNumber,
                address: data.seller.address,
                sellerLogoUrl: data.seller.logoUrl,
                sellerDream: data.seller.dream,
                sellerEstablishedYear: data.seller.establishedYear,
                sellerIsVerified: !!data.seller.isVerified,
                sellerIsApproved: !!data.seller.isApproved,
                sellerVerificationTier: data.seller.verificationTier || "None",
                ssmNumber: data.seller.ssmNumber,
                reportCount: data.seller.reportCount || 0,
                sellerAverageRating: data.seller.averageRating || 0,
                sellerReviewCount: data.seller.reviewCount || 0
              };
              setSelectedSellerProfile(mappedProfile);
            }
          })
          .catch((err) => {
            console.error("Error loading shared seller profile:", err);
          });
      }
    }
  }, []);

  const handleCloseSharedProduct = () => {
    setSharedProduct(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("productId");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  };

  const handleViewSharedProductSeller = () => {
    if (sharedProduct) {
      handleOpenSellerProfile(sharedProduct);
      handleCloseSharedProduct();
    }
  };

  // Seller Profile Review States
  const [sellerReviews, setSellerReviews] = useState<any[]>([]);
  const [loadingSellerReviews, setLoadingSellerReviews] = useState<boolean>(false);
  const [submittingSellerReview, setSubmittingSellerReview] = useState<boolean>(false);
  const [sellerRatingInput, setSellerRatingInput] = useState<number>(5);
  const [sellerReviewerName, setSellerReviewerName] = useState<string>("");
  const [sellerCommentInput, setSellerCommentInput] = useState<string>("");
  const [sellerReviewSuccess, setSellerReviewSuccess] = useState<string>("");
  const [sellerReviewError, setSellerReviewError] = useState<string>("");

  useEffect(() => {
    if (selectedSellerProfile) {
      fetchSellerReviews(selectedSellerProfile.sellerId);
      // Reset form fields
      setSellerRatingInput(5);
      setSellerReviewerName("");
      setSellerCommentInput("");
      setSellerReviewSuccess("");
      setSellerReviewError("");
    } else {
      setSellerReviews([]);
    }
  }, [selectedSellerProfile]);

  const fetchSellerReviews = async (sellerId: string) => {
    setLoadingSellerReviews(true);
    try {
      const res = await fetch(`/api/sellers/${sellerId}/reviews`);
      const data = await res.json();
      if (res.ok) {
        setSellerReviews(data);
      }
    } catch (err) {
      console.error("Error fetching seller reviews:", err);
    } finally {
      setLoadingSellerReviews(false);
    }
  };

  const handleSellerReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSellerProfile) return;
    if (!sellerReviewerName.trim()) {
      setSellerReviewError("Please enter your name.");
      return;
    }

    setSubmittingSellerReview(true);
    setSellerReviewSuccess("");
    setSellerReviewError("");

    try {
      const res = await fetch(`/api/sellers/${selectedSellerProfile.sellerId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: sellerRatingInput,
          comment: sellerCommentInput,
          reviewerName: sellerReviewerName
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSellerReviewSuccess("Thank you for your rating and feedback!");
        setSellerReviewerName("");
        setSellerCommentInput("");
        setSellerRatingInput(5);
        fetchSellerReviews(selectedSellerProfile.sellerId);
        // Refresh products list
        onRefreshProducts();
        fetchLocalProducts();
      } else {
        setSellerReviewError(data.error || "Failed to submit review.");
      }
    } catch (err) {
      console.error("Error submitting review:", err);
      setSellerReviewError("Failed to connect to the server.");
    } finally {
      setSubmittingSellerReview(false);
    }
  };

  // Pagination and local loading states
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const [localLoading, setLocalLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const limit = 50;

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

  // Real-time seller counts for promo tracking
  const [sellerCount, setSellerCount] = useState<number>(0);
  const [loadingSellers, setLoadingSellers] = useState<boolean>(true);

  useEffect(() => {
    fetch("/api/sellers")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSellersList(data);
          setSellerCount(data.length);
        }
      })
      .catch((err) => console.error("Failed to load sellers list in MarketGrid", err))
      .finally(() => setLoadingSellers(false));
  }, [localProducts]);

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
    const shareUrl = `${window.location.origin}/?productId=${p.id}`;
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

  // Seller profile sharing state and handler
  const [copiedSellerId, setCopiedSellerId] = useState<string | null>(null);

  const handleShareSellerProfile = async (sellerId: string, businessName: string) => {
    const shareUrl = `${window.location.origin}/?sellerId=${sellerId}`;
    const shareText = `Check out "${businessName}" on TamuBah Sabah Entrepreneur Marketplace! View their home-based products and ratings here:\n\n${shareUrl}`;

    setShareModalData({
      isOpen: true,
      title: businessName,
      subtitle: "Sabah Home-based Business",
      shareUrl,
      shareText: `Check out "${businessName}" on TamuBah! View their home-based products and ratings here:`
    });

    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedSellerId(sellerId);
      setTimeout(() => setCopiedSellerId(null), 2000);
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
      {/* Hero Intro Section */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-4 py-1.5 rounded-full border border-emerald-200/50 uppercase tracking-widest inline-block mb-3">
          {t("from_sabahan")}
        </span>
        <h1 className="text-3xl md:text-5xl font-extrabold font-sans tracking-tight text-slate-900 leading-tight">
          {language === "EN" ? (
            <>Support Our Local Sabahan <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Business</span></>
          ) : (
            <>Sokong <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Perniagaan</span> Tempatan Orang Kita</>
          )}
        </h1>
        <p className="text-slate-500 text-sm md:text-base mt-4 font-sans leading-relaxed">
          {t("order_authentic")}
        </p>
      </div>

      {/* Real-time Promotion spots alert banner */}
      <div className="max-w-4xl mx-auto mb-10 bg-gradient-to-br from-emerald-800 to-teal-900 rounded-3xl p-6 text-white shadow-lg border border-emerald-500/20 relative overflow-hidden">
        {/* Decorative ambient elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-emerald-500/30 text-emerald-100 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border border-white/10">
                  {t("promo_badge")}
                </span>
                <span className="text-[10px] text-teal-100 font-bold bg-white/10 px-2 py-0.5 rounded">
                  {t("promo_sub")}
                </span>
              </div>
              <h3 className="font-extrabold text-white text-base md:text-lg tracking-tight mt-1.5 leading-tight font-sans">
                {t("promo_title")}
              </h3>
              <p className="text-emerald-100/90 text-xs mt-1 leading-relaxed max-w-xl">
                {t("promo_desc")}
              </p>
            </div>
          </div>
          
          {/* Real-time Counter Badge */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center shrink-0 w-full md:w-auto min-w-[180px]">
            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
              {t("promo_onboarded")}
            </div>
            <div className="text-3xl font-black text-white my-1 flex items-baseline justify-center gap-1.5">
              <span>{loadingSellers ? "..." : sellerCount}</span>
              <span className="text-emerald-300 text-xs font-semibold">/ 100</span>
            </div>
            <div className="text-[10px] font-black uppercase text-emerald-200 bg-emerald-800/40 px-2 py-1 rounded-lg border border-emerald-500/20 inline-block">
              {100 - sellerCount > 0 ? `${100 - sellerCount} ${t("slots_remaining")}` : t("promo_sold_out")}
            </div>
          </div>
        </div>
      </div>

      {/* Main Search and Filter Section */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-md border border-slate-100 mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          
          {/* Search Input */}
          <div className="relative w-full md:flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <Search className="w-5 h-5" />
            </span>
            <input
              id="market-search-input"
              type="text"
              placeholder={t("search_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm"
            />
          </div>

          {/* Quick Location Filter Dropdown */}
          <div className="relative w-full md:w-64">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <MapPin className="w-4 h-4" />
            </span>
            <select
              id="market-location-select"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm font-medium appearance-none"
            >
              <option value="All">{t("all_districts")}</option>
              {SABAH_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Expand Filters Button */}
          <button
            id="toggle-filters-btn"
            onClick={() => setShowFilters(!showFilters)}
            className={`w-full md:w-auto px-5 py-3 rounded-2xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all cursor-pointer ${
              showFilters 
                ? "bg-slate-900 border-slate-900 text-white" 
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {t("category_filters")}
          </button>
        </div>

        {/* Dynamic Category Chips (shown by default or toggleable) */}
        {showFilters && (
          <div className="mt-5 pt-5 border-t border-slate-50">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
              {t("browse_by_category")}
            </span>
            <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-2.5">
              {categoryChips.map((cat) => (
                <button
                  key={cat}
                  id={`category-chip-${cat.replace(/\s+/g, "-")}`}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-3 rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 border ${
                    selectedCategory === cat
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                      : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <CategoryIcon category={cat} className="w-9 h-9 shrink-0" />
                  <span className="text-[10px] font-semibold text-center leading-tight line-clamp-2">
                    {cat === "All" ? t("all_categories") : t(cat)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedCategory === "Services&Runners" && (
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

                {/* Image Section */}
                <div className="h-28 sm:h-32 overflow-hidden relative bg-slate-50 shrink-0">
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    referrerPolicy="no-referrer"
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
                  {/* Price and Title */}
                  <h3 className="font-bold text-slate-900 text-xs group-hover:text-emerald-700 transition-colors leading-snug line-clamp-2 mb-1">
                    {p.title}
                  </h3>
                  <span className="text-xs font-extrabold text-slate-900 shrink-0 bg-amber-50 text-amber-950 px-1.5 py-0.5 rounded-md border border-amber-200 w-fit mb-2">
                    RM {p.price.toFixed(2)}
                  </span>

                  {/* Seller Brand & Info */}
                  <div className="border-t border-slate-50 pt-2 flex flex-col gap-1.5 mt-auto">
                    <button
                      type="button"
                      onClick={() => handleOpenSellerProfile(p)}
                      title={`Click to view ${p.businessName} full business profile`}
                      className="flex items-center gap-1 cursor-pointer text-left group/btn hover:opacity-90"
                    >
                      <div className="w-4 h-4 rounded overflow-hidden bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-[7px] font-bold text-emerald-800 shrink-0">
                        {p.sellerLogoUrl ? (
                          <img src={p.sellerLogoUrl} alt={p.businessName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          p.businessName.charAt(0)
                        )}
                      </div>
                      <span className="font-bold text-slate-700 group-hover/btn:text-emerald-700 transition-colors line-clamp-1 text-[9px] flex items-center gap-0.5 min-w-0">
                        {p.businessName}
                        {p.sellerVerificationTier === "Gold" ? (
                          <ShieldCheck className="w-2.5 h-2.5 shrink-0" style={{ color: "#d4af37" }} title="Gold Licensed Seller" />
                        ) : p.sellerVerificationTier === "Silver" ? (
                          <ShieldCheck className="w-2.5 h-2.5 shrink-0" style={{ color: "#c0c0c0" }} title="Silver Licensed Seller" />
                        ) : p.sellerVerificationTier === "Bronze" ? (
                          <ShieldCheck className="w-2.5 h-2.5 shrink-0" style={{ color: "#cd7f32" }} title="Bronze Licensed Seller" />
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

      {/* Seller Profile Details Modal */}
      {selectedSellerProfile && (
        <div id="seller-profile-modal-overlay" className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
            {/* Header banner */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 text-white relative">
              <button
                type="button"
                id="close-profile-modal-btn"
                onClick={handleCloseSellerProfile}
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-1.5 transition-colors cursor-pointer"
                title="Close Profile"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-emerald-500 bg-white/10 shrink-0 flex items-center justify-center relative">
                  {selectedSellerProfile.sellerLogoUrl ? (
                    <img 
                      src={selectedSellerProfile.sellerLogoUrl} 
                      alt={selectedSellerProfile.businessName} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <Building className="w-8 h-8 text-emerald-400" />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  {selectedSellerProfile.sellerVerificationTier === "Gold" ? (
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider bg-amber-950/40 px-2.5 py-1 rounded-md w-fit border border-[#d4af37]/30" style={{ color: "#d4af37" }}>
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "#d4af37" }} />
                      <span>Gold Licensed Seller</span>
                    </div>
                  ) : selectedSellerProfile.sellerVerificationTier === "Silver" ? (
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider bg-slate-900/40 px-2.5 py-1 rounded-md w-fit border border-[#c0c0c0]/30" style={{ color: "#c0c0c0" }}>
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "#c0c0c0" }} />
                      <span>Silver Licensed Seller</span>
                    </div>
                  ) : selectedSellerProfile.sellerVerificationTier === "Bronze" ? (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-orange-950/40 px-2.5 py-1 rounded-md w-fit border border-[#cd7f32]/30" style={{ color: "#cd7f32" }}>
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "#cd7f32" }} />
                      <span>Bronze Licensed Seller</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-950/50 px-2.5 py-1 rounded-md w-fit border border-slate-800">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Unverified Home Seller</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <h3 className="font-extrabold text-xl leading-tight truncate">
                      {selectedSellerProfile.businessName}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleShareSellerProfile(selectedSellerProfile.sellerId, selectedSellerProfile.businessName)}
                      className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer shadow-sm flex items-center justify-center shrink-0"
                      title="Share Business Profile"
                    >
                      {copiedSellerId === selectedSellerProfile.sellerId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Founded by <span className="text-white font-medium">{selectedSellerProfile.sellerName}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Profile body content */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              
              {/* Services & Runners Safety Banner in profile modal */}
              {selectedSellerProfile.category === "Services&Runners" && (
                <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-2xl p-4 flex items-start gap-3 text-xs leading-relaxed shadow-sm">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-900 block mb-0.5">Services & Runners Safety Notice</span>
                    TamuBah is a directory only. Users are fully responsible for vetting their own runners and verifying cash payments upon delivery.
                  </div>
                </div>
              )}

              {/* Reports status warning in details modal */}
              {selectedSellerProfile.reportCount && selectedSellerProfile.reportCount > 0 ? (
                <div className="bg-rose-50 border border-rose-200 text-rose-950 rounded-2xl p-4 flex items-start gap-3 text-xs leading-relaxed">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-800 block mb-0.5">Scam & Fraud Advisory Alert</span>
                    This seller profile has been flagged <span className="font-bold text-rose-700">{selectedSellerProfile.reportCount} {selectedSellerProfile.reportCount === 1 ? "time" : "times"}</span> by buyers for potential safety concerns. We strongly urge buyers to do face-to-face transactions or Cash on Delivery (COD) only.
                  </div>
                </div>
              ) : null}

              {/* About / Est. Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <div className="p-2 bg-emerald-100/60 rounded-xl text-emerald-700">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Serving Since</span>
                    <span className="text-slate-800 font-bold text-xs">
                      {selectedSellerProfile.sellerEstablishedYear || "Not specified"}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <div className="p-2 bg-emerald-100/60 rounded-xl text-emerald-700">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Base Location</span>
                    <span className="text-slate-800 font-bold text-xs">
                      {selectedSellerProfile.availableArea}, Sabah
                    </span>
                  </div>
                </div>
              </div>

              {/* Motivation/Dream Quote Box */}
              <div>
                <h4 className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md w-fit uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span>The Entrepreneur's Dream & Goal</span>
                </h4>
                <div className="relative bg-gradient-to-br from-amber-50/40 to-orange-50/25 p-4.5 rounded-2xl border border-amber-100/30">
                  <p className="text-slate-750 text-xs italic leading-relaxed font-serif text-slate-800">
                    {selectedSellerProfile.sellerDream ? `"${selectedSellerProfile.sellerDream}"` : '"Our goal is to provide our amazing customers in Sabah with fresh, high-quality, authentic homemade products baked with love right from our kitchen."'}
                  </p>
                </div>
              </div>

              {/* Direct Contacts Info */}
              <div className="space-y-3.5 bg-slate-50/60 p-4.5 rounded-2xl border border-slate-100 text-xs">
                <h4 className="font-bold text-slate-700 text-xs border-b border-slate-100 pb-2 mb-2 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  Business Contact Coordinates
                </h4>
                
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[9px] font-semibold uppercase tracking-wider">WhatsApp Line</span>
                    <span className="text-slate-800 font-semibold font-mono">+{selectedSellerProfile.contactNumber}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[9px] font-semibold uppercase tracking-wider">Physical Address / Pick-up Base</span>
                    <span className="text-slate-600 leading-normal">{selectedSellerProfile.address}</span>
                  </div>
                </div>

                {/* Trading License / SSM Verification Detail inside coordinates box */}
                {selectedSellerProfile.ssmNumber ? (
                  <div className="flex items-start gap-3 border-t border-slate-100 pt-3 mt-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-emerald-700 block text-[9px] font-bold uppercase tracking-wider">License / SSM Verified</span>
                      <span className="text-slate-800 font-extrabold font-mono text-[11px] block mt-0.5">{selectedSellerProfile.ssmNumber}</span>
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        This seller has provided a valid trading license or SSM registration number matching their business profile.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 border-t border-rose-100/75 pt-3 mt-3 bg-amber-50/35 p-2.5 rounded-xl border border-amber-100/40">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-amber-800 block text-[9px] font-bold uppercase tracking-wider">Unverified Local Business</span>
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                        Use care and verify the seller identity or pick up directly.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Seller's Ratings & Customer Feedback Section */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  Ratings & Customer Feedback
                </h4>

                {/* Summary row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4.5 rounded-2xl border border-slate-100">
                  <div className="text-center sm:border-r sm:border-slate-200/60 flex flex-col justify-center py-2">
                    <span className="text-3xl md:text-4xl font-extrabold text-slate-800 font-mono">
                      {selectedSellerProfile.sellerAverageRating ? selectedSellerProfile.sellerAverageRating.toFixed(1) : "0.0"}
                    </span>
                    <div className="flex justify-center text-amber-500 gap-0.5 my-1.5">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const rating = selectedSellerProfile.sellerAverageRating || 0;
                        return (
                          <Star 
                            key={star} 
                            className={`w-4 h-4 ${star <= Math.round(rating) ? "fill-amber-500 text-amber-500" : "text-slate-300"}`} 
                          />
                        );
                      })}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium font-sans">
                      Based on {sellerReviews.length} {sellerReviews.length === 1 ? "rating" : "ratings"}
                    </span>
                  </div>

                  <div className="sm:col-span-2 text-xs text-slate-500 flex flex-col justify-center space-y-1.5 px-2">
                    <p className="font-semibold text-slate-700">How do customers feel?</p>
                    <p className="leading-relaxed">
                      Direct feedback helps our homegrown Sabahan entrepreneurs improve and build reliable commercial reputation online.
                    </p>
                  </div>
                </div>

                {/* List of reviews */}
                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {loadingSellerReviews ? (
                    <div className="text-center py-6 text-slate-400 text-xs">Loading reviews...</div>
                  ) : sellerReviews.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-slate-100 text-slate-400 text-xs">
                      No reviews yet. Be the first to leave feedback!
                    </div>
                  ) : (
                    sellerReviews.map((rev) => (
                      <div key={rev.id} className="bg-white border border-slate-100 rounded-2xl p-4 space-y-2 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-800 text-xs">{rev.reviewerName}</span>
                            <div className="flex text-amber-500 gap-0.5 mt-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star 
                                  key={star} 
                                  className={`w-3 h-3 ${star <= rev.rating ? "fill-amber-500 text-amber-500" : "text-slate-200"}`} 
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(rev.createdAt).toLocaleDateString("en-MY", {
                              year: "numeric",
                              month: "short",
                              day: "numeric"
                            })}
                          </span>
                        </div>
                        {rev.comment && (
                          <p className="text-xs text-slate-600 leading-relaxed italic">
                            "{rev.comment}"
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Submit review form */}
                <form onSubmit={handleSellerReviewSubmit} className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4.5 space-y-3.5">
                  <h5 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    Rate & Leave Feedback
                  </h5>

                  {sellerReviewSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 font-semibold flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                      {sellerReviewSuccess}
                    </div>
                  )}

                  {sellerReviewError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                      {sellerReviewError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Your Rating
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setSellerRatingInput(star)}
                          className="p-1 cursor-pointer hover:scale-110 transition-transform focus:outline-none"
                        >
                          <Star 
                            className={`w-6 h-6 ${
                              star <= sellerRatingInput 
                                ? "fill-amber-400 text-amber-400" 
                                : "text-slate-300 hover:text-amber-300"
                            }`} 
                          />
                        </button>
                      ))}
                      <span className="text-xs text-slate-500 font-semibold ml-2">
                        {sellerRatingInput === 5 ? "Excellent! (5/5)" :
                         sellerRatingInput === 4 ? "Very Good! (4/5)" :
                         sellerRatingInput === 3 ? "Good (3/5)" :
                         sellerRatingInput === 2 ? "Fair (2/5)" : "Poor (1/5)"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Heidi / Aaron"
                        value={sellerReviewerName}
                        onChange={(e) => setSellerReviewerName(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Your Comment / Feedback
                      </label>
                      <textarea
                        placeholder="How was your order? Was it delicious, fast or high quality? Share your experience..."
                        value={sellerCommentInput}
                        onChange={(e) => setSellerCommentInput(e.target.value)}
                        rows={2}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-slate-800 resize-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingSellerReview}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {submittingSellerReview ? "Submitting..." : "Submit Rating & Feedback"}
                  </button>
                </form>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2.5 pt-2">
                <div className="flex gap-3">
                  <button
                    type="button"
                    id="modal-close-action-btn"
                    onClick={handleCloseSellerProfile}
                    className="flex-1 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer text-center"
                  >
                    Close Profile
                  </button>
                  <a
                    id="modal-whatsapp-link"
                    href={getWhatsAppLink(selectedSellerProfile)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleTrackContactClick(selectedSellerProfile.sellerId)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Contact Shop Now
                  </a>
                </div>

                <button
                  type="button"
                  id="modal-report-seller-btn"
                  onClick={() => {
                    handleOpenReportModal(selectedSellerProfile);
                    handleCloseSellerProfile();
                  }}
                  className="w-full py-2.5 rounded-xl border border-rose-100 hover:bg-rose-50 text-rose-600 hover:text-rose-700 hover:border-rose-200 font-semibold text-[11px] transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <Flag className="w-3.5 h-3.5 shrink-0" />
                  Report Suspicious Behavior / Scam
                </button>
              </div>

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
                          <img src={sharedProduct.sellerLogoUrl} alt={sharedProduct.businessName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          sharedProduct.businessName.charAt(0)
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-extrabold text-slate-900 text-xs truncate flex items-center gap-1">
                          {sharedProduct.businessName}
                          {sharedProduct.sellerVerificationTier === "Gold" ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          ) : sharedProduct.sellerVerificationTier === "Silver" ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          ) : sharedProduct.sellerVerificationTier === "Bronze" ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
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

    </div>
  );
}
