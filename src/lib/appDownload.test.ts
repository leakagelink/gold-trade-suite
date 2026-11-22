import { describe, expect, it } from "vitest";
import { validateApk, MAX_APK_BYTES } from "./appDownload";

describe("APK upload validation", () => {
  it("accepts APK files up to 100 MB", () => {
    expect(MAX_APK_BYTES).toBe(104857600);
    expect(validateApk({ name: "SkyFX.apk", size: 104857600 })).toBeNull();
    expect(validateApk({ name: "SkyFX.apk", size: 104857601 })).not.toBeNull();
  });
  it("rejects files that are not Android APKs", () => {
    expect(validateApk({ name: "SkyFX.zip", size: 100 })).not.toBeNull();
    expect(validateApk({ name: "SkyFX.APK", size: 100 })).toBeNull();
  });
  it("rejects empty APKs", () => {
    expect(validateApk({ name: "SkyFX.apk", size: 0 })).not.toBeNull();
  });
});