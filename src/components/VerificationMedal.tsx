import React from "react";
import badgeBronze from "../assets/images/badge_bronze.png";
import badgeSilver from "../assets/images/badge_silver.png";
import badgeGold from "../assets/images/badge_gold.png";
import badgeLicensed from "../assets/images/badge_licensed.png";

export type VerificationTier = "Bronze" | "Silver" | "Gold" | "Licensed";

interface VerificationMedalProps {
  tier: VerificationTier;
  size?: number; // pixel width; height scales proportionally to the badge art
  className?: string;
  /** "full" and "seal" both render the same real badge photo — kept as a
   *  prop for backwards compatibility with existing call sites. */
  variant?: "full" | "seal";
}

const TIER_IMAGE: Record<VerificationTier, string> = {
  Bronze: badgeBronze,
  Silver: badgeSilver,
  Gold: badgeGold,
  Licensed: badgeLicensed,
};

const TIER_LABEL: Record<VerificationTier, string> = {
  Bronze: "Bronze Verified Business",
  Silver: "Silver Verified Business",
  Gold: "Gold Verified Business",
  Licensed: "Licensed / SSM Verified Business",
};

export default function VerificationMedal({ tier, size = 88, className = "" }: VerificationMedalProps) {
  return (
    <img
      src={TIER_IMAGE[tier]}
      alt={`${tier} — ${TIER_LABEL[tier]}`}
      title={TIER_LABEL[tier]}
      width={size}
      height={size}
      className={`object-contain drop-shadow-md ${className}`}
      style={{ width: size, height: "auto" }}
      draggable={false}
    />
  );
}
