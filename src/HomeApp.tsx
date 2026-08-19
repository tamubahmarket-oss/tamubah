import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
// @ts-ignore
import tamubahLogo from "./assets/images/traditional_bag_logo_1784122537315.jpg";
import {
  ShoppingBag, User, Home, Search, Users, Megaphone,
  ChevronDown, LogOut, Store, Edit3, ShieldCheck
} from "lucide-react";
import { useLanguage } from "./lib/LanguageContext";
import { Seller } from "./types";
import HomePage from "./components/HomePage";
import BossKuChat from "./components/BossKuChat";
import { useAnnouncement, markAnnouncementSeen } from "./lib/announcementStore";

export default function HomeApp() {
  const { language, setLanguage, t } = useLanguage();
  const [currentSeller, setCurrentSeller] = useState<Seller | null>(null);
  const [headerSearchInput, setHeaderSearchInput] = useState("");
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [showAnnouncementPanel, setShowAnnouncementPanel] = useState(false);
  const accountPanelRef = useRef<HTMLDivElement>(null);
  const announcementPanelRef = useRef<HTMLDivElement>(null);
  const { announcement, isUnread: hasUnreadAnnouncement } = useAnnouncement();

  useEffect(() => {
    const savedSession = localStorage.getItem("sabah_seller_session");
    if (savedSession) {
      try {
        setCurrentSeller(JSON.parse(savedSession));
      } catch (e) {
        console.error("Failed to parse saved session", e);
      }
    }
  }, []);

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

  const hasSellerSession = (): boolean => !!localStorage.getItem("sabah_seller_session");

  const goToMarket = () => { window.location.href = "/market"; };
  const goToSellers = () => { window.location.href = "/sellers"; };
  const goToCommunity = () => { window.location.href = "/market?tab=community"; };
  const goToShop = () => { window.location.href = "/market?tab=shop"; };
  const goToSignIn = () => { window.location.href = "/signin"; };
  const goToJoinAsSeller = () => {
    window.location.href = hasSellerSession() ? "/market?tab=shop" : "/register";
  };

  const handleLogout = () => {
    localStorage.removeItem("sabah_seller_session");
    setCurrentSeller(null);
    setShowAccountPanel(false);
  };

  const handleHeaderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = headerSearchInput.trim();
    if (!query) return;
    window.location.href = `/market?search=${encodeURIComponent(query)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800 antialiased">
      {/* Header — matches the /market app header: logo, unified search, icon-only nav, account */}
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex items-center gap-3 md:gap-5">

          {/* Logo */}
          <div className="flex items-center select-none shrink-0">
            <div className="h-11 md:h-14 overflow-hidden rounded-xl bg-white px-2 flex items-center justify-center">
              <img
                src={tamubahLogo}
                alt="Digital Tamu Logo"
                className="h-22 md:h-28 object-contain -my-5"
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

          <div className="flex-1 sm:hidden" />

          {/* Icon-only Navigation */}
          <nav className="hidden sm:flex items-center gap-1 shrink-0">
            <button
              onClick={() => { window.location.href = "/"; }}
              title={language === "EN" ? "Home" : "Utama"}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer bg-emerald-50 text-emerald-700"
            >
              <Home className="w-5 h-5" />
            </button>
            <button
              onClick={goToMarket}
              title={t("explore_market")}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <ShoppingBag className="w-5 h-5" />
            </button>
            <button
              onClick={goToSellers}
              title={t("local_sellers")}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <User className="w-5 h-5" />
            </button>
            {currentSeller && currentSeller.isApproved && (
              <button
                onClick={goToCommunity}
                title="Community"
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <Users className="w-5 h-5" />
              </button>
            )}
            {currentSeller && (
              <div className="relative" ref={announcementPanelRef}>
                <button
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
                          onClick={goToShop}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                        >
                          <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                          {t("manage_my_shop")}
                        </button>
                        <button
                          onClick={goToShop}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                        >
                          <Edit3 className="w-4 h-4 text-slate-400 shrink-0" />
                          {language === "EN" ? "Edit Profile" : "Sunting Profil"}
                        </button>
                        {currentSeller.isApproved && (
                          <button
                            onClick={goToCommunity}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                          >
                            <Users className="w-4 h-4 text-slate-400 shrink-0" />
                            Community
                          </button>
                        )}
                        <div className="h-px bg-slate-100 my-1" />
                        <button
                          onClick={handleLogout}
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
                  onClick={goToSignIn}
                  className="px-3 md:px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-950 transition-colors cursor-pointer"
                >
                  {t("sign_in")}
                </button>
                <button
                  onClick={goToJoinAsSeller}
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

      <main className="flex-grow">
        <HomePage
          logoUrl={tamubahLogo}
          onLaunchMarket={goToMarket}
          onJoinAsSeller={goToJoinAsSeller}
        />
      </main>

      {/* Bossku AI shopping assistant — Home page only */}
      <BossKuChat />
    </div>
  );
}
