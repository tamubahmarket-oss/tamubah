import React, { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Phone, ShieldCheck, MapPin } from "lucide-react";
import { Story } from "../types";

interface StoryViewerProps {
  groups: Story[][];
  startIndex: number;
  onClose: () => void;
  onStoriesViewed: (ids: string[]) => void;
}

const IMAGE_DURATION_MS = 5000;

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

export default function StoryViewer({ groups, startIndex, onClose, onStoriesViewed }: StoryViewerProps) {
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const viewedRef = useRef<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const group = groups[groupIndex];
  const story = group?.[storyIndex];

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

  // Mark current story as viewed + drive the progress bar
  useEffect(() => {
    if (!story) return;
    viewedRef.current.add(story.id);
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
  }, [groupIndex, storyIndex]);

  const handleVideoTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  };

  if (!story || !group) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center select-none">
      <div className="relative w-full h-full max-w-md mx-auto bg-black overflow-hidden">

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

        {/* Media */}
        <div className="w-full h-full flex items-center justify-center">
          {story.mediaType === "image" ? (
            <img src={story.mediaUrl} alt={story.caption || story.businessName} className="w-full h-full object-contain" />
          ) : (
            <video
              ref={videoRef}
              src={story.mediaUrl}
              autoPlay
              playsInline
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={goNextStory}
              className="w-full h-full object-contain"
            />
          )}
        </div>

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

        {/* Footer: caption + CTA */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 to-transparent pt-10 pb-5 px-4">
          {story.caption && (
            <p className="text-white text-sm mb-3 leading-relaxed">{story.caption}</p>
          )}
          <div className="flex items-center justify-between gap-3">
            {story.sellerLocation && (
              <span className="flex items-center gap-1 text-white/70 text-[11px]">
                <MapPin className="w-3 h-3 shrink-0" />
                {story.sellerLocation}
              </span>
            )}
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
