import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Send, Star, MapPin, ShieldCheck, MessageCircle, Sparkles,
} from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";

// ============================================================================
// BOSSKU — the Home page AI shopping assistant.
// Bubble popup ("Cari / apa / Bossku?") -> live chat widget. Talks to
// POST /api/bossku/chat, which does the actual product/seller matching.
// Every message is logged server-side for the Admin "Bossku AI" report.
// ============================================================================

interface BossKuProduct {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  category: string;
  sellerId: string;
  businessName: string;
  ownerName: string;
  location: string;
  phoneNumber: string;
  verificationTier: string;
  averageRating: number;
  reviewCount: number;
}

interface BossKuSeller {
  id: string;
  businessName: string;
  ownerName: string;
  category: string;
  location: string;
  phoneNumber: string;
  verificationTier: string;
  logoUrl?: string;
  averageRating: number;
}

interface ChatMessage {
  id: string;
  role: "bot" | "user";
  text: string;
  products?: BossKuProduct[];
  sellers?: BossKuSeller[];
}

function getWhatsAppLink(phoneNumber: string, businessName: string, productTitle?: string): string {
  let cleanPhone = (phoneNumber || "").replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) cleanPhone = "6" + cleanPhone;
  else if (cleanPhone.startsWith("1")) cleanPhone = "60" + cleanPhone;
  else if (cleanPhone.length > 0 && !cleanPhone.startsWith("60")) cleanPhone = "60" + cleanPhone;
  const message = productTitle
    ? `Hi ${businessName}, Bossku (TamuBah AI) sent me — I'm interested in "${productTitle}"!`
    : `Hi ${businessName}, Bossku (TamuBah AI) sent me — I'd like to ask about your products!`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

function getOrCreateSessionId(): string {
  let sid = localStorage.getItem("bossku_session_id");
  if (!sid) {
    sid = "sess_" + Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
    localStorage.setItem("bossku_session_id", sid);
  }
  return sid;
}

