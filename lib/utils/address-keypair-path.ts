import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { mnemonicToSeed } from 'bip39';
import BIP32Factory from 'bip32';
import { toXOnly } from './create-key-pair';
import { NETWORK } from '../commands/command-helpers';
const bip32 = BIP32Factory(ecc);

bitcoin.initEccLib(ecc);

export interface ExtendTaprootAddressScriptKeyPairInfo {
  address: string;
  tweakedChildNode: any;
  childNodeXOnlyPubkey: any;
  output: any;
  keyPair: any;
  path: string;
}

export const getExtendTaprootAddressKeypairPath = async (phrase: string, path: string): Promise<ExtendTaprootAddressScriptKeyPairInfo> => {
  const seed = await mnemonicToSeed(phrase);
  const rootKey = bip32.fromSeed(seed);
  const childNode = rootKey.derivePath(path);
  const childNodeXOnlyPubkey = childNode.publicKey.slice(1, 33);
  // This is new for taproot
  // Note: we are using mainnet here to get the correct address
  // The output is the same no matter what the network is.
  const { address, output } = bitcoin.payments.p2tr({
    internalPubkey: childNodeXOnlyPubkey,
    network: NETWORK
  });

  // Used for signing, since the output and address are using a tweaked key
  // We must tweak the signer in the same way.
  const tweakedChildNode = childNode.tweak(
    bitcoin.crypto.taggedHash('TapTweak', childNodeXOnlyPubkey),
  );

  return {
    address: address!,
    tweakedChildNode,
    childNodeXOnlyPubkey,
    output,
    keyPair: childNode,
    path,
  }
}

export interface KeyPairInfo {
  address: string;
  output: Buffer;
  childNodeXOnlyPubkey: any;
  tweakedChildNode: any;
  childNode: any;
}

export const getKeypairInfo = (childNode: any): KeyPairInfo => {
  const childNodeXOnlyPubkey = toXOnly(childNode.publicKey);
  // This is new for taproot
  // Note: we are using mainnet here to get the correct address
  // The output is the same no matter what the network is.
  const { address, output } = bitcoin.payments.p2tr({
    internalPubkey: childNodeXOnlyPubkey,
    network: NETWORK
  });

  // Used for signing, since the output and address are using a tweaked key
  // We must tweak the signer in the same way.
  const tweakedChildNode = childNode.tweak(
    bitcoin.crypto.taggedHash('TapTweak', childNodeXOnlyPubkey),
  );

  return {
    address: address!,
    tweakedChildNode,
    childNodeXOnlyPubkey,
    output: output!,
    childNode
  }
}

