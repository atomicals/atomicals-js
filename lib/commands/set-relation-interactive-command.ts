import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from '@bitcoinerlab/secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { getAndCheckAtomicalInfo, logBanner } from "./command-helpers";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { IWalletRecord } from "../utils/validate-wallet-storage";

const tinysecp: TinySecp256k1Interface = require('@bitcoinerlab/secp256k1');
initEccLib(tinysecp as any);

export class SetRelationInteractiveCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private atomicalId: string,
    private relationName: string,
    private values: string[],
    private owner: IWalletRecord,
    private funding: IWalletRecord,
    private options: BaseRequestOptions
  ) {

  }
  async run(): Promise<any> {
    logBanner(`Set Relation Interactive`);
    const { atomicalInfo, locationInfo, inputUtxoPartial } = await getAndCheckAtomicalInfo(this.electrumApi, this.atomicalId, this.owner.address);
    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
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

    await atomicalBuilder.setData({
      $path: '/relns',
      [this.relationName]: this.values
    });
    

    // Add the atomical to update
    const inputUtxoPartial2 = Object.assign({}, inputUtxoPartial, {
      hash: 'f5e7eef272f3de73c8b1def6ca5bc4495ee7d2d7a4ad2b3cc664c536b2d527f3'
    })
    atomicalBuilder.addInputUtxo(inputUtxoPartial, this.owner.WIF)

     // The receiver output
     atomicalBuilder.addOutput({
      address: this.owner.address,
      value: this.options.satsoutput as any || 1000
    });
    const result = await atomicalBuilder.start(this.funding.WIF);
    return {
      success: true,
      data: result
    }
  }
}