export default function BossKuChat() {
  const { language } = useLanguage();
  const [showPopup, setShowPopup] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>("");

  // Show the popup bubble a couple seconds after landing, once per browser
  // tab session. If dismissed with the X, don't nag again this session.
  // ALWAYS ensure the floating button is visible as a fallback
  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
    const alreadyDismissed = sessionStorage.getItem("bossku_popup_dismissed") === "true";
    const alreadyChatted = sessionStorage.getItem("bossku_chat_opened") === "true";
    if (alreadyDismissed || alreadyChatted) {
      if (alreadyChatted) {
        // returning mid-session with chat history in memory only — keep it simple,
        // just reopen the launcher bubble collapsed.
      }
      // Ensure button shows even after dismissal
      return;
    }
    const timer = setTimeout(() => setShowPopup(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chatOpen]);

  const welcomeText =
    language === "BM"
      ? "Sini saya tolong cari bah! Saya Bossku 🙏 Cakap saja apa yang kau cari — makanan, kedai, barang apa-apa pun boleh — nanti saya bandingkan harga & rating sekali."
      : "Sini saya tolong cari for you bah! I'm Bossku 🙏 Just tell me what you're looking for — food, a shop, anything la — I'll compare price & rating for you.";

  const handleDismissPopup = () => {
    setShowPopup(false);
    sessionStorage.setItem("bossku_popup_dismissed", "true");
  };

  const handleStartChat = () => {
    setShowPopup(false);
    setChatOpen(true);
    sessionStorage.setItem("bossku_chat_opened", "true");
    if (messages.length === 0) {
      setMessages([{ id: "welcome", role: "bot", text: welcomeText }]);
    }
  };

  const handleReopenLauncher = () => {
    setChatOpen(true);
    if (messages.length === 0) {
      setMessages([{ id: "welcome", role: "bot", text: welcomeText }]);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { id: "u_" + Date.now(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/bossku/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionIdRef.current, language }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: "b_" + Date.now(),
            role: "bot",
            text: data.reply,
            products: data.products,
            sellers: data.sellers,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: "b_err_" + Date.now(),
            role: "bot",
            text:
              language === "BM"
                ? "Aduh maaf bah, ada masalah sikit. Cuba lagi sekali ya."
                : "Sorry bah, something went wrong. Try again ya.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: "b_neterr_" + Date.now(),
          role: "bot",
          text:
            language === "BM"
              ? "Ndapat sambung ke server bah, cuba check internet kau."
              : "Cannot reach the server bah, check your internet.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-4 md:right-6 z-[100] flex flex-col items-end gap-3">
      {/* Popup bubble: "Cari / apa / Bossku?" */}
      <AnimatePresence>
        {showPopup && !chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-3xl shadow-2xl border border-emerald-100 w-60 p-4 pt-9"
          >
            <button
              onClick={handleDismissPopup}
              aria-label="Dismiss"
              className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Bossku AI</span>
            </div>
            <p className="text-slate-800 font-extrabold text-xl leading-tight mb-3">
              Cari
              <br />
              apa
              <br />
              Bossku?
            </p>
            <button
              onClick={handleStartChat}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
            >
              {language === "BM" ? "Mula Chat" : "Start Chatting"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live chat widget */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="w-[92vw] max-w-sm h-[70vh] max-h-[560px] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-4 flex items-center gap-3 shrink-0">
              <span className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                <Sparkles className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-sm">Bossku</p>
                <p className="text-[11px] text-emerald-100 truncate">
                  {language === "BM" ? "Pembantu AI TamuBah" : "TamuBah AI Assistant"}
                </p>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/60">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-emerald-600 text-white rounded-br-sm"
                        : "bg-white border border-slate-100 text-slate-700 rounded-bl-sm shadow-sm"
                    }`}
                  >
                    <p>{m.text}</p>

                    {/* Product comparison cards */}
                    {m.products && m.products.length > 0 && (
                      <div className="mt-2.5 space-y-2">
                        {m.products.map((p) => (
                          <div key={p.id} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex gap-2.5">
                            <img
                              src={p.imageUrl}
                              alt={p.title}
                              className="w-12 h-12 rounded-lg object-cover shrink-0 bg-slate-200"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 text-[11px] truncate">{p.title}</p>
                              <p className="text-emerald-700 font-black text-xs">RM {p.price.toFixed(2)}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-bold">
                                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                  {p.averageRating > 0 ? p.averageRating.toFixed(1) : "New"}
                                </span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5 truncate">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                                  {p.location}
                                </span>
                                {p.verificationTier !== "None" && (
                                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">{p.businessName}</p>
                              <a
                                href={getWhatsAppLink(p.phoneNumber, p.businessName, p.title)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg transition-colors"
                              >
                                <MessageCircle className="w-3 h-3" />
                                {language === "BM" ? "Chat Penjual" : "Chat Seller"}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Seller cards */}
                    {m.sellers && m.sellers.length > 0 && (
                      <div className="mt-2.5 space-y-2">
                        {m.sellers.map((s) => (
                          <div key={s.id} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex gap-2.5 items-center">
                            <span className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-[11px] shrink-0 overflow-hidden">
                              {s.logoUrl ? (
                                <img src={s.logoUrl} alt={s.businessName} className="w-full h-full object-cover" />
                              ) : (
                                s.businessName.charAt(0)
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 text-[11px] truncate flex items-center gap-1">
                                {s.businessName}
                                {s.verificationTier !== "None" && (
                                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                )}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-bold">
                                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                  {s.averageRating > 0 ? s.averageRating.toFixed(1) : "New"}
                                </span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5 truncate">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                                  {s.location}
                                </span>
                              </div>
                              <a
                                href={getWhatsAppLink(s.phoneNumber, s.businessName)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg transition-colors"
                              >
                                <MessageCircle className="w-3 h-3" />
                                {language === "BM" ? "Chat Penjual" : "Chat Seller"}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5 shadow-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 border-t border-slate-100 bg-white flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={language === "BM" ? "Contoh: kuih murah kat Penampang..." : "e.g. cheap cakes in Penampang..."}
                className="flex-1 px-3.5 py-2.5 rounded-full border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-xs text-slate-800"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating launcher button (shown once popup/chat has been dismissed/closed) */}
      {!showPopup && !chatOpen && (
        <button
          onClick={handleReopenLauncher}
          aria-label="Chat with Bossku"
          className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl flex items-center justify-center text-white hover:scale-105 transition-transform cursor-pointer"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
