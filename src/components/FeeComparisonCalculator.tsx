import React, { useState, useMemo } from "react";
import tamubahLogo from "../assets/images/traditional_bag_logo_1784122537315.jpg";

interface FeeComparisonCalculatorProps {
  isEN: boolean;
}

// Replaces the old static "commission comparison poster" image with a live,
// interactive calculator — sellers can drag their own monthly sales figure
// and immediately see what they'd keep here versus a 15%/30% commission
// platform, instead of reading one fixed illustrative example.
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
    <div className="rounded-3xl overflow-hidden shadow-xl border border-slate-100 bg-white">
      {/* Branded header */}
      <div className="flex items-center gap-3 px-6 py-5 bg-slate-900">
        <img src={tamubahLogo} alt="TamuBah" className="w-9 h-9 rounded-full object-cover shrink-0" />
        <div>
          <p className="text-white font-bold text-sm leading-tight">TamuBah</p>
          <p className="text-emerald-400 text-[11px] font-semibold uppercase tracking-wide">
            {isEN ? "Fee comparison calculator" : "Kalkulator perbandingan yuran"}
          </p>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {/* Sales slider */}
        <div className="flex items-center gap-3 mb-5">
          <label htmlFor="fee-calc-sales" className="text-sm text-slate-500 shrink-0">
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
            className="flex-1 accent-emerald-600"
          />
          <span className="text-sm font-bold text-slate-900 min-w-[90px] text-right">{fmt(sales)}</span>
        </div>

        {/* Commission rate toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setRate(0.15)}
            className={`flex-1 text-xs font-bold py-2.5 rounded-xl border transition-colors ${
              rate === 0.15 ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {isEN ? "15% commission" : "Komisen 15%"}
          </button>
          <button
            type="button"
            onClick={() => setRate(0.30)}
            className={`flex-1 text-xs font-bold py-2.5 rounded-xl border transition-colors ${
              rate === 0.30 ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {isEN ? "30% commission" : "Komisen 30%"}
          </button>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-red-50 rounded-2xl p-4">
            <p className="text-[11px] font-bold text-red-700 uppercase tracking-wide mb-1">
              {isEN ? "Commission platform" : "Platform komisen"}
            </p>
            <p className="text-2xl font-extrabold text-red-700">{fmt(commissionEarn)}</p>
            <p className="text-[11px] text-red-600 mt-1">
              {fmt(feeAmount)} {isEN ? "taken in fees" : "diambil sebagai yuran"}
            </p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4">
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide mb-1">TamuBah</p>
            <p className="text-2xl font-extrabold text-emerald-700">{fmt(tamubahEarn)}</p>
            <p className="text-[11px] text-emerald-600 mt-1">
              {isEN ? "Only RM 20 flat fee" : "Cuma RM 20 yuran rata"}
            </p>
          </div>
        </div>

        {/* Bars */}
        <div className="mb-1.5">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{isEN ? "Commission platform" : "Platform komisen"}</span>
            <span>{fmt(commissionEarn)}</span>
          </div>
          <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div className="bg-red-400 h-full rounded-full transition-all duration-500" style={{ width: `${commissionPct}%` }} />
          </div>
        </div>
        <div className="mb-6">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>TamuBah</span>
            <span>{fmt(tamubahEarn)}</span>
          </div>
          <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${tamubahPct}%` }} />
          </div>
        </div>

        {/* Difference callout */}
        <div className="flex items-baseline gap-1.5 flex-wrap text-sm text-slate-500 mb-6 pb-6 border-b border-slate-100">
          <span>{isEN ? "You keep an extra" : "Anda simpan lebih"}</span>
          <span className="text-xl font-extrabold text-emerald-700">{fmt(diff)}</span>
          <span>{isEN ? "a month with TamuBah" : "sebulan bersama TamuBah"}</span>
        </div>

        {/* RM20 breakdown */}
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
          {isEN ? "Where your RM20 membership goes" : "Ke mana yuran RM20 anda pergi"}
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            {isEN ? "Infrastructure & hosting" : "Infrastruktur & hosting"} <span className="ml-auto font-semibold">RM 5</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            {isEN ? "Your digital storefront" : "Kedai digital anda"} <span className="ml-auto font-semibold">RM 5</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            {isEN ? "Verification & security" : "Pengesahan & keselamatan"} <span className="ml-auto font-semibold">RM 5</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            {isEN ? "Seller support team" : "Pasukan sokongan penjual"} <span className="ml-auto font-semibold">RM 5</span>
          </div>
        </div>
      </div>
    </div>
  );
}
