import { supabase } from "@/integrations/supabase/client";

export const MAX_APK_BYTES = 100 * 1024 * 1024;

export function validateApk(file: Pick<File, "name" | "size">): string | null {
  if (!file.name.toLowerCase().endsWith(".apk")) return "Please select an Android APK file";
  if (file.size === 0) return "The APK file is empty";
  if (file.size > MAX_APK_BYTES) return "APK must be 100 MB or smaller";
  return null;
}

export async function downloadApp(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("A secure app download link is required");
  const match = parsed.pathname.match(/\/storage\/v1\/object\/public\/(app-releases|app-files)\/(.+)$/);
  if (match) {
    const bucket = match[1];
    const path = decodeURIComponent(match[2]);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60, {
      download: "SkyFX.apk",
    });
    if (error) throw error;
    if (!data?.signedUrl) throw new Error("App download is unavailable");
    window.location.assign(data.signedUrl);
    return;
  }
  window.location.assign(url);
}