import {
  IValidatedWalletInfo,
  IWalletRecord,
} from "../utils/validate-wallet-storage";

export function resolveWalletAliasNew(
  walletInfo: IValidatedWalletInfo,
  alias: string | undefined,
  defaultValue: any
): IWalletRecord {
  if (!alias) {
    return defaultValue;
  }
  if (walletInfo[alias]) {
    return walletInfo[alias];
  }
  if (walletInfo.imported[alias]) {
    return walletInfo.imported[alias];
  }
  throw "No wallet alias or valid address found: " + alias;
}

export const delay = (d = 1000) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(null), d);
  });
