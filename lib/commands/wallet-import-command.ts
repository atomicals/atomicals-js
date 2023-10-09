import { CommandResultInterface } from "./command-result.interface";
import { CommandInterface } from "./command.interface";
import { toXOnly } from "../utils/create-key-pair";
import { jsonFileExists, jsonFileReader, jsonFileWriter } from "../utils/file-utils";
import { IValidatedWalletInfo } from "../utils/validate-wallet-storage";
const bitcoin = require('bitcoinjs-lib');
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const walletPath = process.env.WALLET_PATH || "wallet.json";

export class WalletImportCommand implements CommandInterface {

    constructor(private wif: string, private alias: string) {
    }
    async run(): Promise<CommandResultInterface> {
        if (!(await this.walletExists())) {
            throw "wallet.json does NOT exist, please create one first with wallet-init"
        }
        const walletFileData: IValidatedWalletInfo = (await jsonFileReader(walletPath)) as IValidatedWalletInfo;
        if (!walletFileData.imported) {
            walletFileData.imported = {};
        }
        if (walletFileData.imported.hasOwnProperty(this.alias)) {
            throw `Wallet alias ${this.alias} already exists!`
        }
        // Get the wif and the address and ensure they match
        const importedKeypair = ECPair.fromWIF(this.wif);
        const { address, output } = bitcoin.payments.p2tr({
            internalPubkey: toXOnly(importedKeypair.publicKey)
        });
        const walletImportedField = Object.assign({}, walletFileData.imported, {
            [this.alias]: {
                address,
                WIF: this.wif
            }
        });
        walletFileData['imported'] = walletImportedField;
        await jsonFileWriter(walletPath, walletFileData);
        return {
            success: true,
            data: {
                address,
                alias: this.alias
            }
        }
    }

    async walletExists() {
        if (await jsonFileExists(walletPath)) {
            return true;
        }
    }
}
