// Transform Supabase Storage public URLs into on-the-fly thumbnails via the
// render endpoint. Non-Supabase URLs are returned as-is.
//
// Example:
//   https://xxx.supabase.co/storage/v1/object/public/report-media/foo.jpg
//   → https://xxx.supabase.co/storage/v1/render/image/public/report-media/foo.jpg?width=200&resize=cover&quality=70
export function thumbUrl(url: string | null | undefined, width = 200, quality = 70): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.pathname.includes("/storage/v1/object/public/")) return url;
    u.pathname = u.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    u.searchParams.set("width", String(width));
    u.searchParams.set("resize", "cover");
    u.searchParams.set("quality", String(quality));
    return u.toString();
  } catch {
    return url;
  }
}
