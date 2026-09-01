import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
// @ts-ignore
import tamubahLogo from "./assets/images/traditional_bag_logo_1784122537315.jpg";
import { useLanguage } from "./lib/LanguageContext";
import { 
  ShoppingBag, Store, User, ChevronRight, MapPin, 
  CheckCircle, Plus, Info, Landmark, HelpCircle, ArrowRight, Home,
  Mail, Globe, Users, Search, Megaphone, ChevronDown, LogOut,
  Settings, Edit3, ShieldCheck
} from "lucide-react";
import { Seller, Product, SABAH_LOCATIONS } from "./types";
import { slugify } from "./lib/slug";
import MarketGrid from "./components/MarketGrid";
import ShopDashboard from "./components/ShopDashboard";
import SellerList from "./components/SellerList";
import PendingApproval from "./components/PendingApproval";
import ReceiptView from "./components/ReceiptView";
import CommunityForum from "./components/CommunityForum";
import LocationSharingPrompt from "./components/LocationSharingPrompt";
import { useSellerLocationTracking } from "./lib/useSellerLocationTracking";
import { useAnnouncement, markAnnouncementSeen } from "./lib/announcementStore";

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"market" | "sellers" | "shop" | "community">(() => {
    const path = window.location.pathname.replace(/^\/+/, "").split("/")[0];
    if (path === "sellers" || path === "seller") return "sellers";
    // A shared/clicked seller link (/seller/:id or the older ?sellerId=...)
    // always means "open that seller's shop" — land straight on the
    // Sellers tab so it's there to open.
    if (new URLSearchParams(window.location.search).get("sellerId")) return "sellers";
    return "market";
  });
  const [currentSeller, setCurrentSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  const [marketLocationFilter, setMarketLocationFilter] = useState<string>("All");
  
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  // Global header search (location, product, or seller) + account dropdown panel
  const [headerSearchInput, setHeaderSearchInput] = useState<string>("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>("");
  const [showAccountPanel, setShowAccountPanel] = useState<boolean>(false);
  const [showAnnouncementPanel, setShowAnnouncementPanel] = useState<boolean>(false);
  const accountPanelRef = useRef<HTMLDivElement>(null);
  const announcementPanelRef = useRef<HTMLDivElement>(null);
  const { announcement, isUnread: hasUnreadAnnouncement } = useAnnouncement();

  // "Near Me" live map — continuously report this seller's position to the
  // backend for as long as they're logged in AND have turned sharing on.
  // (See useSellerLocationTracking.ts for the platform limitation: this only
  // tracks while the TamuBah tab is open/foregrounded, not truly in the
  // background — that's a mobile-browser constraint, not a bug.)
  useSellerLocationTracking(currentSeller?.id, !!currentSeller?.locationSharingEnabled);

  // Close the account/announcement dropdowns when clicking outside of them
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountPanelRef.current && !accountPanelRef.current.contains(e.target as Node)) {
        setShowAccountPanel(false);
      }
      if (announcementPanelRef.current && !announcementPanelRef.current.contains(e.target as Node)) {
        setShowAnnouncementPanel(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fire-and-forget visit ping for the admin marketing analytics chart — once per page load
  useEffect(() => {
    fetch("/api/track/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
  }, []);

  const handleHeaderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = headerSearchInput.trim();
    if (!query) return;

    // If the query matches a Sabah district, treat it as a location search
    const matchedLocation = SABAH_LOCATIONS.find(
      (loc) => loc.toLowerCase() === query.toLowerCase() || loc.toLowerCase().includes(query.toLowerCase())
    );

    if (matchedLocation) {
      setMarketLocationFilter(matchedLocation);
      setGlobalSearchQuery("");
      setActiveTab("market");
    } else {
      setGlobalSearchQuery(query);
      setActiveTab("market");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // If this page was opened via a shared receipt link (?receipt=RCPT_ID),
  // show a standalone printable receipt view instead of the normal app shell.
  const [sharedReceiptId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("receipt"));

  const handleDistrictClick = (districtName: string) => {
    setMarketLocationFilter(districtName);
    setActiveTab("market");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Navigate to a seller's full shop (their real product catalog on the
  // Sellers tab), used wherever a seller is clicked from elsewhere in the
  // app — a product card, a shared link, etc. Uses a readable /seller/:slug
  // URL built from the shop's name when we have it; falls back to the raw
  // seller ID so old-style links still work.
  const handleViewSellerShop = (sellerId: string, businessName?: string) => {
    const slug = businessName ? slugify(businessName) : sellerId;
    window.history.pushState({}, "", `/seller/${slug}`);
    setActiveTab("sellers");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Navigate to a specific product's detail view on the Market tab, used
  // when a product is clicked from somewhere other than the Market grid
  // itself (e.g. from inside a seller's shop).
  const handleViewProduct = (productId: string) => {
    window.history.pushState({}, "", `/product/${productId}`);
    setActiveTab("market");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Load session from localStorage on startup
  useEffect(() => {
    const savedSession = localStorage.getItem("sabah_seller_session");
    if (savedSession) {
      try {
        setCurrentSeller(JSON.parse(savedSession));
      } catch (e) {
        console.error("Failed to parse saved session", e);
      }
    }
    fetchProducts();

    // Handle entry links coming from the standalone Auth/Home pages (e.g. /market?tab=shop)
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "shop") {
      setActiveTab("shop");
    } else if (tabParam === "sellers") {
      setActiveTab("sellers");
    } else if (tabParam === "community") {
      setActiveTab("community");
    }
    if (tabParam) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  // Force activeTab to "market" if not logged in
  useEffect(() => {
    if (!currentSeller && (activeTab === "shop" || activeTab === "community")) {
      setActiveTab("market");
    }
  }, [currentSeller, activeTab]);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await fetch("/api/products");
      const data = await response.json();
      if (response.ok) {
        setProducts(data);
      } else {
        console.error("Failed to fetch products from backend:", data.error);
      }
    } catch (error) {
      console.error("Error connecting to backend API:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const executeLogout = () => {
    setCurrentSeller(null);
    localStorage.removeItem("sabah_seller_session");
    setActiveTab("market");
    setShowLogoutConfirm(false);
  };

  const handleUpdateSeller = (updatedSeller: Seller) => {
    setCurrentSeller(updatedSeller);
    localStorage.setItem("sabah_seller_session", JSON.stringify(updatedSeller));
    fetchProducts();
  };

  if (sharedReceiptId) {
    return <ReceiptView receiptId={sharedReceiptId} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800 antialiased selection:bg-emerald-100 selection:text-emerald-800">
      
      {/* Sticky Header Navbar */}
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex items-center gap-3 md:gap-5">

          {/* Logo */}
          <div
            onClick={() => { window.location.href = "/"; }}
            className="flex items-center cursor-pointer select-none group shrink-0"
          >
            <div className="h-11 md:h-14 overflow-hidden rounded-xl bg-white px-2 flex items-center justify-center transition-all duration-300">
              <img
                src={tamubahLogo}
                alt="Digital Tamu Logo"
                className="h-22 md:h-28 object-contain -my-5 group-hover:scale-[1.03] transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Unified Search — location, products & sellers */}
          <form onSubmit={handleHeaderSearchSubmit} className="relative flex-1 max-w-xl hidden sm:block">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={headerSearchInput}
              onChange={(e) => setHeaderSearchInput(e.target.value)}
              placeholder={language === "EN" ? "Search location, products or sellers..." : "Cari lokasi, produk atau penjual..."}
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm text-slate-800"
            />
          </form>

          {/* Spacer keeps icon nav pinned right when search is hidden (mobile) */}
          <div className="flex-1 sm:hidden" />

          {/* Icon-only Navigation */}
          {activeTab !== "shop" && (
            <nav className="hidden sm:flex items-center gap-1 shrink-0">
              <button
                id="nav-tab-home"
                onClick={() => { window.location.href = "/"; }}
                title={language === "EN" ? "Home" : "Utama"}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <Home className="w-5 h-5" />
              </button>
              <button
                id="nav-tab-market"
                onClick={() => setActiveTab("market")}
                title={t("explore_market")}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  activeTab === "market"
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
              </button>
              <button
                id="nav-tab-sellers"
                onClick={() => setActiveTab("sellers")}
                title={t("local_sellers")}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  activeTab === "sellers"
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <User className="w-5 h-5" />
              </button>
              {currentSeller && currentSeller.isApproved && (
                <button
                  id="nav-tab-community"
                  onClick={() => setActiveTab("community")}
                  title="Community"
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    activeTab === "community"
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-5 h-5" />
                </button>
              )}
              {currentSeller && (
                <div className="relative" ref={announcementPanelRef}>
                  <button
                    id="nav-tab-announcements"
                    onClick={() => {
                      setShowAnnouncementPanel((v) => !v);
                      if (!showAnnouncementPanel) markAnnouncementSeen();
                    }}
                    title={language === "EN" ? "Announcements" : "Pengumuman"}
                    className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  >
                    <Megaphone className="w-5 h-5" />
                    {hasUnreadAnnouncement && (
                      <motion.span
                        className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white"
                        animate={{ scale: [1, 1.25, 1] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </button>
                  <AnimatePresence>
                    {showAnnouncementPanel && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-50 p-4"
                      >
                        <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 mb-2">
                          <Megaphone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          {language === "EN" ? "Platform Announcement" : "Pengumuman Platform"}
                        </h4>
                        {announcement ? (
                          <p className="text-xs text-slate-600 leading-relaxed">{announcement.message}</p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            {language === "EN" ? "No announcements right now." : "Tiada pengumuman buat masa ini."}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </nav>
          )}

          {/* Language Selector */}
          <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 select-none shrink-0">
            <button
              onClick={() => setLanguage("EN")}
              className={`px-2 py-1.5 text-[10px] font-black rounded-md transition-all cursor-pointer ${
                language === "EN" ? "bg-white text-emerald-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("BM")}
              className={`px-2 py-1.5 text-[10px] font-black rounded-md transition-all cursor-pointer ${
                language === "BM" ? "bg-white text-emerald-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              BM
            </button>
          </div>

          {/* Account (far right) */}
          <div className="relative shrink-0" ref={accountPanelRef}>
            {currentSeller ? (
              <>
                <button
                  id="dashboard-avatar-btn"
                  onClick={() => setShowAccountPanel((v) => !v)}
                  className="flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
                  title={currentSeller.businessName}
                >
                  <span className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shadow-sm overflow-hidden shrink-0">
                    {currentSeller.logoUrl ? (
                      <img src={currentSeller.logoUrl} alt={currentSeller.businessName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      currentSeller.businessName.charAt(0)
                    )}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform hidden sm:block ${showAccountPanel ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown panel — comes down below the avatar */}
                <AnimatePresence>
                  {showAccountPanel && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-50"
                    >
                      <div className="p-4 bg-gradient-to-br from-emerald-600 to-teal-700 text-white">
                        <div className="flex items-center gap-2.5">
                          <span className="w-10 h-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                            {currentSeller.logoUrl ? (
                              <img src={currentSeller.logoUrl} alt={currentSeller.businessName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              currentSeller.businessName.charAt(0)
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{currentSeller.businessName}</p>
                            <p className="text-[11px] text-emerald-100 truncate flex items-center gap-1">
                              {currentSeller.verificationTier && currentSeller.verificationTier !== "None" && (
                                <ShieldCheck className="w-3 h-3 shrink-0" />
                              )}
                              {currentSeller.ownerName}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="p-1.5">
                        <button
                          onClick={() => { setActiveTab("shop"); setShowAccountPanel(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                        >
                          <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                          {t("manage_my_shop")}
                        </button>
                        <button
                          onClick={() => { setActiveTab("shop"); setShowAccountPanel(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                        >
                          <Edit3 className="w-4 h-4 text-slate-400 shrink-0" />
                          {language === "EN" ? "Edit Profile" : "Sunting Profil"}
                        </button>
                        {currentSeller.isApproved && (
                          <button
                            onClick={() => { setActiveTab("community"); setShowAccountPanel(false); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                          >
                            <Users className="w-4 h-4 text-slate-400 shrink-0" />
                            Community
                          </button>
                        )}
                        <div className="h-px bg-slate-100 my-1" />
                        <button
                          onClick={() => { setShowAccountPanel(false); handleLogout(); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          {t("logout")}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  id="header-login-btn"
                  onClick={() => { window.location.href = "/signin"; }}
                  className="px-3 md:px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-950 transition-colors cursor-pointer"
                >
                  {t("sign_in")}
                </button>
                <button
                  id="header-register-btn"
                  onClick={() => { window.location.href = "/register"; }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 md:px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                >
                  {t("join_as_seller")}
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Mobile search row */}
        <form onSubmit={handleHeaderSearchSubmit} className="sm:hidden relative px-4 pb-2.5">
          <span className="absolute inset-y-0 left-0 pl-7 flex items-center text-slate-400 pointer-events-none">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={headerSearchInput}
            onChange={(e) => setHeaderSearchInput(e.target.value)}
            placeholder={language === "EN" ? "Search location, products or sellers..." : "Cari lokasi, produk atau penjual..."}
            className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm text-slate-800"
          />
        </form>
      </header>

      {/* Mobile Sticky Icon-only Tab Navigation */}
      {activeTab !== "shop" && (
        <div className="sm:hidden sticky top-16 z-30 bg-white/95 border-b border-slate-100 p-2 flex gap-1.5 shadow-sm">
          <button
            id="mobile-nav-home"
            onClick={() => { window.location.href = "/"; }}
            title={language === "EN" ? "Home" : "Utama"}
            className="flex-1 py-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer text-slate-500"
          >
            <Home className="w-5 h-5" />
          </button>
          <button
            id="mobile-nav-market"
            onClick={() => setActiveTab("market")}
            title={t("explore_market")}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === "market" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "text-slate-500"
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
          </button>
          <button
            id="mobile-nav-sellers"
            onClick={() => setActiveTab("sellers")}
            title={t("local_sellers")}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === "sellers" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "text-slate-500"
            }`}
          >
            <User className="w-5 h-5" />
          </button>
          {currentSeller && currentSeller.isApproved && (
            <button
              id="mobile-nav-community"
              onClick={() => setActiveTab("community")}
              title="Community"
              className={`flex-1 py-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTab === "community" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "text-slate-500"
              }`}
            >
              <Users className="w-5 h-5" />
            </button>
          )}
          {currentSeller && (
            <div className="relative flex-1" ref={announcementPanelRef}>
              <button
                id="mobile-nav-announcements"
                onClick={() => {
                  setShowAnnouncementPanel((v) => !v);
                  if (!showAnnouncementPanel) markAnnouncementSeen();
                }}
                title={language === "EN" ? "Announcements" : "Pengumuman"}
                className="relative w-full py-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer text-slate-500"
              >
                <Megaphone className="w-5 h-5" />
                {hasUnreadAnnouncement && (
                  <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full bg-rose-500 border border-white" />
                )}
              </button>
              <AnimatePresence>
                {showAnnouncementPanel && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-50 p-4"
                  >
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 mb-2">
                      <Megaphone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      {language === "EN" ? "Platform Announcement" : "Pengumuman Platform"}
                    </h4>
                    {announcement ? (
                      <p className="text-xs text-slate-600 leading-relaxed">{announcement.message}</p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        {language === "EN" ? "No announcements right now." : "Tiada pengumuman buat masa ini."}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {currentSeller && (
            <button
              id="mobile-nav-shop"
              onClick={() => setActiveTab("shop")}
              title={t("seller_space")}
              className={`flex-1 py-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeTab === "shop" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "text-slate-500"
              }`}
            >
              <Store className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Main Body Pages router */}
      <main className="flex-grow">
        {activeTab === "market" ? (
          <MarketGrid 
            products={products} 
            loading={loadingProducts} 
            onRefreshProducts={fetchProducts}
            selectedLocation={marketLocationFilter}
            onLocationChange={setMarketLocationFilter}
            initialSearchQuery={globalSearchQuery}
            onViewSellerShop={handleViewSellerShop}
          />
        ) : activeTab === "sellers" ? (
          <SellerList 
            products={products} 
            onRefreshProducts={fetchProducts}
            initialSearchQuery={globalSearchQuery}
            onViewProduct={handleViewProduct}
          />
        ) : activeTab === "community" ? (
          currentSeller && currentSeller.isApproved ? (
            <div className="max-w-7xl mx-auto px-4 py-8">
              <CommunityForum seller={currentSeller} />
            </div>
          ) : (
            <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-400">
              Please sign in as an approved seller to access the Community.
            </div>
          )
        ) : (
          /* Shop Tab router */
          currentSeller ? (
            currentSeller.isApproved ? (
              <ShopDashboard 
                seller={currentSeller} 
                onLogout={handleLogout} 
                onRefreshMarket={fetchProducts} 
                onUpdateSeller={handleUpdateSeller}
              />
            ) : (
              <PendingApproval 
                seller={currentSeller} 
                onLogout={handleLogout} 
                onApproved={handleUpdateSeller}
              />
            )
          ) : (
            /* Auth Splash panel when seller wants to access shop space but is not logged in */
            <div className="max-w-4xl mx-auto px-4 py-12 md:py-20 flex flex-col lg:flex-row items-center gap-12">
              <div className="lg:w-1/2 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="h-px w-8 bg-amber-400/60"></span>
                  <span className="text-amber-700 text-[11px] font-bold uppercase tracking-[0.2em]">
                    Seller Portal
                  </span>
                </div>
                <h2 className="text-3xl md:text-5xl font-display font-semibold tracking-tight text-slate-900 leading-[1.1]">
                  Grow your homemade business in Sabah
                </h2>
                <p className="text-slate-500 text-sm md:text-base leading-relaxed">
                  Join hundreds of Sabahan bakers, cooks, drink makers, and small retailers. List your physical stock or custom bakes directly from Penampang, Tuaran, Sandakan, or anywhere in Sabah!
                </p>
                
                <div className="space-y-3.5 pt-2">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 mt-0.5">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-sm block">100% Free Marketplace</span>
                      <span className="text-xs text-slate-400">No commissions, no hidden fees. Keep all your profits!</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 mt-0.5">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-sm block">Direct Customer WhatsApp</span>
                      <span className="text-xs text-slate-400">Buyers click to instantly chat and buy from you on WhatsApp.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 mt-0.5">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-sm block">Easy Stock Availability Toggles</span>
                      <span className="text-xs text-slate-400">Mark items sold-out or back-in-stock with a simple single click.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:w-1/2 w-full flex flex-col items-center justify-center gap-4 bg-white rounded-2xl shadow-xl border border-emerald-100 p-8 md:p-10">
                <p className="text-slate-500 text-sm text-center">
                  Sign in to manage your shop, or create a free seller account to get started.
                </p>
                <button
                  onClick={() => { window.location.href = "/signin"; }}
                  className="w-full py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-sm transition-colors cursor-pointer"
                >
                  {t("sign_in")}
                </button>
                <button
                  onClick={() => { window.location.href = "/register"; }}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors shadow-sm cursor-pointer"
                >
                  {t("join_as_seller")}
                </button>
              </div>
            </div>
          )
        )}
      </main>

      {/* Footer Branding section */}
      <footer className="bg-slate-900 text-white mt-auto py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div 
              onClick={() => { window.location.href = "/"; }}
              className="flex items-center mb-4 cursor-pointer select-none group inline-block"
            >
              <div className="h-14 md:h-16 overflow-hidden rounded-xl bg-white px-2.5 flex items-center justify-center shadow-sm group-hover:scale-[1.03] transition-transform duration-300">
                <img 
                  src={tamubahLogo} 
                  alt="Digital Tamu Logo" 
                  className="h-28 md:h-32 object-contain -my-6"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              Menyokong usahawan tempatan Sabah. A shared digital market platform for local micro-entrepreneurs and home bakers across Sabah, Malaysia.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4">Market Districts</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-slate-400">
              {SABAH_LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  onClick={() => handleDistrictClick(loc)}
                  className="text-left hover:text-emerald-400 transition-colors duration-150 focus:outline-none focus:text-emerald-400 rounded py-0.5 cursor-pointer flex items-center gap-1.5 group/dist"
                >
                  <MapPin className="w-3.5 h-3.5 text-slate-500 group-hover/dist:text-emerald-400 transition-colors shrink-0" />
                  <span className="truncate">{loc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4">Need Help?</h4>
            <div className="space-y-2.5 text-xs text-slate-400 mb-5">
              <a href="mailto:support@tamubah.com" className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors w-fit">
                <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                support@tamubah.com
              </a>
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                www.tamubah.com
              </span>
            </div>

            {currentSeller && activeTab !== "shop" && (
              <>
                <h4 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-3">My Shop Account</h4>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  You are logged in as <span className="text-emerald-400 font-semibold">{currentSeller.businessName}</span>. Go to your Seller Space to add new products or update your public profile.
                </p>
                <button
                  onClick={() => setActiveTab("shop")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                >
                  Go to Seller Space
                </button>
              </>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 border-t border-slate-800/60 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-500 text-xs">
          <span className="select-none">
            &copy; {new Date().getFullYear()} TamuBah. Built with pride in Sabah.
          </span>
          <div className="flex gap-4 items-center flex-wrap justify-center sm:justify-start">
            <span className="hover:text-slate-300 transition-colors">Licensed & Verified</span>
            <span>•</span>
            <span className="hover:text-slate-300 transition-colors">WhatsApp Verified</span>
            <span>•</span>
            <button 
              onClick={() => { window.location.href = "/terms"; }} 
              className="hover:text-emerald-400 font-semibold transition-colors bg-transparent border-none p-0 cursor-pointer text-xs focus:outline-none"
            >
              Terms of Service
            </button>
            <span>•</span>
            <button 
              onClick={() => { window.location.href = "/privacy"; }} 
              className="hover:text-emerald-400 font-semibold transition-colors bg-transparent border-none p-0 cursor-pointer text-xs focus:outline-none"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </footer>

      {/* Custom Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div id="logout-confirm-overlay" className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white">
              <h3 className="font-bold text-lg">Log Out of Shop Account?</h3>
              <p className="text-slate-300 text-xs mt-1">
                You are logging out of your active seller workspace.
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                Are you sure you want to end your session? You can easily sign back in at any time with your seller credentials.
              </p>
              <div className="flex gap-3">
                <button
                  id="cancel-logout-btn"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Stay Logged In
                </button>
                <button
                  id="confirm-logout-btn"
                  onClick={executeLogout}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                >
                  Yes, Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terms & Conditions Global Modal */}

      {/* "Near Me" live map — prompt approved sellers to enable location
          sharing after they log in, so their shop shows up on buyers' maps. */}
      {currentSeller && (
        <LocationSharingPrompt
          seller={currentSeller}
          onUpdated={(patch) => handleUpdateSeller({ ...currentSeller, ...patch })}
        />
      )}

    </div>
  );
}
