// Turns a shop name like "Kak Ani's Kitchen" into a readable URL segment
// like "kak-anis-kitchen", used for shareable /seller/:slug links.
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "seller"
  );
}
