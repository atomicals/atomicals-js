const bitcoin = require('bitcoinjs-lib');
import * as ecc from '@bitcoinerlab/secp256k1';
bitcoin.initEccLib(ecc);
const crypto = require('crypto');
const bip39 = require('bip39');

export function createMnemonicPhrase() {
    const randomBytes = crypto.randomBytes(16) // 128 bits is enough
    const mnemonic = bip39.entropyToMnemonic(randomBytes.toString('hex'))
    if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error("Invalid mnemonic generated!");
    }
    return {
        phrase: mnemonic
    }
}
