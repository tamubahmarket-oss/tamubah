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
  verificationTier?: "None" | "Licensed" | "Bronze" | "Silver" | "Gold"; // Licensed = simple pill; Bronze/Silver/Gold = big 3D medal
  contactCount?: number;
  averageRating?: number;
  reviewCount?: number;
  planStatus?: "pending" | "founding" | "trial" | "paid" | "expired";
  approvedAt?: string;
  trialEndsAt?: string;
  nextPaymentDue?: string;
  latestUpdate?: string;
  latestUpdateAt?: string;
  isOfficial?: boolean;
  businessLink?: string; // optional external link for orders (Google Maps/Forms, website, catalog, etc.)
  createdAt?: string;
}

export interface Product {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  imageUrl: string;
  isAvailable: boolean;
  isPublished?: boolean;
  sortOrder?: number;
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
  sellerVerificationTier?: "None" | "Licensed" | "Bronze" | "Silver" | "Gold";
  ssmNumber?: string;
  reportCount?: number;
  sellerAverageRating?: number;
  sellerReviewCount?: number;
}

export interface PublishRequest {
  id: string;
  sellerId: string;
  productId: string;
  message: string;
  adminNote?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  // Enriched fields (admin view only)
  businessName?: string;
  sellerName?: string;
  productTitle?: string;
  productImageUrl?: string;
  productPrice?: number;
}

export interface ReceiptItem {
  title: string;
  unitPrice: number;
  quantity: number;
  type: "product" | "service";
  productId?: string | null;
  lineTotal: number;
}

export const COMMUNITY_CATEGORIES = [
  "General Discussion",
  "Business Tips",
  "Marketing & Sales",
  "Success Stories",
  "Questions & Help",
];

export interface CommunityTopic {
  id: string;
  sellerId: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  replyCount: number;
  voteCount: number;
  hasVoted: boolean;
  businessName?: string;
  sellerLogoUrl?: string;
  sellerVerificationTier?: "None" | "Licensed" | "Bronze" | "Silver" | "Gold";
  sellerIsOfficial?: boolean;
}

export interface CommunityReply {
  id: string;
  topicId: string;
  sellerId: string;
  body: string;
  createdAt: string;
  businessName?: string;
  sellerLogoUrl?: string;
  sellerVerificationTier?: "None" | "Licensed" | "Bronze" | "Silver" | "Gold";
  sellerIsOfficial?: boolean;
}

export type DeliveryStatus = "open" | "accepted" | "picked_up" | "in_transit" | "delivered" | "cancelled";

export interface DeliveryRequest {
  id: string;
  sellerId: string;
  runnerId?: string;
  productId?: string;
  productTitle: string;
  pickupLocation: string;
  pickupAddress: string;
  dropoffLocation: string;
  dropoffAddress: string;
  customerName?: string;
  customerPhone: string;
  deliveryFee: number;
  notes?: string;
  status: DeliveryStatus;
  createdAt: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  // Enriched fields (present on API responses)
  sellerBusinessName?: string;
  sellerPhoneNumber?: string;
  runnerBusinessName?: string;
  runnerPhoneNumber?: string;
}

export interface Story {
  id: string;
  sellerId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
  likeCount: number;
  createdAt: string;
  expiresAt: string;
  // Enriched fields (present on the public feed)
  viewCount?: number;
  businessName?: string;
  sellerLogoUrl?: string;
  sellerVerificationTier?: "None" | "Licensed" | "Bronze" | "Silver" | "Gold";
  sellerLocation?: string;
  sellerPhoneNumber?: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  sellerId: string;
  customerName?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  deliveryFee: number;
  subtotal: number;
  total: number;
  notes?: string;
  createdAt: string;
  // Enriched seller fields (present when viewed publicly/by admin)
  businessName?: string;
  sellerName?: string;
  sellerPhoneNumber?: string;
  sellerLogoUrl?: string;
  sellerAddress?: string;
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
  "Kota Belud",
  "Tambunan",
  "Kunak",
  "Kinabatangan",
  "Beluran",
  "Telupid",
  "Pitas",
  "Kota Marudu",
  "Tamparuli",
  "Tenom",
  "Sipitang",
  "Sook",
  "Nabawan",
  "Kalabakan",
  "Tongod"
];

export const BUSINESS_CATEGORIES = [
  "Food & Tamu",
  "Art & Crafts",
  "Bundle & Fashion",
  "Gadgets & Electronic",
  "Home & Living",
  "Transport & Runners",
  "Professional Services & Freelance",
  "Others"
];
