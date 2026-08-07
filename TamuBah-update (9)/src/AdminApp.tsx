import React, { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import AdminPanel from "./components/AdminPanel";

export default function AdminApp() {
  // null = still checking with server, true/false = known state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // On load, ask the server whether we already have a valid admin session cookie.
  useEffect(() => {
    fetch("/api/admin/check")
      .then((res) => setIsLoggedIn(res.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsLoggedIn(true);
        setPasscode("");
      } else {
        setError(data.error || "Incorrect admin passcode. Access denied.");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // ignore network errors on logout
    }
    setIsLoggedIn(false);
  };

  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        Checking admin session...
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-800 to-slate-900 p-6 text-white relative">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-indigo-300" />
              <h3 className="font-extrabold text-base tracking-tight">System Operator Login</h3>
            </div>
            <p className="text-indigo-200 text-xs leading-relaxed">
              Enter the passcode to access backend administrative tools & analytics.
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Administrative Passcode
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                autoFocus
                required
              />
              {error && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1.5 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-rose-600"></span>
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
            >
              {submitting ? "Verifying..." : "Verify Code"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminPanel onRefreshMarket={() => {}} onLockAdmin={handleLogout} />
    </div>
  );
}
