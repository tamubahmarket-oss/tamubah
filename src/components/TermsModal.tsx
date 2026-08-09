import React, { useEffect, useState } from "react";
import { X, ShieldCheck, HelpCircle, Gift, Receipt, Eye, ShieldAlert, Lock, UserCheck } from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "terms" | "privacy";
  // When provided, the terms/privacy toggle navigates (e.g. to /terms or /privacy)
  // instead of just switching local state. Used when rendered as its own standalone page.
  onSwitchTab?: (tab: "terms" | "privacy") => void;
  // When true, renders as a plain page section instead of a fixed modal overlay.
  standalone?: boolean;
  // Called when the user clicks "I Understand & Accept". Falls back to onClose if not provided.
  onAccept?: () => void;
}

export default function TermsModal({ isOpen, onClose, defaultTab = "terms", onSwitchTab, standalone = false, onAccept }: TermsModalProps) {
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">(defaultTab);
  const [sellerCount, setSellerCount] = useState<number>(0);
  const [loadingCount, setLoadingCount] = useState<boolean>(true);
  const { language } = useLanguage();

  // Sync activeTab with defaultTab whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      // Fetch seller count from backend to show active spots.
      // showAll+limit bypasses the API's default 50-row cap (which was freezing
      // this at 50 forever), and we count "founding" sellers specifically —
      // that's the actual number of founding-year promo slots used.
      fetch("/api/sellers?showAll=true&limit=1000", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setSellerCount(data.filter((s: any) => s.planStatus === "founding").length);
          }
        })
        .catch((err) => console.error("Failed to load seller count in Terms", err))
        .finally(() => setLoadingCount(false));
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  const promoLimit = 100;
  const spotsLeft = Math.max(0, promoLimit - sellerCount);
  const isPromoActive = sellerCount < promoLimit;

  const content = (
    <div className={standalone ? "bg-white rounded-3xl shadow-xl border border-slate-100 max-w-2xl w-full overflow-hidden flex flex-col mx-auto" : "bg-white rounded-3xl shadow-xl border border-slate-100 max-w-2xl w-full overflow-hidden flex flex-col my-8 max-h-[85vh] animate-in zoom-in-95 duration-150"}>
        
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-emerald-700 to-teal-800 p-6 text-white relative shrink-0">
          {!standalone && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-1.5 transition-all cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-200" />
            <h3 className="font-extrabold text-lg tracking-tight font-sans">
              {activeTab === "terms"
                ? (language === "EN" ? "Terms of Service" : "Syarat Perkhidmatan")
                : (language === "EN" ? "Privacy Policy & Scam Prevention" : "Dasar Privasi & Pencegahan Penipuan")}
            </h3>
          </div>
          <p className="text-emerald-100 text-xs leading-relaxed max-w-xl">
            {language === "EN" 
              ? "Read our official agreements designed to support Sabahan entrepreneurs while ensuring a secure, transparent, and scam-free community."
              : "Baca perjanjian rasmi kami yang dirancang untuk menyokong usahawan Sabah di samping memastikan komuniti yang selamat, telus, dan bebas penipuan."
            }
          </p>
        </div>

        {/* Real-time Early Bird Alert Banner */}
        <div className="bg-emerald-50 border-b border-emerald-100 p-4 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white shrink-0 mt-0.5 shadow-sm">
              <Gift className="w-4 h-4 animate-bounce" />
            </div>
            <div className="flex-grow">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-slate-900 text-xs tracking-tight">
                  {language === "EN" ? "Sabah Early Bird Promotion: First 100 Sellers Free!" : "Promosi Awal Sabah: 100 Penjual Pertama Percuma!"}
                </span>
                <span className="text-[10px] bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {language === "EN" ? "Active Campaign" : "Kempen Aktif"}
                </span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed mt-0.5">
                {language === "EN" ? (
                  <>The first 100 registered micro-shops get <strong className="text-emerald-700">1 Year of Free Premium Promotion</strong> (RM0 subscription fees). Normal subscription is RM20/monthly thereafter.</>
                ) : (
                  <>100 kedai mikro berdaftar pertama mendapat <strong className="text-emerald-700">Promosi Premium Percuma 1 Tahun</strong> (yuran langganan RM0). Langganan biasa ialah RM20/bulanan selepas itu.</>
                )}
              </p>
              
              <div className="flex items-center gap-4 mt-2">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {language === "EN" ? "Sellers onboarded:" : "Penjual berdaftar:"} <span className="font-extrabold text-slate-800">{loadingCount ? (language === "EN" ? "Loading..." : "Memuatkan...") : sellerCount}</span>
                </div>
                <div className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider flex items-center gap-1 bg-emerald-100/50 px-2 py-0.5 rounded">
                  {isPromoActive ? (
                    language === "EN" ? `${spotsLeft} Early Bird Spots Left!` : `${spotsLeft} Tempat Promosi Tinggal!`
                  ) : (
                    language === "EN" ? "All 100 Free Slots Redeemed!" : "Semua 100 Slot Percuma Telah Ditebus!"
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Switch to the other policy page */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3 shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            {activeTab === "terms" ? <Receipt className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {activeTab === "terms"
              ? (language === "EN" ? "Terms of Service" : "Syarat Perkhidmatan")
              : (language === "EN" ? "Privacy Policy" : "Dasar Privasi")}
          </span>
          <button
            onClick={() => {
              const next = activeTab === "terms" ? "privacy" : "terms";
              if (onSwitchTab) { onSwitchTab(next); } else { setActiveTab(next); }
            }}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
          >
            {activeTab === "terms"
              ? (language === "EN" ? "View Privacy Policy instead" : "Lihat Dasar Privasi")
              : (language === "EN" ? "View Terms of Service instead" : "Lihat Syarat Perkhidmatan")}
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600 leading-relaxed max-h-[45vh] scrollbar-thin">
          
          {activeTab === "terms" ? (
            language === "EN" ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Section 1: Merchant Account eligibility */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    1. Seller Eligibility & Local Trade
                  </h4>
                  <p>
                    To host a shop on the TAMU BAH platform, sellers must reside or run their businesses within the state of Sabah, Malaysia. Shops are allowed to list local product inventories consisting of:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-500">
                    <li>Homemade meals, customized cakes, pastries, native foods, and traditional drinks.</li>
                    <li>Local Sabah handicrafts, cultural attire, custom beadworks, and arts.</li>
                    <li>Fresh local agriculture, highland vegetables, seafood, and honey.</li>
                    <li>Micro-services and household goods distributed directly by small Sabahan operators.</li>
                  </ul>
                </div>

                {/* Section 2: Subscription Fee Structure & Payment */}
                <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider text-emerald-800">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    2. Subscription Rates & Fee Schedule
                  </h4>
                  <p className="text-slate-700">
                    By listing on the Sabah Entrepreneur Marketplace, you agree to the following billing policies:
                  </p>
                  <div className="space-y-3 mt-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 shrink-0"></div>
                      <div>
                        <span className="font-bold text-slate-800">Standard Subscription Fee:</span>
                        <p className="text-slate-500">
                          The default subscription fee is <strong className="text-slate-800">RM 20.00 per month</strong>. This subscription includes digital shop pages, catalog management tools, public map placement, and immediate buyer-to-seller WhatsApp linking.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0"></div>
                      <div>
                        <span className="font-bold text-emerald-800">First 100 Early Bird Merchants:</span>
                        <p className="text-slate-500">
                          The first <strong className="text-slate-800">100 registered merchants</strong> receive a special promotional fee waiver:
                        </p>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-500">
                          <li>Enjoy <strong className="text-slate-800">Free Premium Hosting for 1 Year</strong> (RM0 subscription fees) starting from registration date.</li>
                          <li>After the 1-year promotional period finishes, these merchants will transition to the normal subscription rate of <strong className="text-slate-800">RM 20.00 per month</strong> to maintain active listings.</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-1.5 shrink-0"></div>
                      <div>
                        <span className="font-bold text-teal-800">Account 101 and Onwards:</span>
                        <p className="text-slate-500">
                          For the <strong className="text-slate-800">101st merchant profile and all subsequent registrations</strong>, the following trial policies apply:
                        </p>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-500">
                          <li>Enjoy a <strong className="text-slate-800">Free Trial of 1 Month</strong> (RM0 subscription fees) starting from registration date.</li>
                          <li>After the 1-month trial period, active store maintenance requires the standard subscription rate of <strong className="text-slate-800">RM 20.00 per month</strong>.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Content Guidelines */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    3. Catalog Integrity & Price Accuracy
                  </h4>
                  <p>
                    Sellers are fully responsible for maintaining accurate, fair, and legal listings.
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-500">
                    <li><strong className="text-slate-800">Safety Compliance:</strong> Food items must be prepared in sanitary conditions. Sellers must state standard dietary warnings (Halal, pork-free, ingredients, etc.).</li>
                    <li><strong className="text-slate-800">True Pricing:</strong> Prices listed must reflect actual final amounts in Malaysian Ringgit (RM). Misleading bait-and-switch pricing is strictly prohibited.</li>
                    <li><strong className="text-slate-800">Original Images:</strong> Upload photos representing physical stock or your actual creations. Copied pictures from web search or other merchants are not allowed.</li>
                  </ul>
                </div>

                {/* Section 4: WhatsApp Inquiries & Delivery */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    4. Direct WhatsApp Trade Operations
                  </h4>
                  <p>
                    TAMU BAH acts solely as a discovery directory. Orders, payment collections, and delivery tracking are settled independently between you and your customers over WhatsApp. TAMU BAH does not provide escrow, take transaction commissions, or act as an intermediary in individual disputes.
                  </p>
                </div>

                {/* Section 5: Auditing */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    5. Verification and Auditing
                  </h4>
                  <p>
                    Storefronts are subject to periodic administrative review. The TAMU BAH administration team reserves the right to suspend or terminate listings or seller profiles that are flagged for suspicious activities, customer complaints, or failure to comply with local business standards.
                  </p>
                </div>

                {/* Section 6: Mission & Vision */}
                <div className="space-y-2 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-2xl border border-emerald-100/60">
                  <h4 className="font-extrabold text-emerald-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    6. Our Shared Mission & Community Vision
                  </h4>
                  <p className="text-slate-700">
                    TAMU BAH is designed as an inclusive platform specifically to help local merchants promote and sell their products, while encouraging them to unleash their creativity and realize their business aspirations.
                  </p>
                  <p className="text-slate-600 mt-1">
                    We strongly emphasize and invite our merchants to share their unique goals, stories, and entrepreneurial dreams on their profiles to inspire fellow Sabahans and customers alike. This platform represents a collaborative effort to encourage and uplift Sabahan micro-businesses on their path to sustainable success.
                  </p>
                  <p className="text-slate-600 mt-1">
                    To fuel this grassroots growth, we encourage all users to actively share the TAMU BAH app among their friends, families, and communities. TAMU BAH is scheduled for its <strong className="text-emerald-800">Official Launch by next year</strong>, and we sincerely call upon all Sabahans to support, protect, and champion this homegrown digital ecosystem.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Section 1: Merchant Account eligibility (Bahasa) */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    1. Kelayakan Penjual & Dagangan Tempatan
                  </h4>
                  <p>
                    Untuk membuka kedai di platform TAMU BAH, penjual mesti menetap atau menjalankan perniagaan mereka di dalam negeri Sabah, Malaysia. Kedai dibenarkan untuk menyenaraikan produk tempatan yang terdiri daripada:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-500">
                    <li>Makanan buatan sendiri, kek tempahan khas, pastri, makanan tradisional, dan minuman tempatan.</li>
                    <li>Kraf tangan tempatan Sabah, pakaian kebudayaan, seni manik kastam, dan hasil seni.</li>
                    <li>Pertanian tempatan segar, sayur-sayuran tanah tinggi, makanan laut, dan madu.</li>
                    <li>Perkhidmatan mikro dan barangan rumah yang diedarkan secara terus oleh pengusaha kecil Sabah.</li>
                  </ul>
                </div>

                {/* Section 2: Subscription Fee Structure & Payment (Bahasa) */}
                <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider text-emerald-800">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    2. Kadar Langganan & Jadual Bayaran
                  </h4>
                  <p className="text-slate-700">
                    Dengan menyenaraikan kedai di Pasaran Usahawan Sabah, anda bersetuju dengan dasar pengebilan berikut:
                  </p>
                  <div className="space-y-3 mt-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 shrink-0"></div>
                      <div>
                        <span className="font-bold text-slate-800">Yuran Langganan Standard:</span>
                        <p className="text-slate-500">
                          Kadar langganan standard ialah <strong className="text-slate-800">RM 20.00 sebulan</strong>. Langganan ini merangkumi halaman kedai digital, alat pengurusan katalog, kedudukan peta awam, dan pautan WhatsApp terus kepada pembeli.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0"></div>
                      <div>
                        <span className="font-bold text-emerald-800">100 Usahawan Terawal (Early Bird):</span>
                        <p className="text-slate-500">
                          Sebanyak <strong className="text-slate-800">100 peniaga pertama yang berdaftar</strong> akan menerima pengecualian yuran promosi khas:
                        </p>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-500">
                          <li>Nikmati <strong className="text-slate-800">Pengehosan Premium Percuma selama 1 Tahun</strong> (RM0 yuran langganan) bermula dari tarikh pendaftaran.</li>
                          <li>Selepas tempoh promosi 1 tahun berakhir, peniaga akan beralih ke kadar langganan biasa <strong className="text-slate-800">RM 20.00 sebulan</strong> untuk mengekalkan profil aktif mereka.</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-1.5 shrink-0"></div>
                      <div>
                        <span className="font-bold text-teal-800">Akaun ke-101 Dan Seterusnya:</span>
                        <p className="text-slate-500">
                          Bagi <strong className="text-slate-800">pendaftaran profil peniaga ke-101 dan semua pendaftaran seterusnya</strong>, dasar percubaan berikut akan diguna pakai:
                        </p>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-500">
                          <li>Nikmati <strong className="text-slate-800">Percubaan Percuma selama 1 Bulan</strong> (RM0 yuran langganan) bermula dari tarikh pendaftaran.</li>
                          <li>Selepas tempoh percubaan 1 bulan berakhir, peniaga dikehendaki membayar kadar standard <strong className="text-slate-800">RM 20.00 sebulan</strong> untuk mengekalkan kedai aktif mereka di platform.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Content Guidelines (Bahasa) */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    3. Integriti Katalog & Ketepatan Harga
                  </h4>
                  <p>
                    Penjual bertanggungjawab sepenuhnya untuk mengekalkan senarai produk yang tepat, adil, dan sah di sisi undang-undang.
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-500">
                    <li><strong className="text-slate-800">Kepatuhan Keselamatan:</strong> Barangan makanan mesti disediakan dalam keadaan bersih. Penjual mesti menyatakan amaran pemakanan standard (Halal, mesra muslim, bahan-bahan, dsb.).</li>
                    <li><strong className="text-slate-800">Harga Sebenar:</strong> Harga yang disenaraikan mesti mencerminkan amaun akhir dalam Ringgit Malaysia (RM). Penggunaan taktik harga umpan yang mengelirukan adalah dilarang sama sekali.</li>
                    <li><strong className="text-slate-800">Gambar Asal:</strong> Muat naik foto yang mewakili stok fizikal atau ciptaan sebenar anda. Gambar yang disalin dari carian web atau peniaga lain tidak dibenarkan.</li>
                  </ul>
                </div>

                {/* Section 4: WhatsApp Inquiries & Delivery (Bahasa) */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    4. Operasi Dagangan WhatsApp Terus
                  </h4>
                  <p>
                    TAMU BAH bertindak semata-mata sebagai direktori penemuan sahaja. Urusan pesanan, kutipan pembayaran, dan penghantaran diselesaikan secara bebas antara anda dan pelanggan anda melalui WhatsApp. TAMU BAH tidak menyediakan perkhidmatan escrow, mengambil komisen transaksi, atau bertindak sebagai pengantara dalam pertikaian individu.
                  </p>
                </div>

                {/* Section 5: Auditing (Bahasa) */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    5. Pengesahan dan Audit
                  </h4>
                  <p>
                    Halaman kedai adalah tertakluk kepada semakan pentadbiran berkala. Pasukan pentadbir TAMU BAH berhak untuk menggantung atau menamatkan senarai atau profil penjual yang ditandakan mempunyai aktiviti mencurigakan, aduan pelanggan, atau kegagalan mematuhi standard perniagaan tempatan.
                  </p>
                </div>

                {/* Section 6: Mission & Vision (Bahasa) */}
                <div className="space-y-2 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-2xl border border-emerald-100/60">
                  <h4 className="font-extrabold text-emerald-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    6. Misi Bersama & Visi Komuniti
                  </h4>
                  <p className="text-slate-700">
                    TAMU BAH direka sebagai platform inklusif khusus untuk membantu peniaga tempatan mempromosikan dan menjual produk mereka, di samping menggalakkan mereka mengembangkan kreativiti dan merealisasikan aspirasi perniagaan mereka.
                  </p>
                  <p className="text-slate-600 mt-1">
                    Kami sangat menekankan dan menjemput para peniaga kami untuk berkongsi matlamat unik, kisah perniagaan, dan impian keusahawanan mereka pada profil kedai masing-masing demi memberi inspirasi kepada rakan-rakan usahawan dan pelanggan. Platform ini merupakan usaha kolaboratif untuk menggalakkan serta memajukan perniagaan mikro Sabah menuju kejayaan yang mampan.
                  </p>
                  <p className="text-slate-600 mt-1">
                    Bagi memacu pertumbuhan akar umbi ini, kami menyeru semua pengguna untuk berkongsi aplikasi TAMU BAH secara aktif dalam kalangan rakan-rakan, keluarga, dan komuniti anda. TAMU BAH dijadualkan untuk mengadakan <strong className="text-emerald-800">Pelancaran Rasmi pada tahun hadapan</strong>, dan kami dengan rendah hati menyeru semua rakyat Sabah untuk menyokong, memelihara, dan menyebarkan ekosistem digital buatan tempatan ini.
                  </p>
                </div>
              </div>
            )
          ) : (
            language === "EN" ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                
                {/* Privacy Promise Banner */}
                <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl relative overflow-hidden shadow-md">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full blur-xl"></div>
                  <div className="flex items-center gap-2 mb-2 text-teal-400">
                    <ShieldCheck className="w-5 h-5" />
                    <h4 className="font-extrabold text-xs uppercase tracking-wider">TAMU BAH Privacy Promise</h4>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    We are deeply committed to respecting your privacy. <strong className="text-white">TAMU BAH does NOT use, sell, rent, or lease your personal, business, or listing information for any wrong, secondary, or unauthorized marketing purposes.</strong> Your data belongs to you, and we keep it safe.
                  </p>
                </div>

                {/* Section 1: Why registration is required (Preventing scammers) */}
                <div className="space-y-2 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                  <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider text-emerald-800">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    1. Crucial Scam Prevention Protocol
                  </h4>
                  <p className="text-slate-700">
                    Unlike anonymous classified boards, TAMU BAH is a trusted marketplace for small businesses. <strong className="text-slate-900 font-extrabold">All merchant accounts are registered to prevent online scammer activities.</strong>
                  </p>
                  <p className="text-slate-600 mt-1">
                    By requiring seller profiles, verifying local phone numbers, tracking locations, and offering verified badge upgrades for legal Trading License or SSM registrants, we provide a protected experience for local buyers. Anonymous listings are rejected, guaranteeing that every listed entrepreneur represents a traceable, authentic local artisan or business.
                  </p>
                </div>

                {/* Section 2: Data Minimalist Collection */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    2. What Information We Collect
                  </h4>
                  <p>
                    We collect only the essential business metrics necessary to host your digital shop catalog:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 text-[11px]">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-800 block">Public Directory Fields</span>
                      <p className="text-slate-500 mt-0.5">Business name, owner name, district location, physical address, and product catalogs (descriptions, prices, photos).</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-800 block">Verification Elements</span>
                      <p className="text-slate-500 mt-0.5">WhatsApp telephone numbers (to route buyers directly) and optional Trading License or SSM Registration Numbers (to receive verification badges).</p>
                    </div>
                  </div>
                </div>

                {/* Section 3: Safe Data Practices */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    3. Safe Data Handling & Security
                  </h4>
                  <p>
                    Since buyers contact merchants directly via WhatsApp, your business phone number and location are displayed publicly on your listings. Apart from this necessary public directory setup, TAMU BAH utilizes secure password hashes and strict cloud isolation to protect your backend credentials from outside intrusions.
                  </p>
                </div>

                {/* Section 4: Public Disclosure & Contact consent */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    4. Public Consent for WhatsApp Linking
                  </h4>
                  <p>
                    By registering an active merchant profile, you grant TAMU BAH the right to display your designated contact phone number as an active, formatted WhatsApp click-to-chat hyperlink. You may change or delete your shop profile or listings at any time through your personal merchant dashboard.
                  </p>
                </div>

              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-200">
                
                {/* Privacy Promise Banner (Bahasa) */}
                <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl relative overflow-hidden shadow-md">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full blur-xl"></div>
                  <div className="flex items-center gap-2 mb-2 text-teal-400">
                    <ShieldCheck className="w-5 h-5" />
                    <h4 className="font-extrabold text-xs uppercase tracking-wider">Janji Privasi TAMU BAH</h4>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Kami komited sepenuhnya untuk menghormati privasi anda. <strong className="text-white">TAMU BAH TIDAK menggunakan, menjual, menyewa, atau memajak maklumat peribadi, perniagaan, atau senarai anda untuk sebarang tujuan pemasaran salah, sekunder, atau tidak dibenarkan.</strong> Data anda milik anda, dan kami menjaganya dengan selamat.
                  </p>
                </div>

                {/* Section 1: Why registration is required (Preventing scammers) (Bahasa) */}
                <div className="space-y-2 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                  <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider text-emerald-800">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    1. Protokol Penting Pencegahan Penipuan
                  </h4>
                  <p className="text-slate-700">
                    Berbeza dengan papan iklan terperingkat awam, TAMU BAH ialah pasaran dipercayai untuk perniagaan mikro Sabah. <strong className="text-slate-900 font-extrabold">Semua akaun peniaga mesti berdaftar untuk mengelakkan aktiviti penipuan (scammer) dalam talian.</strong>
                  </p>
                  <p className="text-slate-600 mt-1">
                    Dengan mewajibkan pendaftaran profil penjual, mengesahkan nombor telefon WhatsApp tempatan, menjejak lokasi daerah, dan menawarkan lencana pengesahan untuk pemegang Lesen Perniagaan atau SSM, kami menyediakan pengalaman berdagang yang selamat untuk pembeli. Penyenaraian tanpa nama akan ditolak bagi memastikan usahawan yang tersenarai adalah asli dan boleh dikesan.
                  </p>
                </div>

                {/* Section 2: Data Minimalist Collection (Bahasa) */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    2. Maklumat yang Kami Kumpul
                  </h4>
                  <p>
                    Kami hanya mengumpul maklumat penting perniagaan yang diperlukan untuk memaparkan katalog kedai digital anda:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 text-[11px]">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-800 block">Medan Direktori Awam</span>
                      <p className="text-slate-500 mt-0.5">Nama perniagaan, nama pemilik, kawasan daerah, alamat fizikal, dan katalog produk (penerangan, harga, foto).</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-800 block">Elemen Pengesahan</span>
                      <p className="text-slate-500 mt-0.5">Nombor telefon WhatsApp (untuk rujukan pembeli secara terus) dan Lesen Perniagaan Sabah atau Nombor Pendaftaran SSM (pilihan untuk mendapatkan lencana disahkan).</p>
                    </div>
                  </div>
                </div>

                {/* Section 3: Safe Data Practices (Bahasa) */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    3. Pengendalian Data Selamat & Keselamatan
                  </h4>
                  <p>
                    Oleh kerana pembeli menghubungi peniaga terus melalui WhatsApp, nombor telefon perniagaan dan lokasi anda dipaparkan secara umum pada senarai anda. Selain persediaan direktori awam yang diperlukan ini, TAMU BAH menggunakan sistem kata laluan yang disulitkan dan pengasingan awan yang ketat untuk melindungi maklumat kelayakan log masuk belakang anda daripada sebarang pencerobohan luar.
                  </p>
                </div>

                {/* Section 4: Public Disclosure & Contact consent (Bahasa) */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-1.5 h-3 bg-emerald-600 rounded-sm"></span>
                    4. Persetujuan Umum untuk Pautan WhatsApp
                  </h4>
                  <p>
                    Dengan mendaftarkan profil peniaga yang aktif, anda memberi kebenaran kepada TAMU BAH untuk memaparkan nombor telefon anda sebagai pautan terus sembang WhatsApp. Anda boleh menukar atau memadam profil kedai atau senarai anda pada bila-bila masa melalui papan pemuka peniaga anda.
                  </p>
                </div>

              </div>
            )
          )}

        </div>

        {/* Modal Footer actions */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-between items-center shrink-0">
          <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
            <Lock className="w-3 h-3 text-slate-400" /> {language === "EN" ? "Active Protection" : "Perlindungan Aktif"}
          </span>
          <button
            onClick={() => (onAccept ? onAccept() : onClose())}
            className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2.5 px-6 rounded-xl transition-all cursor-pointer shadow-sm shadow-slate-900/10"
          >
            {language === "EN" ? "I Understand & Accept" : "Saya Faham & Terima"}
          </button>
        </div>

      </div>
  );

  if (standalone) {
    return content;
  }

  return (
    <div
      id="terms-conditions-overlay"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      {content}
    </div>
  );
}
