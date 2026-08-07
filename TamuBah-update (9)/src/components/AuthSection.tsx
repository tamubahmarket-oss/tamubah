import React, { useState, useEffect } from "react";
import { 
  User, Mail, Lock, Phone, MapPin, Store, Building, AlertCircle, CheckCircle, ArrowRight,
  ShieldCheck, Loader2, Check, X, Search
} from "lucide-react";
import { SABAH_LOCATIONS, BUSINESS_CATEGORIES, Seller } from "../types";
import { validateSSM } from "../utils";
import { useLanguage } from "../lib/LanguageContext";
import TermsModal from "./TermsModal";

interface AuthSectionProps {
  onAuthSuccess: (seller: Seller) => void;
  onClose: () => void;
  initialMode?: "login" | "register";
  // When provided, the login/register toggle navigates (e.g. to /signin or /register)
  // instead of just switching local state. Used when AuthSection is rendered as its
  // own standalone page rather than inside a shared modal/tab.
  onSwitchMode?: (mode: "login" | "register") => void;
}

export default function AuthSection({ onAuthSuccess, onClose, initialMode = "login", onSwitchMode }: AuthSectionProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);

  // Keep internal mode in sync when the parent changes initialMode (e.g. the
  // standalone /signin and /register pages navigate and pass a new initialMode
  // without unmounting this component).
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const { language } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Form states
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState(BUSINESS_CATEGORIES[0]);
  const [ssmNumber, setSsmNumber] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [location, setLocation] = useState(SABAH_LOCATIONS[0]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Login states
  const [loginIdentity, setLoginIdentity] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Real-time seller counts for promo tracking
  const [sellerCount, setSellerCount] = useState<number>(0);
  const [loadingSellers, setLoadingSellers] = useState<boolean>(true);

  // SSM Validation states
  const [ssmValidation, setSsmValidation] = useState<any>(null);
  const [isVerifyingSSM, setIsVerifyingSSM] = useState(false);
  const [ssmVerificationRecord, setSsmVerificationRecord] = useState<any>(null);
  const [ssmVerificationError, setSsmVerificationError] = useState<string | null>(null);

  // Trigger local validation whenever ssmNumber changes
  const handleSsmChange = (value: string) => {
    setSsmNumber(value);
    setSsmVerificationRecord(null);
    setSsmVerificationError(null);
    if (!value.trim()) {
      setSsmValidation(null);
      return;
    }
    const result = validateSSM(value);
    setSsmValidation(result);
  };

  // Perform SSM server-side database verification
  const handleVerifySsmWithRegistry = async () => {
    if (!ssmNumber.trim() || (ssmValidation && !ssmValidation.isValid)) return;
    setIsVerifyingSSM(true);
    setSsmVerificationError(null);
    setSsmVerificationRecord(null);

    try {
      const response = await fetch(`/api/validate-ssm?ssm=${encodeURIComponent(ssmNumber)}`);
      const data = await response.json();
      if (!response.ok || !data.isValid) {
        setSsmVerificationError(data.error || "Failed to verify SSM number.");
      } else if (data.isDuplicated) {
        setSsmVerificationError(data.error);
      } else {
        setSsmVerificationRecord(data);
      }
    } catch (err) {
      setSsmVerificationError("Connection error. Could not reach registry.");
    } finally {
      setIsVerifyingSSM(false);
    }
  };

  React.useEffect(() => {
    fetch("/api/sellers?showAll=true&limit=1000", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSellerCount(data.filter((s: any) => s.planStatus === "founding").length);
        }
      })
      .catch((err) => console.error("Failed to load seller count in AuthSection", err))
      .finally(() => setLoadingSellers(false));
  }, []);

  // Password strength check
  const getPasswordStrength = () => {
    if (!password) return { label: "None", color: "bg-gray-200", width: "w-0", score: 0 };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    switch (score) {
      case 1:
        return { label: "Weak (6+ chars)", color: "bg-red-500", width: "w-1/4", score };
      case 2:
        return { label: "Fair (Add Uppercase)", color: "bg-orange-500", width: "w-2/4", score };
      case 3:
        return { label: "Good (Add Number)", color: "bg-yellow-500", width: "w-3/4", score };
      case 4:
        return { label: "Strong!", color: "bg-emerald-500", width: "w-full", score };
      default:
        return { label: "Weak", color: "bg-red-500", width: "w-1/4", score };
    }
  };

  const strength = getPasswordStrength();

  const submitRegistration = async (termsAccepted: boolean) => {
    setError(null);
    setSuccess(null);

    // Validation
    if (!ownerName.trim() || !email.trim() || !businessName.trim() || !address.trim() || !phoneNumber.trim()) {
      setError("Please fill in all required fields.");
      return false;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return false;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }

    if (!termsAccepted) {
      setError("Please agree to the Terms & Conditions to complete your registration.");
      return false;
    }

    if (ssmNumber.trim()) {
      const ssmRes = validateSSM(ssmNumber);
      if (!ssmRes.isValid) {
        setError(`SSM validation failed: ${ssmRes.message}`);
        return false;
      }
    }

    setLoading(true);

    try {
      // Clean phone number: remove any formatting, ensure starting with 60 (Malaysian country code)
      let formattedPhone = phoneNumber.replace(/\D/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "6" + formattedPhone;
      } else if (formattedPhone.startsWith("1")) {
        formattedPhone = "60" + formattedPhone;
      } else if (!formattedPhone.startsWith("60")) {
        formattedPhone = "60" + formattedPhone;
      }

      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ownerName,
          email,
          businessName,
          category,
          ssmNumber,
          address,
          phoneNumber: formattedPhone,
          password,
          location,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to register account.");
      }

      setSuccess("Account created successfully! Your application is pending TamuBah Development Team approval. You can now log in to view status.");
      // Auto switch mode to login after short delay and prepopulate
      setLoginIdentity(email);
      setTimeout(() => {
        if (onSwitchMode) { onSwitchMode("login"); } else { setMode("login"); }
        setSuccess(null);
      }, 3000);
      return true;

    } catch (err: any) {
      setError(err.message || "An error occurred during registration.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitRegistration(agreedToTerms);
  };

  // Called when the user clicks "I Understand & Accept" in the Terms modal.
  // If the registration form is already fully and validly filled in, this
  // completes the account creation and moves the user to the sign-in screen.
  // Otherwise it simply closes the modal and returns them to the (still
  // filled-in) Create Account form, with a message about what's missing.
  const handleTermsAccept = async () => {
    setAgreedToTerms(true);
    setShowTermsModal(false);
    await submitRegistration(true);
  };

  const handleTermsModalClose = () => {
    setShowTermsModal(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!loginIdentity.trim() || !loginPassword.trim()) {
      setError("Please fill in all credentials.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identity: loginIdentity,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to log in.");
      }

      setSuccess("Successfully logged in!");
      setTimeout(() => {
        onAuthSuccess(data.seller);
        onClose();
      }, 800);

    } catch (err: any) {
      setError(err.message || "An error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div id="auth-section" className="bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden max-w-lg w-full mx-auto">
      {/* Visual Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white text-center relative">
        <div className="absolute top-4 right-4 text-emerald-100/40 text-xs font-mono select-none">
          {language === "EN" ? "SABAH ENTREPRENEUR HUB" : "PUSAT USAHAWAN SABAH"}
        </div>
        <h2 className="text-2xl font-bold font-sans tracking-tight">
          {mode === "login" 
            ? (language === "EN" ? "Welcome Back, Seller" : "Selamat Kembali, Penjual") 
            : (language === "EN" ? "Join Sabah's Marketplace" : "Sertai Pasaran Sabah")}
        </h2>
        <p className="text-emerald-100 text-sm mt-1">
          {mode === "login" 
            ? (language === "EN" 
                ? "Sign in to manage your homemade bakery, foods, and products." 
                : "Log masuk untuk mengurus bakeri buatan sendiri, makanan, dan produk anda.") 
            : (language === "EN" 
                ? "Set up your digital shop and share your crafts with Sabahans." 
                : "Sediakan kedai digital anda dan kongsi hasil kraf dengan rakyat Sabah.")}
        </p>
      </div>

      <div className="p-6">
        {/* Link to the other page (Sign In and Create Account are now separate pages) */}
        <div className="text-center mb-6">
          <button
            id={mode === "login" ? "toggle-register-btn" : "toggle-login-btn"}
            type="button"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
            onClick={() => {
              const next = mode === "login" ? "register" : "login";
              if (onSwitchMode) { onSwitchMode(next); } else { setMode(next); setError(null); }
            }}
          >
            {mode === "login"
              ? (language === "EN" ? "Don't have an account? Create one" : "Belum ada akaun? Cipta sekarang")
              : (language === "EN" ? "Already have an account? Sign in" : "Sudah ada akaun? Log masuk")}
          </button>
        </div>

        {/* Messaging */}
        {error && (
          <div id="auth-error-msg" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 flex items-start gap-2 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div id="auth-success-msg" className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl mb-5 flex items-start gap-2 text-sm">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Login Form */}
        {mode === "login" ? (
          <form id="login-form" onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {language === "EN" ? "Owner Name or Email Address" : "Nama Pemilik atau Alamat E-mel"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="login-identity-input"
                  type="text"
                  required
                  placeholder={language === "EN" ? "e.g. anna@sabahshop.com or Anna Lim" : "cth. anna@sabahshop.com atau Anna Lim"}
                  value={loginIdentity}
                  onChange={(e) => setLoginIdentity(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {language === "EN" ? "Password" : "Kata Laluan"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="login-password-input"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm"
                />
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm mt-6 disabled:opacity-50"
            >
              {loading 
                ? (language === "EN" ? "Logging in..." : "Melog masuk...") 
                : (language === "EN" ? "Enter Shop Page" : "Masuk ke Halaman Kedai")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Registration Form */
          <form id="register-form" onSubmit={handleRegisterSubmit} className="space-y-4 max-h-[460px] overflow-y-auto pr-2 scrollbar-thin">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2">
              {language === "EN" ? "Shop & Brand Profile" : "Profil Kedai & Jenama"}
            </h3>

            {/* Early Bird Promotion & Anti-Scam Info Card */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-100 p-4 rounded-xl space-y-3 mb-4 text-xs text-slate-600">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-600 rounded-lg text-white mt-0.5 shadow-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5a2 2 0 10-2 2h2zm0 0h4m-4 0H8m12 9a4 4 0 11-8 0 4 4 0 018 0zm-16 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">
                    {language === "EN" ? "Sabah Early Bird Countdown: " : "Hitung Mundur Promosi Awal Sabah: "}{loadingSellers ? "Loading..." : `${100 - sellerCount} ${language === "EN" ? "spots left!" : "tempat tinggal!"}`}
                  </h4>
                  <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                    {language === "EN" ? (
                      <>
                        <strong className="text-emerald-700 font-bold">{sellerCount} entrepreneurs</strong> have successfully registered. Join now to secure <strong>1 Year of Free Premium Promotion</strong> (worth RM240)!
                      </>
                    ) : (
                      <>
                        <strong className="text-emerald-700 font-bold">{sellerCount} usahawan</strong> telah berjaya mendaftar. Sertai sekarang untuk mendapatkan <strong>Promosi Premium Percuma 1 Tahun</strong> (bernilai RM240)!
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200/60 pt-3 flex items-start gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-white mt-0.5 shadow-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">
                    {language === "EN" ? "Scam Prevention & Privacy Safety" : "Pencegahan Penipuan & Keselamatan Privasi"}
                  </h4>
                  <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                    {language === "EN" ? (
                      <>
                        Anonymous listings are blocked to protect our local community. Registration is required to prevent online scammer activities. We guarantee: <strong className="text-slate-700 font-semibold">TAMU BAH will never use, lease, or share your information for wrong purposes.</strong> Your data belongs strictly to you.
                      </>
                    ) : (
                      <>
                        Senarai tanpa nama disekat untuk melindungi komuniti tempatan kami. Pendaftaran diperlukan untuk mengelakkan aktiviti penipuan dalam talian. Kami menjamin: <strong className="text-slate-700 font-semibold">TAMU BAH tidak akan sekali-kali menggunakan, memajak, atau berkongsi maklumat anda untuk tujuan yang salah.</strong> Data anda adalah milik mutlak anda.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {language === "EN" ? "Owner Name" : "Nama Pemilik"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="register-owner-name"
                  type="text"
                  required
                  placeholder={language === "EN" ? "e.g. Anna Lim" : "cth. Anna Lim"}
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {language === "EN" ? "Email Address" : "Alamat E-mel"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="register-email"
                  type="email"
                  required
                  placeholder="anna@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {language === "EN" ? "Business Name" : "Nama Perniagaan"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Store className="w-4 h-4" />
                </span>
                <input
                  id="register-business-name"
                  type="text"
                  required
                  placeholder={language === "EN" ? "e.g. Anna's Homemade Cakes" : "cth. Kek Buatan Sendiri Anna"}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {language === "EN" ? "Primary Category" : "Kategori Utama"} <span className="text-red-500">*</span>
              </label>
              <select
                id="register-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm bg-white"
              >
                {BUSINESS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {language === "EN" 
                      ? cat 
                      : (cat === "Food & Beverage" ? "Makanan & Minuman" 
                         : cat === "Handicrafts" ? "Kraf Tangan" 
                         : cat === "Agriculture" ? "Pertanian" 
                         : cat === "Apparel & Accessories" ? "Pakaian & Aksesori" 
                         : cat === "Health & Beauty" ? "Kesihatan & Kecantikan" 
                         : cat)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {language === "EN" ? "Trading License / SSM No." : "Lesen Perniagaan / No. SSM"} <span className="text-slate-400 font-normal">{language === "EN" ? "(Optional)" : "(Pilihan)"}</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Building className="w-4 h-4" />
                </span>
                <input
                  id="register-ssm"
                  type="text"
                  placeholder="e.g. DBKK/12345/2026 or 202603120150"
                  value={ssmNumber}
                  onChange={(e) => handleSsmChange(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition text-sm ${
                    ssmNumber.trim() === ""
                      ? "border-slate-200 focus:border-emerald-500"
                      : ssmValidation?.isValid
                      ? "border-emerald-500 focus:border-emerald-500 bg-emerald-50/10"
                      : "border-rose-400 focus:border-rose-400 bg-rose-50/10"
                  }`}
                />
              </div>

                {/* Real-time Validation & Verification UI */}
                {ssmNumber.trim() !== "" && ssmValidation && (
                  <div className="mt-1.5 space-y-1.5">
                    {ssmValidation.isValid ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>{language === "EN" ? "Format Valid: " : "Format Sah: "}{ssmValidation.entityType}</span>
                        </div>
                        
                        {!ssmVerificationRecord && !ssmVerificationError && (
                          <button
                            type="button"
                            onClick={handleVerifySsmWithRegistry}
                            disabled={isVerifyingSSM}
                            className="flex items-center gap-1.5 self-start text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 px-2.5 py-1 rounded-lg shadow-sm transition"
                          >
                            {isVerifyingSSM ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>{language === "EN" ? "Querying Registry..." : "Menyemak Pendaftaran..."}</span>
                              </>
                            ) : (
                              <>
                                <Search className="w-3 h-3" />
                                <span>{language === "EN" ? "Verify with Registration DB" : "Sahkan dengan DB Pendaftaran"}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-1 text-[11px] text-rose-600 leading-tight">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{ssmValidation.message}</span>
                      </div>
                    )}

                    {/* Server Verification Record Result */}
                    {ssmVerificationRecord && (
                      <div className="bg-emerald-50 border border-emerald-200/60 p-2.5 rounded-xl space-y-1 text-[11px] text-slate-700 shadow-sm animate-fadeIn">
                        <div className="flex justify-between items-center border-b border-emerald-100 pb-1 mb-1 font-bold text-emerald-800">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            {language === "EN" ? "Official License Registry" : "Pendaftaran Lesen Rasmi"}
                          </span>
                          <span className="bg-emerald-600 text-white font-extrabold px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wide">
                            {ssmVerificationRecord.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <span className="text-slate-400">{language === "EN" ? "Type:" : "Jenis:"}</span>
                          <span className="col-span-2 font-medium text-slate-800">{ssmVerificationRecord.entityType}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <span className="text-slate-400">{language === "EN" ? "Established:" : "Ditubuhkan:"}</span>
                          <span className="col-span-2 font-medium text-slate-800">{ssmVerificationRecord.registrationDate}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 italic pt-0.5 border-t border-emerald-50/50">
                          {language === "EN" ? "Authority:" : "Pihak Berkuasa:"} {ssmVerificationRecord.regulatedBy}
                        </div>
                      </div>
                    )}

                    {/* Server Verification Error Result (including duplicated check) */}
                    {ssmVerificationError && (
                      <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-xl text-[11px] text-rose-700 space-y-1.5">
                        <div className="flex items-start gap-1.5 font-semibold text-rose-800">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                          <span>{language === "EN" ? "Verification Alert" : "Amaran Pengesahan"}</span>
                        </div>
                        <p className="leading-relaxed text-[10.5px] text-rose-600">
                          {ssmVerificationError}
                        </p>
                      </div>
                    )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {language === "EN" ? "Phone Number (WhatsApp)" : "Nombor Telefon (WhatsApp)"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-medium text-xs">
                  +60
                </span>
                <input
                  id="register-phone"
                  type="tel"
                  required
                  placeholder="123456789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {language === "EN" ? "Use a number dedicated to your business, and make sure it is active on WhatsApp — buyers will contact you here." : "Gunakan nombor khusus untuk perniagaan anda, dan pastikan ia aktif di WhatsApp — pembeli akan menghubungi anda di sini."}
              </p>
            </div>

            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-1 pt-2 mb-2">
              {language === "EN" ? "Location & Address" : "Lokasi & Alamat"}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {language === "EN" ? "District" : "Daerah"} <span className="text-red-500">*</span>
              </label>
              <select
                id="register-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm bg-white"
              >
                {SABAH_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {language === "EN" ? "Physical Address / Base" : "Alamat Fizikal / Tapak"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <MapPin className="w-4 h-4" />
                </span>
                <input
                  id="register-address"
                  type="text"
                  required
                  placeholder={language === "EN" ? "e.g. Block A, Cyber City, Penampang" : "cth. Blok A, Cyber City, Penampang"}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm"
                />
              </div>
            </div>

            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-1 pt-2 mb-2">
              {language === "EN" ? "Security" : "Keselamatan"}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {language === "EN" ? "Password" : "Kata Laluan"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="register-password"
                  type="password"
                  required
                  placeholder={language === "EN" ? "Min 6 characters" : "Minima 6 aksara"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm"
                />
              </div>
              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-1.5">
                  <div className="flex justify-between items-center text-[10px] mb-1">
                    <span className="text-slate-500">{language === "EN" ? "Strength:" : "Kekuatan:"}</span>
                    <span className="font-semibold text-slate-700">
                      {strength.label === "None" ? (language === "EN" ? "None" : "Tiada")
                       : strength.label.startsWith("Weak") ? (language === "EN" ? "Weak" : "Lemah")
                       : strength.label.startsWith("Fair") ? (language === "EN" ? "Fair" : "Sederhana")
                       : strength.label.startsWith("Good") ? (language === "EN" ? "Good" : "Baik")
                       : (language === "EN" ? "Strong!" : "Kuat!")}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300`}></div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {language === "EN" ? "Confirm Password" : "Sahkan Kata Laluan"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="register-confirm-password"
                  type="password"
                  required
                  placeholder={language === "EN" ? "Retype password" : "Taip semula kata laluan"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm"
                />
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-emerald-50/60 border border-emerald-100 p-3.5 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                {language === "EN"
                  ? <><span className="font-bold">A quick reminder:</span> Always respond to customers professionally, in a friendly manner, and with good manners — clear communication and courtesy build trust and repeat customers for your business.</>
                  : <><span className="font-bold">Peringatan ringkas:</span> Sentiasa layan pelanggan secara profesional, mesra, dan bersopan santun — komunikasi yang jelas dan hormat membina kepercayaan serta pelanggan tetap untuk perniagaan anda.</>}
              </p>
            </div>

            <div className="flex items-start gap-2.5 mt-5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <input
                id="agree-terms-checkbox"
                type="checkbox"
                required
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 transition-all cursor-pointer"
              />
              <label htmlFor="agree-terms-checkbox" className="text-xs text-slate-500 leading-relaxed cursor-pointer select-none">
                {language === "EN" ? "I agree to the " : "Saya bersetuju dengan "}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-emerald-600 hover:text-emerald-700 font-bold underline cursor-pointer inline-block"
                >
                  {language === "EN" ? "Terms & Conditions" : "Syarat & Peraturan"}
                </button>{" "}
                {language === "EN" 
                  ? "including standard seller conduct policies and subscription fee agreements (RM20/monthly, first 100 free for 1 year)."
                  : "termasuk dasar tingkah laku penjual standard dan perjanjian yuran langganan (RM20/bulanan, 100 pertama percuma untuk 1 tahun)."}
              </label>
            </div>

            <button
              id="register-submit-btn"
              type="submit"
              disabled={loading || !agreedToTerms}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm mt-6 disabled:opacity-50 cursor-pointer"
            >
              {loading 
                ? (language === "EN" ? "Creating Account..." : "Mencipta Akaun...") 
                : (language === "EN" ? "Create Account & Start Listing" : "Cipta Akaun & Mula Menyenarai")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>

    <TermsModal
      isOpen={showTermsModal}
      onClose={handleTermsModalClose}
      onAccept={handleTermsAccept}
      defaultTab="terms"
    />
    </>
  );
}
