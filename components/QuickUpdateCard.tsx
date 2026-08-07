import React, { useState } from "react";
import { Megaphone, Send, X, Clock } from "lucide-react";
import { Seller } from "../types";

interface QuickUpdateCardProps {
  seller: Seller;
  onUpdated: () => void;
  onUpdateSeller?: (seller: Seller) => void;
}

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function QuickUpdateCard({ seller, onUpdated, onUpdateSeller }: QuickUpdateCardProps) {
  const [text, setText] = useState(seller.latestUpdate || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasActiveUpdate = !!seller.latestUpdate && !!seller.latestUpdateAt;
  const charLimit = 140;

  const postUpdate = async (value: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/sellers/${seller.id}/latest-update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ update: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to post update.");
      if (onUpdateSeller) onUpdateSeller(data.seller);
      onUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to post update.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError("Write something first, e.g. \"Fresh kuih ready today!\"");
      return;
    }
    postUpdate(text.trim());
  };

  const handleClear = () => {
    setText("");
    postUpdate("");
  };

  return (
    <div className="bg-gradient-to-br from-amber-50 to-white rounded-3xl p-5 md:p-6 shadow-md border border-amber-100 mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
          <Megaphone className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 text-sm md:text-base leading-tight">What's fresh today?</h2>
          <p className="text-[11px] md:text-xs text-slate-500">
            Post a quick update — it shows on your shop card in Local Sellers for a few days.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl mb-3 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex-grow">
          <input
            type="text"
            value={text}
            maxLength={charLimit}
            onChange={(e) => setText(e.target.value)}
            placeholder='e.g. "Fresh kuih ready today, order before 5pm!"'
            className="w-full px-4 py-2.5 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition text-sm bg-white"
          />
          {hasActiveUpdate && seller.latestUpdateAt && (
            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" />
              Current update posted {timeAgo(seller.latestUpdateAt)}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="submit"
            disabled={submitting}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            {submitting ? "Posting..." : "Post"}
          </button>
          {hasActiveUpdate && (
            <button
              type="button"
              onClick={handleClear}
              disabled={submitting}
              title="Clear current update"
              className="border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold px-3.5 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
