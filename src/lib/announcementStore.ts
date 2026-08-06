import { useEffect, useState } from "react";

/**
 * Lightweight platform announcement banner, set by an admin and shown to
 * every signed-in seller via a red "unread" dot on the header's Announcement
 * icon. There's no announcements table in the schema, so this is stored in
 * localStorage; it's a small, self-contained feature that doesn't need a
 * backend migration to work.
 */

const ANNOUNCEMENT_KEY = "tamubah_platform_announcement_v1";
const SEEN_KEY = "tamubah_announcement_last_seen_v1";
const EVENT_NAME = "tamubah:announcement-changed";

export interface PlatformAnnouncement {
  message: string;
  createdAt: string;
}

export function getAnnouncement(): PlatformAnnouncement | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANNOUNCEMENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAnnouncement(message: string): void {
  if (typeof window === "undefined") return;
  const trimmed = message.trim();
  if (!trimmed) {
    window.localStorage.removeItem(ANNOUNCEMENT_KEY);
  } else {
    const payload: PlatformAnnouncement = { message: trimmed, createdAt: new Date().toISOString() };
    window.localStorage.setItem(ANNOUNCEMENT_KEY, JSON.stringify(payload));
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function markAnnouncementSeen(): void {
  const current = getAnnouncement();
  if (typeof window === "undefined" || !current) return;
  window.localStorage.setItem(SEEN_KEY, current.createdAt);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/** React hook: current announcement + whether it's unread by this browser. */
export function useAnnouncement() {
  const [announcement, setAnnouncementState] = useState<PlatformAnnouncement | null>(() => getAnnouncement());
  const [lastSeen, setLastSeen] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem(SEEN_KEY) : null
  );

  useEffect(() => {
    const refresh = () => {
      setAnnouncementState(getAnnouncement());
      setLastSeen(typeof window !== "undefined" ? window.localStorage.getItem(SEEN_KEY) : null);
    };
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const isUnread = !!announcement && announcement.createdAt !== lastSeen;
  return { announcement, isUnread };
}
