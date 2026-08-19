import React, { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Phone, ShieldCheck, MapPin, Heart } from "lucide-react";
import { Story } from "../types";

interface StoryViewerProps {
  groups: Story[][];
  startIndex: number;
  onClose: () => void;
  onStoriesViewed: (ids: string[]) => void;
}

const IMAGE_DURATION_MS = 5000;
const VIEWER_STORAGE_KEY = "tamubah_story_viewer_id";
const LIKE_FLUSH_DELAY_MS = 700;

function getOrCreateViewerId(): string {
  try {
    let id = localStorage.getItem(VIEWER_STORAGE_KEY);
    if (!id) {
      id = "viewer_" + Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
      localStorage.setItem(VIEWER_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "viewer_" + Math.random().toString(36).substr(2, 12);
  }
}

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

function getWhatsAppLink(phoneNumber: string, businessName: string): string {
  let cleanPhone = phoneNumber.replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) cleanPhone = "6" + cleanPhone;
  else if (cleanPhone.startsWith("1")) cleanPhone = "60" + cleanPhone;
  else if (cleanPhone.length > 0 && !cleanPhone.startsWith("60")) cleanPhone = "60" + cleanPhone;
  const message = `Hi ${businessName}, I saw your story on TamuBah!`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

interface FlyingHeart {
  id: number;
  left: number;
}

export default function StoryViewer({ groups, startIndex, onClose, onStoriesViewed }: StoryViewerProps) {
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [hearts, setHearts] = useState<FlyingHeart[]>([]);
  const viewedRef = useRef<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const viewerIdRef = useRef<string>("");
  const heartIdRef = useRef(0);
  const pendingLikesRef = useRef<Map<string, number>>(new Map());
  const likeFlushTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const nextPreloadedRef = useRef<Set<string>>(new Set());

  const group = groups[groupIndex];
  const story = group?.[storyIndex];

  useEffect(() => {
    viewerIdRef.current = getOrCreateViewerId();
  }, []);

  const goNextStory = () => {
    if (!group) return;
    if (storyIndex < group.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
    } else {
      finishAndClose();
    }
  };

  const goPrevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((g) => g - 1);
      setStoryIndex(prevGroup.length - 1);
    }
  };

  const finishAndClose = () => {
    onStoriesViewed([...viewedRef.current]);
    onClose();
  };

  const handleCloseClick = () => {
    onStoriesViewed([...viewedRef.current]);
    onClose();
  };

  // Preload an image so the browser has it cached before we navigate to it —
  // this is what actually removes the "next shop but previous story still
  // showing" lag: without it the old <img> keeps painting its last frame
  // while the new one downloads.
  const preloadImage = (url?: string) => {
    if (!url || nextPreloadedRef.current.has(url)) return;
    nextPreloadedRef.current.add(url);
    const img = new Image();
    img.src = url;
  };

  // Mark current story as viewed, record it server-side, drive the progress
  // bar, and warm the cache for whatever comes next.
  useEffect(() => {
    if (!story) return;
    setMediaReady(false);

    const alreadyViewed = viewedRef.current.has(story.id);
    viewedRef.current.add(story.id);
    if (!alreadyViewed && viewerIdRef.current) {
      fetch(`/api/stories/${story.id}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerId: viewerIdRef.current }),
      }).catch(() => {});
    }

    // Warm the cache for the next story (within this group or the next one)
    const nextInGroup = group?.[storyIndex + 1];
    const nextGroupFirst = !nextInGroup ? groups[groupIndex + 1]?.[0] : undefined;
    const upcoming = nextInGroup || nextGroupFirst;
    if (upcoming?.mediaType === "image") preloadImage(upcoming.mediaUrl);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [groupIndex, storyIndex]);

  // Drive the progress bar only once the current media has actually loaded —
  // this stops the bar (and auto-advance) from racing ahead while the image
  // is still downloading, which is what made it feel laggy/desynced.
  useEffect(() => {
    if (!story || !mediaReady) return;
    setProgress(0);
    startTimeRef.current = Date.now();

    if (story.mediaType === "image") {
      const tick = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const pct = Math.min(100, (elapsed / IMAGE_DURATION_MS) * 100);
        setProgress(pct);
        if (pct >= 100) {
          goNextStory();
        } else {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
    // video progress is driven by the <video> element's timeupdate/ended events instead
  }, [groupIndex, storyIndex, mediaReady]);

  const handleVideoTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  };

  const flushLikes = (storyId: string) => {
    const count = pendingLikesRef.current.get(storyId);
    pendingLikesRef.current.delete(storyId);
    if (!count) return;
    fetch(`/api/stories/${storyId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    }).catch(() => {});
  };

  const handleLoveTap = (clientX: number) => {
    if (!story) return;

    // Spawn a flying heart from roughly where the tap happened.
    const container = document.getElementById("bossku-story-stage");
    const rect = container?.getBoundingClientRect();
    const leftPct = rect ? ((clientX - rect.left) / rect.width) * 100 : 50;
    const id = heartIdRef.current++;
    setHearts((prev) => [...prev, { id, left: Math.min(90, Math.max(10, leftPct)) }]);
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, 1400);

    // Batch the actual network call — a burst of taps sends one request.
    const current = pendingLikesRef.current.get(story.id) || 0;
    pendingLikesRef.current.set(story.id, current + 1);
    const storyId = story.id;
    if (likeFlushTimerRef.current[storyId]) clearTimeout(likeFlushTimerRef.current[storyId]);
    likeFlushTimerRef.current[storyId] = setTimeout(() => flushLikes(storyId), LIKE_FLUSH_DELAY_MS);
  };

  // Flush any pending likes immediately when leaving the viewer.
  useEffect(() => {
    return () => {
      Object.keys(likeFlushTimerRef.current).forEach((sid) => {
        clearTimeout(likeFlushTimerRef.current[sid]);
        flushLikes(sid);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!story || !group) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center select-none">
      <div id="bossku-story-stage" className="relative w-full h-full max-w-md mx-auto bg-black overflow-hidden">

        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1.5">
          {group.map((s, idx) => (
            <div key={s.id} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{
                  width: idx < storyIndex ? "100%" : idx === storyIndex ? `${progress}%` : "0%",
                  transition: idx === storyIndex && story.mediaType === "video" ? "width 0.1s linear" : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-3 right-3 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-emerald-800 border border-white/30 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {story.sellerLogoUrl ? (
                <img src={story.sellerLogoUrl} alt={story.businessName} className="w-full h-full object-cover" />
              ) : (
                story.businessName?.charAt(0) || "T"
              )}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-white text-xs font-bold">{story.businessName}</span>
                {story.sellerVerificationTier === "Gold" && <ShieldCheck className="w-3 h-3" style={{ color: "#d4af37" }} />}
                {story.sellerVerificationTier === "Silver" && <ShieldCheck className="w-3 h-3" style={{ color: "#c0c0c0" }} />}
                {story.sellerVerificationTier === "Bronze" && <ShieldCheck className="w-3 h-3" style={{ color: "#cd7f32" }} />}
              </div>
              <span className="text-white/60 text-[10px]">{timeAgo(story.createdAt)}</span>
            </div>
          </div>
          <button onClick={handleCloseClick} className="text-white/90 hover:text-white p-1.5 cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Media — keyed by story id so React fully remounts on change instead
            of reusing the old <img>/<video> node, which is what caused the
            previous story's frame to keep showing while the new one loaded. */}
        <div className="w-full h-full flex items-center justify-center bg-black">
          {story.mediaType === "image" ? (
            <img
              key={story.id}
              src={story.mediaUrl}
              alt={story.caption || story.businessName}
              className={`w-full h-full object-contain transition-opacity duration-150 ${mediaReady ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setMediaReady(true)}
            />
          ) : (
            <video
              key={story.id}
              ref={videoRef}
              src={story.mediaUrl}
              autoPlay
              playsInline
              onLoadedData={() => setMediaReady(true)}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={goNextStory}
              className={`w-full h-full object-contain transition-opacity duration-150 ${mediaReady ? "opacity-100" : "opacity-0"}`}
            />
          )}
          {!mediaReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          )}
        </div>

        {/* Flying love hearts */}
        <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
          {hearts.map((h) => (
            <Heart
              key={h.id}
              className="absolute bottom-24 w-8 h-8 text-rose-500 fill-rose-500 animate-[bossku-fly-heart_1.4s_ease-out_forwards]"
              style={{ left: `${h.left}%` }}
            />
          ))}
        </div>
        <style>{`
          @keyframes bossku-fly-heart {
            0% { transform: translateY(0) scale(0.6); opacity: 0; }
            15% { transform: translateY(-20px) scale(1.1); opacity: 1; }
            100% { transform: translateY(-260px) scale(0.9) translateX(var(--drift, 10px)); opacity: 0; }
          }
        `}</style>

        {/* Tap zones for navigation */}
        <button onClick={goPrevStory} className="absolute left-0 top-0 bottom-0 w-1/3 z-10 cursor-pointer" aria-label="Previous story" />
        <button onClick={goNextStory} className="absolute right-0 top-0 bottom-0 w-2/3 z-10 cursor-pointer" aria-label="Next story" />

        {/* Desktop nav arrows */}
        <div className="hidden md:block">
          <button onClick={goPrevStory} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={goNextStory} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Footer: caption + love button + CTA */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 to-transparent pt-10 pb-5 px-4">
          {story.caption && (
            <p className="text-white text-sm mb-3 leading-relaxed">{story.caption}</p>
          )}
          <div className="flex items-center justify-between gap-3">
            {story.sellerLocation && (
              <span className="flex items-center gap-1 text-white/70 text-[11px] shrink-0">
                <MapPin className="w-3 h-3 shrink-0" />
                {story.sellerLocation}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLoveTap(e.clientX);
              }}
              aria-label="Send love"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 transition-all cursor-pointer shrink-0"
            >
              <Heart className="w-5 h-5 text-white" />
            </button>
            {story.sellerPhoneNumber && (
              <a
                href={getWhatsAppLink(story.sellerPhoneNumber, story.businessName || "")}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Phone className="w-3 h-3 shrink-0" />
                Chat on WhatsApp
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
