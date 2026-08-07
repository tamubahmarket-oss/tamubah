import React, { useState, useEffect } from "react";
import { Story } from "../types";
import StoryViewer from "./StoryViewer";

const SEEN_STORAGE_KEY = "tamubah_seen_story_ids";

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markSeen(ids: string[]) {
  try {
    const current = getSeenIds();
    ids.forEach((id) => current.add(id));
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...current]));
  } catch {
    // ignore storage errors (private browsing etc.)
  }
}

export default function StoryBar() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSellerIndex, setOpenSellerIndex] = useState<number | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(getSeenIds());

  const fetchStories = () => {
    fetch("/api/stories")
      .then((res) => res.json())
      .then((data) => setStories(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load stories", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStories();
  }, []);

  if (loading || stories.length === 0) return null;

  // Group stories by seller, most-recently-active seller first
  const sellerOrder: string[] = [];
  const bySeller = new Map<string, Story[]>();
  stories.forEach((s) => {
    if (!bySeller.has(s.sellerId)) {
      bySeller.set(s.sellerId, []);
      sellerOrder.push(s.sellerId);
    }
    bySeller.get(s.sellerId)!.push(s);
  });
  // Oldest-first within each seller's own story set (classic story order)
  bySeller.forEach((arr) => arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));

  const groups = sellerOrder.map((sellerId) => bySeller.get(sellerId)!);

  const isGroupUnseen = (group: Story[]) => group.some((s) => !seenIds.has(s.id));

  const handleStoriesViewed = (ids: string[]) => {
    markSeen(ids);
    setSeenIds(getSeenIds());
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-2 px-1 -mx-1" style={{ scrollbarWidth: "none" }}>
        {groups.map((group, idx) => {
          const first = group[0];
          const unseen = isGroupUnseen(group);
          return (
            <button
              key={first.sellerId}
              onClick={() => setOpenSellerIndex(idx)}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group/story"
            >
              <div
                className={`w-16 h-16 rounded-full p-[2.5px] transition-transform group-hover/story:scale-105 ${
                  unseen ? "bg-gradient-to-tr from-amber-400 via-rose-500 to-emerald-500" : "bg-slate-200"
                }`}
              >
                <div className="w-full h-full rounded-full bg-white p-[2px]">
                  <div className="w-full h-full rounded-full overflow-hidden bg-emerald-50 flex items-center justify-center text-emerald-800 font-bold text-sm">
                    {first.sellerLogoUrl ? (
                      <img src={first.sellerLogoUrl} alt={first.businessName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      first.businessName?.charAt(0) || "T"
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-600 max-w-[68px] truncate">
                {first.businessName}
              </span>
            </button>
          );
        })}
      </div>

      {openSellerIndex !== null && (
        <StoryViewer
          groups={groups}
          startIndex={openSellerIndex}
          onClose={() => setOpenSellerIndex(null)}
          onStoriesViewed={handleStoriesViewed}
        />
      )}
    </>
  );
}
