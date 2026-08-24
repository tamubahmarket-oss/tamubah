import React, { useState, useEffect, useCallback } from "react";
import {
  Truck, MapPin, Phone, Package, Clock, CheckCircle2, XCircle,
  ArrowRight, RefreshCw, Wallet, User, FileText, AlertCircle,
  ChevronRight, Loader2, Ban, PackageCheck, Navigation
} from "lucide-react";
import { Seller, DeliveryRequest, DeliveryStatus, SABAH_LOCATIONS } from "../types";

interface RunnerDeliveryPanelProps {
  seller: Seller;
  language: "EN" | "BM";
}

const POLL_INTERVAL_MS = 20000;

function getWhatsAppLink(phoneNumber: string, name: string, message: string): string {
  let cleanPhone = (phoneNumber || "").replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) cleanPhone = "6" + cleanPhone;
  else if (cleanPhone.startsWith("1")) cleanPhone = "60" + cleanPhone;
  else if (cleanPhone.length > 0 && !cleanPhone.startsWith("60")) cleanPhone = "60" + cleanPhone;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

function timeAgo(dateString: string, language: "EN" | "BM"): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return language === "EN" ? "just now" : "sebentar tadi";
  if (mins < 60) return `${mins}m ${language === "EN" ? "ago" : "lalu"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${language === "EN" ? "ago" : "lalu"}`;
  const days = Math.floor(hours / 24);
  return `${days}d ${language === "EN" ? "ago" : "lalu"}`;
}

const STATUS_STEPS: DeliveryStatus[] = ["accepted", "picked_up", "in_transit", "delivered"];
const STATUS_LABEL: Record<DeliveryStatus, { en: string; bm: string }> = {
  open: { en: "Open", bm: "Terbuka" },
  accepted: { en: "Accepted", bm: "Diterima" },
  picked_up: { en: "Picked Up", bm: "Diambil" },
  in_transit: { en: "On The Way", bm: "Dalam Perjalanan" },
  delivered: { en: "Delivered", bm: "Selesai" },
  cancelled: { en: "Cancelled", bm: "Dibatalkan" },
};

function StatusBadge({ status, language }: { status: DeliveryStatus; language: "EN" | "BM" }) {
  const label = language === "EN" ? STATUS_LABEL[status].en : STATUS_LABEL[status].bm;
  const styles: Record<DeliveryStatus, string> = {
    open: "bg-sky-50 text-sky-700 border-sky-200",
    accepted: "bg-amber-50 text-amber-700 border-amber-200",
    picked_up: "bg-indigo-50 text-indigo-700 border-indigo-200",
    in_transit: "bg-violet-50 text-violet-700 border-violet-200",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {label}
    </span>
  );
}

