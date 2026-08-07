import React, { useState } from "react";
// @ts-ignore
import tamubahLogo from "./assets/images/traditional_bag_logo_1784122537315.jpg";
import TermsModal from "./components/TermsModal";

function getTabFromPath(): "terms" | "privacy" {
  return window.location.pathname.startsWith("/privacy") ? "privacy" : "terms";
}

export default function TermsApp() {
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">(getTabFromPath());

  const handleSwitchTab = (tab: "terms" | "privacy") => {
    const path = tab === "privacy" ? "/privacy" : "/terms";
    window.history.pushState({}, "", path);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800 antialiased">
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 md:h-24 flex items-center justify-between gap-4">
          <div
            onClick={() => { window.location.href = "/"; }}
            className="flex items-center cursor-pointer select-none group"
          >
            <div className="h-14 md:h-16 overflow-hidden rounded-xl bg-white px-2.5 flex items-center justify-center">
              <img
                src={tamubahLogo}
                alt="Digital Tamu Logo"
                className="h-28 md:h-32 object-contain -my-6 group-hover:scale-[1.03] transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-start justify-center px-4 py-10 md:py-16">
        <TermsModal
          isOpen={true}
          standalone
          defaultTab={activeTab}
          onSwitchTab={handleSwitchTab}
          onClose={() => { window.location.href = "/"; }}
        />
      </main>
    </div>
  );
}
