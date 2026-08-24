import { useEffect, useState, useCallback } from "react";
import { BUSINESS_CATEGORIES } from "../types";

/**
 * Admin-editable business categories.
 *
 * Backed by the `categories` table on the server (see /api/categories and
 * /api/admin/categories/*) so edits made by any admin, on any device, show
 * up everywhere immediately — not just in the browser that made the change.
 *
 * The backend/schema stores `category` as a free-text string on each
 * seller/product (no foreign key), so renaming a category server-side also
 * updates every seller/product currently using the old name — see the PUT
 * /api/admin/categories/:id handler.
 *
 * Every screen that needs the current category list or color should go
 * through this module (via the `useCategories()` hook) instead of importing
 * BUSINESS_CATEGORIES directly, so admin edits are reflected live.
 */

interface CategoryRecord {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

const EVENT_NAME = "tamubah:categories-changed";
const FALLBACK_PALETTE = [
  "#f59e0b", "#ec4899", "#3b82f6", "#14b8a6", "#22c55e",
  "#a855f7", "#ef4444", "#0ea5e9", "#eab308", "#6366f1",
];

// In-memory cache shared across every useCategories() consumer, so we don't
// refetch on every mount — just on the change event.
let cache: CategoryRecord[] | null = null;
let inFlight: Promise<CategoryRecord[]> | null = null;

async function fetchCategories(): Promise<CategoryRecord[]> {
  try {
    const res = await fetch("/api/categories");
    if (!res.ok) throw new Error("failed");
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return data;
  } catch (e) {
    console.error("Failed to fetch categories from server", e);
  }
  // Fallback so the UI never renders empty (e.g. offline, or table not migrated yet)
  return BUSINESS_CATEGORIES.map((name, i) => ({
    id: `fallback_${i}`,
    name,
    color: FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
    sortOrder: i,
  }));
}

function loadCategories(): Promise<CategoryRecord[]> {
  if (cache) return Promise.resolve(cache);
  if (inFlight) return inFlight;
  inFlight = fetchCategories().then((data) => {
    cache = data;
    inFlight = null;
    return data;
  });
  return inFlight;
}

function notifyChanged() {
  cache = null; // force a refetch next time anything asks
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

/** React hook: live list of categories + colors, updates whenever admin edits them (any tab, any device). */
export function useCategories() {
  const [records, setRecords] = useState<CategoryRecord[]>(() =>
    BUSINESS_CATEGORIES.map((name, i) => ({ id: `pending_${i}`, name, color: FALLBACK_PALETTE[i % FALLBACK_PALETTE.length], sortOrder: i }))
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    loadCategories().then((data) => {
      setRecords(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(EVENT_NAME, refresh);
    return () => window.removeEventListener(EVENT_NAME, refresh);
  }, [refresh]);

  const categories = records.map((r) => r.name);
  const colors = Object.fromEntries(records.map((r) => [r.name, r.color]));

  return { categories, colors, records, loading };
}

/** Non-hook accessor for the current (possibly cached) category name list. */
export async function getCategories(): Promise<string[]> {
  const data = await loadCategories();
  return data.map((r) => r.name);
}

export async function getCategoryColorMap(): Promise<Record<string, string>> {
  const data = await loadCategories();
  return Object.fromEntries(data.map((r) => [r.name, r.color]));
}

export async function addCategory(name: string, color?: string): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };
  try {
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, color }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Failed to add category." };
    notifyChanged();
    return {};
  } catch {
    return { error: "Network error." };
  }
}

async function findIdByName(name: string): Promise<string | null> {
  const data = await loadCategories();
  return data.find((r) => r.name === name)?.id || null;
}

export async function renameCategory(oldName: string, newName: string): Promise<{ error?: string }> {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return {};
  const id = await findIdByName(oldName);
  if (!id) return { error: "Category not found." };
  try {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Failed to rename category." };
    notifyChanged();
    return {};
  } catch {
    return { error: "Network error." };
  }
}

export async function setCategoryColor(name: string, color: string): Promise<{ error?: string }> {
  const id = await findIdByName(name);
  if (!id) return { error: "Category not found." };
  try {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    if (!res.ok) {
      const data = await res.json();
      return { error: data.error || "Failed to update color." };
    }
    notifyChanged();
    return {};
  } catch {
    return { error: "Network error." };
  }
}

export async function removeCategory(name: string): Promise<{ error?: string }> {
  const id = await findIdByName(name);
  if (!id) return { error: "Category not found." };
  try {
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      return { error: data.error || "Failed to delete category." };
    }
    notifyChanged();
    return {};
  } catch {
    return { error: "Network error." };
  }
}

/** Reorders categories to match the given array of names (admin drag/reorder UI). */
export async function reorderCategories(orderedNames: string[]): Promise<{ error?: string }> {
  const data = await loadCategories();
  const byName = new Map(data.map((r) => [r.name, r.id]));
  const orderedIds = orderedNames.map((n) => byName.get(n)).filter(Boolean) as string[];
  if (orderedIds.length === 0) return { error: "Nothing to reorder." };
  try {
    const res = await fetch("/api/admin/categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok) {
      const data2 = await res.json();
      return { error: data2.error || "Failed to reorder categories." };
    }
    notifyChanged();
    return {};
  } catch {
    return { error: "Network error." };
  }
}

export function getCategoryColorDynamic(category: string): string {
  const found = cache?.find((r) => r.name === category);
  return found?.color || FALLBACK_PALETTE[0];
}
