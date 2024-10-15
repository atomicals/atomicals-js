const bitcoin = require('bitcoinjs-lib');
import * as ecc from 'tiny-secp256k1';
bitcoin.initEccLib(ecc);

import ECPairFactory from 'ecpair';
import { defaultDerivedPath } from './address-helpers';
import { createMnemonicPhrase } from './create-mnemonic-phrase';

const ECPair = ECPairFactory(ecc);
import BIP32Factory from 'bip32';
import { NETWORK } from '../commands/command-helpers';
const bip32 = BIP32Factory(ecc);

export const toXOnly = (publicKey) => {
    return publicKey.slice(1, 33);
}
const bip39 = require('bip39');

export interface KeyPair {
    address: string
    publicKey: string
    publicKeyXOnly: string
    path: string,
    WIF: string
    privateKey?: string
}

export const createKeyPair = async (
    phrase: string = '',
    path = defaultDerivedPath,
    passphrase: string = ''
) : Promise<KeyPair> => {
    if (!phrase || phrase === '') {
        const phraseResult = createMnemonicPhrase();
        phrase = phraseResult.phrase;
    }
    const seed = await bip39.mnemonicToSeed(phrase, passphrase);
    const rootKey = bip32.fromSeed(seed);
    const childNodePrimary = rootKey.derivePath(path);
    // const p2pkh = bitcoin.payments.p2pkh({ pubkey: childNodePrimary.publicKey });
    const childNodeXOnlyPubkeyPrimary = toXOnly(childNodePrimary.publicKey);
    const p2trPrimary = bitcoin.payments.p2tr({
        internalPubkey: childNodeXOnlyPubkeyPrimary,
        network: NETWORK
    });
    if (!p2trPrimary.address || !p2trPrimary.output) {
        throw "error creating p2tr"
    }
    /* const p2pkhPrimary = bitcoin.payments.p2pkh({
        pubkey: childNodePrimary.publicKey,
        network: NETWORK
    });
    // console.log('p2pkhPrimary', p2pkhPrimary, p2pkhPrimary.address.toString())
    */
    // Used for signing, since the output and address are using a tweaked key
    // We must tweak the signer in the same way.
    const tweakedChildNodePrimary = childNodePrimary.tweak(
        bitcoin.crypto.taggedHash('TapTweak', childNodeXOnlyPubkeyPrimary),
    );

    // Do a sanity check with the WIF serialized and then verify childNodePrimary is the same
    const wif = childNodePrimary.toWIF();
    const keypair = ECPair.fromWIF(wif);

    if (childNodePrimary.publicKey.toString('hex') !== keypair.publicKey.toString('hex')) {
        throw 'createKeyPair error child node not match sanity check'
    }
    return {
        address: p2trPrimary.address,
        publicKey: childNodePrimary.publicKey.toString('hex'),
        publicKeyXOnly: childNodeXOnlyPubkeyPrimary.toString('hex'),
        path,
        WIF: childNodePrimary.toWIF(),
        privateKey: childNodePrimary.privateKey?.toString('hex'),
    }
}
export interface WalletRequestDefinition {
    phrase?: string | undefined
    path?: string | undefined
}

export const createPrimaryAndFundingImportedKeyPairs = async (
    phrase?: string | undefined,
    path?: string | undefined,
    passphrase?: string | undefined,
    n?: number
) => {
    if (!phrase) {
        phrase = createMnemonicPhrase().phrase;
    }
    let pathUsed = defaultDerivedPath.substring(0, 11);
    if (path) {
        pathUsed = path;
    }
    const imported = {}

    if (n) {
        for (let i = 2; i < n + 2; i++) {
            imported[i+''] = await createKeyPair(phrase, `${pathUsed}/0/` + i, passphrase)
        }
    }
    return {
        wallet: {
            phrase,
            passphrase,
            primary: await createKeyPair(phrase, `${pathUsed}/0/0`, passphrase),
            funding: await createKeyPair(phrase, `${pathUsed}/1/0`, passphrase)
        },
        imported
    }
}

export const createNKeyPairs = async (
    phrase: string | undefined,
    passphrase: string | undefined,
    n = 1
) => {
    const keypairs: any = [];
    for (let i = 0; i < n; i++) {
        keypairs.push(await createKeyPair(phrase, `${defaultDerivedPath.substring(0, 13)}/${i}`, passphrase));
    }
    return {
        phrase,
        keypairs,
    }
}
