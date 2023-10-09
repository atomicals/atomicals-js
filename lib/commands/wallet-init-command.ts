import { CommandResultInterface } from "./command-result.interface";
import { CommandInterface } from "./command.interface";
import { createPrimaryAndFundingKeyPairs } from "../utils/create-key-pair";
import { jsonFileExists, jsonFileWriter } from "../utils/file-utils";
import { walletPathResolver } from "../utils/wallet-path-resolver";

const walletPath = walletPathResolver();

export class WalletInitCommand implements CommandInterface {
    async run(): Promise<CommandResultInterface> {
        if (await this.walletExists()) {
            throw "wallet.json exists, please remove it first to initialize another wallet. You may also use 'wallet-create' command to generate a new wallet."
        }
        const wallet = await createPrimaryAndFundingKeyPairs();

        await jsonFileWriter(walletPath, {
            phrase: wallet.phrase,
            primary: {
                address: wallet.primary.address,
                path: wallet.primary.path,
                WIF: wallet.primary.WIF
            },
            funding: {
                address: wallet.funding.address,
                path: wallet.funding.path,
                WIF: wallet.funding.WIF
            }
        });
        return {
            success: true,
            data: wallet
        }
    }
    async walletExists() {
        if (await jsonFileExists(walletPath)) {
            return true;
        }
    }
}
