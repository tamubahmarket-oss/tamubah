import React from "react";
import { motion } from "motion/react";

/**
 * Layered, animated illustrations representing what each Sabah district is
 * known for — a soft colored blob backdrop plus a two-tone silhouette on
 * top, gently floating. Meant to sit behind a seller card at low opacity as
 * a decorative watermark.
 */

type LocationSvgIcon = React.FC<{}>;

// Shared soft "blob" backdrop shape every location illustration sits on top
// of — gives every watermark a bit of organic depth instead of a flat icon.
const Blob = () => (
  <path
    d="M70 8 C100 6 128 28 130 62 C132 96 108 128 72 130 C38 132 8 108 8 70 C8 34 40 10 70 8 Z"
    opacity={0.55}
  />
);

// Kota Kinabalu — city skyline + sun
const CityIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <circle cx="104" cy="38" r="12" opacity={0.9} />
    <rect x="26" y="76" width="16" height="42" opacity={0.95} />
    <rect x="46" y="58" width="18" height="60" opacity={0.95} />
    <rect x="68" y="80" width="14" height="38" opacity={0.95} />
    <rect x="86" y="46" width="20" height="72" opacity={0.95} />
    <rect x="34" y="82" width="4" height="4" fill="white" opacity={0.5} />
    <rect x="52" y="66" width="4" height="4" fill="white" opacity={0.5} />
    <rect x="92" y="54" width="4" height="4" fill="white" opacity={0.5} />
  </>
);

// Penampang — traditional conical hat with weave rings
const HatIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <path d="M70 26 L104 92 Q70 106 36 92 Z" opacity={0.95} />
    <ellipse cx="70" cy="94" rx="36" ry="9" opacity={0.95} />
    <path d="M46 66 Q70 74 94 66" stroke="white" strokeWidth="2" fill="none" opacity={0.35} />
    <path d="M42 78 Q70 88 98 78" stroke="white" strokeWidth="2" fill="none" opacity={0.35} />
  </>
);

// Sandakan — orangutan silhouette
const OrangutanIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <circle cx="70" cy="52" r="24" opacity={0.95} />
    <circle cx="42" cy="46" r="11" opacity={0.9} />
    <circle cx="98" cy="46" r="11" opacity={0.9} />
    <ellipse cx="70" cy="96" rx="29" ry="24" opacity={0.95} />
  </>
);

// Tawau — cocoa pod with ridges
const CocoaIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <path d="M70 20 Q98 38 94 72 Q90 108 70 116 Q50 108 46 72 Q42 38 70 20 Z" opacity={0.95} />
    <path d="M70 26 Q70 70 70 112" stroke="white" strokeWidth="2" opacity={0.3} />
    <path d="M56 40 Q60 74 62 104" stroke="white" strokeWidth="1.5" opacity={0.2} />
    <path d="M84 40 Q80 74 78 104" stroke="white" strokeWidth="1.5" opacity={0.2} />
  </>
);

// Keningau — cattle head with horns
const CattleIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <circle cx="70" cy="74" r="28" opacity={0.95} />
    <path d="M46 52 Q30 28 24 40 Q36 58 48 60 Z" opacity={0.9} />
    <path d="M94 52 Q110 28 116 40 Q104 58 92 60 Z" opacity={0.9} />
    <ellipse cx="50" cy="62" rx="7" ry="10" opacity={0.9} />
    <ellipse cx="90" cy="62" rx="7" ry="10" opacity={0.9} />
  </>
);

// Lahad Datu — rainforest canopy
const TreeIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <rect x="64" y="78" width="12" height="36" opacity={0.95} />
    <circle cx="70" cy="52" r="30" opacity={0.95} />
    <circle cx="46" cy="66" r="16" opacity={0.75} />
    <circle cx="94" cy="66" r="16" opacity={0.75} />
  </>
);

// Putatan — riverside village house
const HouseIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <path d="M70 24 L112 60 L100 60 L100 108 L40 108 L40 60 L28 60 Z" opacity={0.95} />
    <rect x="62" y="82" width="16" height="26" fill="white" opacity={0.3} />
  </>
);

// Tuaran — palm tree
const PalmIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <path d="M67 60 Q60 92 66 116 L74 116 Q72 92 73 60 Z" opacity={0.95} />
    <path d="M70 60 Q38 48 26 58 Q46 62 70 66 Z" opacity={0.9} />
    <path d="M70 60 Q102 48 114 58 Q94 62 70 66 Z" opacity={0.9} />
    <path d="M70 60 Q56 30 40 30 Q52 52 70 66 Z" opacity={0.9} />
    <path d="M70 60 Q84 30 100 30 Q88 52 70 66 Z" opacity={0.9} />
    <path d="M70 60 Q70 22 70 26 Q70 44 70 66 Z" opacity={0.9} />
  </>
);

// Papar — paddy field / rice stalks
const PaddyIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <path d="M52 112 Q46 66 58 24 Q65 66 60 112 Z" opacity={0.95} />
    <path d="M70 112 Q69 62 70 18 Q76 62 76 112 Z" opacity={0.95} />
    <path d="M88 112 Q94 66 82 24 Q75 66 80 112 Z" opacity={0.95} />
  </>
);

