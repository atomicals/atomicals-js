import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { logBanner, prepareArgsMetaCtx } from "./command-helpers";
import { getKeypairInfo } from "../utils/address-keypair-path";
import { checkBaseRequestOptions, decorateAtomical } from "../utils/atomical-format-helpers";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
export class MintInteractiveDftCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private address: string,
    private ticker: string,
    private fundingWIF: string,
    private useCurrentBitwork?: boolean
  ) {
    this.options = checkBaseRequestOptions(this.options)
    this.ticker = this.ticker.startsWith('$') ? this.ticker.substring(1) : this.ticker;
  }
  async run(): Promise<any> {
    // Prepare the keys
    const filesData: any[] = await prepareArgsMetaCtx(
      {
        mint_ticker: this.ticker,
      }, undefined, undefined)

    logBanner('Mint Interactive FT (Decentralized)');
    console.log("Atomical type:", 'FUNGIBLE (decentralized)', filesData, this.ticker);
    console.log("Mint for ticker: ", this.ticker);

    const atomicalIdResult = await this.electrumApi.atomicalsGetByTicker(this.ticker);
    const atomicalResponse = await this.electrumApi.atomicalsGetFtInfo(atomicalIdResult.result.atomical_id);
    const globalInfo = atomicalResponse.global;
    const atomicalInfo = atomicalResponse.result;
    const atomicalDecorated = decorateAtomical(atomicalInfo);

    console.log(globalInfo, atomicalDecorated);

    if (!atomicalDecorated['$ticker'] || atomicalDecorated['$ticker'] != this.ticker) {
      throw new Error('Ticker being requested does not match the initialized decentralized FT mint: ' + atomicalDecorated)
    }

    if (!atomicalDecorated['subtype'] || atomicalDecorated['subtype'] != 'decentralized') {
      throw new Error('Subtype must be decentralized fungible token type')
    }

    if (atomicalDecorated['$mint_height'] > (globalInfo['height'] + 1)) {
      throw new Error(`Mint height is invalid. height=${globalInfo['height']}, $mint_height=${atomicalDecorated['$mint_height']}`)
    }
    const perAmountMint = atomicalDecorated['$mint_amount'];
    if (perAmountMint <= 0 || perAmountMint >= 100000000) {
      throw new Error('Per amount mint must be > 0 and less than or equal to 100,000,000')
    }
    console.log("Per mint amount:", perAmountMint);

    if (!atomicalDecorated['dft_info']) {
      throw new Error(`General error no dft_info found`)
    }

    const max_mints = atomicalDecorated['$max_mints']
    const mint_count = atomicalDecorated['dft_info']['mint_count'];
    const mint_bitworkc_current = atomicalDecorated['dft_info']['mint_bitworkc_current'];
    const mint_bitworkc_next = atomicalDecorated['dft_info']['mint_bitworkc_next'];
    const mint_bitworkc_current_remaining = atomicalDecorated['dft_info']['mint_bitworkc_current_remaining'];
    const mint_bitworkr_current = atomicalDecorated['dft_info']['mint_bitworkr_current'];
    const mint_bitworkr_next = atomicalDecorated['dft_info']['mint_bitworkr_next'];
    const mint_bitworkr_current_remaining = atomicalDecorated['dft_info']['mint_bitworkr_current_remaining'];

    const ticker = atomicalDecorated['$ticker'];
    const isInfiniteMode = atomicalDecorated['$mint_mode'] == 'perpetual';

    if (isInfiniteMode) {
      console.log('Infinite minting mode detected, there is no limit')
    } else {
      if (atomicalDecorated['dft_info']['mint_count'] >= atomicalDecorated['$max_mints']) {
        throw new Error(`Decentralized mint for ${ticker} completely minted out!`)
      } else {
        console.log(`There are already ${mint_count} mints of ${ticker} out of a max total of ${max_mints}.`)
      }
    }
 
    console.log('atomicalDecorated', atomicalResponse, atomicalDecorated);
    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      rbf: this.options.rbf,
      satsbyte: this.options.satsbyte,
      address: this.address,
      disableMiningChalk: this.options.disableMiningChalk,
      opType: 'dmt',
      dmtOptions: {
        mintAmount: perAmountMint,
        ticker: this.ticker,
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });

    // Attach any default data
    // Attach a container request
    if (this.options.container)
      atomicalBuilder.setContainerMembership(this.options.container);

    // In infinite minting mode we have a moving target difficulty always increasing based on how many minted so far
    if (isInfiniteMode) {
      // Mine the current or the next difficulty. By default it is the next
      if (mint_bitworkc_current) {

        if (this.useCurrentBitwork) {
          atomicalBuilder.setBitworkCommit(mint_bitworkc_current);
        } else {
          atomicalBuilder.setBitworkCommit(mint_bitworkc_next); 
        }

      }
      if (this.useCurrentBitwork) {
        atomicalBuilder.setBitworkReveal(mint_bitworkr_current);
      } else {
        atomicalBuilder.setBitworkReveal(mint_bitworkr_next); 
      }
    } else {
      // Attach any requested bitwork OR automatically request bitwork if the parent decentralized ft requires it
      const mint_bitworkc = atomicalDecorated['$mint_bitworkc'] || this.options.bitworkc
      if (mint_bitworkc) {
        atomicalBuilder.setBitworkCommit(mint_bitworkc);
      }

      const mint_bitworkr = atomicalDecorated['$mint_bitworkr'] || this.options.bitworkr
      if (mint_bitworkr) {
        atomicalBuilder.setBitworkReveal(mint_bitworkr);
      }
    }
   
    // The receiver output of the deploy
    atomicalBuilder.addOutput({
      address: this.address,
      value: perAmountMint
    })

    const result = await atomicalBuilder.start(this.fundingWIF);
    return {
      success: true,
      data: result
    }
  }

}
