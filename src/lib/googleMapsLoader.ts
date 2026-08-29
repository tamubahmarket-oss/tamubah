// Loads the Google Maps JavaScript API once via a plain <script> tag, rather
// than pulling in a wrapper npm package — keeps this feature dependency-free
// on top of what's already in package.json. Safe to call loadGoogleMaps()
// multiple times from different components; the script only loads once.

declare global {
  interface Window {
    google?: any;
    __tamubahGoogleMapsLoadPromise?: Promise<void>;
  }
}

const SCRIPT_ID = "tamubah-google-maps-script";

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadGoogleMaps() can only run in the browser."));
  }
  if (window.google?.maps) {
    return Promise.resolve();
  }
  if (window.__tamubahGoogleMapsLoadPromise) {
    return window.__tamubahGoogleMapsLoadPromise;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!apiKey) {
    return Promise.reject(
      new Error(
        "Missing VITE_GOOGLE_MAPS_API_KEY. Add it to your .env file (see .env.example) and restart the dev server."
      )
    );
  }

  window.__tamubahGoogleMapsLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps.")));
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=marker&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(script);
  });

  return window.__tamubahGoogleMapsLoadPromise;
}
