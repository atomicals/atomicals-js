import { Atomicals, ElectrumApi } from "..";
import { validateWalletStorage } from "../utils/validate-wallet-storage";
import { delay, resolveWalletAliasNew } from "./utils";


export const mintDft = async (ticker: string, count: number, options: any = {}) => {
    const walletInfo = await validateWalletStorage();
    const array = Array.from({ length: count }, (_, index) => index + 1);
    for await (const iterator of array) {
        ticker = ticker.toLowerCase();
        const atomicals = new Atomicals(ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
        let walletRecord = resolveWalletAliasNew(walletInfo, options.initialowner, walletInfo.primary);
        let fundingRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
        const result: any = await atomicals.mintDftInteractive({
          rbf: options.rbf,
          satsbyte: parseInt(options.satsbyte),
          disableMiningChalk: options.disablechalk,
        }, walletRecord.address, ticker, fundingRecord.WIF);
        console.log(iterator, result)
        delay(2000)
        
    }
}