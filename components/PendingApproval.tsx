import React, { useState } from "react";
import { 
  Clock, ShieldAlert, RefreshCw, LogOut, Phone, Building, User, MapPin, CheckCircle, Info 
} from "lucide-react";
import { motion } from "motion/react";
import { Seller } from "../types";
import { useLanguage } from "../lib/LanguageContext";

interface PendingApprovalProps {
  seller: Seller;
  onLogout: () => void;
  onApproved: (updatedSeller: Seller) => void;
}

export default function PendingApproval({ seller, onLogout, onApproved }: PendingApprovalProps) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "info" | "success" | "error" } | null>(null);
  const { language } = useLanguage();

  const handleCheckStatus = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/sellers/${seller.id}`);
      const data = await res.json();
      
      if (res.ok && data.success && data.seller) {
        if (data.seller.isApproved) {
          setMessage({
            text: language === "EN" 
              ? "Congratulations! Your account has been approved! Seamlessly redirecting to your Shop Space..."
              : "Tahniah! Akaun anda telah diluluskan! Membawa anda ke Ruang Kedai anda...",
            type: "success"
          });
          // Wait 1.5 seconds for the user to see the success state, then trigger onApproved
          setTimeout(() => {
            onApproved(data.seller);
          }, 1500);
        } else {
          setMessage({
            text: language === "EN"
              ? "Your account is still pending review by the TamuBah Development Team. Thank you for your patience!"
              : "Akaun anda masih dalam semakan oleh Pasukan Pembangunan TamuBah. Terima kasih atas kesabaran anda!",
            type: "info"
          });
        }
      } else {
        setMessage({
          text: data.error || (language === "EN" ? "Failed to fetch status. Please try again." : "Gagal mendapatkan status. Sila cuba lagi."),
          type: "error"
        });
      }
    } catch (err) {
      console.error("Error checking approval status:", err);
      setMessage({
        text: language === "EN"
          ? "Network error. Unable to connect to verification server."
          : "Ralat rangkaian. Tidak dapat menyambung ke pelayan pengesahan.",
        type: "error"
      });
    } finally {
      setChecking(false);
    }
  };

  // Format WhatsApp Link to contact TamuBah Development Team
  const getAdminWhatsAppLink = () => {
    const adminPhone = "601112345678"; // Representative local Sabahan TamuBah Development Team phone
    const text = language === "EN"
      ? `Hi TamuBah Development Team! I recently registered my business "${seller.businessName}" (Owner: ${seller.ownerName}) and am waiting for account approval. Could you please review my registration? Thank you!`
      : `Hai Pasukan Pembangunan TamuBah! Saya baru sahaja mendaftarkan perniagaan saya "${seller.businessName}" (Pemilik: ${seller.ownerName}) dan sedang menunggu kelulusan akaun. Bolehkah anda menyemak pendaftaran saya? Terima kasih!`;
    return `https://wa.me/${adminPhone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div id="pending-approval-view" className="max-w-4xl mx-auto px-4 py-12 md:py-16">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-3xl border border-slate-150 shadow-xl overflow-hidden"
      >
        {/* Status Top Accent Bar */}
        <div className="bg-amber-500 h-2.5 w-full"></div>

        <div className="p-6 md:p-10 space-y-8">
          
          {/* Header & Pending Indicator */}
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 pb-6 border-b border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 animate-pulse">
              <Clock className="w-8 h-8" />
            </div>
            <div className="text-center md:text-left space-y-2">
              <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-3 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
                {language === "EN" ? "Registration Status: Pending TamuBah Dev Team Review" : "Status Pendaftaran: Menunggu Semakan Pasukan Dev TamuBah"}
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
                {language === "EN" ? "Reviewing Your Shop Setup" : "Menyemak Persediaan Kedai Anda"}
              </h1>
              <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">
                {language === "EN" 
                  ? "Tamu Bah marketplace is committed to serving authentic, licensed, or locally recommended Sabahan sellers. Your application has been received and is waiting for approval from the TamuBah Development Team."
                  : "Pasaran Tamu Bah komited untuk memberi perkhidmatan kepada penjual Sabah yang sahih, berlesen, atau disyorkan secara tempatan. Permohonan anda telah diterima dan sedang menunggu kelulusan daripada Pasukan Pembangunan TamuBah."}
              </p>
            </div>
          </div>

          {/* Business Summary Card */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Building className="w-4 h-4 text-slate-400" />
              {language === "EN" ? "Your Submitted Details" : "Butiran yang Anda Serahkan"}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-100 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-emerald-700 font-bold">
                  {seller.businessName.charAt(0)}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">{language === "EN" ? "Business Name" : "Nama Perniagaan"}</span>
                  <span className="text-sm font-bold text-slate-800">{seller.businessName}</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-100 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">{language === "EN" ? "Owner / Entrepreneur" : "Pemilik / Usahawan"}</span>
                  <span className="text-sm font-bold text-slate-800">{seller.ownerName}</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-100 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                  <MapPin className="w-5 h-5 animate-bounce text-emerald-600" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">{language === "EN" ? "Location Base" : "Tapak Lokasi"}</span>
                  <span className="text-sm font-bold text-slate-800">{seller.location}, Sabah</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-100 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">{language === "EN" ? "SSM / Local License" : "SSM / Lesen Tempatan"}</span>
                  <span className="text-sm font-bold text-slate-850">
                    {seller.ssmNumber ? seller.ssmNumber : (language === "EN" ? "No SSM Provided (Traditional Tamu/Home Kitchen)" : "Tiada SSM Disediakan (Tamu Tradisional/Dapur Rumah)")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Feedbacks */}
          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-2xl border text-xs flex items-start gap-2.5 leading-relaxed ${
                message.type === "success" 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                  : message.type === "error"
                  ? "bg-rose-50 border-rose-200 text-rose-850"
                  : "bg-amber-50 border-amber-200 text-amber-850"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <Info className="w-5 h-5 text-amber-500 shrink-0" />
              )}
              <span className="font-semibold">{message.text}</span>
            </motion.div>
          )}

          {/* Active Actions bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5 pt-4">
            {/* Status Refresh button */}
            <button
              id="check-approval-btn"
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
              {checking ? (language === "EN" ? "Checking Approval..." : "Menyemak Kelulusan...") : (language === "EN" ? "Check Approval Status" : "Semak Status Kelulusan")}
            </button>

            {/* Expeditious support message via whatsapp */}
            <a
              id="contact-admin-whatsapp"
              href={getAdminWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              {language === "EN" ? "Inquire via WhatsApp" : "Hubungi via WhatsApp"}
            </a>

            {/* Logout button */}
            <button
              id="pending-logout-btn"
              onClick={onLogout}
              className="w-full sm:w-auto sm:ml-auto px-5 py-3.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              {language === "EN" ? "Logout / Exit Portal" : "Log Keluar / Keluar Portal"}
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
