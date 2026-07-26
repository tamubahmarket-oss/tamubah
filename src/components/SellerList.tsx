import React, { useState, useEffect } from "react";
import { 
  Search, MapPin, Phone, Award, ShieldCheck, ShieldAlert, 
  Calendar, User, Briefcase, FileText, ArrowUpRight, 
  X, Filter, Star, Info, ShoppingBag, Grid, CheckCircle, Share2, Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Seller, Product, SABAH_LOCATIONS, BUSINESS_CATEGORIES } from "../types";
import ShareModal from "./ShareModal";
import { useLanguage } from "../lib/LanguageContext";

interface SellerWithStats extends Seller {
  productCount: number;
  reportCount: number;
}

interface SellerListProps {
  products: Product[];
  onRefreshProducts: () => void;
}

export default function SellerList({ products, onRefreshProducts }: SellerListProps) {
  const { t, language } = useLanguage();
  const [sellers, setSellers] = useState<SellerWithStats[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  
  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [onlyVerified, setOnlyVerified] = useState(false);
  
  // Selected seller details / product browser modal
  const [activeSellerModal, setActiveSellerModal] = useState<SellerWithStats | null>(null);

  // Unified share modal state
  const [shareModalData, setShareModalData] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    shareUrl: string;
    shareText: string;
  } | null>(null);

  const handleOpenSellerModal = (s: SellerWithStats) => {
    setActiveSellerModal(s);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("sellerId", s.id);
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  };

  const handleCloseSellerModal = () => {
    setActiveSellerModal(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("sellerId");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  };

  // Ratings and Reviews States
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [reviewerNameInput, setReviewerNameInput] = useState<string>("");
  const [commentInput, setCommentInput] = useState<string>("");
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string>("");
  const [reviewErrorMsg, setReviewErrorMsg] = useState<string>("");

  useEffect(() => {
    if (activeSellerModal) {
      fetchReviews(activeSellerModal.id);
      // Reset form states
      setRatingInput(5);
      setReviewerNameInput("");
      setCommentInput("");
      setReviewSuccessMsg("");
      setReviewErrorMsg("");
    } else {
      setReviews([]);
    }
  }, [activeSellerModal]);

  const fetchReviews = async (sellerId: string) => {
    setLoadingReviews(true);
    try {
      const res = await fetch(`/api/sellers/${sellerId}/reviews`);
      const data = await res.json();
      if (res.ok) {
        setReviews(data);
      }
    } catch (err) {
      console.error("Error fetching reviews:", err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSellerModal) return;
    if (!reviewerNameInput.trim()) {
      setReviewErrorMsg("Please enter your name.");
      return;
    }

    setSubmittingReview(true);
    setReviewSuccessMsg("");
    setReviewErrorMsg("");

    try {
      const res = await fetch(`/api/sellers/${activeSellerModal.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: ratingInput,
          comment: commentInput,
          reviewerName: reviewerNameInput
        })
      });
      const data = await res.json();
      if (res.ok) {
        setReviewSuccessMsg("Thank you for your rating and feedback!");
        setReviewerNameInput("");
        setCommentInput("");
        setRatingInput(5);
        fetchReviews(activeSellerModal.id);
        // Refresh products/sellers to show updated rating score on cards
        fetchSellers();
        if (onRefreshProducts) onRefreshProducts();
      } else {
        setReviewErrorMsg(data.error || "Failed to submit review.");
      }
    } catch (err) {
      console.error("Error submitting review:", err);
      setReviewErrorMsg("Failed to connect to the server.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Product sharing states and helper
  const [copiedProductId, setCopiedProductId] = useState<string | null>(null);

  const handleShareProduct = async (p: Product, businessName: string) => {
    const shareUrl = `${window.location.origin}/?productId=${p.id}`;
    const shareText = `Check out "${p.title}" (RM ${p.price.toFixed(2)}) from "${businessName}" on TamuBah Sabah Entrepreneur Marketplace! Click here to see it:\n\n${shareUrl}`;

    setShareModalData({
      isOpen: true,
      title: p.title,
      subtitle: `By ${businessName} • RM ${p.price.toFixed(2)}`,
      shareUrl,
      shareText: `Check out "${p.title}" (RM ${p.price.toFixed(2)}) from "${businessName}" on TamuBah!`
    });

    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedProductId(p.id);
      setTimeout(() => setCopiedProductId(null), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  // Seller profile sharing states and helper
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

  useEffect(() => {
    fetchSellers();
  }, [products]); // Refetch stats when products change

  useEffect(() => {
    if (typeof window !== "undefined" && sellers.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const sharedSellerId = params.get("sellerId");
      if (sharedSellerId) {
        const foundSeller = sellers.find(s => s.id === sharedSellerId);
        if (foundSeller) {
          setActiveSellerModal(foundSeller);
        }
      }
    }
  }, [sellers]);

  const fetchSellers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/sellers");
      const data = await response.json();
      if (response.ok) {
        setSellers(data);
        setError("");
      } else {
        setError(data.error || "Failed to load sellers list.");
      }
    } catch (err) {
      console.error("Error fetching sellers:", err);
      setError("Failed to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Filter sellers
  const filteredSellers = sellers.filter((s) => {
    const matchesSearch = 
      s.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.dream && s.dream.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesLocation = selectedLocation === "All" || s.location === selectedLocation;
    const matchesCategory = selectedCategory === "All" || s.category === selectedCategory;
    
    // Public directory should only show approved/verified sellers!
    const isApproved = !!s.isApproved;
    const matchesVerified = !onlyVerified || (s.verificationTier && s.verificationTier !== "None");
    
    return matchesSearch && matchesLocation && matchesCategory && isApproved && matchesVerified;
  });

  // Get products belong to a specific seller
  const getSellerProducts = (sellerId: string) => {
    return products.filter((p) => p.sellerId === sellerId);
  };

  // Format WhatsApp link for seller profile
  const getWhatsAppLink = (seller: Seller, message?: string) => {
    let cleanPhone = seller.phoneNumber.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "6" + cleanPhone;
    } else if (cleanPhone.startsWith("1")) {
      cleanPhone = "60" + cleanPhone;
    } else if (cleanPhone.length > 0 && !cleanPhone.startsWith("60")) {
      cleanPhone = "60" + cleanPhone;
    }
    const defaultMsg = `Hi ${seller.ownerName}, I found your shop "${seller.businessName}" on the Tamu Bah Marketplace and wanted to make an inquiry!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message || defaultMsg)}`;
  };

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

  return (
    <div id="seller-list-view" className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Visual Header Banner */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-4 py-1.5 rounded-full border border-emerald-200/50 uppercase tracking-widest inline-block mb-3">
          {t("directory_badge")}
        </span>
        <h1 className="text-3xl md:text-5xl font-extrabold font-sans tracking-tight text-slate-900 leading-tight">
          {language === "EN" ? (
            <>Meet Our Local <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Entrepreneurs</span></>
          ) : (
            <>Kenali <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Usahawan</span> Tempatan Kita</>
          )}
        </h1>
        <p className="text-slate-500 text-sm md:text-base mt-4 font-sans leading-relaxed">
          {t("directory_desc")}
        </p>
      </div>

      {/* Interactive Filter Suite */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-md border border-slate-100 mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <Search className="w-5 h-5" />
            </span>
            <input
              type="text"
              placeholder={t("search_sellers_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm text-slate-800"
            />
          </div>

          {/* Location Dropdown */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <MapPin className="w-4 h-4" />
            </span>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm font-medium text-slate-700 appearance-none cursor-pointer"
            >
              <option value="All">{t("all_districts")}</option>
              {SABAH_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <Filter className="w-4 h-4" />
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm font-medium text-slate-700 appearance-none cursor-pointer"
            >
              <option value="All">{t("all_categories")}</option>
              {BUSINESS_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{t(cat)}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Verification & Quick Stats Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-50">
          <label className="flex items-center gap-2.5 cursor-pointer select-none group text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={onlyVerified}
              onChange={(e) => setOnlyVerified(e.target.checked)}
              className="w-4 h-4 rounded border-slate-200 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="flex items-center gap-1 group-hover:text-emerald-700 transition-colors">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              {t("only_verified_sellers")}
            </span>
          </label>

          <div className="text-xs text-slate-400 font-medium">
            {language === "EN" ? (
              <>Found <span className="text-slate-700 font-bold">{filteredSellers.length}</span> local {filteredSellers.length === 1 ? "seller" : "sellers"}</>
            ) : (
              <>Menemui <span className="text-slate-700 font-bold">{filteredSellers.length}</span> penjual tempatan</>
            )}
          </div>
        </div>
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

      {/* Main Sellers Display Section */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <svg className="animate-spin h-8 w-8 text-emerald-600 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-semibold">
            {language === "EN" ? "Gathering Sabahan micro-shops..." : "Mengumpulkan kedai mikro Sabah..."}
          </span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl max-w-md mx-auto text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-rose-800 text-sm">Failed to Load Sellers</h3>
          <p className="text-rose-600/80 text-xs leading-relaxed">{error}</p>
          <button 
            onClick={fetchSellers}
            className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredSellers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4 border border-slate-100">
            <User className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">{t("no_sellers_found")}</h3>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">
            {language === "EN" 
              ? "We couldn't find any registered sellers matching your search query in the selected location or category."
              : "Kami tidak dapat menemui mana-mana penjual berdaftar yang sepadan dengan carian anda di lokasi atau kategori tersebut."
            }
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedLocation("All");
              setSelectedCategory("All");
              setOnlyVerified(false);
            }}
            className="mt-5 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            {t("reset_filters")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSellers.map((seller) => {
            const sellerInv = getSellerProducts(seller.id);
            return (
              <div 
                key={seller.id}
                className="group bg-white rounded-3xl border border-slate-100/80 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between"
              >
                {/* Seller Intro Card Segment */}
                <div className="p-5.5 space-y-4 flex-grow">
                  
                  {/* Logo and Verification Banner */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center text-emerald-800 shrink-0">
                      {seller.logoUrl ? (
                        <img 
                          src={seller.logoUrl} 
                          alt={seller.businessName} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <span className="font-extrabold text-xl">{seller.businessName.charAt(0)}</span>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      {seller.verificationTier === "Gold" ? (
                        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 bg-[#faf6eb] border border-[#d4af37]/35 shadow-sm" style={{ color: "#b8860b" }} title="Gold Tier Verified Merchant">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "#d4af37" }} />
                          {language === "EN" ? "Gold Licensed" : "Berlesen Emas"}
                        </span>
                      ) : seller.verificationTier === "Silver" ? (
                        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 bg-[#f4f5f7] border border-[#c0c0c0]/35 shadow-sm" style={{ color: "#5a6268" }} title="Silver Tier Verified Merchant">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "#c0c0c0" }} />
                          {language === "EN" ? "Silver Licensed" : "Berlesen Perak"}
                        </span>
                      ) : seller.verificationTier === "Bronze" ? (
                        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 bg-[#faf5f0] border border-[#cd7f32]/35 shadow-sm" style={{ color: "#a0522d" }} title="Bronze Tier Verified Merchant">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "#cd7f32" }} />
                          {language === "EN" ? "Bronze Licensed" : "Berlesen Gangsa"}
                        </span>
                      ) : (
                        <span className="bg-slate-50 text-slate-500 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-slate-100 flex items-center gap-1 shrink-0" title="Standard/Home-based custom order maker">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {language === "EN" ? "Home Cook" : "Peniaga Rumah"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Shop Details */}
                  <div>
                    <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                      {t(seller.category)}
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-emerald-700 transition-colors leading-tight mt-1.5 flex items-center gap-1">
                      {seller.businessName}
                      {seller.verificationTier === "Gold" ? (
                        <ShieldCheck className="w-4 h-4 shrink-0 inline-block" style={{ color: "#d4af37" }} title="Exclusive Gold Licensed Seller" />
                      ) : seller.verificationTier === "Silver" ? (
                        <ShieldCheck className="w-4 h-4 shrink-0 inline-block" style={{ color: "#c0c0c0" }} title="Exclusive Silver Licensed Seller" />
                      ) : seller.verificationTier === "Bronze" ? (
                        <ShieldCheck className="w-4 h-4 shrink-0 inline-block" style={{ color: "#cd7f32" }} title="Exclusive Bronze Licensed Seller" />
                      ) : null}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                      <span className="font-medium text-slate-500">{language === "EN" ? `By ${seller.ownerName}` : `Oleh ${seller.ownerName}`}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        {seller.location}
                      </span>
                    </div>
                    {/* Rating Summary Badge */}
                    <div className="flex items-center gap-1.5 mt-2 text-xs">
                      {seller.averageRating && seller.averageRating > 0 ? (
                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-md text-amber-800">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          <span className="font-extrabold font-mono text-[11px]">{seller.averageRating.toFixed(1)}</span>
                          <span className="text-[10px] text-amber-700/80">
                            ({language === "EN" ? `${seller.reviewCount} ${seller.reviewCount === 1 ? "review" : "reviews"}` : `${seller.reviewCount} ulasan`})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md text-slate-400">
                          <Star className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          <span className="text-[10px] italic">
                            {language === "EN" ? "No ratings yet" : "Belum ada penarafan"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Motivational Dream Statement */}
                  <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100/50 text-xs italic text-slate-600 leading-relaxed font-serif line-clamp-3">
                    "{seller.dream || (language === "EN" ? "Dedicated to providing local families with our traditional recipes and high-quality home bakes." : "Berdedikasi untuk menyediakan keluarga tempatan dengan resipi tradisional kami dan biskut buatan sendiri berkualiti tinggi.")}"
                  </div>

                  {/* Safety Alert indicator if reported */}
                  {seller.reportCount > 0 && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-800 text-[10px] rounded-xl p-2.5 flex items-start gap-1.5 leading-relaxed">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        {language === "EN" ? (
                          <>
                            <span className="font-bold">Caution:</span> Has {seller.reportCount} warning {seller.reportCount === 1 ? "flag" : "flags"}. We advise COD transactions.
                          </>
                        ) : (
                          <>
                            <span className="font-bold">Perhatian:</span> Mempunyai {seller.reportCount} bendera amaran. Kami mengesyorkan pembayaran tunai semasa serahan (COD).
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick coordinates */}
                  <div className="space-y-1.5 text-xs text-slate-500">
                    <p className="line-clamp-1 flex items-center gap-1 text-[11px]">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-600">{language === "EN" ? "Base:" : "Tapak:"}</span> {seller.address}
                    </p>
                    {seller.ssmNumber && (
                      <p className="font-mono text-[10px] text-emerald-700 flex items-center gap-1 bg-emerald-50/40 w-fit px-2 py-0.5 rounded-md">
                        <Award className="w-3.5 h-3.5 text-emerald-600" />
                        {language === "EN" ? "License / SSM:" : "Lesen / SSM:"} {seller.ssmNumber}
                      </p>
                    )}
                  </div>

                </div>

                {/* Bottom Card Actions */}
                <div className="px-5.5 pb-5.5 pt-3 border-t border-slate-50/80 bg-slate-50/30 grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => handleOpenSellerModal(seller)}
                    className="py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:border-slate-300"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                    {language === "EN" ? `Browse Items (${sellerInv.length})` : `Lihat Produk (${sellerInv.length})`}
                  </button>

                  <a
                    href={getWhatsAppLink(seller)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleTrackContactClick(seller.id)}
                    className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer hover:shadow-md hover:shadow-emerald-600/10"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {t("contact_now")}
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Seller Detail & Product Browser Modal (Rendered with overlay) */}
      <AnimatePresence>
        {activeSellerModal && (
          <div 
            id="seller-details-modal-overlay"
            className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
            onClick={handleCloseSellerModal}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-3xl w-full overflow-hidden text-slate-800 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Graphic Banner Header */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 text-white relative shrink-0">
                <button
                  onClick={handleCloseSellerModal}
                  className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-1.5 transition-colors cursor-pointer"
                  title="Close Profile"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4.5">
                  <div className="w-18 h-18 rounded-2xl overflow-hidden border-2 border-emerald-500 bg-white/10 shrink-0 flex items-center justify-center relative">
                    {activeSellerModal.logoUrl ? (
                      <img 
                        src={activeSellerModal.logoUrl} 
                        alt={activeSellerModal.businessName} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <Briefcase className="w-9 h-9 text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="bg-emerald-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {activeSellerModal.category}
                      </span>
                      {activeSellerModal.verificationTier === "Gold" ? (
                        <span className="flex items-center gap-1 text-[10px] font-extrabold bg-amber-950/40 px-2.5 py-0.5 rounded-md border border-[#d4af37]/30" style={{ color: "#d4af37" }}>
                          <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#d4af37" }} />
                          {language === "EN" ? "Gold Verified Seller" : "Penjual Disahkan Emas"}
                        </span>
                      ) : activeSellerModal.verificationTier === "Silver" ? (
                        <span className="flex items-center gap-1 text-[10px] font-extrabold bg-slate-900/40 px-2.5 py-0.5 rounded-md border border-[#c0c0c0]/30" style={{ color: "#c0c0c0" }}>
                          <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#c0c0c0" }} />
                          {language === "EN" ? "Silver Verified Seller" : "Penjual Disahkan Perak"}
                        </span>
                      ) : activeSellerModal.verificationTier === "Bronze" ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-orange-950/40 px-2.5 py-0.5 rounded-md border border-[#cd7f32]/30" style={{ color: "#cd7f32" }}>
                          <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#cd7f32" }} />
                          {language === "EN" ? "Bronze Verified Seller" : "Penjual Disahkan Gangsa"}
                        </span>
                      ) : activeSellerModal.isVerified || !!activeSellerModal.ssmNumber ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-500/30">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          {language === "EN" ? "Licensed / SSM Verified Business" : "Perniagaan Berlesen / SSM Disahkan"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-400 text-[10px] font-bold bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-500/10">
                          <Info className="w-3.5 h-3.5 text-amber-400" />
                          {language === "EN" ? "Sabah Home Shop" : "Kedai Rumah Sabah"}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <h3 className="font-extrabold text-2xl leading-tight">
                        {activeSellerModal.businessName}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleShareSellerProfile(activeSellerModal.id, activeSellerModal.businessName)}
                        className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer shadow-sm flex items-center justify-center shrink-0"
                        title="Share Business Profile"
                      >
                        {copiedSellerId === activeSellerModal.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      {language === "EN" ? (
                        <>Managed by <span className="text-white font-medium">{activeSellerModal.ownerName}</span> in <span className="font-semibold text-white">{activeSellerModal.location}, Sabah</span></>
                      ) : (
                        <>Diusahakan oleh <span className="text-white font-medium">{activeSellerModal.ownerName}</span> di <span className="font-semibold text-white">{activeSellerModal.location}, Sabah</span></>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scrollable Modal Content */}
              <div className="overflow-y-auto p-6 space-y-6 flex-grow">
                
                {/* Services & Runners Safety Notice */}
                {activeSellerModal.category === "Services&Runners" && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-2xl p-4 flex items-start gap-3 text-xs leading-relaxed shadow-sm">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-900 block mb-0.5">{t("safety_disclaimer_title")}</span>
                      <strong>TamuBah {language === "EN" ? "is a directory only." : "adalah direktori sahaja."}</strong> {t("safety_disclaimer_desc")}
                    </div>
                  </div>
                )}

                {/* Reports Warning Notice */}
                {activeSellerModal.reportCount > 0 && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-950 rounded-2xl p-4 flex items-start gap-3 text-xs leading-relaxed">
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-rose-800 block mb-0.5">
                        {language === "EN" ? "Scam & Safety Advisory Warning" : "Amaran Penasihat Keselamatan & Penipuan"}
                      </span>
                      {language === "EN" ? (
                        <>This profile has been reported <span className="font-bold text-rose-700">{activeSellerModal.reportCount} {activeSellerModal.reportCount === 1 ? "time" : "times"}</span> by other buyers. To guarantee safety, we highly recommend doing face-to-face meetups or cash-on-delivery.</>
                      ) : (
                        <>Profil ini telah dilaporkan sebanyak <span className="font-bold text-rose-700">{activeSellerModal.reportCount} kali</span> oleh pembeli lain. Untuk menjamin keselamatan, kami sangat mengesyorkan melakukan pertemuan bersemuka atau bayar semasa serahan (COD).</>
                      )}
                    </div>
                  </div>
                )}

                {/* About & Motivational Dream */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Detailed Dream Quote */}
                  <div className="md:col-span-2 space-y-2.5">
                    <h4 className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md w-fit uppercase tracking-wider flex items-center gap-1.5">
                      <span>{language === "EN" ? "Entrepreneur Story & Goal" : "Kisah & Matlamat Usahawan"}</span>
                    </h4>
                    <div className="bg-gradient-to-br from-amber-50/40 to-orange-50/25 p-4 rounded-2xl border border-amber-100/30">
                      <p className="text-slate-700 text-xs italic leading-relaxed font-serif">
                        "{activeSellerModal.dream || (language === "EN" ? "To serve families across Sabah with fresh, delicious, high-quality, authentic homemade products baked with passion right from our kitchen." : "Untuk melayani keluarga di seluruh Sabah dengan produk buatan sendiri yang segar, lazat, berkualiti tinggi dan asli yang dibakar dengan penuh minat terus dari dapur kami.")}"
                      </p>
                    </div>
                  </div>

                  {/* Shop Details Stats */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs">
                    <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      {language === "EN" ? "Shop Overview" : "Gambaran Keseluruhan Kedai"}
                    </h5>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">{language === "EN" ? "Serving Since:" : "Beroperasi Sejak:"}</span>
                      <span className="font-semibold text-slate-800">{activeSellerModal.establishedYear || (language === "EN" ? "Not specified" : "Tidak dinyatakan")}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">{language === "EN" ? "Area:" : "Kawasan:"}</span>
                      <span className="font-semibold text-slate-800">{activeSellerModal.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{language === "EN" ? "Active Stock:" : "Stok Aktif:"}</span>
                      <span className="font-bold text-emerald-700">{getSellerProducts(activeSellerModal.id).length} {language === "EN" ? "Items" : "Produk"}</span>
                    </div>
                  </div>

                </div>

                {/* Seller's Products Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Grid className="w-4 h-4 text-slate-400" />
                    {language === "EN" ? `Products by ${activeSellerModal.businessName}` : `Produk oleh ${activeSellerModal.businessName}`}
                  </h4>

                  {getSellerProducts(activeSellerModal.id).length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">
                        {language === "EN" ? "This seller has no active products listed yet." : "Penjual ini belum menyenaraikan sebarang produk aktif."}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {getSellerProducts(activeSellerModal.id).map((prod) => (
                        <div 
                          key={prod.id} 
                          className="flex border border-slate-100 bg-white rounded-2xl p-2.5 gap-3 hover:border-slate-200 hover:shadow-sm transition-all"
                        >
                          <img 
                            src={prod.imageUrl} 
                            alt={prod.title} 
                            referrerPolicy="no-referrer"
                            className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-50"
                          />
                          <div className="flex flex-col justify-between flex-grow min-w-0">
                            <div>
                              <div className="flex justify-between items-start gap-1.5">
                                <h5 className="font-bold text-slate-800 text-xs truncate leading-snug" title={prod.title}>
                                  {prod.title}
                                </h5>
                                <span className="text-[10px] font-extrabold text-slate-900 shrink-0 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  RM {prod.price.toFixed(2)}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">
                                {prod.description}
                              </p>
                            </div>

                            <div className="flex items-center justify-between mt-1.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                prod.isAvailable 
                                  ? "bg-emerald-50 text-emerald-700" 
                                  : "bg-slate-100 text-slate-400"
                              }`}>
                                {prod.isAvailable ? (language === "EN" ? "In Stock" : "Ada Stok") : t("sold_out")}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleShareProduct(prod, activeSellerModal.businessName)}
                                  className={`text-[9px] font-bold p-1 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                                    copiedProductId === prod.id
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                      : "border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
                                  }`}
                                  title={copiedProductId === prod.id ? "Link Copied!" : "Share product"}
                                >
                                  {copiedProductId === prod.id ? (
                                    <Check className="w-3.5 h-3.5 shrink-0" />
                                  ) : (
                                    <Share2 className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                </button>

                                <a
                                  href={getWhatsAppLink(activeSellerModal, `Hi ${activeSellerModal.ownerName}, I would like to order your product "${prod.title}" (RM ${prod.price.toFixed(2)}) listed on the Sabah Entrepreneur Marketplace!`)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => handleTrackContactClick(activeSellerModal.id)}
                                  className={`text-[9px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-all ${
                                    prod.isAvailable 
                                      ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer" 
                                      : "bg-slate-100 text-slate-300 pointer-events-none"
                                  }`}
                                >
                                  <Phone className="w-2.5 h-2.5" />
                                  {language === "EN" ? "Order" : "Pesan"}
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Seller's Core Contact Info Coordinates */}
                <div className="space-y-3 bg-slate-50 p-4.5 rounded-2xl border border-slate-100 text-xs">
                  <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {language === "EN" ? "Direct Contact details" : "Maklumat Hubungan Terus"}
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="flex items-start gap-2.5">
                      <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block">WhatsApp Hot-Line</span>
                        <span className="font-semibold font-mono text-slate-800">+{activeSellerModal.phoneNumber}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block">{language === "EN" ? "Base Pick-up Address" : "Alamat Ambil Tapak"}</span>
                        <span className="text-slate-600 leading-normal">{activeSellerModal.address}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seller's Ratings & Customer Feedback Section */}
                <div className="space-y-4 border-t border-slate-100 pt-5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    {language === "EN" ? "Ratings & Customer Feedback" : "Penarafan & Maklum Balas Pelanggan"}
                  </h4>

                  {/* Summary row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4.5 rounded-2xl border border-slate-100">
                    <div className="text-center md:border-r md:border-slate-200/60 flex flex-col justify-center py-2">
                      <span className="text-3xl md:text-4xl font-extrabold text-slate-800 font-mono">
                        {activeSellerModal.averageRating ? activeSellerModal.averageRating.toFixed(1) : "0.0"}
                      </span>
                      <div className="flex justify-center text-amber-500 gap-0.5 my-1.5">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const rating = activeSellerModal.averageRating || 0;
                          return (
                            <Star 
                              key={star} 
                              className={`w-4 h-4 ${star <= Math.round(rating) ? "fill-amber-500 text-amber-500" : "text-slate-300"}`} 
                            />
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium font-sans">
                        {language === "EN" ? (
                          <>Based on {reviews.length} {reviews.length === 1 ? "rating" : "ratings"}</>
                        ) : (
                          <>Berdasarkan {reviews.length} penarafan</>
                        )}
                      </span>
                    </div>

                    <div className="md:col-span-2 text-xs text-slate-500 flex flex-col justify-center space-y-1.5 px-2">
                      <p className="font-semibold text-slate-700">{language === "EN" ? "How do customers feel?" : "Bagaimana perasaan pelanggan?"}</p>
                      <p className="leading-relaxed">
                        {language === "EN" 
                          ? "Ratings and comments are left by genuine buyers. Direct ratings help local entrepreneurs build trust, improve their craftsmanship, and gain visibility."
                          : "Penarafan dan komen ditinggalkan oleh pembeli sebenar. Penarafan langsung membantu usahawan tempatan membina kepercayaan, meningkatkan kualiti produk, dan meningkatkan pendedahan."
                        }
                      </p>
                    </div>
                  </div>

                  {/* List of reviews */}
                  <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                    {loadingReviews ? (
                      <div className="text-center py-6 text-slate-400 text-xs">{language === "EN" ? "Loading reviews..." : "Memuatkan ulasan..."}</div>
                    ) : reviews.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-slate-100 text-slate-400 text-xs">
                        {language === "EN" ? "No reviews yet. Be the first to leave feedback!" : "Belum ada ulasan. Jadilah yang pertama memberikan maklum balas!"}
                      </div>
                    ) : (
                      reviews.map((rev) => (
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
                  <form onSubmit={handleReviewSubmit} className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4.5 space-y-3.5">
                    <h5 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                      {language === "EN" ? "Rate & Leave Feedback" : "Nilai & Tinggalkan Maklum Balas"}
                    </h5>

                    {reviewSuccessMsg && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 font-semibold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                        {reviewSuccessMsg}
                      </div>
                    )}

                    {reviewErrorMsg && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 font-semibold flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                        {reviewErrorMsg}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {language === "EN" ? "Your Rating" : "Penarafan Anda"}
                      </label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            key={star}
                            onClick={() => setRatingInput(star)}
                            className="p-1 cursor-pointer hover:scale-110 transition-transform focus:outline-none"
                          >
                            <Star 
                              className={`w-6 h-6 ${
                                star <= ratingInput 
                                  ? "fill-amber-400 text-amber-400" 
                                  : "text-slate-300 hover:text-amber-300"
                              }`} 
                            />
                          </button>
                        ))}
                        <span className="text-xs text-slate-500 font-semibold ml-2">
                          {ratingInput === 5 ? (language === "EN" ? "Excellent! (5/5)" : "Sangat Cemerlang! (5/5)") :
                           ratingInput === 4 ? (language === "EN" ? "Very Good! (4/5)" : "Sangat Baik! (4/5)") :
                           ratingInput === 3 ? (language === "EN" ? "Good (3/5)" : "Baik (3/5)") :
                           ratingInput === 2 ? (language === "EN" ? "Fair (2/5)" : "Sederhana (2/5)") : (language === "EN" ? "Poor (1/5)" : "Kurang Memuaskan (1/5)")}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {language === "EN" ? "Your Name" : "Nama Anda"}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., Heidi / Aaron"
                          value={reviewerNameInput}
                          onChange={(e) => setReviewerNameInput(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {language === "EN" ? "Your Comment / Feedback" : "Komen / Maklum Balas Anda"}
                        </label>
                        <textarea
                          placeholder={language === "EN" ? "How was your order? Was it delicious, fast or high quality? Share your experience..." : "Bagaimanakah pesanan anda? Adakah ia lazat, cepat atau berkualiti tinggi? Kongsi pengalaman anda..."}
                          value={commentInput}
                          onChange={(e) => setCommentInput(e.target.value)}
                          rows={2}
                          className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-slate-800 resize-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {submittingReview ? (language === "EN" ? "Submitting..." : "Menghantar...") : (language === "EN" ? "Submit Rating & Feedback" : "Hantar Penarafan & Maklum Balas")}
                    </button>
                  </form>
                </div>

              </div>

              {/* Bottom footer bar */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                <button
                  onClick={handleCloseSellerModal}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer text-center"
                >
                  {language === "EN" ? "Close Shop Window" : "Tutup Kedai"}
                </button>
                <a
                  href={getWhatsAppLink(activeSellerModal)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleTrackContactClick(activeSellerModal.id)}
                  className="flex-grow bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {language === "EN" ? "Chat on WhatsApp" : "Sembang di WhatsApp"}
                </a>
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
