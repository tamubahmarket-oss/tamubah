import React from "react";
// @ts-ignore
import tamubahLogo from "./assets/images/traditional_bag_logo_1784122537315.jpg";
import { ShoppingBag, User, LogIn } from "lucide-react";
import { useLanguage } from "./lib/LanguageContext";
import HomePage from "./components/HomePage";

export default function HomeApp() {
  const { language, setLanguage, t } = useLanguage();

  const hasSellerSession = (): boolean => {
    return !!localStorage.getItem("sabah_seller_session");
  };

  const goToMarket = () => {
    window.location.href = "/market";
  };

  const goToSellers = () => {
    window.location.href = "/sellers";
  };

  const goToSignIn = () => {
    window.location.href = "/signin";
  };

  const goToJoinAsSeller = () => {
    window.location.href = hasSellerSession() ? "/market?tab=shop" : "/register";
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800 antialiased">
      {/* Lightweight header — full header/nav lives in the main app at /market */}
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 md:h-24 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex items-center select-none">
              <div className="h-14 md:h-16 overflow-hidden rounded-xl bg-white px-2.5 flex items-center justify-center">
                <img
                  src={tamubahLogo}
                  alt="Digital Tamu Logo"
                  className="h-28 md:h-32 object-contain -my-6"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 select-none">
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
          </div>

          <nav className="hidden sm:flex items-center bg-slate-100/80 p-1 rounded-2xl border border-slate-200/40">
            <button
              onClick={goToMarket}
              className="px-5 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-slate-800"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              {t("explore_market")}
            </button>
            <button
              onClick={goToSellers}
              className="px-5 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-slate-800"
            >
              <User className="w-3.5 h-3.5" />
              {t("local_sellers")}
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={goToSignIn}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-950 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              {t("sign_in")}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <HomePage
          logoUrl={tamubahLogo}
          onLaunchMarket={goToMarket}
          onJoinAsSeller={goToJoinAsSeller}
        />
      </main>
    </div>
  );
}
