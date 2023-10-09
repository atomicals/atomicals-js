import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { GetByTickerCommand } from "./get-by-ticker-command";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { BitworkInfo, checkBaseRequestOptions, isValidBitworkMinimum, isValidBitworkString } from "../utils/atomical-format-helpers";
import { prepareFilesDataAsObject } from "./command-helpers";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
export class InitInteractiveDftCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private files: string[],
    private address: string,
    private requestTicker: string,
    private mintAmount: number,
    private maxMints: number,
    private mintHeight: number,
    private mintBitworkc: string | null,
    private mintBitworkr: string | null,
    private fundingWIF: string,
    private options: BaseRequestOptions,
  ) {
    this.options = checkBaseRequestOptions(this.options);
    this.requestTicker = this.requestTicker.startsWith('$') ? this.requestTicker.substring(1) : this.requestTicker;
    isValidBitworkMinimum(this.options.bitworkc);

    if (this.maxMints > 100000 || this.maxMints < 1) {
      throw new Error('max mints must be between 1 and 100,000')
    }
    
    if (this.mintAmount > 100000000 || this.mintAmount < 546) {
      throw new Error('mint amount must be between 546 and 100,000,000')
    }
  }
  async run(): Promise<any> {
    const getExistingNameCommand = new GetByTickerCommand(this.electrumApi, this.requestTicker, AtomicalsGetFetchType.GET, undefined);
    try {
      const getExistingNameResult = await getExistingNameCommand.run();
      if (getExistingNameResult.success && getExistingNameResult.data) {
        if (getExistingNameResult.data.result && getExistingNameResult.data.result.atomical_id || getExistingNameResult.data.candidates.length) {
          throw 'Already exists with that name. Try a different name.';
        }
      }
    } catch (err: any) {
      console.log('err', err)
      if (err.code !== 1) {
        throw err; // Code 1 means call correctly returned that it was not found
      }
    }

    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      satsbyte: this.options.satsbyte,
      address: this.address,
      opType: 'dft',
      dftOptions: {
        mintAmount: Number(this.mintAmount),
        maxMints: Number(this.maxMints),
        mintHeight: Number(this.mintHeight),
        ticker: this.requestTicker,
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });

    // Attach any default data
    let filesData = await prepareFilesDataAsObject(this.files);
    await atomicalBuilder.setData(filesData);

    const args = {
      mint_amount: Number(this.mintAmount),
      mint_height: Number(this.mintHeight),
      max_mints: Number(this.maxMints),
    };

    let mintBitworkCommitInfo: BitworkInfo | null = null;
    if (this.mintBitworkc) {
      mintBitworkCommitInfo = isValidBitworkString(this.mintBitworkc)
      args['mint_bitworkc'] = mintBitworkCommitInfo?.hex_bitwork;
    }

    let mintBitworkRevealInfo: BitworkInfo | null = null;
    if (this.mintBitworkr) {
      mintBitworkRevealInfo = isValidBitworkString(this.mintBitworkr)
      args['mint_bitworkr'] = mintBitworkRevealInfo?.hex_bitwork;
    }

    atomicalBuilder.setArgs(args);
    // Set to request a container
    atomicalBuilder.setRequestTicker(this.requestTicker);
    // Attach a container request
    if (this.options.container)
      atomicalBuilder.setContainerMembership(this.options.container);
    // Attach any requested bitwork
    if (this.options.bitworkc) {
      atomicalBuilder.setBitworkCommit(this.options.bitworkc);
    }
    if (this.options.bitworkr) {
      atomicalBuilder.setBitworkReveal(this.options.bitworkr);
    }

    if (this.options.parent) {
      atomicalBuilder.setInputParent(await AtomicalOperationBuilder.resolveInputParent(this.electrumApi, this.options.parent, this.options.parentOwner as any))
    }

    // The receiver output
    atomicalBuilder.addOutput({
      address: this.address,
      value: this.options.satsoutput as any || 1000
    });

    const result = await atomicalBuilder.start(this.fundingWIF);
    return {
      success: true,
      data: result
    }
  }

}