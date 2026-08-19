import React, { useState, useRef, useEffect } from "react";
import { Camera, Video, X, Clock, Upload, Eye, Heart } from "lucide-react";
import { Seller, Story } from "../types";
import { compressAndResizeImage } from "../utils";

interface PostStoryCardProps {
  seller: Seller;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export default function PostStoryCard({ seller }: PostStoryCardProps) {
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMyStories = () => {
    fetch("/api/stories")
      .then((res) => res.json())
      .then((data: Story[]) => setMyStories(Array.isArray(data) ? data.filter((s) => s.sellerId === seller.id) : []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchMyStories();
  }, [seller.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      setError("Please choose a photo or a short video.");
      return;
    }
    if (isVideo && file.size > 30 * 1024 * 1024) {
      setError("Video is too large — please keep it under 30MB.");
      return;
    }

    try {
      setUploading(true);
      let dataUrl: string;
      if (isImage) {
        dataUrl = await compressAndResizeImage(file, 1080, 0.8, "image/webp");
      } else {
        dataUrl = await readFileAsDataUrl(file);
      }
      setPreview({ url: dataUrl, type: isVideo ? "video" : "image" });

      const response = await fetch("/api/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, folder: "stories" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to upload.");
      setUploadedUrl(data.url);
    } catch (err: any) {
      setError(err.message || "Failed to process file.");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handlePost = async () => {
    if (!preview || !uploadedUrl) {
      setError("Please choose a photo or video first.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const response = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId: seller.id,
          mediaUrl: uploadedUrl,
          mediaType: preview.type,
          caption,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to post story.");
      setPreview(null);
      setUploadedUrl(null);
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchMyStories();
    } catch (err: any) {
      setError(err.message || "Failed to post story.");
    } finally {
      setPosting(false);
    }
  };

  const handleCancelPreview = () => {
    setPreview(null);
    setUploadedUrl(null);
    setCaption("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteStory = async (storyId: string) => {
    try {
      await fetch(`/api/stories/${storyId}?sellerId=${seller.id}`, { method: "DELETE" });
      setMyStories((prev) => prev.filter((s) => s.id !== storyId));
    } catch (err) {
      console.error("Failed to delete story", err);
    }
  };

  return (
    <div className="bg-gradient-to-br from-rose-50 to-white rounded-3xl p-5 md:p-6 shadow-md border border-rose-100 mb-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 bg-rose-100 rounded-xl text-rose-600 shrink-0">
          <Camera className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 text-sm md:text-base leading-tight">Post a Story</h2>
          <p className="text-[11px] md:text-xs text-slate-500">
            Share a quick photo or video — visible for 24 hours in Explore Market.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl mb-3 text-xs">
          {error}
        </div>
      )}

      {/* Active stories */}
      {myStories.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto mb-4 pb-1">
          {myStories.map((s) => (
            <div key={s.id} className="relative shrink-0 w-16 h-24 rounded-xl overflow-hidden bg-slate-100 border border-rose-100 group">
              {s.mediaType === "image" ? (
                <img src={s.mediaUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={s.mediaUrl} className="w-full h-full object-cover" muted />
              )}
              <button
                onClick={() => handleDeleteStory(s.id)}
                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 cursor-pointer"
                title="Delete story"
              >
                <X className="w-3 h-3" />
              </button>
              <span className="absolute bottom-1 left-1 right-1 text-[8px] text-white bg-black/50 rounded px-1 py-0.5 flex items-center gap-0.5 justify-center">
                <Clock className="w-2 h-2 shrink-0" />
                {timeLeft(s.expiresAt)}
              </span>
              <span className="absolute top-1 left-1 flex items-center gap-1">
                <span className="flex items-center gap-0.5 text-[8px] font-bold text-white bg-black/50 rounded px-1 py-0.5">
                  <Eye className="w-2 h-2 shrink-0" />
                  {s.viewCount ?? 0}
                </span>
                <span className="flex items-center gap-0.5 text-[8px] font-bold text-white bg-black/50 rounded px-1 py-0.5">
                  <Heart className="w-2 h-2 shrink-0 fill-rose-400 text-rose-400" />
                  {s.likeCount ?? 0}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      {!preview ? (
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-rose-200 hover:border-rose-300 hover:bg-rose-50/50 rounded-2xl py-6 cursor-pointer transition-colors">
          <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
          <Upload className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-sm font-semibold text-rose-500">Choose a photo or video</span>
        </label>
      ) : (
        <div className="space-y-3">
          <div className="relative w-full max-w-[220px] mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: "9/16" }}>
            {preview.type === "image" ? (
              <img src={preview.url} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <video src={preview.url} className="w-full h-full object-cover" muted autoPlay loop playsInline />
            )}
            <button
              onClick={handleCancelPreview}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-semibold">
                Uploading...
              </div>
            )}
          </div>

          <input
            type="text"
            value={caption}
            maxLength={200}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption (optional)..."
            className="w-full px-4 py-2.5 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400/30 focus:border-rose-400 transition text-sm bg-white"
          />

          <button
            onClick={handlePost}
            disabled={uploading || posting || !uploadedUrl}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {preview.type === "video" ? <Video className="w-4 h-4 shrink-0" /> : <Camera className="w-4 h-4 shrink-0" />}
            {posting ? "Posting..." : uploading ? "Waiting for upload..." : "Post Story"}
          </button>
        </div>
      )}
    </div>
  );
}
