import { supabase } from "@/integrations/supabase/client";

const BUCKET = "report-media";
// 10 years in seconds — practically permanent signed URL
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.78;

/**
 * Compresses an image File via canvas. Returns a Blob (jpeg) or the original
 * file if it's not an image or compression fails.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file; // preserve animation

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size > file.size) return file; // don't upload bigger
    return blob;
  } catch {
    return file;
  }
}

function extFromType(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "video/mp4") return "mp4";
  if (type === "video/webm") return "webm";
  if (type === "video/quicktime") return "mov";
  return "bin";
}

/** Uploads a single File and returns a long-lived signed URL. */
export async function uploadOne(file: File): Promise<string> {
  const isImage = file.type.startsWith("image/");
  const blob = isImage ? await compressImage(file) : file;
  const type = blob instanceof File ? blob.type : (blob.type || file.type);
  const ext = extFromType(type);
  const rand = crypto.randomUUID();
  const path = `${new Date().toISOString().slice(0, 10)}/${rand}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: type, cacheControl: "31536000" });
  if (upErr) throw upErr;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) throw error ?? new Error("signed url failed");
  return data.signedUrl;
}

/** Uploads many files in parallel; resolves with successful URLs only. */
export async function uploadMany(files: File[]): Promise<string[]> {
  const results = await Promise.allSettled(files.map((f) => uploadOne(f)));
  return results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value);
}
