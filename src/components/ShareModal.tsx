import React, { useState } from "react";
import { X, Check, Copy, Send, Share2, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../lib/LanguageContext";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  shareUrl: string;
  shareText: string;
}

export default function ShareModal({ isOpen, onClose, title, subtitle, shareUrl, shareText }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const { language } = useLanguage();

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const shareTargets = [
    {
      name: "WhatsApp",
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.704 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
      color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100/40 hover:text-emerald-700 hover:shadow-emerald-100/50",
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + "\n\n" + shareUrl)}`,
    },
    {
      name: "Threads",
      icon: (
        <img
          src="/Screenshot 2026-08-11 at 10.39.18 AM.png"
          alt="Threads"
          className="w-5 h-5 object-contain rounded-sm"
        />
      ),
      color: "bg-slate-50 text-slate-900 hover:bg-slate-100 border-slate-200/40 hover:text-slate-950 hover:shadow-slate-100/50",
      url: `https://www.threads.net/intent/post?text=${encodeURIComponent(shareText + "\n\n" + shareUrl)}`,
    },
    {
      name: "Facebook",
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      color: "bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100/40 hover:text-blue-700 hover:shadow-blue-100/50",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: "Insta Story",
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
      color: "bg-gradient-to-tr from-pink-50 via-rose-50 to-purple-50 text-rose-600 border-pink-100/40 hover:from-pink-100 hover:via-rose-100 hover:to-purple-100 hover:text-rose-700 hover:shadow-rose-100/50",
      url: "https://www.instagram.com/",
      onClick: (e: React.MouseEvent) => {
        try {
          navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error("Instagram copy failed", err);
        }
      }
    },
    {
      name: "Telegram",
      icon: <Send className="w-4.5 h-4.5 text-sky-600 transform rotate-[15deg] -translate-x-0.5 -translate-y-0.5" />,
      color: "bg-sky-50 text-sky-600 hover:bg-sky-100 border-sky-100/40 hover:text-sky-700 hover:shadow-sky-100/50",
      url: `https://telegram.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      name: "X / Twitter",
      icon: (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      color: "bg-zinc-50 text-zinc-900 hover:bg-zinc-150 border-zinc-200/40 hover:text-zinc-950 hover:shadow-zinc-100/50",
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    }
  ];

  return (
    <AnimatePresence>
      <div
        id="share-modal-backdrop"
        className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          id="share-modal-card"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-[28px] overflow-hidden shadow-2xl max-w-sm w-full border border-slate-100 flex flex-col p-6 text-slate-800 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Decorative Top subtle brand gradient bar */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />

          {/* Elegant Modern Header */}
          <div className="flex justify-between items-center mb-5 mt-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50/70 border border-emerald-100/50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
                <Share2 className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm leading-tight tracking-tight">
                  {language === "EN" ? "Share Marketplace" : "Kongsi Pasaran"}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  {language === "EN" ? "Send to friends & socials" : "Hantar kepada rakan & media sosial"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer border border-transparent hover:border-slate-100"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Premium Shared Item Card Mockup (Simulating a rich link snippet) */}
          <div className="bg-gradient-to-b from-slate-50 to-slate-100/40 border border-slate-100 rounded-2xl p-4 mb-5 relative overflow-hidden group">
            <div className="absolute top-3 right-3 text-slate-300 group-hover:text-slate-400 transition-colors">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 bg-emerald-50 w-fit px-2 py-0.5 rounded-full border border-emerald-100/30">
              {language === "EN" ? "Link Preview" : "Pratonton Pautan"}
            </div>
            <h4 className="font-extrabold text-slate-900 text-[13px] leading-snug truncate pr-6">
              {title}
            </h4>
            <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
              {subtitle}
            </p>
            <div className="mt-2.5 flex items-center gap-1 text-[10px] text-slate-400 font-mono select-all truncate">
              <span className="text-emerald-500/80 font-bold">https://</span>
              <span>{shareUrl.replace(/^https?:\/\//, "")}</span>
            </div>
          </div>

          {/* Social Targets Grid - Redesigned to look extremely professional */}
          <div className="grid grid-cols-6 gap-1 mb-6">
            {shareTargets.map((target, idx) => (
              <a
                key={target.name || `target-${idx}`}
                href={target.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
                onClick={(e) => {
                  if (target.onClick) {
                    target.onClick(e);
                  }
                }}
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-200 transform group-hover:scale-105 group-hover:-translate-y-0.5 ${target.color}`}>
                  {target.icon}
                </div>
                {target.name && (
                  <span className="text-[9.5px] font-bold text-slate-500 group-hover:text-slate-900 transition-colors leading-tight text-center truncate w-full px-0.5">
                    {target.name}
                  </span>
                )}
              </a>
            ))}
          </div>

          {/* Direct Copy Section with professional clean layout */}
          <div className="border-t border-slate-100/80 pt-5">
            <div className="flex justify-between items-center mb-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                {language === "EN" ? "Direct Link Address" : "Alamat Pautan Terus"}
              </label>
              <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                {language === "EN" ? "Active Link" : "Pautan Aktif"}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50/80 border border-slate-100 rounded-xl p-1.5 pl-3.5 hover:border-slate-200 transition-colors">
              <span className="text-[11px] font-semibold font-mono text-slate-500 truncate flex-grow select-all">
                {shareUrl}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 ${
                  copied 
                    ? "bg-emerald-500 text-white shadow-emerald-500/10" 
                    : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-950/10"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    {language === "EN" ? "Copied" : "Disalin"}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                    {language === "EN" ? "Copy" : "Salin"}
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
