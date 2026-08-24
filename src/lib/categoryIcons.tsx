import React from "react";

/**
 * Custom minimalist icon badges for each business category — a flat colored
 * circle with a simple white line-drawn glyph. Kept centralized so every
 * screen (market filters, product cards, seller forms, admin panel) shows
 * the same badge for the same category.
 */

type CategorySvgIcon = React.FC<{ className?: string }>;

export const BADGE_COLORS: Record<string, string> = {
  All: "#64748b",
  "Food & Tamu": "#f59e0b",
  "Art & Crafts": "#ec4899",
  "Bundle & Fashion": "#a855f7",
  "Gadgets & Electronic": "#3b82f6",
  "Home & Living": "#22c55e",
  "Transport & Runners": "#14b8a6",
  "Professional Services & Freelance": "#0ea5e9",
  Others: "#64748b",
};

const COLORS_STORAGE_KEY = "tamubah_category_colors_v1";

function readColorOverrides(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COLORS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Solid hex color for a category (used for accent bars, borders, etc.) */
export function getCategoryColor(category: string): string {
  const overrides = readColorOverrides();
  return overrides[category] || BADGE_COLORS[category] || BADGE_COLORS.Others;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * A soft, low-opacity tint of the category's color — for card backgrounds,
 * so the market grid subtly color-codes each listing by category without
 * shouting over the product photo.
 */
export function getCategoryTint(category: string, alpha = 0.07): string {
  return hexToRgba(getCategoryColor(category), alpha);
}

function Badge({ color, className, children }: { color: string; className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill={color} />
      {children}
    </svg>
  );
}

const glyphProps = {
  stroke: "white",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
};

const AllIcon: CategorySvgIcon = ({ className }) => (
  <Badge color={BADGE_COLORS.All} className={className}>
    <rect x="9" y="9" width="6" height="6" rx="1.2" fill="white" />
    <rect x="17" y="9" width="6" height="6" rx="1.2" fill="white" />
    <rect x="9" y="17" width="6" height="6" rx="1.2" fill="white" />
    <rect x="17" y="17" width="6" height="6" rx="1.2" fill="white" />
  </Badge>
);

const FoodIcon: CategorySvgIcon = ({ className }) => (
  <Badge color={BADGE_COLORS["Food & Tamu"]} className={className}>
    <path d="M9 17 A7 5 0 0 0 23 17" {...glyphProps} />
    <line x1="8" y1="17" x2="24" y2="17" {...glyphProps} />
    <path d="M13 9 q1.5 -2.5 0 -4" {...glyphProps} />
    <path d="M19 9 q1.5 -2.5 0 -4" {...glyphProps} />
  </Badge>
);

const ArtCraftsIcon: CategorySvgIcon = ({ className }) => (
  <Badge color={BADGE_COLORS["Art & Crafts"]} className={className}>
    <path d="M11 22 a6.5 6.5 0 1 1 10 -5.5 c0 2 -1.5 2.5 -3 2.5 h-1.2 a1.6 1.6 0 0 0 -1 2.8 a1.6 1.6 0 0 1 -1 2.8 a6.5 6.5 0 0 1 -3.8 -2.6z" {...glyphProps} />
    <circle cx="12" cy="14" r="0.9" fill="white" stroke="none" />
    <circle cx="16" cy="11" r="0.9" fill="white" stroke="none" />
    <circle cx="20" cy="14" r="0.9" fill="white" stroke="none" />
  </Badge>
);

const FashionIcon: CategorySvgIcon = ({ className }) => (
  <Badge color={BADGE_COLORS["Bundle & Fashion"]} className={className}>
    <path d="M16 8 v3" {...glyphProps} />
    <path d="M16 11 l-8 6 a2 2 0 0 0 1.6 2.4 l6.4 -2.4 l6.4 2.4 a2 2 0 0 0 1.6 -2.4 z" {...glyphProps} />
    <line x1="9" y1="19.5" x2="23" y2="19.5" {...glyphProps} />
  </Badge>
);

const GadgetsIcon: CategorySvgIcon = ({ className }) => (
  <Badge color={BADGE_COLORS["Gadgets & Electronic"]} className={className}>
    <rect x="12" y="7" width="8" height="18" rx="1.6" {...glyphProps} />
    <circle cx="16" cy="21.5" r="0.9" fill="white" stroke="none" />
  </Badge>
);

const TransportIcon: CategorySvgIcon = ({ className }) => (
  <Badge color={BADGE_COLORS["Transport & Runners"]} className={className}>
    <path d="M7 19 l2 -6 a2 2 0 0 1 2 -1.4 h10 a2 2 0 0 1 2 1.4 l2 6" {...glyphProps} />
    <line x1="7" y1="19" x2="25" y2="19" {...glyphProps} />
    <circle cx="11" cy="21" r="1.6" stroke="white" strokeWidth={1.4} fill="none" />
    <circle cx="21" cy="21" r="1.6" stroke="white" strokeWidth={1.4} fill="none" />
  </Badge>
);

const HomesIcon: CategorySvgIcon = ({ className }) => (
  <Badge color={BADGE_COLORS["Home & Living"]} className={className}>
    <path d="M8 15 l8 -7 l8 7" {...glyphProps} />
    <path d="M10 14 v9 h12 v-9" {...glyphProps} />
    <rect x="14" y="18" width="4" height="5" rx="0.6" stroke="white" strokeWidth={1.3} fill="none" />
  </Badge>
);

const ProfessionalServicesIcon: CategorySvgIcon = ({ className }) => (
  <Badge color={BADGE_COLORS["Professional Services & Freelance"]} className={className}>
    <rect x="9" y="13" width="14" height="10" rx="1.6" {...glyphProps} />
    <path d="M13 13 v-2.4 a1.6 1.6 0 0 1 1.6 -1.6 h2.8 a1.6 1.6 0 0 1 1.6 1.6 v2.4" {...glyphProps} />
    <line x1="9" y1="18" x2="23" y2="18" {...glyphProps} />
  </Badge>
);

const OthersIcon: CategorySvgIcon = ({ className }) => (
  <Badge color={BADGE_COLORS.Others} className={className}>
    <path d="M9 12 l7 -4 l7 4 l0 9 l-7 4 l-7 -4 z" {...glyphProps} />
    <path d="M9 12 l7 4 l7 -4" {...glyphProps} />
    <line x1="16" y1="16" x2="16" y2="25" {...glyphProps} />
  </Badge>
);

export const CATEGORY_ICONS: Record<string, CategorySvgIcon> = {
  All: AllIcon,
  "Food & Tamu": FoodIcon,
  "Art & Crafts": ArtCraftsIcon,
  "Bundle & Fashion": FashionIcon,
  "Gadgets & Electronic": GadgetsIcon,
  "Home & Living": HomesIcon,
  "Transport & Runners": TransportIcon,
  "Professional Services & Freelance": ProfessionalServicesIcon,
  Others: OthersIcon,
};

export function getCategoryIcon(category: string): CategorySvgIcon {
  return CATEGORY_ICONS[category] || OthersIcon;
}

interface CategoryIconProps {
  category: string;
  className?: string;
}

/** Convenience component: <CategoryIcon category={p.category} className="w-4 h-4" /> */
export function CategoryIcon({ category, className }: CategoryIconProps) {
  const Icon = getCategoryIcon(category);
  return <Icon className={className} />;
}
