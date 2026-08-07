import React, { useState, useEffect } from "react";
import { Receipt as ReceiptIcon, Printer, AlertCircle, Building, Phone, MapPin, Home } from "lucide-react";
// @ts-ignore
import tamubahLogo from "../assets/images/traditional_bag_logo_1784122537315.jpg";

interface ReceiptViewProps {
  receiptId: string;
}

export default function ReceiptView({ receiptId }: ReceiptViewProps) {
  const [receipt, setReceipt] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/receipts/${receiptId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Receipt not found.");
        return res.json();
      })
      .then((data) => setReceipt(data))
      .catch((err) => setError(err.message || "Failed to load receipt."))
      .finally(() => setLoading(false));
  }, [receiptId]);

  const getWhatsAppLink = () => {
    if (!receipt?.sellerPhoneNumber) return "#";
    let cleanPhone = String(receipt.sellerPhoneNumber).replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "6" + cleanPhone;
    else if (cleanPhone.startsWith("1")) cleanPhone = "60" + cleanPhone;
    else if (cleanPhone.length > 0 && !cleanPhone.startsWith("60")) cleanPhone = "60" + cleanPhone;
    const message = `Hi ${receipt.sellerName || receipt.businessName}, I'm following up on my receipt ${receipt.id} (Total RM ${Number(receipt.total).toFixed(2)}).`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-10 print:bg-white print:py-0">
      {/* Brand header (hidden when printing) */}
      <div className="mb-6 print:hidden flex items-center gap-3 select-none cursor-pointer" onClick={() => { window.location.href = "/"; }}>
        <div className="h-12 overflow-hidden rounded-xl bg-white px-2 flex items-center justify-center shadow-sm">
          <img src={tamubahLogo} alt="TamuBah" className="h-24 object-contain -my-6" referrerPolicy="no-referrer" />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <svg className="animate-spin h-8 w-8 text-emerald-600 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-semibold">Loading receipt...</span>
        </div>
      ) : error || !receipt ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center max-w-md w-full shadow-sm">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-400 mx-auto mb-4 border border-rose-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Receipt Not Found</h3>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">
            {error || "This receipt link may be invalid or the receipt has been removed."}
          </p>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="mt-5 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" /> Back to Market
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-md max-w-lg w-full overflow-hidden print:shadow-none print:border-0 print:rounded-none">
          {/* Header */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 text-white print:bg-white print:text-slate-900 print:border-b print:border-slate-300">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-emerald-500 bg-white/10 shrink-0 flex items-center justify-center print:border-slate-300">
                  {receipt.sellerLogoUrl ? (
                    <img src={receipt.sellerLogoUrl} alt={receipt.businessName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <Building className="w-6 h-6 text-emerald-400 print:text-slate-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="font-extrabold text-base leading-tight truncate">{receipt.businessName}</h1>
                  {receipt.sellerAddress && (
                    <p className="text-[10px] text-slate-300 print:text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 shrink-0" /> {receipt.sellerAddress}
                    </p>
                  )}
                </div>
              </div>
              <div className="p-2 bg-white/10 rounded-xl text-emerald-300 shrink-0 print:hidden">
                <ReceiptIcon className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Receipt meta */}
          <div className="px-6 pt-5 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Receipt No.</span>
              <span className="font-mono font-extrabold text-slate-800">{receipt.id}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Date</span>
              <span className="font-semibold text-slate-700">
                {new Date(receipt.createdAt).toLocaleString("en-MY", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>

          {(receipt.customerName || receipt.customerPhone) && (
            <div className="mx-6 mt-4 bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs">
              <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider mb-0.5">Billed To</span>
              {receipt.customerName && <span className="font-semibold text-slate-800 block">{receipt.customerName}</span>}
              {receipt.customerPhone && <span className="text-slate-500">{receipt.customerPhone}</span>}
            </div>
          )}

          {/* Items table */}
          <div className="px-6 mt-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 text-[9px] uppercase tracking-wider border-b border-slate-100">
                  <th className="text-left font-bold pb-2">Item</th>
                  <th className="text-center font-bold pb-2">Qty</th>
                  <th className="text-right font-bold pb-2">Price</th>
                  <th className="text-right font-bold pb-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(receipt.items || []).map((it: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-2.5 font-semibold text-slate-800">{it.title}</td>
                    <td className="py-2.5 text-center text-slate-500">{it.quantity}</td>
                    <td className="py-2.5 text-right text-slate-500">RM {Number(it.unitPrice).toFixed(2)}</td>
                    <td className="py-2.5 text-right font-bold text-slate-800">RM {Number(it.lineTotal ?? it.unitPrice * it.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-6 mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-700">RM {Number(receipt.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Delivery</span>
              <span className="font-semibold text-slate-700">RM {Number(receipt.deliveryFee).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base border-t border-slate-200 pt-2 mt-2">
              <span className="font-extrabold text-slate-900">Total</span>
              <span className="font-extrabold text-emerald-700">RM {Number(receipt.total).toFixed(2)}</span>
            </div>
          </div>

          {receipt.notes && (
            <div className="mx-6 mt-4 bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
              <span className="font-bold block text-[9px] uppercase tracking-wider text-amber-600 mb-0.5">Notes</span>
              {receipt.notes}
            </div>
          )}

          {/* Actions */}
          <div className="p-6 pt-5 flex gap-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex-1 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
            {receipt.sellerPhoneNumber && (
              <a
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" /> Contact Seller
              </a>
            )}
          </div>

          <div className="px-6 pb-6 text-center print:pb-2">
            <span className="text-[10px] text-slate-300">Generated on TamuBah — Sabah Entrepreneur Marketplace</span>
          </div>
        </div>
      )}
    </div>
  );
}
