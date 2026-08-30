import React, { useState } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Seller } from "../types";
import { useLanguage } from "../lib/LanguageContext";
import { geolocationErrorMessage } from "../lib/geolocationErrors";

interface LocationSharingPromptProps {
  seller: Seller;
  onUpdated: (patch: Partial<Seller>) => void;
}

const DISMISS_KEY = "tamubah_location_prompt_dismissed";

export default function LocationSharingPrompt({ seller, onUpdated }: LocationSharingPromptProps) {
  const { language } = useLanguage();
  const isEN = language === "EN";
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "true");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only for approved sellers who haven't already turned this on.
  const shouldShow = !!seller.isApproved && !seller.locationSharingEnabled && !dismissed;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  const handleEnable = () => {
    if (!("geolocation" in navigator)) {
      setError(isEN ? "This device/browser doesn't support location sharing." : "Peranti/pelayar ini tidak menyokong perkongsian lokasi.");
      return;
    }
    setRequesting(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/sellers/${seller.id}/location`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              locationSharingEnabled: true,
            }),
          });
          if (!res.ok) throw new Error("Request failed");
          onUpdated({
            locationSharingEnabled: true,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        } catch {
          setError(isEN ? "Couldn't save your location. Please try again." : "Gagal simpan lokasi. Sila cuba lagi.");
        } finally {
          setRequesting(false);
        }
      },
      (err) => {
        setRequesting(false);
        setError(geolocationErrorMessage(err, isEN));
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 }
    );
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 relative"
          >
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
              <MapPin className="w-7 h-7 text-emerald-600" />
            </div>

            <h3 className="text-lg font-extrabold text-slate-900 mb-1.5">
              {isEN ? "Show your shop on the Near Me map?" : "Tunjukkan kedai anda di peta Berhampiran Saya?"}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              {isEN
                ? "Turn on location sharing so nearby buyers can find you on TamuBah's live map. You can turn this off anytime from your dashboard."
                : "Hidupkan perkongsian lokasi supaya pembeli berhampiran boleh jumpa kedai anda di peta langsung TamuBah. Anda boleh matikan bila-bila masa dari papan pemuka anda."}
            </p>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                disabled={requesting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {isEN ? "Not Now" : "Nanti Sahaja"}
              </button>
              <button
                onClick={handleEnable}
                disabled={requesting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                {isEN ? "Enable" : "Aktifkan"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
