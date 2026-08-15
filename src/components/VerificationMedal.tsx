import React, { useId } from "react";

interface VerificationMedalProps {
  tier: "Bronze" | "Silver" | "Gold";
  size?: number; // pixel width; height scales proportionally (medal + ribbon tails)
  className?: string;
}

// Tier color ramps — each is a 3-stop gradient (highlight -> mid -> shadow)
// so the seal reads as a lifted, lit metal disc rather than a flat tint.
// Gold intentionally uses TamuBah's brand green instead of literal yellow-gold,
// since green is the platform's own "premium" color.
const TIER_COLORS: Record<VerificationMedalProps["tier"], { light: string; mid: string; dark: string; text: string }> = {
  Bronze: { light: "#e3a874", mid: "#b6702f", dark: "#7a4419", text: "Bronze Verified Business" },
  Silver: { light: "#f1f4f6", mid: "#b9c2c9", dark: "#7c8790", text: "Silver Verified Business" },
  Gold: { light: "#6fe0a8", mid: "#0f9d58", dark: "#0b5c34", text: "Gold Verified Business" },
};

// Dark-navy face color used inside every tier (matches the reference badge's
// navy center), fading slightly toward the rim for a subtle domed look.
const FACE_NAVY_LIGHT = "#173a5e";
const FACE_NAVY_DARK = "#0a1f33";

function buildScallopedSealPath(cx: number, cy: number, outerR: number, innerR: number, points: number): string {
  const step = (Math.PI * 2) / (points * 2);
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2) + " ";
  }
  return d + "Z";
}

export default function VerificationMedal({ tier, size = 88, className = "" }: VerificationMedalProps) {
  const uid = useId().replace(/[:]/g, "");
  const colors = TIER_COLORS[tier];
  const sealPath = buildScallopedSealPath(100, 96, 74, 63, 20);

  return (
    <svg
      viewBox="0 0 200 240"
      width={size}
      height={(size * 240) / 200}
      className={className}
      role="img"
      aria-label={`${tier} — ${colors.text}`}
    >
      <defs>
        <linearGradient id={`rim-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.light} />
          <stop offset="45%" stopColor={colors.mid} />
          <stop offset="100%" stopColor={colors.dark} />
        </linearGradient>
        <linearGradient id={`ribbon-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors.dark} />
          <stop offset="50%" stopColor={colors.mid} />
          <stop offset="100%" stopColor={colors.dark} />
        </linearGradient>
        <radialGradient id={`face-${uid}`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor={FACE_NAVY_LIGHT} />
          <stop offset="100%" stopColor={FACE_NAVY_DARK} />
        </radialGradient>
        <radialGradient id={`shine-${uid}`} cx="34%" cy="26%" r="40%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={`drop-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity="0.35" />
        </filter>
      </defs>

      <g filter={`url(#drop-${uid})`}>
        {/* Ribbon tails, drawn first so the seal overlaps their top edge */}
        <path
          d="M76,150 L76,228 L100,210 L92,150 Z"
          fill={`url(#ribbon-${uid})`}
          transform="rotate(-8 88 190)"
        />
        <path
          d="M124,150 L124,228 L100,210 L108,150 Z"
          fill={`url(#ribbon-${uid})`}
          transform="rotate(8 112 190)"
        />

        {/* Outer scalloped seal (the coin itself) */}
        <path d={sealPath} fill={`url(#rim-${uid})`} stroke={colors.dark} strokeWidth="1" />

        {/* Thin inner ridge ring for depth, between rim and navy face */}
        <circle cx="100" cy="96" r="58" fill="none" stroke={colors.dark} strokeOpacity="0.5" strokeWidth="2" />

        {/* Navy face */}
        <circle cx="100" cy="96" r="54" fill={`url(#face-${uid})`} stroke={colors.light} strokeWidth="2" />

        {/* Glossy highlight, upper-left, for the "3D dome" effect */}
        <circle cx="100" cy="96" r="54" fill={`url(#shine-${uid})`} />

        {/* Wordmark, stacked TAMU / BAH */}
        <text
          x="100"
          y="88"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight="800"
          fontSize="22"
          letterSpacing="2"
          fill="#ffffff"
        >
          TAMU
        </text>
        <text
          x="100"
          y="112"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight="800"
          fontSize="22"
          letterSpacing="3"
          fill={colors.light}
        >
          BAH
        </text>
      </g>
    </svg>
  );
}
