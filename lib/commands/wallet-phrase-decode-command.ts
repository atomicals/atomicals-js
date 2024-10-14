import { CommandResultInterface } from "./command-result.interface";
import { CommandInterface } from "./command.interface";
import { decodeMnemonicPhrase } from "../utils/decode-mnemonic-phrase";

export class WalletPhraseDecodeCommand implements CommandInterface {
    constructor(private phrase: string, private path: string, private passphrase?: string) {
    }
    async run(): Promise<CommandResultInterface> {
        const wallet = await decodeMnemonicPhrase(this.phrase, this.path, this.passphrase);
        return {
            success: true,
            data: wallet
        }
    }
}
