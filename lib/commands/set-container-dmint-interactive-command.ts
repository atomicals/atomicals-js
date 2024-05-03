import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { getAndCheckAtomicalInfo, logBanner, readJsonFileAsCompleteDataObjectEncodeAtomicalIds } from "./command-helpers";
import { isAtomicalId, isValidBitworkString } from "../utils/atomical-format-helpers";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { IWalletRecord } from "../utils/validate-wallet-storage";
import { detectScriptToAddressType } from "../utils/address-helpers";

const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);

interface DmintManifestInteface {
  v: string,
  mint_height: number,
  items: number,
  rules: {
    o?: { [script: string]: {v: number, id?: string} },
    p: string,
    bitworkc?: string,
    bitworkr?: string,
  }[],
}

export function validateDmint(
  obj: {dmint?: DmintManifestInteface} | undefined,
) {
  if (!obj) {
    throw `Invalid manifest.`;
  }
  const dmint = obj.dmint;
  if (!dmint) {
    throw `Invalid manifest: No 'dmint' field.`;
  }
  const items = dmint.items;
  if (!items) {
    throw `Invalid items count: ${items}.`;
  }
  for (const {o, p, bitworkc, bitworkr} of dmint.rules) {
    try {
      new RegExp(p);
    } catch (e) {
      throw `Invalid rule pattern: ${p}.\n${e}`;
    }
    if (o === undefined && bitworkc === undefined && bitworkr === undefined) {
      throw `Invalid rule (${p}): No fields specified.`;
    }
    if (o !== undefined) {
      if (Object.keys(o).length === 0) {
        throw `Invalid rule (${p}) output: No script specified.`
      }
      for (const entry of Object.entries(o)) {
        const script = entry[0]
        try {
          detectScriptToAddressType(script)
        } catch (e) {
          throw `Invalid rule (${p}) output script [${script}]: ${e}`
        }
        const {v, id} = entry[1]
        if (typeof v !== 'number' || !v || v <= 0) {
          throw `Invalid rule (${p}) output value: Invalid amount (${v}).`
        }
        if (id !== undefined && !isAtomicalId(id)) {
          throw `Invalid rule (${p}) output id: Invalid Atomical ID (${id}).`
        }
      }
    }
    if (bitworkc !== undefined && !isValidBitworkString(bitworkc)) {
      throw `Invalid rule (${p}) bitworkc: Invalid bitwork string (${bitworkc}).`
    }
    if (bitworkr !== undefined && !isValidBitworkString(bitworkr)) {
      throw `Invalid rule (${p}) bitworkr: Invalid bitwork string (${bitworkr}).`
    }
  }
  const mh = dmint.mint_height;
  if (mh === 0) {
    return true;
  }
  if (mh !== undefined) {
    if (isNaN(mh)) {
      throw `Invalid mint height: NaN.`
    }
    if (mh < 0 || mh > 10000000) {
      throw `Invalid mint height: Should between 0 and 10000000.`
    }
    return true;
  }
  return false;
}

export class SetContainerDmintInteractiveCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private containerName: string,
    private filename: string,
    private owner: IWalletRecord,
    private funding: IWalletRecord,
  ) {

  }
  async run(): Promise<any> {
    logBanner(`Set Container Data Interactive`);
    // Attach any default data
    let filesData = await readJsonFileAsCompleteDataObjectEncodeAtomicalIds(this.filename, false);

    if (!validateDmint(filesData)) {
      throw new Error('Invalid dmint');
    }
    const { atomicalInfo, locationInfo, inputUtxoPartial } = await getAndCheckAtomicalInfo(this.electrumApi, this.containerName, this.owner.address, 'NFT', 'container');
    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      rbf: this.options.rbf,
      satsbyte: this.options.satsbyte,
      address: this.owner.address,
      disableMiningChalk: this.options.disableMiningChalk,
      opType: 'mod',
      nftOptions: {
        satsoutput: this.options.satsoutput as any
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });
    await atomicalBuilder.setData(filesData);

    // Attach any requested bitwork
    if (this.options.bitworkc) {
      atomicalBuilder.setBitworkCommit(this.options.bitworkc);
    }
    // Add the atomical to update
    atomicalBuilder.addInputUtxo(inputUtxoPartial, this.owner.WIF)

    // The receiver output
    atomicalBuilder.addOutput({
      address: this.owner.address,
      value: this.options.satsoutput as any || 1000// todo: determine how to auto detect the total input and set it to that
    });

    const result = await atomicalBuilder.start(this.funding.WIF);
    return {
      success: true,
      data: result
    }
  }
}