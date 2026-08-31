import React, { useEffect, useRef, useState } from "react";
import { X, MapPin, Loader2, AlertCircle, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../lib/LanguageContext";
import { loadGoogleMaps } from "../lib/googleMapsLoader";
import { geolocationErrorMessage } from "../lib/geolocationErrors";
import { CategoryIcon } from "../lib/categoryIcons";

interface NearbySeller {
  id: string;
  businessName: string;
  category: string;
  location: string;
  verificationTier: string;
  latitude: number;
  longitude: number;
  updatedAt?: string;
  logoUrl?: string;
  distanceKm: number;
}

interface NearMeMapProps {
  open: boolean;
  onClose: () => void;
  onViewSellerShop?: (sellerId: string, businessName?: string) => void;
}

type LoadState = "idle" | "locating" | "loading-map" | "ready" | "permission-denied" | "error";

const RADIUS_KM = 15;

// Hides restaurant/hall/shop/attraction POI icons and labels, plus transit
// stations — those belong to Google's own business listings, not TamuBah's,
// and clutter the map with names unrelated to our sellers. Roads, water,
// and area/city/district labels are kept since buyers still need those for
// orientation (which is the actual point of a Sabah district-based map).
const CLEAN_MAP_STYLE: any[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export default function NearMeMap({ open, onClose, onViewSellerShop }: NearMeMapProps) {
  const { language } = useLanguage();
  const isEN = language === "EN";
  const [state, setState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sellers, setSellers] = useState<NearbySeller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<NearbySeller | null>(null);
  const [locatingMe, setLocatingMe] = useState(false);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const buyerMarkerRef = useRef<any>(null);
  const sellerMarkersRef = useRef<Map<string, any>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const buyerCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Reset everything when the popup closes, so reopening starts fresh.
  useEffect(() => {
    if (!open) {
      wsRef.current?.close();
      wsRef.current = null;
      sellerMarkersRef.current.forEach((m) => m.setMap(null));
      sellerMarkersRef.current.clear();
      buyerMarkerRef.current = null;
      mapRef.current = null;
      setState("idle");
      setErrorMessage(null);
      setSellers([]);
      setSelectedSeller(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setState("locating");
      if (!("geolocation" in navigator)) {
        setState("error");
        setErrorMessage(isEN ? "This device/browser doesn't support location." : "Peranti/pelayar ini tidak menyokong lokasi.");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          buyerCoordsRef.current = coords;

          try {
            setState("loading-map");
            await loadGoogleMaps();
          } catch (e) {
            // Logged so the real cause (bad/missing API key, API not
            // enabled, referrer restriction, billing not set up, etc.) is
            // visible in the browser console instead of silently swallowed.
            console.error("NearMeMap: failed to load Google Maps script:", e);
            if (!cancelled) {
              setState("error");
              setErrorMessage(
                isEN
                  ? `Couldn't load Google Maps (${(e as Error)?.message || "unknown error"}). This usually means the Maps API key is missing, restricted, or the Maps JavaScript API isn't enabled/billed yet.`
                  : `Gagal muatkan Google Maps (${(e as Error)?.message || "ralat tidak diketahui"}). Ini biasanya bermakna kunci API Maps tiada, disekat, atau Maps JavaScript API belum diaktifkan/tiada bil.`
              );
            }
            return;
          }
          if (cancelled) return;

          try {
            const res = await fetch(`/api/sellers/nearby?lat=${coords.lat}&lng=${coords.lng}&radiusKm=${RADIUS_KM}`);
            if (!res.ok) {
              const errText = await res.text().catch(() => "");
              throw new Error(`Server responded ${res.status}: ${errText.slice(0, 200)}`);
            }
            const data = await res.json();
            if (cancelled) return;
            const initialSellers: NearbySeller[] = data.sellers || [];
            setSellers(initialSellers);

            initMap(coords, initialSellers);
            connectRealtime();
            setState("ready");
          } catch (e) {
            console.error("NearMeMap: failed to fetch nearby sellers:", e);
            if (!cancelled) {
              setState("error");
              setErrorMessage(
                isEN ? "Couldn't load nearby shops right now. Please try again." : "Gagal muatkan kedai berhampiran buat masa ini. Sila cuba lagi."
              );
            }
          }
        },
        (err) => {
          if (cancelled) return;
          setState(err.code === err.PERMISSION_DENIED ? "permission-denied" : "error");
          setErrorMessage(geolocationErrorMessage(err, isEN));
        },
        { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 }
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function initMap(center: { lat: number; lng: number }, initialSellers: NearbySeller[]) {
    const google = (window as any).google;
    if (!mapDivRef.current || !google?.maps) return;

    const map = new google.maps.Map(mapDivRef.current, {
      center,
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false,
      styles: CLEAN_MAP_STYLE,
    });
    mapRef.current = map;

    // "You are here" marker — a plain blue dot, distinct from shop pins.
    buyerMarkerRef.current = new google.maps.Marker({
      position: center,
      map,
      title: isEN ? "You are here" : "Anda di sini",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#2563eb",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      zIndex: 999,
    });

    initialSellers.forEach((s) => upsertSellerMarker(s));
  }

  function upsertSellerMarker(seller: NearbySeller) {
    const google = (window as any).google;
    const map = mapRef.current;
    if (!google?.maps || !map) return;

    const existing = sellerMarkersRef.current.get(seller.id);
    const position = { lat: seller.latitude, lng: seller.longitude };

    if (existing) {
      existing.setPosition(position);
      return;
    }

    const marker = new google.maps.Marker({
      position,
      map,
      title: seller.businessName,
      icon: {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
        fillColor: "#14432E",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 1.5,
        scale: 1.6,
        anchor: new google.maps.Point(12, 22),
      },
    });
    marker.addListener("click", () => setSelectedSeller(seller));
    sellerMarkersRef.current.set(seller.id, marker);
  }

  function removeSellerMarker(sellerId: string) {
    const marker = sellerMarkersRef.current.get(sellerId);
    if (marker) {
      marker.setMap(null);
      sellerMarkersRef.current.delete(sellerId);
    }
    setSellers((prev) => prev.filter((s) => s.id !== sellerId));
  }

  // Re-fetches a fresh position (not just re-centering on the stale one —
  // the buyer may have moved since the popup opened) and recentres the map,
  // moves the "you are here" marker, and refreshes the nearby-sellers list
  // from that new point.
  function handleLocateMe() {
    if (!("geolocation" in navigator) || locatingMe) return;
    setLocatingMe(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        buyerCoordsRef.current = coords;
        const google = (window as any).google;
        if (mapRef.current && google?.maps) {
          mapRef.current.panTo(coords);
          mapRef.current.setZoom(13);
          buyerMarkerRef.current?.setPosition(coords);
        }
        try {
          const res = await fetch(`/api/sellers/nearby?lat=${coords.lat}&lng=${coords.lng}&radiusKm=${RADIUS_KM}`);
          if (res.ok) {
            const data = await res.json();
            const refreshed: NearbySeller[] = data.sellers || [];
            setSellers(refreshed);
            const refreshedIds = new Set(refreshed.map((s) => s.id));
            sellerMarkersRef.current.forEach((marker, id) => {
              if (!refreshedIds.has(id)) {
                marker.setMap(null);
                sellerMarkersRef.current.delete(id);
              }
            });
            refreshed.forEach((s) => upsertSellerMarker(s));
          }
        } catch {
          // Keep showing the previous list rather than clearing it on a
          // transient refresh failure — the map recentring above still
          // succeeded either way.
        } finally {
          setLocatingMe(false);
        }
      },
      () => setLocatingMe(false),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 30_000 }
    );
  }

  function connectRealtime() {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/nearby`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "location_update") {
          const buyer = buyerCoordsRef.current;
          const distanceKm = buyer ? haversine(buyer.lat, buyer.lng, msg.latitude, msg.longitude) : 0;
          if (distanceKm > RADIUS_KM) {
            // Moved out of range — drop it if we were showing it.
            removeSellerMarker(msg.sellerId);
            return;
          }
          const updated: NearbySeller = {
            id: msg.sellerId,
            businessName: msg.businessName,
            category: msg.category,
            location: "",
            verificationTier: msg.verificationTier || "None",
            latitude: msg.latitude,
            longitude: msg.longitude,
            updatedAt: msg.updatedAt,
            distanceKm,
          };
          upsertSellerMarker(updated);
          setSellers((prev) => {
            const idx = prev.findIndex((s) => s.id === updated.id);
            if (idx === -1) return [...prev, updated].sort((a, b) => a.distanceKm - b.distanceKm);
            const next = [...prev];
            next[idx] = { ...next[idx], ...updated };
            return next.sort((a, b) => a.distanceKm - b.distanceKm);
          });
        } else if (msg.type === "location_removed") {
          removeSellerMarker(msg.sellerId);
        }
      } catch {
        // ignore malformed messages
      }
    };
    // A dropped connection just means live updates pause — the initial
    // snapshot from GET /api/sellers/nearby is still shown, so this fails
    // quietly rather than interrupting the buyer.
    ws.onerror = () => {};
  }

  function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/60 flex items-end md:items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full md:max-w-3xl md:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl h-[85vh] md:h-[80vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900">{isEN ? "Shops Near Me" : "Kedai Berhampiran Saya"}</h3>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative flex-1 min-h-0">
              {(state === "locating" || state === "loading-map") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 z-10">
                  <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
                  <p className="text-sm text-slate-500">
                    {state === "locating"
                      ? (isEN ? "Getting your location…" : "Mendapatkan lokasi anda…")
                      : (isEN ? "Loading map…" : "Memuatkan peta…")}
                  </p>
                </div>
              )}

              {(state === "error" || state === "permission-denied") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 z-10 px-8 text-center">
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                  <p className="text-sm text-slate-600">{errorMessage}</p>
                </div>
              )}

              <div ref={mapDivRef} className="w-full h-full" />

              {state === "ready" && (
                <button
                  onClick={handleLocateMe}
                  disabled={locatingMe}
                  title={isEN ? "Locate me" : "Cari lokasi saya"}
                  className="absolute bottom-44 right-3 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-60 z-10"
                >
                  {locatingMe ? (
                    <Loader2 className="w-4.5 h-4.5 text-emerald-600 animate-spin" />
                  ) : (
                    <Navigation className="w-4.5 h-4.5 text-emerald-600" />
                  )}
                </button>
              )}

              {state === "ready" && (
                <div className="absolute bottom-0 left-0 right-0 max-h-40 overflow-y-auto bg-white/95 backdrop-blur border-t border-slate-100">
                  {sellers.length === 0 ? (
                    <p className="text-xs text-slate-400 px-4 py-3">
                      {isEN
                        ? `No sellers sharing their location within ${RADIUS_KM}km yet.`
                        : `Belum ada penjual kongsi lokasi dalam ${RADIUS_KM}km lagi.`}
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-50">
                      {sellers.map((s) => (
                        <li
                          key={s.id}
                          onClick={() => {
                            setSelectedSeller(s);
                            mapRef.current?.panTo({ lat: s.latitude, lng: s.longitude });
                          }}
                          className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-slate-50"
                        >
                          <CategoryIcon category={s.category} className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-sm font-semibold text-slate-800 truncate flex-1">{s.businessName}</span>
                          <span className="text-xs text-slate-400 shrink-0">{s.distanceKm.toFixed(1)} km</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {selectedSeller && (
                <div className="absolute top-3 left-3 right-3 md:left-auto md:right-3 md:w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-20">
                  <button
                    onClick={() => setSelectedSeller(null)}
                    className="absolute top-2.5 right-2.5 text-slate-300 hover:text-slate-500"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {selectedSeller.distanceKm.toFixed(1)} km {isEN ? "away" : "jauh"}
                  </div>
                  <p className="font-extrabold text-slate-900 mb-0.5">{selectedSeller.businessName}</p>
                  <p className="text-xs text-slate-500 mb-3">{selectedSeller.category}</p>
                  <button
                    onClick={() => {
                      onViewSellerShop?.(selectedSeller.id, selectedSeller.businessName);
                      onClose();
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2 rounded-xl"
                  >
                    {isEN ? "View Shop" : "Lihat Kedai"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
