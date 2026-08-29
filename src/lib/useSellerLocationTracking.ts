import { useEffect, useRef, useState } from "react";

// Continuously tracks and reports a seller's position to the backend while
// `enabled` is true, using navigator.geolocation.watchPosition.
//
// IMPORTANT LIMITATION (web platform, not something this hook can work
// around): mobile browsers — Safari on iOS in particular — pause
// watchPosition callbacks once the tab is backgrounded/the screen locks.
// True always-on background tracking (like a native app) isn't something a
// website can do; this tracks live for as long as the seller has TamuBah
// open and active, which is the practical ceiling for a web app.
const MIN_UPDATE_INTERVAL_MS = 12_000; // don't PATCH more than ~every 12s
const MIN_MOVE_METERS = 25; // ...unless they've moved at least this far

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type LocationTrackingStatus = "idle" | "tracking" | "error" | "unsupported";

export function useSellerLocationTracking(sellerId: string | undefined, enabled: boolean) {
  const [status, setStatus] = useState<LocationTrackingStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    if (!enabled || !sellerId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setStatus("idle");
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setErrorMessage("This device/browser doesn't support location sharing.");
      return;
    }

    const sendUpdate = async (lat: number, lng: number) => {
      try {
        await fetch(`/api/sellers/${sellerId}/location`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: lat, longitude: lng, locationSharingEnabled: true }),
        });
        lastSentRef.current = { lat, lng, at: Date.now() };
      } catch {
        // A single failed update isn't worth surfacing to the seller —
        // watchPosition will fire again shortly and retry naturally.
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus("tracking");
        setErrorMessage(null);
        const { latitude, longitude } = pos.coords;
        const last = lastSentRef.current;
        const now = Date.now();
        const movedFarEnough = !last || distanceMeters(last.lat, last.lng, latitude, longitude) >= MIN_MOVE_METERS;
        const enoughTimePassed = !last || now - last.at >= MIN_UPDATE_INTERVAL_MS;
        if (movedFarEnough || enoughTimePassed) {
          sendUpdate(latitude, longitude);
        }
      },
      (err) => {
        setStatus("error");
        setErrorMessage(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Turn it on in your browser/device settings to keep sharing your shop's location."
            : "Couldn't get your location right now. Will keep trying."
        );
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [sellerId, enabled]);

  return { status, errorMessage };
}