// Semporna — fish / diving
const FishIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <path d="M28 70 Q58 40 92 70 Q58 100 28 70 Z" opacity={0.95} />
    <path d="M92 70 L114 54 L114 86 Z" opacity={0.9} />
    <circle cx="46" cy="64" r="3" fill="white" opacity={0.5} />
  </>
);

// Kudat — lighthouse (Tip of Borneo) with beam
const LighthouseIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <path d="M58 60 L56 108 L84 108 L82 60 Z" opacity={0.95} />
    <path d="M54 60 L70 30 L86 60 Z" opacity={0.95} />
    <rect x="44" y="106" width="52" height="8" opacity={0.95} />
    <path d="M70 44 L98 30 M70 44 L98 58" stroke="white" strokeWidth="2" opacity={0.3} />
    <rect x="62" y="72" width="16" height="8" fill="white" opacity={0.25} />
  </>
);

// Ranau — Mount Kinabalu twin peaks + clouds
const MountainIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <path d="M22 112 L54 46 L70 74 L86 36 L118 112 Z" opacity={0.95} />
    <path d="M78 44 L86 36 L94 44 L88 54 L82 54 Z" fill="white" opacity={0.4} />
    <ellipse cx="40" cy="34" rx="16" ry="6" opacity={0.3} />
    <ellipse cx="100" cy="26" rx="14" ry="5" opacity={0.3} />
  </>
);

// Beaufort — railway train
const TrainIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <rect x="30" y="58" width="80" height="38" rx="6" opacity={0.95} />
    <rect x="42" y="32" width="20" height="28" rx="3" opacity={0.95} />
    <circle cx="48" cy="102" r="8" opacity={0.9} />
    <circle cx="92" cy="102" r="8" opacity={0.9} />
    <rect x="96" y="68" width="16" height="18" rx="2" opacity={0.9} />
    <rect x="38" y="68" width="14" height="10" fill="white" opacity={0.3} />
    <rect x="58" y="68" width="14" height="10" fill="white" opacity={0.3} />
  </>
);

// Kota Belud — horse silhouette (Tamu Besar / cowboy town)
const HorseIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <path
      d="M84 116 L84 88 Q100 80 97 60 Q110 55 105 38 Q97 24 84 30 Q77 16 65 20 Q57 8 47 16 Q37 18 40 32 Q28 37 33 49 Q26 56 35 63 L47 70 L47 116 L58 116 L58 88 L70 88 L70 116 Z"
      opacity={0.95}
    />
    <path d="M84 30 Q94 18 104 22" stroke="white" strokeWidth="2" fill="none" opacity={0.3} />
  </>
);

// Fallback — simple map pin
const PinIcon: LocationSvgIcon = () => (
  <>
    <Blob />
    <path d="M70 26 Q100 26 100 56 Q100 80 70 108 Q40 80 40 56 Q40 26 70 26 Z" opacity={0.95} />
    <circle cx="70" cy="55" r="13" fill="white" opacity={0.35} />
  </>
);

const LOCATION_ICONS: Record<string, LocationSvgIcon> = {
  "Kota Kinabalu": CityIcon,
  Penampang: HatIcon,
  Sandakan: OrangutanIcon,
  Tawau: CocoaIcon,
  Keningau: CattleIcon,
  "Lahad Datu": TreeIcon,
  Putatan: HouseIcon,
  Tuaran: PalmIcon,
  Papar: PaddyIcon,
  Semporna: FishIcon,
  Kudat: LighthouseIcon,
  Ranau: MountainIcon,
  Beaufort: TrainIcon,
  "Kota Belud": HorseIcon,
};

function getLocationIcon(location: string): LocationSvgIcon {
  return LOCATION_ICONS[location] || PinIcon;
}

// Spreads float directions across cards so a grid of watermarks doesn't
// all bob in perfect unison — picked deterministically from the seller's
// location name so the same seller always animates the same way.
function floatSeed(location: string) {
  let hash = 0;
  for (let i = 0; i < location.length; i++) hash = (hash * 31 + location.charCodeAt(i)) % 1000;
  return hash / 1000;
}

interface LocationWatermarkProps {
  location: string;
  color: string;
  className?: string;
}

/** Animated, layered low-opacity background watermark for a seller's district. */
export function LocationWatermark({ location, color, className }: LocationWatermarkProps) {
  const Icon = getLocationIcon(location);
  const seed = floatSeed(location);
  const duration = 6 + seed * 4; // 6-10s, varies per location
  const rotateBase = -6 + seed * 12; // -6 to +6 deg base tilt

  return (
    <motion.div
      className={className}
      style={{ color }}
      initial={{ y: 0, rotate: rotateBase }}
      animate={{ y: [0, -8, 0], rotate: [rotateBase - 3, rotateBase + 3, rotateBase - 3] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg viewBox="0 0 140 140" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <Icon />
      </svg>
    </motion.div>
  );
}
