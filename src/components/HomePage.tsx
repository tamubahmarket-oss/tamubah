import React from "react";
import { 
  ArrowRight, Store, Share2, Award, Heart, HelpCircle, 
  CheckCircle, Smartphone, Send, Megaphone, Users,
  Mail, Globe
} from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";
import FeeComparisonCalculator from "./FeeComparisonCalculator";

interface HomePageProps {
  onLaunchMarket: () => void;
  onJoinAsSeller: () => void;
  logoUrl: string;
}

export default function HomePage({ onLaunchMarket, onJoinAsSeller, logoUrl }: HomePageProps) {
  const { language } = useLanguage();

  const isEN = language === "EN";

  return (
    <div className="w-full bg-gradient-to-b from-white via-slate-50/50 to-slate-100/30 font-sans pb-16 relative">
      
      {/* Fixed Large Logo Background Watermark */}
      <div className="fixed inset-0 flex items-center justify-center opacity-10 pointer-events-none select-none z-0">
        <img 
          src={logoUrl} 
          alt="TAMUBAH Logo Background" 
          className="w-[90%] max-w-[1000px] md:max-w-[1400px] lg:max-w-[1700px] h-auto max-h-[90vh] object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
      
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 md:pt-20 pb-16 md:pb-24 border-b border-slate-100/80">

        {/* Ambient subtle background decorative highlights */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-40 select-none z-0">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-emerald-100 blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-teal-100 blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-4 relative z-10 text-center space-y-6 md:space-y-8">
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-[11px] font-extrabold px-3.5 py-1.5 rounded-full border border-emerald-100/60 uppercase tracking-widest">
            {isEN ? "SABAHAN MICRO-BUSINESS HUB" : "HAB PERNIAGAAN MIKRO SABAH"}
          </span>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-950 max-w-4xl mx-auto leading-tight">
            {isEN ? (
              <>
                Empowering the Dreams of <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Sabahan Entrepreneurs</span>
              </>
            ) : (
              <>
                Memperkasakan Impian <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Usahawan Tempatan</span> Sabah
              </>
            )}
          </h1>

          <p className="text-slate-600 text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            {isEN ? (
              "TAMU BAH is a dedicated homegrown digital ecosystem built to showcase, promote, and elevate Sabah's micro-merchants and home-bakers. We connect passionate creators directly with local buyers."
            ) : (
              "TAMU BAH ialah ekosistem digital buatan tempatan yang direka khas untuk mempamerkan, mempromosikan, dan memartabatkan usahawan mikro dan pembuat roti rumah di Sabah. Kami menghubungkan pencipta kreatif terus dengan pembeli tempatan."
            )}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onLaunchMarket}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer text-sm"
            >
              {isEN ? "Explore Tamu Digital" : "Teroka Tamu Digital"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onJoinAsSeller}
              className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-extrabold rounded-2xl hover:border-slate-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <Store className="w-4 h-4 text-emerald-600" />
              {isEN ? "Register as Merchant" : "Daftar Sebagai Peniaga"}
            </button>
          </div>

          {/* Core Trust Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-10 text-left">
            <div className="bg-white/60 backdrop-blur-xs p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-emerald-600 font-bold text-xs uppercase block tracking-wider mb-1">{isEN ? "0% Commission" : "Komisyen 0%"}</span>
              <p className="text-slate-500 text-xs">{isEN ? "Keep 100% of your earnings directly." : "Simpan 100% keuntungan hasil jualan."}</p>
            </div>
            <div className="bg-white/60 backdrop-blur-xs p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-emerald-600 font-bold text-xs uppercase block tracking-wider mb-1">{isEN ? "Direct WhatsApp" : "WhatsApp Terus"}</span>
              <p className="text-slate-500 text-xs">{isEN ? "Instantly chat with buyers & close deals." : "Hubungi pembeli terus & runding harga."}</p>
            </div>
            <div className="bg-white/60 backdrop-blur-xs p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-emerald-600 font-bold text-xs uppercase block tracking-wider mb-1">{isEN ? "Sabah Native" : "Buatan Sabah"}</span>
              <p className="text-slate-500 text-xs">{isEN ? "Supporting local micro-economies." : "Sokong ekonomi mikro tempatan kita."}</p>
            </div>
            <div className="bg-white/60 backdrop-blur-xs p-4 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-emerald-600 font-bold text-xs uppercase block tracking-wider mb-1">{isEN ? "Free Trials & Plans" : "Percubaan & Pelan"}</span>
              <p className="text-slate-500 text-xs">{isEN ? "Get 1 month free trial, then just RM20/month membership. No hidden fees." : "Dapatkan percubaan percuma 1 bulan, kemudian yuran keahlian RM20/bulan sahaja. Tiada caj tersembunyi."}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 1.5 WHY TAMUBAH — COMMISSION COMPARISON POSTER */}
      <section className="max-w-5xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-8 space-y-2">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest block">
            {isEN ? "THE NUMBERS DON'T LIE" : "ANGKA TIDAK PERNAH BOHONG"}
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {isEN ? "Sell Smarter With TamuBah" : "Berniaga Lebih Bijak Bersama TamuBah"}
          </h2>
        </div>

        <FeeComparisonCalculator isEN={isEN} />

        <p className="text-slate-500 text-sm text-center leading-relaxed max-w-3xl mx-auto mt-6">
          {isEN ? (
            <>
              Other platforms take 15% to 30% off every single sale, quietly shrinking your profit no matter how well you sell. TamuBah charges one flat RM20 a month instead, so on 100 orders of a RM10 item, you'd keep <strong className="text-emerald-700">RM980</strong> here versus only <strong className="text-slate-700">RM700–RM850</strong> on a typical commission app. The more you sell, the more that difference works in your favor, not the platform's.
            </>
          ) : (
            <>
              Platform lain mengambil 15% hingga 30% daripada setiap jualan anda, secara senyap-senyap mengecilkan keuntungan anda tidak kira sehebat mana jualan anda. TamuBah hanya mengenakan yuran rata RM20 sebulan, jadi bagi 100 pesanan produk RM10, anda menyimpan <strong className="text-emerald-700">RM980</strong> di sini berbanding hanya <strong className="text-slate-700">RM700–RM850</strong> di platform komisyen biasa. Semakin banyak anda berjaya jual, semakin besar perbezaan itu memihak kepada anda, bukan kepada platform.
            </>
          )}
        </p>
      </section>

      {/* 2. VISION, MISSION & ENTREPRENEUR DREAM CHERISHING */}
      <section className="max-w-5xl mx-auto px-4 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          
          <div className="space-y-6">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest block">
              {isEN ? "OUR CORE MISSION" : "MISI UTAMA KAMI"}
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {isEN ? (
                "Celebrating Craftsmanship & Encouraging Creativity"
              ) : (
                "Meraikan Ketukangan & Menyemarakkan Kreativiti"
              )}
            </h2>
            <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
              <p>
                {isEN ? (
                  "At the heart of TAMU BAH is a deep desire to help Sabahan merchants succeed. We believe that physical boundaries should never limit local potential. We provide a space where you can share your passion, list your products, and turn your business dreams into reality."
                ) : (
                  "Di tengah-tengah landasan TAMU BAH ialah keinginan murni untuk membantu peniaga Sabah berkembang maju. Kami percaya sempadan geografi tidak sepatutnya mengehadkan potensi tempatan. Kami menyediakan ruang untuk anda berkongsi minat, menyenaraikan barangan, dan merealisasikan impian perniagaan anda."
                )}
              </p>
              <div className="p-4 bg-emerald-50/50 border-l-4 border-emerald-500 rounded-r-xl">
                <p className="font-medium text-emerald-950 italic">
                  {isEN ? (
                    "\"We strongly emphasize and inspire our merchants to share their unique goals and life-dreams. Your personal journey is the spark that inspires the community!\""
                  ) : (
                    "\"Kami sangat menekankan dan memberi inspirasi kepada usahawan kami untuk berkongsi matlamat unik dan impian hidup mereka. Kisah anda adalah percikan yang memberi inspirasi kepada komuniti!\""
                  )}
                </p>
              </div>
              <p>
                {isEN ? (
                  "By offering a digital storefront, we give micro-businesses the professional toolkit to operate like modern entrepreneurs, without the high barrier of setup fees, coding, or hidden commissions."
                ) : (
                  "Dengan menawarkan profil kedai digital yang tersusun, kami memberikan perniagaan mikro peralatan profesional untuk beroperasi seperti usahawan moden tanpa kos persediaan, pengaturcaraan, atau caj komisyen."
                )}
              </p>
            </div>
          </div>

          {/* Mission/Vision Features Grid Card */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/60 shadow-lg shadow-slate-100/40 relative">
            <div className="absolute -top-3 -right-3 bg-teal-500 text-white rounded-full p-2 shadow-md">
              <Award className="w-5 h-5" />
            </div>
            
            <h3 className="font-extrabold text-lg text-slate-900 mb-6 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
              {isEN ? "Why TamuBah is Special" : "Kenapa TamuBah Istimewa"}
            </h3>

            <ul className="space-y-5">
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">{isEN ? "Dream-Oriented Storefronts" : "Profil Berorientasikan Impian"}</h4>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {isEN ? "Every store displays the owner's story & dreams, encouraging a deeply personal bond between sellers and buyers." : "Setiap kedai memaparkan kisah & impian pemiliknya, mengeratkan hubungan murni antara pembeli dan penjual."}
                  </p>
                </div>
              </li>
              
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">{isEN ? "Local Economic Uplift" : "Memartabatkan Ekonomi Tempatan"}</h4>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {isEN ? "Focusing strictly on Sabahan micro-businesses (Tuaran, KK, Semporna, Penampang, etc.) to stimulate community wealth." : "Menumpukan sepenuhnya kepada usahawan mikro Sabah (Tuaran, KK, Semporna, Penampang, dll.) untuk memajukan ekonomi komuniti."}
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">{isEN ? "Unleashing Creative Freedom" : "Membebaskan Kebebasan Kreatif"}</h4>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {isEN ? "Encouraging unique home-cooked culinary treats, traditional handicrafts, custom art, and personalized micro-services." : "Menggalakkan masakan rumah yang unik, kraftangan tradisional, seni tersendiri, dan perkhidmatan mikro."}
                  </p>
                </div>
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* 3. STEP-BY-STEP MERCHANT GUIDE */}
      <section className="bg-slate-900 text-white py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
            <span className="text-emerald-400 font-extrabold text-xs uppercase tracking-widest block">
              {isEN ? "EASY SYSTEM GUIDE" : "PANDUAN RINGKAS SISTEM"}
            </span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">
              {isEN ? "How to Start as a Merchant" : "Cara Memulakan Langkah Anda"}
            </h2>
            <p className="text-slate-400 text-sm">
              {isEN ? (
                "Follow these simple visual steps to set up your digital tamu space and begin displaying your products today."
              ) : (
                "Ikuti langkah ringkas ini untuk membina ruang tamu digital anda dan mula mempamerkan produk hari ini."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-800 space-y-4">
              <span className="w-8 h-8 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center text-xs">1</span>
              <h3 className="font-extrabold text-base">{isEN ? "Create Your Account" : "Daftar Akaun Anda"}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                {isEN ? (
                  "Sign up easily with your email, entrepreneur name, and business name. Choose your primary district from our Sabah locations list."
                ) : (
                  "Daftar dengan mudah menggunakan emel, nama pengusaha, dan nama perniagaan. Pilih daerah utama anda dari senarai lokasi Sabah."
                )}
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-800 space-y-4">
              <span className="w-8 h-8 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center text-xs">2</span>
              <h3 className="font-extrabold text-base">{isEN ? "Share Your Goal & Dreams" : "Kongsi Impian & Matlamat"}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                {isEN ? (
                  "Describe what inspired you to start, your business dreams, and goals. Letting people read your passion builds immense community support!"
                ) : (
                  "Huraikan apa yang mendorong anda bermula, impian perniagaan, dan matlamat anda. Berkongsi kisah anda membina sokongan komuniti yang kuat!"
                )}
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-800 space-y-4">
              <span className="w-8 h-8 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center text-xs">3</span>
              <h3 className="font-extrabold text-base">{isEN ? "Add Products & Share" : "Tambah Produk & Kongsi"}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                {isEN ? (
                  "List your fresh bakes, handmade crafts, or services. Toggle stock availability in real-time. Buyers tap and chat directly via WhatsApp!"
                ) : (
                  "Senaraikan masakan segar, kraf tangan, atau servis anda. Kemas kini status stok dalam masa nyata. Pembeli hubungi anda terus di WhatsApp!"
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. OFFICIAL LAUNCH, MOBILE APP ANNOUNCEMENT & SHARING COMMUNITY CHALLENGE */}
      <section className="max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
          
          {/* Subtle design accents */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-12 -translate-y-12 blur-xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/20 rounded-full -translate-x-12 translate-y-12 blur-xl" />

          <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-1.5 bg-white/10 text-emerald-100 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              <Megaphone className="w-3.5 h-3.5" />
              {isEN ? "UPCOMING OFFICIAL LAUNCH" : "PELANCARAN RASMI AKAN DATANG"}
            </span>

            <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
              {isEN ? (
                "Preparing For Our Official Launch"
              ) : (
                "Bersedia Untuk Pelancaran Rasmi"
              )}
            </h2>

            <p className="text-emerald-100/90 text-sm md:text-base leading-relaxed">
              {isEN ? (
                "TAMU BAH is currently in its soft pre-launch phase! We invite every Sabahan to support, protect, and build this app together as we work toward our highly anticipated official public launch."
              ) : (
                "TAMU BAH kini berada dalam fasa pra-pelancaran! Kami menjemput setiap rakyat Sabah untuk menyokong, memelihara, dan membina aplikasi ini bersama sementara kami menuju ke arah pelancaran rasmi secara besar-besaran."
              )}
            </p>

            <div className="bg-white/10 p-5 rounded-2xl border border-white/15 text-left flex gap-4 items-start">
              <Smartphone className="w-8 h-8 text-emerald-200 shrink-0 mt-1" />
              <div>
                <h4 className="font-extrabold text-sm text-white mb-1">
                  {isEN ? "Coming to Your Phone" : "Akan Hadir Ke Telefon Anda"}
                </h4>
                <p className="text-emerald-100/80 text-xs leading-relaxed">
                  {isEN ? (
                    "At our official launch, TamuBah will also be available as a mobile app, downloadable directly from the Play Store (Android) and App Store (iOS), making it even easier to buy from and sell alongside fellow Sabahans."
                  ) : (
                    "Semasa pelancaran rasmi, TamuBah turut akan tersedia sebagai aplikasi mudah alih, boleh dimuat turun terus dari Play Store (Android) dan App Store (iOS), menjadikannya lebih mudah untuk membeli dan berniaga bersama sesama rakyat Sabah."
                  )}
                </p>
              </div>
            </div>

            <div className="bg-white/10 p-5 rounded-2xl border border-white/15 text-left flex gap-4 items-start">
              <Users className="w-8 h-8 text-emerald-200 shrink-0 mt-1" />
              <div>
                <h4 className="font-extrabold text-sm text-white mb-1">
                  {isEN ? "Share the Love! Sabahan Community Challenge" : "Kongsi Kasih Sayang! Cabaran Komuniti Sabah"}
                </h4>
                <p className="text-emerald-100/80 text-xs leading-relaxed">
                  {isEN ? (
                    "We strongly encourage all Sabahans to share this app with their close friends, relatives, and neighboring entrepreneurs. Let's make this app the absolute go-to directory to find pure Sabahan talents."
                  ) : (
                    "Kami sangat menggalakkan semua rakyat Sabah untuk berkongsi aplikasi ini dengan rakan terdekat, saudara-mara, dan peniaga jiran. Jadikannya direktori utama untuk mencari bakat tempatan Sabah."
                  )}
                </p>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onLaunchMarket}
                className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-emerald-50 text-emerald-950 font-black rounded-xl shadow-md transition-all active:scale-[0.98] text-xs cursor-pointer"
              >
                {isEN ? "Launch Digital Market" : "Mula Melayari Tamu"}
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: "TAMU BAH - Sabah Usahawan Market",
                      text: "Sokong peniaga tempatan Sabah! Jom guna aplikasi TAMU BAH.",
                      url: window.location.href,
                    }).catch(console.error);
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    alert(isEN ? "App link copied to clipboard!" : "Pautan aplikasi disalin ke papan keratan!");
                  }
                }}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-700/50 hover:bg-emerald-700/80 text-white font-extrabold rounded-xl border border-emerald-400/30 transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                {isEN ? "Share App Link" : "Kongsi Pautan Aplikasi"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FAQs / HELP SECTION */}
      <section className="max-w-4xl mx-auto px-4 pb-4">
        <h3 className="font-extrabold text-lg text-slate-900 mb-6 flex items-center gap-2 justify-center">
          <HelpCircle className="w-5 h-5 text-slate-500" />
          {isEN ? "Frequently Asked Questions" : "Soalan Lazim"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
              {isEN ? "What is the subscription fee?" : "Berapakah yuran langganan?"}
            </h4>
            <p className="text-slate-500 text-xs leading-relaxed">
              {isEN ? (
                "The first 100 registered sellers will get a 1-Year Free subscription! From the 101st seller onwards, you get a 1-Month Free Trial. After the trial periods end, the normal subscription is only RM20/month. We charge absolutely 0% commission on your sales."
              ) : (
                "100 usahawan pertama yang mendaftar akan mendapat langganan Percuma selama 1 Tahun! Dari peniaga ke-101 dan seterusnya, anda mendapat Percubaan Percuma selama 1 Bulan. Selepas tempoh percubaan berakhir, kadar langganan biasa adalah RM20/bulan. Kami tidak mengambil sebarang komisyen jualan (0% komisyen)."
              )}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
              {isEN ? "How are orders processed?" : "Bagaimana tempahan diproses?"}
            </h4>
            <p className="text-slate-500 text-xs leading-relaxed">
              {isEN ? (
                "Every product listed features a direct WhatsApp purchase button. When a buyer clicks it, it launches a pre-filled WhatsApp chat with the merchant."
              ) : (
                "Setiap produk yang disenaraikan mempunyai butang WhatsApp terus. Apabila pembeli menekannya, ia akan membuka sembang WhatsApp dengan peniaga."
              )}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
              {isEN ? "Who can join?" : "Siapa yang layak menyertai?"}
            </h4>
            <p className="text-slate-500 text-xs leading-relaxed">
              {isEN ? (
                "Any home-baker, caterer, small farmer, handicraft maker, runner or service provider based in Sabah is welcome to join!"
              ) : (
                "Sesiapa sahaja pengusaha roti rumah, katerer, petani kecil, pembuat kraftangan, penghantar barang atau penyedia servis di Sabah dialu-alukan!"
              )}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
              {isEN ? "What happens next year?" : "Apakah yang berlaku tahun depan?"}
            </h4>
            <p className="text-slate-500 text-xs leading-relaxed">
              {isEN ? (
                "We will officially launch the app publicly to attract thousands of active customers across the state to support homegrown Sabah goods."
              ) : (
                "Kami akan melancarkan aplikasi ini secara rasmi secara meluas untuk menarik ribuan pelanggan aktif di seluruh negeri bagi menyokong produk Sabah."
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Need Help / Support */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-emerald-950 rounded-3xl p-8 md:p-10 text-center">
          <h3 className="text-white font-bold text-lg mb-2">
            {isEN ? "Need help with anything?" : "Perlukan bantuan?"}
          </h3>
          <p className="text-emerald-100/80 text-xs md:text-sm mb-6 max-w-md mx-auto leading-relaxed">
            {isEN
              ? "Our team is here for you — whether it's a question about signing up, your shop, or anything else."
              : "Pasukan kami sedia membantu — sama ada soalan tentang pendaftaran, kedai anda, atau apa-apa sahaja."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs md:text-sm">
            <a
              href="mailto:support@tamubah.com"
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl transition-colors font-semibold"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              support@tamubah.com
            </a>
            <span className="flex items-center gap-1.5 text-emerald-100/70 px-4 py-2.5">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              www.tamubah.com
            </span>
          </div>
        </div>
      </section>

      {/* Ownership / legal footer */}
      <section className="max-w-4xl mx-auto px-4 pb-10">
        <p className="text-center text-[11px] text-slate-400 leading-relaxed">
          {isEN ? "Owned & operated by" : "Dimiliki & dikendalikan oleh"}{" "}
          <span className="font-semibold text-slate-500">TAMUBAH GLOBAL 202603219687 (AS0520291-W)</span>
        </p>
      </section>

    </div>
  );
}