function StatusStepper({ status, language }: { status: DeliveryStatus; language: "EN" | "BM" }) {
  if (status === "cancelled") return null;
  const currentIdx = STATUS_STEPS.indexOf(status === "open" ? "accepted" : status);
  return (
    <div className="flex items-center gap-1 mt-2">
      {STATUS_STEPS.map((step, idx) => {
        const done = status !== "open" && idx <= currentIdx;
        return (
          <React.Fragment key={step}>
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-emerald-500" : "bg-slate-200"}`}
              title={language === "EN" ? STATUS_LABEL[step].en : STATUS_LABEL[step].bm}
            />
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 ${done && idx < currentIdx ? "bg-emerald-500" : "bg-slate-200"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function RunnerDeliveryPanel({ seller, language }: RunnerDeliveryPanelProps) {
  const isRunner = seller.category === "Transport & Runners";

  const [subView, setSubView] = useState<"open" | "active" | "history">(isRunner ? "open" : "active");
  const [openJobs, setOpenJobs] = useState<DeliveryRequest[]>([]);
  const [myJobs, setMyJobs] = useState<DeliveryRequest[]>([]); // runner: accepted by me | seller: requests I posted
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState<string>(isRunner ? seller.location : "");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // New request form state (sellers)
  const [form, setForm] = useState({
    productTitle: "",
    pickupLocation: seller.location || "",
    pickupAddress: seller.address || "",
    dropoffLocation: "",
    dropoffAddress: "",
    customerName: "",
    customerPhone: "",
    deliveryFee: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchOpenJobs = useCallback(async () => {
    try {
      const url = locationFilter
        ? `/api/deliveries/open?location=${encodeURIComponent(locationFilter)}`
        : "/api/deliveries/open";
      const res = await fetch(url);
      if (res.ok) setOpenJobs(await res.json());
    } catch {
      /* silent — polling retries anyway */
    }
  }, [locationFilter]);

  const fetchMyJobs = useCallback(async () => {
    try {
      const url = isRunner ? `/api/deliveries/runner/${seller.id}` : `/api/deliveries/seller/${seller.id}`;
      const res = await fetch(url);
      if (res.ok) setMyJobs(await res.json());
    } catch {
      /* silent */
    }
  }, [isRunner, seller.id]);

  const refreshAll = useCallback(async () => {
    await Promise.all([isRunner ? fetchOpenJobs() : Promise.resolve(), fetchMyJobs()]);
    setLoading(false);
  }, [isRunner, fetchOpenJobs, fetchMyJobs]);

  useEffect(() => {
    setLoading(true);
    refreshAll();
    const interval = setInterval(refreshAll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationFilter]);

  useEffect(() => {
    if (!success && !error) return;
    const t = setTimeout(() => {
      setSuccess(null);
      setError(null);
    }, 3500);
    return () => clearTimeout(t);
  }, [success, error]);

  const handleAccept = async (jobId: string) => {
    setActionLoading(jobId);
    setError(null);
    try {
      const res = await fetch(`/api/deliveries/${jobId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runnerId: seller.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (language === "EN" ? "Failed to accept job." : "Gagal terima tugasan."));
      } else {
        setSuccess(language === "EN" ? "Job accepted! Check 'My Deliveries'." : "Tugasan diterima! Semak 'Tugasan Saya'.");
        await refreshAll();
        setSubView("active");
      }
    } catch {
      setError(language === "EN" ? "Network error. Try again." : "Ralat rangkaian. Cuba lagi.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdvanceStatus = async (jobId: string, nextStatus: DeliveryStatus) => {
    setActionLoading(jobId);
    setError(null);
    try {
      const res = await fetch(`/api/deliveries/${jobId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, actorId: seller.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (language === "EN" ? "Failed to update status." : "Gagal kemas kini status."));
      } else {
        setSuccess(language === "EN" ? "Status updated." : "Status dikemas kini.");
        await refreshAll();
      }
    } catch {
      setError(language === "EN" ? "Network error. Try again." : "Ralat rangkaian. Cuba lagi.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId: seller.id,
          productTitle: form.productTitle,
          pickupLocation: form.pickupLocation,
          pickupAddress: form.pickupAddress,
          dropoffLocation: form.dropoffLocation,
          dropoffAddress: form.dropoffAddress,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          deliveryFee: parseFloat(form.deliveryFee) || 0,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (language === "EN" ? "Failed to post request." : "Gagal hantar permintaan."));
      } else {
        setSuccess(language === "EN" ? "Delivery request posted to runners!" : "Permintaan penghantaran dihantar kepada runner!");
        setForm({
          productTitle: "",
          pickupLocation: seller.location || "",
          pickupAddress: seller.address || "",
          dropoffLocation: "",
          dropoffAddress: "",
          customerName: "",
          customerPhone: "",
          deliveryFee: "",
          notes: "",
        });
        setShowForm(false);
        await fetchMyJobs();
      }
    } catch {
      setError(language === "EN" ? "Network error. Try again." : "Ralat rangkaian. Cuba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  // Runner earnings summary (delivered jobs only)
  const deliveredJobs = myJobs.filter((j) => j.status === "delivered");
  const todayEarnings = deliveredJobs
    .filter((j) => j.deliveredAt && new Date(j.deliveredAt).toDateString() === new Date().toDateString())
    .reduce((sum, j) => sum + j.deliveryFee, 0);
  const totalEarnings = deliveredJobs.reduce((sum, j) => sum + j.deliveryFee, 0);
  const activeJobsList = myJobs.filter((j) => ["accepted", "picked_up", "in_transit"].includes(j.status));
  const historyJobsList = myJobs.filter((j) => ["delivered", "cancelled"].includes(j.status));

  const nextStatusFor = (status: DeliveryStatus): DeliveryStatus | null => {
    if (status === "accepted") return "picked_up";
    if (status === "picked_up") return "in_transit";
    if (status === "in_transit") return "delivered";
    return null;
  };

  return (
    <div id="delivery-panel" className="space-y-5">
      {/* Toasts */}
      {(error || success) && (
        <div
          className={`rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2 border ${
            error ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}
        >
          {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {error || success}
        </div>
      )}

      {isRunner ? (
        <>
          {/* Runner earnings summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-sm">
              <Wallet className="w-4 h-4 text-emerald-200 mb-1.5" />
              <div className="text-xl font-black font-mono">RM {todayEarnings.toFixed(2)}</div>
              <div className="text-[10px] text-emerald-100 mt-0.5">
                {language === "EN" ? "Earned Today" : "Pendapatan Hari Ini"}
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <PackageCheck className="w-4 h-4 text-emerald-600 mb-1.5" />
              <div className="text-xl font-black font-mono text-slate-800">{deliveredJobs.length}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {language === "EN" ? "Total Delivered" : "Jumlah Dihantar"}
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <Wallet className="w-4 h-4 text-amber-600 mb-1.5" />
              <div className="text-xl font-black font-mono text-slate-800">RM {totalEarnings.toFixed(2)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {language === "EN" ? "All-Time Earnings" : "Pendapatan Keseluruhan"}
              </div>
            </div>
          </div>

          {/* Sub-nav */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-px overflow-x-auto">
            {(["open", "active", "history"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSubView(v)}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  subView === v ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {v === "open" && <Package className="w-3.5 h-3.5" />}
                {v === "active" && <Navigation className="w-3.5 h-3.5" />}
                {v === "history" && <Clock className="w-3.5 h-3.5" />}
                {v === "open" && (language === "EN" ? `Available (${openJobs.length})` : `Tersedia (${openJobs.length})`)}
                {v === "active" && (language === "EN" ? `Active (${activeJobsList.length})` : `Aktif (${activeJobsList.length})`)}
                {v === "history" && (language === "EN" ? "History" : "Sejarah")}
              </button>
            ))}
            <button
              onClick={refreshAll}
              className="ml-auto p-2 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
              title={language === "EN" ? "Refresh" : "Muat Semula"}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* OPEN JOBS */}
          {subView === "open" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">{language === "EN" ? "All Districts" : "Semua Daerah"}</option>
                  {SABAH_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  {language === "EN" ? "Loading jobs..." : "Memuatkan tugasan..."}
                </div>
              ) : openJobs.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">
                    {language === "EN" ? "No open delivery jobs right now. Check back soon!" : "Tiada tugasan penghantaran buat masa ini. Semak semula nanti!"}
                  </p>
                </div>
              ) : (
                openJobs.map((job) => (
                  <div key={job.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-800 truncate">{job.productTitle}</h4>
                        <p className="text-[11px] text-slate-500">
                          {job.sellerBusinessName} · {timeAgo(job.createdAt, language)}
                        </p>
                      </div>
                      <span className="shrink-0 bg-emerald-50 text-emerald-700 font-black text-sm px-2.5 py-1 rounded-lg font-mono">
                        RM {job.deliveryFee.toFixed(2)}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">P</span>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-700">{job.pickupLocation}</span>
                          <span className="text-slate-500"> — {job.pickupAddress}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">D</span>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-700">{job.dropoffLocation}</span>
                          <span className="text-slate-500"> — {job.dropoffAddress}</span>
                        </div>
                      </div>
                    </div>

                    {job.notes && (
                      <p className="text-[11px] text-slate-500 italic flex items-start gap-1.5">
                        <FileText className="w-3 h-3 shrink-0 mt-0.5" />
                        {job.notes}
                      </p>
                    )}

                    <button
                      onClick={() => handleAccept(job.id)}
                      disabled={actionLoading === job.id}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {actionLoading === job.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Truck className="w-3.5 h-3.5" />
                          {language === "EN" ? "Accept This Job" : "Terima Tugasan Ini"}
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ACTIVE + HISTORY share the same card renderer */}
          {(subView === "active" || subView === "history") && (
            <div className="space-y-3">
              {(subView === "active" ? activeJobsList : historyJobsList).length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">
                    {subView === "active"
                      ? (language === "EN" ? "No active deliveries. Accept a job to get started." : "Tiada penghantaran aktif. Terima tugasan untuk mula.")
                      : (language === "EN" ? "No completed deliveries yet." : "Belum ada penghantaran selesai.")}
                  </p>
                </div>
              ) : (
                (subView === "active" ? activeJobsList : historyJobsList).map((job) => {
                  const next = nextStatusFor(job.status);
                  return (
                    <div key={job.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-800 truncate">{job.productTitle}</h4>
                          <p className="text-[11px] text-slate-500">{job.sellerBusinessName}</p>
                        </div>
                        <StatusBadge status={job.status} language={language} />
                      </div>

                      <StatusStepper status={job.status} language={language} />

                      <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">P</span>
                          <span className="text-slate-600">{job.pickupLocation} — {job.pickupAddress}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">D</span>
                          <span className="text-slate-600">{job.dropoffLocation} — {job.dropoffAddress}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-black text-emerald-700">RM {job.deliveryFee.toFixed(2)}</span>
                        {job.sellerPhoneNumber && (
                          <a
                            href={getWhatsAppLink(job.sellerPhoneNumber, job.sellerBusinessName || "", `Hi, regarding delivery job "${job.productTitle}"...`)}
                            target="_blank" rel="noopener noreferrer"
                            className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {language === "EN" ? "Contact Seller" : "Hubungi Penjual"}
                          </a>
                        )}
                        {job.customerPhone && (
                          <a
                            href={getWhatsAppLink(job.customerPhone, job.customerName || "customer", `Hi, I'm your TamuBah runner for "${job.productTitle}".`)}
                            target="_blank" rel="noopener noreferrer"
                            className="text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-1"
                          >
                            <User className="w-3 h-3" />
                            {language === "EN" ? "Contact Customer" : "Hubungi Pelanggan"}
                          </a>
                        )}
                      </div>

                      {subView === "active" && next && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAdvanceStatus(job.id, next)}
                            disabled={actionLoading === job.id}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {actionLoading === job.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                {language === "EN" ? `Mark as ${STATUS_LABEL[next].en}` : `Tanda ${STATUS_LABEL[next].bm}`}
                                <ArrowRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleAdvanceStatus(job.id, "cancelled")}
                            disabled={actionLoading === job.id}
                            className="p-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title={language === "EN" ? "Cancel" : "Batal"}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* SELLER VIEW — request a delivery + track own requests */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 max-w-md">
              {language === "EN"
                ? "Post a delivery job and any approved TamuBah runner nearby can pick it up and deliver it for you."
                : "Hantar tugasan penghantaran dan mana-mana runner TamuBah yang diluluskan berdekatan boleh ambil dan hantar untuk anda."}
            </p>
            <button
              onClick={() => setShowForm(!showForm)}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              {showForm ? (language === "EN" ? "Cancel" : "Batal") : (language === "EN" ? "New Request" : "Permintaan Baru")}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmitRequest} className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {language === "EN" ? "What's being delivered?" : "Apa yang dihantar?"}
                </label>
                <input
                  required value={form.productTitle}
                  onChange={(e) => setForm({ ...form, productTitle: e.target.value })}
                  placeholder={language === "EN" ? "e.g. 2x Kek Lapis + 1x Bundle" : "cth: 2x Kek Lapis + 1x Bundle"}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {language === "EN" ? "Pickup District" : "Daerah Ambil"}
                  </label>
                  <select
                    required value={form.pickupLocation}
                    onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">—</option>
                    {SABAH_LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {language === "EN" ? "Dropoff District" : "Daerah Hantar"}
                  </label>
                  <select
                    required value={form.dropoffLocation}
                    onChange={(e) => setForm({ ...form, dropoffLocation: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">—</option>
                    {SABAH_LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {language === "EN" ? "Pickup Address" : "Alamat Ambil"}
                </label>
                <input
                  required value={form.pickupAddress}
                  onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {language === "EN" ? "Dropoff Address" : "Alamat Hantar"}
                </label>
                <input
                  required value={form.dropoffAddress}
                  onChange={(e) => setForm({ ...form, dropoffAddress: e.target.value })}
                  placeholder={language === "EN" ? "Customer's delivery address" : "Alamat penghantaran pelanggan"}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {language === "EN" ? "Customer Name" : "Nama Pelanggan"}
                  </label>
                  <input
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {language === "EN" ? "Customer Phone" : "Telefon Pelanggan"}
                  </label>
                  <input
                    required value={form.customerPhone}
                    onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    placeholder="601XXXXXXXX"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {language === "EN" ? "Delivery Fee You're Offering (RM)" : "Bayaran Penghantaran Ditawarkan (RM)"}
                </label>
                <input
                  required type="number" step="0.01" min="0" value={form.deliveryFee}
                  onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })}
                  placeholder="10.00"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {language === "EN" ? "Notes for Runner (optional)" : "Nota untuk Runner (pilihan)"}
                </label>
                <textarea
                  rows={2} value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder={language === "EN" ? "e.g. Fragile, keep upright. Call before arriving." : "cth: Mudah pecah, jangan terbalik. Call sebelum sampai."}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                />
              </div>

              <button
                type="submit" disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (language === "EN" ? "Post Delivery Request" : "Hantar Permintaan")}
              </button>
            </form>
          )}

          {/* Seller's own requests, all statuses */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {language === "EN" ? "Your Delivery Requests" : "Permintaan Penghantaran Anda"}
            </h4>

            {loading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                {language === "EN" ? "Loading..." : "Memuatkan..."}
              </div>
            ) : myJobs.length === 0 ? (
              <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">
                  {language === "EN" ? "No delivery requests yet." : "Belum ada permintaan penghantaran."}
                </p>
              </div>
            ) : (
              myJobs.map((job) => (
                <div key={job.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h5 className="font-bold text-sm text-slate-800 truncate">{job.productTitle}</h5>
                      <p className="text-[11px] text-slate-500">
                        {job.pickupLocation} <ChevronRight className="w-3 h-3 inline" /> {job.dropoffLocation}
                      </p>
                    </div>
                    <StatusBadge status={job.status} language={language} />
                  </div>
                  <StatusStepper status={job.status} language={language} />
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-black text-emerald-700">RM {job.deliveryFee.toFixed(2)}</span>
                    {job.runnerBusinessName ? (
                      <span className="text-slate-500">
                        {language === "EN" ? "Runner: " : "Runner: "}
                        <span className="font-semibold text-slate-700">{job.runnerBusinessName}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">
                        {language === "EN" ? "Waiting for a runner..." : "Menunggu runner..."}
                      </span>
                    )}
                    {job.runnerPhoneNumber && (
                      <a
                        href={getWhatsAppLink(job.runnerPhoneNumber, job.runnerBusinessName || "", `Hi, regarding delivery "${job.productTitle}"...`)}
                        target="_blank" rel="noopener noreferrer"
                        className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        {language === "EN" ? "Contact" : "Hubungi"}
                      </a>
                    )}
                  </div>
                  {job.status === "open" && (
                    <button
                      onClick={() => handleAdvanceStatus(job.id, "cancelled")}
                      disabled={actionLoading === job.id}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                    >
                      <XCircle className="w-3 h-3" />
                      {language === "EN" ? "Cancel Request" : "Batal Permintaan"}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
