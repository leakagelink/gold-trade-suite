import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Upload, Download, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { downloadApp, validateApk } from "@/lib/appDownload";

interface AppRelease {
  id: string;
  version: string;
  file_url: string;
  file_path: string;
  file_size: number | null;
  release_notes: string | null;
  is_active: boolean;
  created_at: string;
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
};

export default function AdminAppUpload() {
  const { user } = useAuth();
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchReleases = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_releases")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setReleases((data as AppRelease[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  const syncDownloadSetting = async (url: string) => {
    const { error } = await supabase.from("payment_settings").upsert({
      setting_key: "app_download_url", setting_value: url,
      updated_by: user?.id, updated_at: new Date().toISOString(),
    }, { onConflict: "setting_key" });
    if (error) throw error;
  };

  const handleUpload = async () => {
    if (!file) return toast.error("Please choose an APK file");
    const validationError = validateApk(file);
    if (validationError) return toast.error(validationError);
    if (!version.trim()) return toast.error("Please enter a version");
    if (!user) return toast.error("Please sign in again");

    try {
      setUploading(true);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `releases/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("app-releases")
        .upload(path, file, { contentType: file.type || "application/vnd.android.package-archive", upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("app-releases").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const { data: inserted, error: insErr } = await supabase.from("app_releases").insert({
        version: version.trim(),
        file_url: publicUrl,
        file_path: path,
        file_size: file.size,
        release_notes: notes.trim() || null,
        is_active: false,
        uploaded_by: user?.id,
      }).select("*").single();
      if (insErr) {
        await supabase.storage.from("app-releases").remove([path]);
        throw insErr;
      }
      if (!inserted) throw new Error("Release could not be saved");
      await activateRelease(inserted as AppRelease);

      toast.success("App uploaded successfully");
      setVersion("");
      setNotes("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      fetchReleases();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const activateRelease = async (r: AppRelease) => {
    // Publish the download link first; a failed upload never removes the previous APK.
    await syncDownloadSetting(r.file_url);
    const { error } = await supabase.from("app_releases").update({ is_active: true }).eq("id", r.id);
    if (error) throw error;
    const { error: deactivateError } = await supabase.from("app_releases")
      .update({ is_active: false }).eq("is_active", true).neq("id", r.id);
    if (deactivateError) throw deactivateError;
  };

  const handleSetActive = async (r: AppRelease) => {
    setBusyId(r.id);
    try {
      await activateRelease(r);
      toast.success(`Version ${r.version} is now active`);
      await fetchReleases();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish release");
    } finally { setBusyId(null); }
  };

  const handleDelete = async (r: AppRelease) => {
    if (!confirm(`Delete version ${r.version}?`)) return;
    setBusyId(r.id);
    try {
      const { data: setting, error: settingError } = await supabase.from("payment_settings")
        .select("setting_value").eq("setting_key", "app_download_url").maybeSingle();
      if (settingError) throw settingError;
      if (setting?.setting_value === r.file_url) await syncDownloadSetting("");
      const { error: storageError } = await supabase.storage.from("app-releases").remove([r.file_path]);
      if (storageError) throw storageError;
      const { error } = await supabase.from("app_releases").delete().eq("id", r.id);
      if (error) throw error;
      toast.success("Release deleted");
      await fetchReleases();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete release");
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Upload Mobile App (APK)
          </CardTitle>
          <CardDescription>
            SkyFX Android
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                placeholder="e.g. 1.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apk-file-input">APK File</Label>
              <Input
                id="apk-file-input"
                ref={fileInput}
                type="file"
                disabled={uploading}
                accept=".apk,application/vnd.android.package-archive"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">.apk · Maximum 100 MB{file ? ` · ${formatSize(file.size)}` : ""}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Release Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="What's new in this version..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={handleUpload} disabled={uploading || busyId !== null} className="w-full">
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Upload & Publish"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Releases</CardTitle>
          <CardDescription>The active release is shown to users.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : releases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No releases uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {releases.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border rounded-lg"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">v{r.version}</span>
                      {r.is_active && (
                        <Badge className="bg-success hover:bg-success">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{formatSize(r.file_size)}</span>
                    </div>
                    {r.release_notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{r.release_notes}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => downloadApp(r.file_url).catch(() => toast.error("App download failed"))}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Download
                    </Button>
                    {!r.is_active && (
                      <Button size="sm" variant="secondary" disabled={uploading || busyId !== null} onClick={() => handleSetActive(r)}>
                        Set Active
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" aria-label={`Delete version ${r.version}`} disabled={uploading || busyId !== null} onClick={() => handleDelete(r)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
