import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import {randomBytes} from 'crypto';
import {entropyToMnemonic, validateMnemonic} from 'bip39';

bitcoin.initEccLib(ecc);

export function createMnemonicPhrase() {
    const bytes = randomBytes(16) // 128 bits is enough
    const mnemonic = entropyToMnemonic(bytes.toString('hex'))
    if (!validateMnemonic(mnemonic)) {
        throw new Error("Invalid mnemonic generated!");
    }
    return {
        phrase: mnemonic
    }
}
