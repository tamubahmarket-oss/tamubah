// Turns a raw GeolocationPositionError into a clear, actionable message —
// distinguishing "you said no" (permission) from "the device/OS never
// answered" (timeout) from "the device answered but found nothing"
// (unavailable), since those need different fixes from the user's side.
export function geolocationErrorMessage(err: GeolocationPositionError, isEN: boolean): string {
  if (err.code === err.PERMISSION_DENIED) {
    return isEN
      ? "Location permission was denied. Allow it in your browser's site settings, then try again."
      : "Kebenaran lokasi ditolak. Benarkan dalam tetapan laman pelayar anda, kemudian cuba lagi.";
  }
  if (err.code === err.TIMEOUT) {
    return isEN
      ? "Location took too long to respond. Check that Location Services and Wi-Fi are turned on for your device/browser, then try again."
      : "Lokasi mengambil masa terlalu lama untuk bertindak balas. Pastikan Location Services dan Wi-Fi dihidupkan untuk peranti/pelayar anda, kemudian cuba lagi.";
  }
  // POSITION_UNAVAILABLE — the OS answered but couldn't resolve a position.
  return isEN
    ? "Your device couldn't determine a location right now. Check your device's location settings and try again."
    : "Peranti anda tidak dapat tentukan lokasi buat masa ini. Semak tetapan lokasi peranti anda dan cuba lagi.";
}
