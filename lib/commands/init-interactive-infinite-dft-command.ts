import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
import * as readline from 'readline';
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { GetByTickerCommand } from "./get-by-ticker-command";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { checkBaseRequestOptions, isValidBitworkMinimum } from "../utils/atomical-format-helpers";
import { readJsonFileAsCompleteDataObjectEncodeAtomicalIds } from "./command-helpers";
import { isHex } from "../utils/utils";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);

const promptContinue = async (): Promise<any>  => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    let reply: string = '';
    const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));
    while (reply !== 'q') {
      console.log(`Are you sure you want to continue with the details above? (y/n)`)
      console.log('-')
      reply = (await prompt("Enter your selection: ") as any);
      switch (reply) {
        case 'y':
          return true;
        default:
        throw new Error("user aborted")
      }
    }
  } finally {
    rl.close();
  }
}

export class InitInteractiveInfiniteDftCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private file: string,
    private address: string,
    private requestTicker: string,
    private mintAmount: number,
    private maxMints: number,
    private mintHeight: number,
    private mintBitworkVector: string,
    private mintBitworkCommitIncrement: number,
    private mintBitworkRevealIncrement: number | null,
    private mintBitworkCommitIncrementStart: number | null,
    private mintBitworkRevealIncrementStart: number | null,
    private maxGlobalMints: number | null,
    private fundingWIF: string,
    private noimage?: boolean
  ) {
    this.options = checkBaseRequestOptions(this.options);
    this.requestTicker = this.requestTicker.startsWith('$') ? this.requestTicker.substring(1) : this.requestTicker;
    isValidBitworkMinimum(this.options.bitworkc);

    if (this.maxMints > 100000 || this.maxMints < 1) {
      throw new Error('Command line tool expects max mints to be between 1 and 100,000')
    }
    
    if (this.mintAmount > 100000000 || this.mintAmount < 546) {
      throw new Error('mint amount must be between 546 and 100,000,000')
    }
  }

  async run(): Promise<any> {
    let filesData;
    if (this.file) {
      filesData = await readJsonFileAsCompleteDataObjectEncodeAtomicalIds(this.file, true);
      console.log(filesData)
      if (!filesData['name']) {
        throw new Error('Please set a name in the files metadata. See examples in /templates/fungible-tokens')
      }
  
      if (!filesData['legal']) {
        throw new Error('Please set legal in the files metadata. See examples in /templates/fungible-tokens')
      }
  
      if (!filesData['legal']['terms']) {
        throw new Error('Please set legal terms in the files metadata. See examples in /templates/fungible-tokens')
      }
  
      if (!this.noimage && filesData['image']) {
        // Ex: atom:btc:dat:<location of store-file data>/image.png
        const re = /atom\:btc\:dat\:[a-f0-9]{64}i0\/.*\.(png|jpeg|svg|jpg|gif|webp)/
        if (!re.test(filesData['image'])) {
          throw new Error('The image field in the metadata is invalid and must be in the format of atom:btc:dat:<locationId>/image.png - create the file with the store-file command and copy the urn into the image field')
        }
      }
    } else {
      // Just default some metadata if a file was not provided
      filesData = {
        name: this.requestTicker.toUpperCase()
      }
    }
   
    console.log('Initializing Infinite Decentralized FT Token')
    console.log('-----------------------')
    console.log('Total Supply (Satoshis): unbounded');
    console.log('Total Supply (BTC): unbounded');
    console.log('Total Supply: unbounded');
    console.log('Max mints (per Bitwork difficulty target): ', this.maxMints);
    console.log('Mint Bitwork Vector: ', this.mintBitworkVector);
    console.log('Mint Bitwork (commit) Increment: ', this.mintBitworkCommitIncrement);
    console.log('Mint Bitwork (commit) Increment Start: ', this.mintBitworkCommitIncrementStart);
    console.log('Mint Bitwork (reveal) Increment: ', this.mintBitworkRevealIncrement);
    console.log('Mint Bitwork (reveal) Increment Start: ', this.mintBitworkRevealIncrementStart);
    console.log('Max mints in global:', this.maxGlobalMints)
    console.log('Mint Height: ', this.mintHeight);
    console.log('Mint Amount: ', this.mintAmount);
    console.log('Data objects: ', filesData);
    console.log('-----------------------')
    
    if (this.mintBitworkCommitIncrement < 1 || this.mintBitworkCommitIncrement > 64) {
      throw new Error('Error: Mint Bitwork Commit Increment must be between 1 and 64')
    }
    if (this.mintBitworkRevealIncrement && (this.mintBitworkRevealIncrement < 1 || this.mintBitworkRevealIncrement > 64)) {
      throw new Error('Error: Mint Bitwork Reveal Increment must be between 1 and 64')
    }

    if (this.mintBitworkVector.length < 4 || !isHex(this.mintBitworkVector)) {
      throw new Error('Error: Mint Bitwork Vector must be a hex string at least length 4')
    }
    await promptContinue();

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
      rbf: this.options.rbf,
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
    await atomicalBuilder.setData(filesData);

    const args = {
      mint_amount: Number(this.mintAmount),
      mint_height: Number(this.mintHeight),
      max_mints: Number(this.maxMints),
    };
    
    // Set mint mode = perpetual/infinite
    args['md'] = 1
    args['bv'] = this.mintBitworkVector

    if (this.mintBitworkCommitIncrement) {
      args['bci'] = this.mintBitworkCommitIncrement
      if (this.mintBitworkCommitIncrementStart) {
        if (this.mintBitworkCommitIncrementStart < 0 || this.mintBitworkCommitIncrementStart > 192) {
          throw new Error('mintBitworkCommitIncrementStart is not a number in range 0 to 192')
        }
        args['bcs'] = this.mintBitworkCommitIncrementStart
      }
    }
    if (this.mintBitworkRevealIncrement) {
      args['bri'] = this.mintBitworkRevealIncrement
      if (this.mintBitworkRevealIncrementStart) {
        if (this.mintBitworkRevealIncrementStart < 0 || this.mintBitworkRevealIncrementStart > 192) {
          throw new Error('mintBitworkRevealIncrementStart is not a number in range 0 to 192')
        }
        args['brs'] = this.mintBitworkRevealIncrementStart
      }
    }
    if (this.maxGlobalMints) {
      args['maxg'] = this.maxGlobalMints;
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