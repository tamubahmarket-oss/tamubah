import React, { useState, useEffect } from "react";
import { 
  Plus, Trash2, ToggleLeft, ToggleRight, LogOut, Upload, ShoppingBag, 
  MapPin, Check, AlertCircle, RefreshCw, Layers, DollarSign, FileText, CheckCircle,
  Briefcase, Calendar, User, Phone, Building, Star, Globe, Heart, MessageCircle
} from "lucide-react";
import { Seller, Product, BUSINESS_CATEGORIES, SABAH_LOCATIONS } from "../types";
import { compressAndResizeImage } from "../utils";
import { useLanguage } from "../lib/LanguageContext";
import tamubahBagIcon from "../assets/images/traditional_bag_logo_1784122537315.jpg";


interface ShopDashboardProps {
  seller: Seller;
  onLogout: () => void;
  onRefreshMarket: () => void;
  onUpdateSeller: (seller: Seller) => void;
}

// Premium Unsplash stock images for beautiful business profiles/logos
const PROFILE_PRESETS = [
  { name: "Bakery & Flour", url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80" },
  { name: "Kitchen & Chef", url: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&auto=format&fit=crop&q=80" },
  { name: "Coffee Roaster", url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&auto=format&fit=crop&q=80" },
  { name: "Sweet Bakery", url: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&auto=format&fit=crop&q=80" },
  { name: "Local Spices", url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80" },
  { name: "Handicrafts", url: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=400&auto=format&fit=crop&q=80" }
];

export default function ShopDashboard({ seller, onLogout, onRefreshMarket, onUpdateSeller }: ShopDashboardProps) {
  const { language } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirmProductId, setDeleteConfirmProductId] = useState<string | null>(null);

  // Publish requests: only 1 product may be published (live in the market)
  // per seller at a time. Extra products need admin permission to go live.
  const [publishRequests, setPublishRequests] = useState<any[]>([]);
  const [askAdminProductId, setAskAdminProductId] = useState<string | null>(null);
  const [askAdminMessage, setAskAdminMessage] = useState("");
  const [askAdminSubmitting, setAskAdminSubmitting] = useState(false);

  const fetchPublishRequests = async () => {
    try {
      const res = await fetch(`/api/publish-requests?sellerId=${seller.id}`);
      const data = await res.json();
      if (res.ok) setPublishRequests(data);
    } catch (err) {
      console.error("Failed to fetch publish requests", err);
    }
  };

  const getPendingRequestForProduct = (productId: string) =>
    publishRequests.find((r) => r.productId === productId && r.status === "pending");

  const publishedCount = products.filter((p) => (p as any).isPublished).length;

  const handlePublishProduct = async (productId: string) => {
    setActionLoading(productId);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: seller.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to publish product.");
      }
      setProducts(products.map(p => p.id === productId ? { ...p, ...data.product } : p));
      setSuccess("Product is now live in the Sabah Market!");
      onRefreshMarket();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublishProduct = async (productId: string) => {
    setActionLoading(productId);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}/unpublish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: seller.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to unpublish product.");
      }
      setProducts(products.map(p => p.id === productId ? { ...p, ...data.product } : p));
      setSuccess("Product moved back to your private shop.");
      onRefreshMarket();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenAskAdmin = (productId: string) => {
    setAskAdminProductId(productId);
    setAskAdminMessage("");
  };

  const handleSubmitAskAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askAdminProductId) return;
    setAskAdminSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/publish-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: seller.id, productId: askAdminProductId, message: askAdminMessage }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send request to admin.");
      }
      setSuccess("Your request has been sent to the admin for review.");
      setAskAdminProductId(null);
      await fetchPublishRequests();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAskAdminSubmitting(false);
    }
  };

  useEffect(() => {
    fetchPublishRequests();
  }, [seller.id]);

  const [sellerCount, setSellerCount] = useState<number>(0);
  const [loadingSellers, setLoadingSellers] = useState<boolean>(true);

  useEffect(() => {
    fetch("/api/sellers")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSellerCount(data.length);
        }
      })
      .catch((err) => console.error("Failed to load seller count in ShopDashboard", err))
      .finally(() => setLoadingSellers(false));
  }, []);

  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<"products" | "profile">("products");

  // Form states for creating a product
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(BUSINESS_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  // Form states for business profile
  const [profileLogoUrl, setProfileLogoUrl] = useState(seller.logoUrl || "");
  const [profileEstablishedYear, setProfileEstablishedYear] = useState(seller.establishedYear || "");
  const [profileDream, setProfileDream] = useState(seller.dream || "");
  const [profileBusinessName, setProfileBusinessName] = useState(seller.businessName || "");
  const [profileOwnerName, setProfileOwnerName] = useState(seller.ownerName || "");
  const [profileCategory, setProfileCategory] = useState(seller.category || "");
  const [profileLocation, setProfileLocation] = useState(seller.location || "");
  const [profileSsmNumber, setProfileSsmNumber] = useState(seller.ssmNumber || "");
  const [profilePhoneNumber, setProfilePhoneNumber] = useState(seller.phoneNumber || "");
  const [profileAddress, setProfileAddress] = useState(seller.address || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileDragActive, setProfileDragActive] = useState(false);

  // Sync profile form values if seller prop changes
  useEffect(() => {
    setProfileLogoUrl(seller.logoUrl || "");
    setProfileEstablishedYear(seller.establishedYear || "");
    setProfileDream(seller.dream || "");
    setProfileBusinessName(seller.businessName || "");
    setProfileOwnerName(seller.ownerName || "");
    setProfileCategory(seller.category || "");
    setProfileLocation(seller.location || "");
    setProfileSsmNumber(seller.ssmNumber || "");
    setProfilePhoneNumber(seller.phoneNumber || "");
    setProfileAddress(seller.address || "");
  }, [seller]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSavingProfile(true);

    try {
      // Clean phone number: remove any formatting, ensure starting with 60 (Malaysian country code)
      let formattedPhone = profilePhoneNumber.replace(/\D/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "6" + formattedPhone;
      } else if (formattedPhone.startsWith("1")) {
        formattedPhone = "60" + formattedPhone;
      } else if (formattedPhone.length > 0 && !formattedPhone.startsWith("60")) {
        formattedPhone = "60" + formattedPhone;
      }

      const response = await fetch(`/api/sellers/${seller.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logoUrl: profileLogoUrl,
          establishedYear: profileEstablishedYear,
          dream: profileDream,
          businessName: profileBusinessName,
          ownerName: profileOwnerName,
          category: profileCategory,
          location: profileLocation,
          ssmNumber: profileSsmNumber,
          phoneNumber: formattedPhone || profilePhoneNumber,
          address: profileAddress,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update business profile.");
      }

      setSuccess("Your business profile has been successfully updated!");
      onUpdateSeller(data.seller);
      onRefreshMarket();
      
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  // Helper for profile photo file upload
  const processProfilePhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, JPEG, WEBP) for your business profile photo.");
      return;
    }

    try {
      // Compress and resize (converting to .webp with max 800px dimension and 0.8 quality)
      const compressedBase64 = await compressAndResizeImage(file, 800, 0.8, "image/webp");
      setProfileLogoUrl(compressedBase64);
      setError(null);
    } catch (err: any) {
      console.error("Compression error:", err);
      setError("Failed to process and compress the logo. Please try another image.");
    }
  };

  const handleProfilePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processProfilePhoto(e.target.files[0]);
    }
  };

  const handleProfileDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setProfileDragActive(true);
    } else if (e.type === "dragleave") {
      setProfileDragActive(false);
    }
  };

  const handleProfileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setProfileDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processProfilePhoto(e.dataTransfer.files[0]);
    }
  };

  // Fetch only this seller's products
  const fetchMyProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/products?showAll=true");
      const data = await response.json();
      if (response.ok) {
        // Filter products made by this specific seller
        const myProducts = data.filter((p: Product) => p.sellerId === seller.id);
        setProducts(myProducts);
      } else {
        throw new Error(data.error || "Failed to fetch your products.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyProducts();
  }, [seller.id]);

  // Handle local file upload
  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, JPEG, WEBP).");
      return;
    }

    try {
      // Compress and resize (converting to .webp with max 1000px dimension and 0.8 quality)
      const compressedBase64 = await compressAndResizeImage(file, 1000, 0.8, "image/webp");
      setImageUrl(compressedBase64);
      setError(null);
    } catch (err: any) {
      console.error("Compression error:", err);
      setError("Failed to process and compress the product image. Please try another image.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Submit product creation
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim() || !category || !description.trim() || !price || !imageUrl) {
      setError("All fields are required. Remember, a picture is a MUST!");
      return;
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setError("Please enter a valid price greater than 0.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          category,
          description,
          price: numericPrice,
          imageUrl,
          isAvailable,
          sellerId: seller.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to list product.");
      }

      setSuccess("Product successfully posted to Sabah's market!");
      
      // Reset Form fields
      setTitle("");
      setDescription("");
      setPrice("");
      setImageUrl("");
      setIsAvailable(true);

      // Refresh listings
      await fetchMyProducts();
      onRefreshMarket(); // Tell App to refresh public view

      setTimeout(() => {
        setSuccess(null);
      }, 3000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle availability state
  const handleToggleAvailability = async (productId: string) => {
    setActionLoading(productId);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}/toggle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sellerId: seller.id }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to toggle status.");
      }

      setProducts(products.map(p => p.id === productId ? { ...p, isAvailable: data.product.isAvailable } : p));
      onRefreshMarket(); // Notify public market
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTrigger = (productId: string) => {
    setDeleteConfirmProductId(productId);
  };

  // Delete product
  const executeDeleteProduct = async (productId: string) => {
    setDeleteConfirmProductId(null);
    setActionLoading(productId);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}?sellerId=${seller.id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete product.");
      }

      setProducts(products.filter(p => p.id !== productId));
      setSuccess("Product removed from marketplace.");
      onRefreshMarket(); // Notify public market

      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div id="shop-dashboard" className="max-w-7xl mx-auto px-4 py-8">
      {/* Seller Dashboard Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-emerald-900/30 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {language === "EN" ? "Seller Dashboard Active" : "Dashboard Penjual Aktif"}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans tracking-tight">
            {seller.businessName}
          </h1>
          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2 text-slate-300 text-sm">
            <span className="flex items-center gap-1">
              <span className="font-semibold text-white">{language === "EN" ? "Owner:" : "Pemilik:"}</span> {seller.ownerName}
            </span>
            <span className="text-slate-500">•</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> {seller.location}, Sabah
            </span>
            {seller.ssmNumber && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-xs bg-slate-700/60 text-slate-200 px-2.5 py-0.5 rounded-full font-mono">
                  {language === "EN" ? "License / SSM:" : "Lesen / SSM:"} {seller.ssmNumber}
                </span>
              </>
            )}
          </div>
        </div>

        <button
          id="logout-btn"
          onClick={onLogout}
          className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-5 py-2.5 rounded-xl border border-rose-500/20 transition-all font-semibold text-sm self-stretch md:self-auto justify-center cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          {language === "EN" ? "Log Out Account" : "Log Keluar Akaun"}
        </button>
      </div>

      {/* Celebration Congratulatory Banner for Early Bird Promo */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-3xl p-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl transform translate-x-8 -translate-y-8"></div>
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              {language === "EN" ? "Official Pioneer Seller" : "Penjual Pelopor Rasmi"}
            </span>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
              {language === "EN" ? "Early Bird Promotion Active" : "Promosi Pendaftaran Awal Aktif"}
            </span>
          </div>
          <h2 className="text-lg font-extrabold text-slate-800 font-sans tracking-tight">
            Tahniah & Congratulations, {seller.ownerName}! 🎉
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed max-w-3xl">
            {language === "EN" 
              ? "You have successfully set up your seller profile on TAMU BAH! As one of our first 100 pioneering Sabahan micro-shops, your business has officially locked in 1 Year of Free Premium Promotion (valued at RM240) for absolutely RM0. Enjoy 100% of your hard-earned profits with zero platform commission fees!"
              : "Anda telah berjaya menyediakan profil penjual anda di TAMU BAH! Sebagai salah satu daripada 100 kedai mikro perintis Sabah yang pertama, perniagaan anda secara rasmi mendapat Promosi Premium Percuma Selama 1 Tahun (bernilai RM240) dengan harga RM0 sahaja. Nikmati 100% daripada keuntungan titik peluh anda dengan yuran komisen platform sifar!"}
          </p>
          <div className="pt-1 flex items-center gap-2 text-xs font-bold text-emerald-700">
            <Check className="w-4 h-4 stroke-[3]" />
            <span>
              {language === "EN"
                ? "Feel free to upload your amazing products, specify your details, and start receiving direct orders!"
                : "Sila muat naik produk hebat anda, nyatakan butiran anda, dan mula menerima pesanan terus!"}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 border-b border-slate-200 mb-8 pb-px">
        <button
          id="tab-btn-products"
          onClick={() => {
            setActiveSubTab("products");
            setError(null);
            setSuccess(null);
          }}
          className={`px-5 py-3 md:px-6 md:py-3.5 font-bold text-xs md:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === "products"
              ? "border-emerald-600 text-emerald-700 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          {language === "EN" ? "Products Catalog" : "Katalog Produk"} ({products.length})
        </button>
        <button
          id="tab-btn-profile"
          onClick={() => {
            setActiveSubTab("profile");
            setError(null);
            setSuccess(null);
          }}
          className={`px-5 py-3 md:px-6 md:py-3.5 font-bold text-xs md:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === "profile"
              ? "border-emerald-600 text-emerald-700 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          {language === "EN" ? "Business Profile Settings" : "Tetapan Profil Perniagaan"}
        </button>
      </div>

      {activeSubTab === "products" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Create Product Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 sticky top-24">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 mb-6">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-lg">
                  {language === "EN" ? "Post New Product" : "Hantar Produk Baru"}
                </h2>
                <p className="text-xs text-slate-500">
                  {language === "EN" ? "Add product or services to Tamu Bah" : "Tambah produk atau perkhidmatan ke Tamu Bah"}
                </p>
              </div>
            </div>

            {/* Error & Success indicators */}
            {error && (
              <div id="product-form-error" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 flex items-start gap-2 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div id="product-form-success" className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl mb-5 flex items-start gap-2 text-sm">
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form id="create-product-form" onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="product-title-input"
                  type="text"
                  required
                  placeholder="e.g. Moist Chocolate Indulgence Cake"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="product-category-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm bg-white"
                >
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Price (RM) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-medium text-sm">
                    RM
                  </span>
                  <input
                    id="product-price-input"
                    type="number"
                    step="0.01"
                    min="0.10"
                    required
                    placeholder="15.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="product-desc-input"
                  required
                  rows={3}
                  placeholder="Tell customers about the ingredients, size, preparation time, and delivery arrangements..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm resize-none"
                />
              </div>

              {/* Product Image Selection & Upload Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product Image <span className="text-red-500">*</span>
                </label>

                {imageUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 h-44 group">
                    <img
                      src={imageUrl}
                      alt="Upload Preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="bg-white/95 hover:bg-white text-rose-600 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
                      >
                        Remove Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                      dragActive 
                        ? "border-emerald-500 bg-emerald-50/50" 
                        : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <input
                      id="file-upload-input"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="file-upload-input" className="cursor-pointer block">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
                      <span className="text-xs font-semibold text-slate-800 block">
                        Drag & Drop or <span className="text-emerald-600 hover:underline">Browse File</span>
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        PNG, JPG, JPEG up to 5MB
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Photo Quality Advice */}
              {!imageUrl && (
                <div className="flex items-start gap-2.5 bg-amber-50/60 border border-amber-100 p-3 rounded-xl">
                  <Star className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    <span className="font-bold">Photo tip:</span> Use your own original photo, taken in good lighting and clearly showing the actual product. Clear, professional-looking photos build buyer trust and get more orders — avoid blurry shots, watermarks, or images copied from the internet.
                  </p>
                </div>
              )}

              {/* Availability Toggle */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">Available Immediately?</span>
                  <span className="text-[10px] text-slate-400">Post directly as active in the Sabah Market</span>
                </div>
                <button
                  type="button"
                  id="availability-toggle-btn"
                  onClick={() => setIsAvailable(!isAvailable)}
                  className="text-emerald-600 focus:outline-none cursor-pointer"
                >
                  {isAvailable ? (
                    <ToggleRight className="w-10 h-10" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-300" />
                  )}
                </button>
              </div>

              <button
                id="post-product-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-2 cursor-pointer"
              >
                {loading ? "Posting..." : "Post to Sabah Market"}
                <Check className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Seller's Current Catalog / Active Listings */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 min-h-[500px]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 rounded-xl">
                  <img src={tamubahBagIcon} alt="Tamu Bah" className="w-5 h-5 object-contain" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">My Listed Products</h2>
                  <p className="text-xs text-slate-500">Manage what you are currently selling</p>
                </div>
              </div>
              
              <button
                id="refresh-shop-btn"
                onClick={fetchMyProducts}
                className="p-1.5 hover:bg-slate-50 rounded-lg border border-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                title="Refresh Shop Catalog"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5 mb-6 flex items-start gap-2.5 text-xs text-indigo-800 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Only 1 product can be published (live) in the Sabah Market at a time.</span>{" "}
                Every other product you add stays saved in your shop. Unpublish your current live product to swap it for another, or use "Ask Admin to Publish" to request permission to show more than 1 product at once.
              </div>
            </div>

            {loading && products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mb-3 text-emerald-600" />
                <span>Loading your shop catalog...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4 border border-slate-100">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">No Products Listed Yet</h3>
                <p className="text-slate-400 text-xs mt-1.5 max-w-sm">
                  Add your first homemade bakery, dessert, meal, or drink using the form on the left.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {products.map((p) => (
                  <div
                    key={p.id}
                    id={`my-product-card-${p.id}`}
                    className="group border border-slate-100 rounded-2xl overflow-hidden bg-white hover:shadow-md transition-all relative flex flex-col h-full"
                  >
                    {/* Absolute badges */}
                    <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
                      <span className="bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {p.category}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 z-10">
                      <button
                        id={`delete-product-btn-${p.id}`}
                        onClick={() => handleDeleteTrigger(p.id)}
                        disabled={actionLoading === p.id}
                        className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-xl shadow-sm border border-red-200/50 transition-colors cursor-pointer"
                        title="Delete product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Image Area */}
                    <div className="h-44 overflow-hidden relative bg-slate-100 shrink-0">
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    {/* Content */}
                    <div className="p-4 flex flex-col flex-grow">
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors line-clamp-1">
                          {p.title}
                        </h3>
                        <span className="text-sm font-extrabold text-slate-900 shrink-0">
                          RM {p.price.toFixed(2)}
                        </span>
                      </div>

                      <p className="text-slate-500 text-xs line-clamp-2 mb-4 flex-grow">
                        {p.description}
                      </p>

                      {/* Action & Status */}
                      <div className="flex items-center justify-between border-t border-slate-50 pt-3.5 mt-auto">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${p.isAvailable ? "bg-emerald-500" : "bg-slate-300"}`}></span>
                          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                            {p.isAvailable ? "Available" : "Out of Stock"}
                          </span>
                        </div>

                        <button
                          id={`toggle-availability-btn-${p.id}`}
                          onClick={() => handleToggleAvailability(p.id)}
                          disabled={actionLoading === p.id}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                            p.isAvailable 
                              ? "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200" 
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {p.isAvailable ? "Set Out of Stock" : "Set Available"}
                        </button>
                      </div>

                      {/* Market Publish Status & Controls */}
                      {(() => {
                        const isPublished = (p as any).isPublished;
                        const pendingRequest = getPendingRequestForProduct(p.id);
                        return (
                          <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${isPublished ? "bg-indigo-500" : "bg-slate-300"}`}></span>
                              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                {isPublished ? "Published (Live)" : pendingRequest ? "Pending Admin Review" : "In Shop Only"}
                              </span>
                            </div>

                            {isPublished ? (
                              <button
                                onClick={() => handleUnpublishProduct(p.id)}
                                disabled={actionLoading === p.id}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 transition-all cursor-pointer"
                              >
                                Unpublish
                              </button>
                            ) : pendingRequest ? (
                              <span className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                                Request Sent
                              </span>
                            ) : publishedCount < 1 ? (
                              <button
                                onClick={() => handlePublishProduct(p.id)}
                                disabled={actionLoading === p.id}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 transition-all cursor-pointer"
                              >
                                Publish to Market
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenAskAdmin(p.id)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 transition-all cursor-pointer"
                              >
                                Ask Admin to Publish
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
      ) : (
        <div id="business-profile-panel" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Live Public Profile Preview Card */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-b from-white to-slate-50 rounded-3xl p-6 shadow-md border border-slate-100 sticky top-24 text-slate-800">
              <div className="text-center pb-4 border-b border-slate-100">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider mb-4 inline-block">
                  Market Profile Card Preview
                </span>
                
                <div className="relative w-28 h-28 mx-auto mb-4 rounded-3xl overflow-hidden shadow-md border-2 border-emerald-500/20 bg-slate-100 flex items-center justify-center">
                  {profileLogoUrl ? (
                    <img 
                      src={profileLogoUrl} 
                      alt="Business Logo Preview" 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Building className="w-10 h-10 mb-1" />
                      <span className="text-[10px] uppercase tracking-wider font-bold font-mono">No Logo</span>
                    </div>
                  )}
                </div>

                <h3 className="font-extrabold text-slate-800 text-lg leading-tight">
                  {profileBusinessName || "My Homemade Business"}
                </h3>
                <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full mt-1.5 inline-block font-medium">
                  {profileCategory || "Food&Tamu"}
                </span>

                {profileEstablishedYear && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-2 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-300 animate-pulse" />
                    <span>Serving Sabah Since {profileEstablishedYear}</span>
                  </div>
                )}
              </div>

              {/* Profile Details List */}
              <div className="py-5 space-y-3.5 border-b border-slate-100">
                <div className="flex items-start gap-3 text-xs">
                  <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[9px]">Founder / Entrepreneur</span>
                    <span className="text-slate-700 font-medium">{profileOwnerName || "Not Set"}</span>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 text-xs font-sans">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[9px]">Primary Location</span>
                    <span className="text-slate-700 font-medium">{profileLocation ? `${profileLocation}, Sabah` : "Not Set"}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-xs">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[9px]">WhatsApp Contact</span>
                    <span className="text-slate-700 font-medium font-mono">+{profilePhoneNumber || "Not Set"}</span>
                  </div>
                </div>

                {profileSsmNumber && (
                  <div className="flex items-start gap-3 text-xs">
                    <Building className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[9px]">License / SSM Registration</span>
                      <span className="text-slate-700 font-medium font-mono">{profileSsmNumber}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 text-xs">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[9px]">Business/Pick-up Address</span>
                    <span className="text-slate-600 leading-normal">{profileAddress || "Not Set"}</span>
                  </div>
                </div>
              </div>

              {/* Dream Quote Block */}
              <div className="pt-5">
                <div className="flex items-center gap-1 mb-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md w-fit uppercase tracking-wider">
                  <span>The Entrepreneur's Dream</span>
                </div>
                <div className="relative bg-gradient-to-br from-amber-50/50 to-orange-50/20 p-4 rounded-2xl border border-amber-100/40">
                  <p className="text-slate-600 text-xs italic leading-relaxed font-serif">
                    {profileDream ? `"${profileDream}"` : '"Every Sabahan entrepreneur starts with a simple dream. Share your story, vision, or goal with your customers here..."'}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Edit Business Profile Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-md border border-slate-100 text-slate-800">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                  <Briefcase className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">Manage Business Profile</h2>
                  <p className="text-xs text-slate-500">Update your public profile, entrepreneur dream, and business registration info</p>
                </div>
              </div>

              {/* Status messages specifically inside form */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-start gap-2 text-sm animate-in fade-in duration-150">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl mb-6 flex items-start gap-2 text-sm animate-in fade-in duration-150">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-6">
                
                {/* 1. Business Logo Profile Photo Upload & Presets */}
                <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-3 bg-emerald-500 rounded-full"></span>
                    Business Profile Photo / Logo
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
                    {/* Preview circle on left */}
                    <div className="md:col-span-1 flex flex-col items-center">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner flex items-center justify-center relative group">
                        {profileLogoUrl ? (
                          <>
                            <img 
                              src={profileLogoUrl} 
                              alt="Current Logo" 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover" 
                            />
                            <button
                              type="button"
                              onClick={() => setProfileLogoUrl("")}
                              className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold cursor-pointer"
                            >
                              Remove Photo
                            </button>
                          </>
                        ) : (
                          <div className="text-center text-slate-400">
                            <Building className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                            <span className="text-[9px] uppercase tracking-wider font-bold">No Photo</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upload or Drop Area in Middle */}
                    <div className="md:col-span-2">
                      <div
                        onDragEnter={handleProfileDrag}
                        onDragOver={handleProfileDrag}
                        onDragLeave={handleProfileDrag}
                        onDrop={handleProfileDrop}
                        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                          profileDragActive 
                            ? "border-emerald-500 bg-emerald-50/50" 
                            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <input
                          id="profile-upload-input"
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePhotoFileChange}
                          className="hidden"
                        />
                        <label htmlFor="profile-upload-input" className="cursor-pointer block">
                          <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                          <span className="text-xs font-semibold text-slate-800 block">
                            Drag & Drop or <span className="text-emerald-600 hover:underline">Browse Logo File</span>
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Logo Presets Selection below */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      Or Choose a Beautiful Pre-set Theme Business Photo:
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {PROFILE_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setProfileLogoUrl(preset.url)}
                          title={preset.name}
                          className={`h-11 rounded-lg overflow-hidden border transition-all cursor-pointer relative group ${
                            profileLogoUrl === preset.url ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Core Story: Established & The Dream */}
                <div className="bg-amber-50/30 border border-amber-100/50 p-5 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    Our Business Story & Dream
                  </h3>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      When did you start this business? <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                        <Calendar className="w-4 h-4 text-slate-400" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 2022, or March 2024"
                        value={profileEstablishedYear}
                        onChange={(e) => setProfileEstablishedYear(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm bg-white"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Specify the year or month you embarked on this business journey.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Your Business Dream / Motivation / Vision <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="e.g. My dream is to make home-style Sabah cuisine accessible to everyone, support local farmers, and expand into a physical bakery. Or what is your driving passion?"
                      value={profileDream}
                      onChange={(e) => setProfileDream(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm resize-none bg-white font-sans leading-relaxed text-slate-800"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Share your dream so customers can feel the human spirit behind your incredible products!</span>
                  </div>
                </div>

                {/* 3. Detailed Business Information */}
                <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-3 bg-emerald-500 rounded-full"></span>
                    Contact & Registration Details
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Business Shop Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={profileBusinessName}
                      onChange={(e) => setProfileBusinessName(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Entrepreneur / Owner Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={profileOwnerName}
                      onChange={(e) => setProfileOwnerName(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={profileCategory}
                      onChange={(e) => setProfileCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm bg-white"
                    >
                      {BUSINESS_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Sabah Location <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={profileLocation}
                      onChange={(e) => setProfileLocation(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm bg-white"
                    >
                      {SABAH_LOCATIONS.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Trading License / SSM Number (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DBKK/12345/2026, KKS-12345, or 202603120150"
                      value={profileSsmNumber}
                      onChange={(e) => setProfileSsmNumber(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      WhatsApp Contact Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-sm font-medium">
                        +
                      </span>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 60123456789"
                        value={profilePhoneNumber}
                        onChange={(e) => setProfilePhoneNumber(e.target.value)}
                        className="w-full pl-7 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm font-mono bg-white"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 block">Include country code, e.g. 60128334455 (no spaces or hyphens).</span>
                    <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed bg-slate-100/70 border border-slate-200/60 rounded-lg px-2.5 py-1.5">
                      Use a number dedicated to your business, and make sure it is active and reachable on WhatsApp — this is how buyers will message and order from you. This number will always be shown to buyers on your listings and profile.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Business/Pick-up Physical Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Specify your shop or physical pickup address..."
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-sm resize-none bg-white"
                    />
                  </div>

                  {/* Customer Conduct Advice */}
                  <div className="flex items-start gap-2.5 bg-emerald-50/60 border border-emerald-100 p-3.5 rounded-xl">
                    <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      <span className="font-bold">A quick reminder:</span> Always respond to customers professionally, in a friendly manner, and with good manners — clear communication and courtesy build trust and repeat customers for your business.
                    </p>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                >
                  {savingProfile ? "Saving Profile..." : "Save Business Profile Changes"}
                  <Check className="w-4 h-4" />
                </button>

              </form>
            </div>
          </div>

        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmProductId && (
        <div id="delete-confirm-overlay" className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
            <div className="bg-gradient-to-br from-rose-950 to-rose-900 p-5 text-white">
              <h3 className="font-bold text-lg">Remove Product Listing?</h3>
              <p className="text-rose-200 text-xs mt-1">
                This will delete your product from the Sabah Market.
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                Are you sure you want to delete <span className="font-semibold text-slate-800">"{products.find(p => p.id === deleteConfirmProductId)?.title}"</span>? This action is permanent and cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  id="cancel-delete-btn"
                  onClick={() => setDeleteConfirmProductId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Keep Product
                </button>
                <button
                  id="confirm-delete-btn"
                  onClick={() => executeDeleteProduct(deleteConfirmProductId)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                >
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ask Admin to Publish Modal */}
      {askAdminProductId && (
        <div id="ask-admin-overlay" className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
            <div className="bg-gradient-to-br from-indigo-950 to-indigo-900 p-5 text-white">
              <h3 className="font-bold text-lg">Ask Admin to Publish</h3>
              <p className="text-indigo-200 text-xs mt-1">
                You already have 1 product published. Request permission to publish this one too.
              </p>
            </div>
            <form onSubmit={handleSubmitAskAdmin} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Message to Admin (optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. It's a seasonal item and I'd like both live during festive season..."
                  value={askAdminMessage}
                  onChange={(e) => setAskAdminMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-slate-800 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAskAdminProductId(null)}
                  disabled={askAdminSubmitting}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-55"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={askAdminSubmitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1 text-xs cursor-pointer disabled:opacity-55"
                >
                  {askAdminSubmitting ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
