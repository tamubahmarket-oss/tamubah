import React, { useState, useEffect } from "react";
// @ts-ignore
import tamubahLogo from "./assets/images/traditional_bag_logo_1784122537315.jpg";
import { useLanguage } from "./lib/LanguageContext";
import { 
  ShoppingBag, Store, User, ChevronRight, MapPin, 
  CheckCircle, Plus, Info, Landmark, HelpCircle, ArrowRight, Home
} from "lucide-react";
import { Seller, Product, SABAH_LOCATIONS } from "./types";
import MarketGrid from "./components/MarketGrid";
import ShopDashboard from "./components/ShopDashboard";
import SellerList from "./components/SellerList";
import PendingApproval from "./components/PendingApproval";
import ReceiptView from "./components/ReceiptView";

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"market" | "sellers" | "shop">(() => {
    const path = window.location.pathname.replace(/^\/+/, "").split("/")[0];
    return path === "sellers" ? "sellers" : "market";
  });
  const [currentSeller, setCurrentSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  const [marketLocationFilter, setMarketLocationFilter] = useState<string>("All");
  
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  // If this page was opened via a shared receipt link (?receipt=RCPT_ID),
  // show a standalone printable receipt view instead of the normal app shell.
  const [sharedReceiptId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("receipt"));

  const handleDistrictClick = (districtName: string) => {
    setMarketLocationFilter(districtName);
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
    }
    if (tabParam) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Force activeTab to "market" if not logged in
  useEffect(() => {
    if (!currentSeller && activeTab === "shop") {
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
        <div className="max-w-7xl mx-auto px-4 h-20 md:h-24 flex items-center justify-between gap-4">
          
          {/* Logo Brand & Language Selector */}
          <div className="flex items-center gap-3 md:gap-4">
            <div 
              onClick={() => { window.location.href = "/"; }} 
              className="flex items-center cursor-pointer select-none group"
            >
              <div className="h-14 md:h-16 overflow-hidden rounded-xl bg-white px-2.5 flex items-center justify-center transition-all duration-300">
                <img 
                  src={tamubahLogo} 
                  alt="Digital Tamu Logo" 
                  className="h-28 md:h-32 object-contain -my-6 group-hover:scale-[1.03] transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Language Selector */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 select-none">
              <button
                onClick={() => setLanguage("EN")}
                className={`px-2 py-1.5 text-[10px] font-black rounded-md transition-all cursor-pointer ${
                  language === "EN"
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("BM")}
                className={`px-2 py-1.5 text-[10px] font-black rounded-md transition-all cursor-pointer ${
                  language === "BM"
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                BM
              </button>
            </div>
          </div>

          {/* Navigation Tabs (always visible for public pages, seller space accessible if signed in) */}
          {activeTab !== "shop" && (
            <nav className="hidden sm:flex items-center bg-slate-100/80 p-1 rounded-2xl border border-slate-200/40">
              <button
                id="nav-tab-home"
                onClick={() => { window.location.href = "/"; }}
                className="px-5 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-slate-800"
              >
                <Home className="w-3.5 h-3.5" />
                {language === "EN" ? "Home" : "Utama"}
              </button>
              <button
                id="nav-tab-market"
                onClick={() => setActiveTab("market")}
                className={`px-5 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "market"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {t("explore_market")}
              </button>
              <button
                id="nav-tab-sellers"
                onClick={() => setActiveTab("sellers")}
                className={`px-5 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "sellers"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                {t("local_sellers")}
              </button>
              {currentSeller && (
                <button
                  id="nav-tab-shop"
                  onClick={() => setActiveTab("shop")}
                  className={`px-5 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "shop"
                      ? "bg-white text-emerald-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  {t("seller_space")}
                </button>
              )}

            </nav>
          )}

          {/* User Section (Right corner) */}
          <div className="flex items-center gap-3">
            {currentSeller ? (
              <div className="flex items-center gap-3">
                <button
                  id="header-seller-profile"
                  onClick={() => setActiveTab("shop")}
                  className="hidden md:flex flex-col items-end text-right cursor-pointer group"
                >
                  <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                    {currentSeller.businessName}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {t("manage_my_shop")}
                  </span>
                </button>
                <button
                  id="dashboard-avatar-btn"
                  onClick={() => setActiveTab("shop")}
                  className="w-10 h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shadow-sm hover:shadow transition-all cursor-pointer"
                  title="Go to Shop Dashboard"
                >
                  <User className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  id="header-login-btn"
                  onClick={() => { window.location.href = "/signin"; }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-950 transition-colors cursor-pointer"
                >
                  {t("sign_in")}
                </button>
                <button
                  id="header-register-btn"
                  onClick={() => { window.location.href = "/register"; }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                >
                  {t("join_as_seller")}
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Mobile Sticky Tab Navigation */}
      {activeTab !== "shop" && (
        <div className="sm:hidden sticky top-16 z-30 bg-white/95 border-b border-slate-100 p-2 flex gap-2 shadow-sm">
          <button
            id="mobile-nav-home"
            onClick={() => { window.location.href = "/"; }}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-slate-500"
          >
            <Home className="w-4 h-4" />
            Home
          </button>
          <button
            id="mobile-nav-market"
            onClick={() => setActiveTab("market")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "market"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold"
                : "text-slate-500"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Market
          </button>
          <button
            id="mobile-nav-sellers"
            onClick={() => setActiveTab("sellers")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "sellers"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold"
                : "text-slate-500"
            }`}
          >
            <User className="w-4 h-4" />
            Sellers
          </button>
          {currentSeller && (
            <button
              id="mobile-nav-shop"
              onClick={() => setActiveTab("shop")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "shop"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold"
                  : "text-slate-500"
              }`}
            >
              <Store className="w-4 h-4" />
              My Shop
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
          />
        ) : activeTab === "sellers" ? (
          <SellerList 
            products={products} 
            onRefreshProducts={fetchProducts}
          />
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
                <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-100 uppercase tracking-widest inline-block">
                  Seller Portal
                </span>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 font-sans leading-tight">
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

          {currentSeller && activeTab !== "shop" && (
            <div>
              <h4 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4">My Shop Account</h4>
              <p className="text-slate-400 text-xs leading-relaxed mb-4">
                You are logged in as <span className="text-emerald-400 font-semibold">{currentSeller.businessName}</span>. Go to your Seller Space to add new products or update your public profile.
              </p>
              <button
                onClick={() => setActiveTab("shop")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
              >
                Go to Seller Space
              </button>
            </div>
          )}
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


    </div>
  );
}
