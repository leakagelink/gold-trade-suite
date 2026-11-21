export interface DepositDeletionEffects {
  removesRequestAndHistory: true;
  changesAvailableWalletBalance: false;
  releasesLockedBalance: boolean;
}

export const getDepositDeletionEffects = (status: string): DepositDeletionEffects => ({
  removesRequestAndHistory: true,
  changesAvailableWalletBalance: false,
  releasesLockedBalance: status === "locked",
});
