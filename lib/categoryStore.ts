import { useEffect, useState } from "react";
import { BUSINESS_CATEGORIES } from "../types";
import { BADGE_COLORS } from "./categoryIcons";

/**
 * Admin-editable business categories.
 *
 * The backend/schema stores `category` as a free-text string on each
 * seller, so there's no dedicated categories table to migrate. This store
 * keeps the *list* of selectable categories (plus a display color for any
 * category the admin adds) in localStorage, seeded from the built-in
 * BUSINESS_CATEGORIES/BADGE_COLORS. Every screen that needs the current
 * category list or color should go through this module instead of
 * importing the static constants directly, so admin edits show up
 * everywhere immediately.
 */

const CATS_KEY = "tamubah_categories_v1";
const COLORS_KEY = "tamubah_category_colors_v1";
const EVENT_NAME = "tamubah:categories-changed";

const FALLBACK_PALETTE = [
  "#f59e0b", "#ec4899", "#3b82f6", "#14b8a6", "#22c55e",
  "#a855f7", "#ef4444", "#0ea5e9", "#eab308", "#6366f1",
];

function readCategories(): string[] {
  if (typeof window === "undefined") return BUSINESS_CATEGORIES;
  try {
    const raw = window.localStorage.getItem(CATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Failed to read categories from storage", e);
  }
  return [...BUSINESS_CATEGORIES];
}

function readColors(): Record<string, string> {
  if (typeof window === "undefined") return { ...BADGE_COLORS };
  try {
    const raw = window.localStorage.getItem(COLORS_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    return { ...BADGE_COLORS, ...stored };
  } catch (e) {
    console.error("Failed to read category colors from storage", e);
    return { ...BADGE_COLORS };
  }
}

function persist(categories: string[], colors: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CATS_KEY, JSON.stringify(categories));
  window.localStorage.setItem(COLORS_KEY, JSON.stringify(colors));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function nextPaletteColor(colors: Record<string, string>): string {
  const used = new Set(Object.values(colors));
  const free = FALLBACK_PALETTE.find((c) => !used.has(c));
  return free || FALLBACK_PALETTE[Object.keys(colors).length % FALLBACK_PALETTE.length];
}

export function getCategories(): string[] {
  return readCategories();
}

export function getCategoryColorMap(): Record<string, string> {
  return readColors();
}

export function addCategory(name: string, color?: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const categories = readCategories();
  if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
  const colors = readColors();
  const updatedCategories = [...categories, trimmed];
  const updatedColors = { ...colors, [trimmed]: color || nextPaletteColor(colors) };
  persist(updatedCategories, updatedColors);
}

export function renameCategory(oldName: string, newName: string): void {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return;
  const categories = readCategories();
  const colors = readColors();
  const updatedCategories = categories.map((c) => (c === oldName ? trimmed : c));
  const updatedColors = { ...colors };
  if (updatedColors[oldName]) {
    updatedColors[trimmed] = updatedColors[oldName];
    delete updatedColors[oldName];
  }
  persist(updatedCategories, updatedColors);
}

export function setCategoryColor(name: string, color: string): void {
  const colors = readColors();
  persist(readCategories(), { ...colors, [name]: color });
}

export function removeCategory(name: string): void {
  const categories = readCategories().filter((c) => c !== name);
  const colors = readColors();
  delete colors[name];
  persist(categories, colors);
}

export function resetCategories(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CATS_KEY);
  window.localStorage.removeItem(COLORS_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/** React hook: live list of categories + colors, updates whenever admin edits them (any tab). */
export function useCategories() {
  const [categories, setCategories] = useState<string[]>(() => readCategories());
  const [colors, setColors] = useState<Record<string, string>>(() => readColors());

  useEffect(() => {
    const refresh = () => {
      setCategories(readCategories());
      setColors(readColors());
    };
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { categories, colors };
}

export function getCategoryColorDynamic(category: string): string {
  const colors = readColors();
  return colors[category] || FALLBACK_PALETTE[0];
}
