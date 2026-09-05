import React, { useState, useMemo } from "react";
import tamubahIcon from "../assets/images/tamubah_icon_cyan.png";

interface FeeComparisonCalculatorProps {
  isEN: boolean;
}

// Holographic HUD-style calculator — sellers drag their own monthly sales
// figure and immediately see what they'd keep here versus a 15%/30%
// commission platform, presented as a sci-fi projected interface.
export default function FeeComparisonCalculator({ isEN }: FeeComparisonCalculatorProps) {
  const [sales, setSales] = useState(1000);
  const [rate, setRate] = useState(0.30);

  const { commissionEarn, tamubahEarn, feeAmount, diff, commissionPct, tamubahPct } = useMemo(() => {
    const fee = sales * rate;
    const cEarn = sales - fee;
    const tEarn = Math.max(sales - 20, 0);
    const max = Math.max(cEarn, tEarn, 1);
    return {
      commissionEarn: cEarn,
      tamubahEarn: tEarn,
      feeAmount: fee,
      diff: tEarn - cEarn,
      commissionPct: Math.round((cEarn / max) * 100),
      tamubahPct: Math.round((tEarn / max) * 100),
    };
  }, [sales, rate]);

  const fmt = (n: number) => `RM ${Math.round(n).toLocaleString()}`;

  return (
    <div
      className="relative rounded-3xl overflow-hidden border border-cyan-400/30"
      style={{
        background: "radial-gradient(circle at 50% 0%, #0a1a2b 0%, #050c16 55%, #020609 100%)",
        boxShadow: "0 0 40px rgba(34,211,238,0.15), inset 0 0 60px rgba(34,211,238,0.05)",
      }}
    >
      {/* Scanline / grid texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.6) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Corner tech brackets */}
      <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-cyan-400/60 pointer-events-none" />
      <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-cyan-400/60 pointer-events-none" />
      <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-cyan-400/60 pointer-events-none" />
      <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-cyan-400/60 pointer-events-none" />

      {/* Branded header */}
      <div className="relative flex items-center gap-3 px-6 py-5 border-b border-cyan-400/20">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 border border-cyan-400/50"
          style={{ boxShadow: "0 0 18px rgba(34,211,238,0.55)" }}
        >
          <img
            src={tamubahIcon}
            alt="TamuBah"
            className="w-7 h-7 object-contain"
            style={{ filter: "drop-shadow(0 0 6px rgba(34,211,238,0.9))" }}
          />
        </div>
        <div>
          <p className="text-cyan-50 font-bold text-sm leading-tight tracking-wide">TAMUBAH</p>
          <p className="text-cyan-400 text-[11px] font-semibold uppercase tracking-[0.15em]">
            {isEN ? "Fee comparison calculator" : "Kalkulator perbandingan yuran"}
          </p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-cyan-400/70 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          {isEN ? "Live" : "Langsung"}
        </span>
      </div>

      <div className="relative p-6 md:p-8">
        {/* Sales slider */}
        <div className="flex items-center gap-3 mb-5">
          <label htmlFor="fee-calc-sales" className="text-xs text-cyan-400/80 uppercase tracking-wider shrink-0">
            {isEN ? "Monthly sales" : "Jualan bulanan"}
          </label>
          <input
            id="fee-calc-sales"
            type="range"
            min={200}
            max={5000}
            step={100}
            value={sales}
            onChange={(e) => setSales(parseInt(e.target.value, 10))}
            className="flex-1 accent-cyan-400"
          />
          <span className="text-sm font-bold text-cyan-50 min-w-[90px] text-right">{fmt(sales)}</span>
        </div>

        {/* Commission rate toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setRate(0.15)}
            className={`flex-1 text-xs font-bold py-2.5 rounded-xl border transition-colors ${
              rate === 0.15
                ? "bg-cyan-400/20 border-cyan-400 text-cyan-50"
                : "border-cyan-400/20 text-cyan-400/60 hover:border-cyan-400/40"
            }`}
          >
            {isEN ? "15% commission" : "Komisen 15%"}
          </button>
          <button
            type="button"
            onClick={() => setRate(0.30)}
            className={`flex-1 text-xs font-bold py-2.5 rounded-xl border transition-colors ${
              rate === 0.30
                ? "bg-cyan-400/20 border-cyan-400 text-cyan-50"
                : "border-cyan-400/20 text-cyan-400/60 hover:border-cyan-400/40"
            }`}
          >
            {isEN ? "30% commission" : "Komisen 30%"}
          </button>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-2xl p-4 border border-rose-400/30 bg-rose-400/5">
            <p className="text-[11px] font-bold text-rose-300 uppercase tracking-wide mb-1">
              {isEN ? "Commission platform" : "Platform komisen"}
            </p>
            <p className="text-2xl font-extrabold text-rose-300">{fmt(commissionEarn)}</p>
            <p className="text-[11px] text-rose-300/70 mt-1">
              {fmt(feeAmount)} {isEN ? "taken in fees" : "diambil sebagai yuran"}
            </p>
          </div>
          <div className="rounded-2xl p-4 border border-cyan-400/40 bg-cyan-400/5">
            <p className="text-[11px] font-bold text-cyan-300 uppercase tracking-wide mb-1">TamuBah</p>
            <p className="text-2xl font-extrabold text-cyan-300">{fmt(tamubahEarn)}</p>
            <p className="text-[11px] text-cyan-300/70 mt-1">
              {isEN ? "Only RM 20 flat fee" : "Cuma RM 20 yuran rata"}
            </p>
          </div>
        </div>

        {/* Bars */}
        <div className="mb-1.5">
          <div className="flex justify-between text-xs text-cyan-100/50 mb-1">
            <span>{isEN ? "Commission platform" : "Platform komisen"}</span>
            <span>{fmt(commissionEarn)}</span>
          </div>
          <div className="bg-cyan-400/10 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-rose-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${commissionPct}%`, boxShadow: "0 0 10px rgba(251,113,133,0.7)" }}
            />
          </div>
        </div>
        <div className="mb-6">
          <div className="flex justify-between text-xs text-cyan-100/50 mb-1">
            <span>TamuBah</span>
            <span>{fmt(tamubahEarn)}</span>
          </div>
          <div className="bg-cyan-400/10 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${tamubahPct}%`, boxShadow: "0 0 10px rgba(34,211,238,0.8)" }}
            />
          </div>
        </div>

        {/* Difference callout */}
        <div className="flex items-baseline gap-1.5 flex-wrap text-sm text-cyan-100/60 mb-6 pb-6 border-b border-cyan-400/20">
          <span>{isEN ? "You keep an extra" : "Anda simpan lebih"}</span>
          <span className="text-xl font-extrabold text-cyan-300">{fmt(diff)}</span>
          <span>{isEN ? "a month with TamuBah" : "sebulan bersama TamuBah"}</span>
        </div>

        {/* RM20 breakdown */}
        <p className="text-xs font-bold text-cyan-400/80 uppercase tracking-wider mb-3">
          {isEN ? "Where your RM20 membership goes" : "Ke mana yuran RM20 anda pergi"}
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs text-cyan-100/70">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" style={{ boxShadow: "0 0 6px rgba(34,211,238,0.9)" }} />
            {isEN ? "Infrastructure & hosting" : "Infrastruktur & hosting"} <span className="ml-auto font-semibold text-cyan-50">RM 5</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" style={{ boxShadow: "0 0 6px rgba(34,211,238,0.9)" }} />
            {isEN ? "Your digital storefront" : "Kedai digital anda"} <span className="ml-auto font-semibold text-cyan-50">RM 5</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" style={{ boxShadow: "0 0 6px rgba(34,211,238,0.9)" }} />
            {isEN ? "Verification & security" : "Pengesahan & keselamatan"} <span className="ml-auto font-semibold text-cyan-50">RM 5</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" style={{ boxShadow: "0 0 6px rgba(34,211,238,0.9)" }} />
            {isEN ? "Seller support team" : "Pasukan sokongan penjual"} <span className="ml-auto font-semibold text-cyan-50">RM 5</span>
          </div>
        </div>
      </div>
    </div>
  );
}
