import { describe, expect, it } from "vitest";
import { getDepositDeletionEffects } from "./depositDeletion";

describe("deposit deletion rules", () => {
  it.each(["pending", "approved", "rejected", "locked"])(
    "removes the request and linked history for %s deposits",
    (status) => {
      expect(getDepositDeletionEffects(status).removesRequestAndHistory).toBe(true);
    },
  );

  it("never changes the available wallet balance, including for approved deposits", () => {
    expect(getDepositDeletionEffects("approved").changesAvailableWalletBalance).toBe(false);
  });

  it("releases the locked amount only when deleting a locked deposit", () => {
    expect(getDepositDeletionEffects("locked").releasesLockedBalance).toBe(true);
    expect(getDepositDeletionEffects("approved").releasesLockedBalance).toBe(false);
    expect(getDepositDeletionEffects("pending").releasesLockedBalance).toBe(false);
    expect(getDepositDeletionEffects("rejected").releasesLockedBalance).toBe(false);
  });
});
