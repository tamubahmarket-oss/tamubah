export interface Seller {
  id: string;
  ownerName: string;
  email: string;
  businessName: string;
  category: string;
  ssmNumber?: string;
  address: string;
  phoneNumber: string;
  location: string;
  logoUrl?: string;
  establishedYear?: string;
  dream?: string;
  isVerified?: boolean; // deprecated or used alongside
  isApproved?: boolean; // status that allows page access
  verificationTier?: "None" | "Bronze" | "Silver" | "Gold"; // 3-level verified badge
  contactCount?: number;
  averageRating?: number;
  reviewCount?: number;
}

export interface Product {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  imageUrl: string;
  isAvailable: boolean;
  sellerId: string;
  createdAt: string;
  // Enriched fields from server join:
  sellerName: string;
  businessName: string;
  availableArea: string;
  contactNumber: string;
  address: string;
  sellerLogoUrl?: string;
  sellerEstablishedYear?: string;
  sellerDream?: string;
  sellerIsVerified?: boolean;
  sellerIsApproved?: boolean;
  sellerVerificationTier?: "None" | "Bronze" | "Silver" | "Gold";
  ssmNumber?: string;
  reportCount?: number;
  sellerAverageRating?: number;
  sellerReviewCount?: number;
}

export interface Review {
  id: string;
  sellerId: string;
  rating: number; // 1 to 5
  comment: string;
  reviewerName: string;
  createdAt: string;
}

export const SABAH_LOCATIONS = [
  "Kota Kinabalu",
  "Penampang",
  "Sandakan",
  "Tawau",
  "Keningau",
  "Lahad Datu",
  "Putatan",
  "Tuaran",
  "Papar",
  "Semporna",
  "Kudat",
  "Ranau",
  "Beaufort",
  "Kota Belud"
];

export const BUSINESS_CATEGORIES = [
  "Food&Tamu",
  "Bundle&Fashion",
  "Gadgets&Electronics",
  "Cars&Bikes",
  "Homes&Living",
  "Services&Runners",
  "Others"
];
