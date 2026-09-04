import React, { createContext, useContext, useState } from "react";

export type Language = "EN" | "BM";

const translations: Record<Language, Record<string, string>> = {
  EN: {
    // Header & Navigation
    explore_market: "Explore Market",
    local_sellers: "Local Sellers",
    seller_space: "Seller Space",
    dev_team: "TamuBah Dev Team",
    sign_in: "Sign In",
    join_as_seller: "Join as Business",
    manage_my_shop: "Manage My Shop",
    logout: "Log Out",
    welcome_back: "Welcome back",

    // Market Page Banner / Intros
    from_sabahan: "FROM SABAHAN FOR SABAHAN",
    support_local_business: "Support Our Local Sabahan Business",
    order_authentic: "Order authentic homemade cakes, local Sabah meals, fresh brew, traditional ingredients, and unique crafts directly from small entrepreneurs operating right from their homes in Sabah.",
    
    // Promo Banner
    promo_badge: "Sabah Early Bird Promotion",
    promo_sub: "RM0 Subscription Fee",
    promo_title: "First 100 Micro-Shops: 1 Year Free Premium Promotion!",
    promo_desc: "Support and build your business. The first 100 registered Sabahan entrepreneurs pay RM0 for 12 months. Normal rate RM20/month. No hidden charges!",
    promo_onboarded: "Successfully Onboarded",
    slots_remaining: "slots remaining!",
    promo_sold_out: "Promotion Sold Out!",

    // Filter Controls
    search_placeholder: "Search homemade foods, bakery, drinks, sellers...",
    search_sellers_placeholder: "Search sellers by shop name, owner, or products...",
    all_districts: "All of Sabah (Locations)",
    category_filters: "Category Filters",
    browse_by_category: "Browse by Category",
    only_verified_sellers: "Only Verified Sellers",

    // Safety Disclaimers
    safety_disclaimer_title: "Important Safety & Service Disclaimer",
    safety_disclaimer_desc: "TamuBah is a directory only. Users are fully responsible for vetting their own runners and verifying cash payments upon delivery.",

    // Product Listing Status
    tuning_market: "Tuning the local Sabahan market...",
    no_products_found: "No Products Found",
    no_products_desc: "We couldn't find any listings matching your search criteria. Try broadening your search or selection!",
    reset_filters: "Clear All Filters",
    showing_items_count: "Showing {count} homemade items in Sabah",
    available: "Available",
    sold_out: "Sold Out",

    // Action Buttons
    order_whatsapp: "Order via WhatsApp",
    share: "Share",
    view_shop_reviews: "View Shop & Reviews",
    contact_now: "Contact Now",
    view_shop: "View Shop",
    established_since: "Established Since",
    business_dream: "Our Business Dream",
    verified_seller: "Verified Seller",
    ssm_registered: "SSM Registered",
    listings: "Listings",
    rating: "Rating",
    reviews: "Reviews",

    // Reviews Section
    write_review: "Write a Review",
    reviewer_name: "Your Name",
    reviewer_name_placeholder: "Enter your name...",
    review_placeholder: "Share your experience with this local seller...",
    submit_review: "Submit Review",
    submitting: "Submitting...",
    no_reviews_yet: "No reviews yet. Be the first to share your experience!",
    review_success: "Review submitted successfully!",
    all_products_by_seller: "All Products by this Seller",

    // Seller Page Header
    directory_badge: "Sabah Entrepreneur Directory",
    directory_title: "Meet Our Local Entrepreneurs",
    directory_desc: "Connect directly with local bakeshops, home chefs, crafters, and beverage makers across Sabah. Read their inspiring stories and explore their fresh products.",
    no_sellers_found: "No local sellers found matching filters.",

    // Categories
    all_categories: "All Categories",
    all_districts_lbl: "All Districts",
    "Food&Tamu": "Food & Tamu",
    "Bundle&Fashion": "Bundle & Fashion",
    "Gadgets&Electronics": "Gadgets & Electronics",
    "Services&Runners": "Services & Runners",
    "Others": "Others"
  },
  BM: {
    // Header & Navigation
    explore_market: "TAMU DIGITAL",
    local_sellers: "USAHAWAN KITA",
    seller_space: "Ruang Penjual",
    dev_team: "Pasukan TamuBah",
    sign_in: "Log Masuk",
    join_as_seller: "Sertai sebagai Penjual",
    manage_my_shop: "Urus Kedai Saya",
    logout: "Log Keluar",
    welcome_back: "Selamat kembali",

    // Market Page Banner / Intros
    from_sabahan: "DARI SABAHAN UNTUK SABAHAN",
    support_local_business: "Sama-sama kita menyokong usahawan tempatan sabah",
    order_authentic: "Pesan kek buatan sendiri yang tulen, hidangan tempatan Sabah, minuman segar, bahan tradisional, dan kraf unik terus daripada usahawan kecil yang beroperasi dari rumah mereka di Sabah.",

    // Promo Banner
    promo_badge: "Promosi Awal Sabah",
    promo_sub: "Yuran Langganan RM0",
    promo_title: "100 Kedai Mikro Pertama: Promosi Premium Percuma 1 Tahun!",
    promo_desc: "Sokong dan bina perniagaan anda. 100 usahawan Sabah berdaftar pertama membayar RM0 selama 12 bulan. Kadar biasa RM20/bulan. Tiada caj tersembunyi!",
    promo_onboarded: "Berjaya Disertakan",
    slots_remaining: "slot tinggal!",
    promo_sold_out: "Promosi Habis Dijual!",

    // Filter Controls
    search_placeholder: "Cari makanan buatan sendiri, bakeri, minuman, penjual...",
    search_sellers_placeholder: "Cari penjual mengikut nama kedai, pemilik, atau produk...",
    all_districts: "Seluruh Sabah (Lokasi)",
    category_filters: "Tapis Kategori",
    browse_by_category: "Layari mengikut Kategori",
    only_verified_sellers: "Hanya Penjual Disahkan",

    // Safety Disclaimers
    safety_disclaimer_title: "Penafian Keselamatan & Perkhidmatan Penting",
    safety_disclaimer_desc: "TamuBah adalah direktori sahaja. Pengguna bertanggungjawab sepenuhnya untuk menilai pelari mereka sendiri dan mengesahkan pembayaran tunai semasa penghantaran.",

    // Product Listing Status
    tuning_market: "Menyelaras pasaran tempatan Sabah...",
    no_products_found: "Tiada Produk Ditemui",
    no_products_desc: "Kami tidak dapat mencari sebarang senarai yang sepadan dengan kriteria carian anda. Cuba luaskan carian atau pilihan anda!",
    reset_filters: "Padam Semua Penapis",
    showing_items_count: "Menunjukkan {count} produk buatan sendiri di Sabah",
    available: "Tersedia",
    sold_out: "Habis",

    // Action Buttons
    order_whatsapp: "Pesan via WhatsApp",
    share: "Kongsi",
    view_shop_reviews: "Lihat Kedai & Ulasan",
    contact_now: "Hubungi Sekarang",
    view_shop: "Lihat Kedai",
    established_since: "Ditubuhkan Sejak",
    business_dream: "Impian Perniagaan Kami",
    verified_seller: "Penjual Disahkan",
    ssm_registered: "Terdaftar SSM",
    listings: "Senarai Produk",
    rating: "Penarafan",
    reviews: "Ulasan",

    // Reviews Section
    write_review: "Tulis Ulasan",
    reviewer_name: "Nama Anda",
    reviewer_name_placeholder: "Masukkan nama anda...",
    review_placeholder: "Kongsi pengalaman anda dengan penjual tempatan ini...",
    submit_review: "Hantar Ulasan",
    submitting: "Menghantar...",
    no_reviews_yet: "Belum ada ulasan. Jadilah yang pertama berkongsi pengalaman anda!",
    review_success: "Ulasan berjaya dihantar!",
    all_products_by_seller: "Semua Produk oleh Penjual Ini",

    // Seller Page Header
    directory_badge: "Direktori Usahawan Sabah",
    directory_title: "Kenali Usahawan Tempatan Kami",
    directory_desc: "Hubungi terus dengan kedai roti tempatan, tukang masak rumah, pengkraf, dan pembuat minuman di seluruh Sabah. Baca kisah inspirasi mereka dan terokai produk segar mereka.",
    no_sellers_found: "Tiada penjual tempatan ditemui sepadan dengan penapis.",

    // Categories
    all_categories: "Semua Kategori",
    all_districts_lbl: "Semua Daerah",
    "Food&Tamu": "Makanan & Tamu",
    "Bundle&Fashion": "Pakaian Bundel & Fesyen",
    "Gadgets&Electronics": "Gajet & Elektronik",
    "Services&Runners": "Perkhidmatan & Pelari",
    "Others": "Lain-lain"
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("sabah_tamu_language");
    return (saved === "EN" || saved === "BM") ? (saved as Language) : "EN";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("sabah_tamu_language", lang);
  };

  const t = (key: string, variables?: Record<string, string | number>): string => {
    const translationSet = translations[language];
    let template = "";
    if (translationSet && translationSet[key]) {
      template = translationSet[key];
    } else {
      const fallbackSet = translations["EN"];
      if (fallbackSet && fallbackSet[key]) {
        template = fallbackSet[key];
      } else {
        template = key;
      }
    }

    if (variables) {
      Object.entries(variables).forEach(([varKey, varVal]) => {
        template = template.replace(`{${varKey}}`, String(varVal));
      });
    }

    return template;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
