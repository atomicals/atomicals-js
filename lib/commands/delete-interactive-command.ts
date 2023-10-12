

import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from '@bitcoinerlab/secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
import * as bitcoin from 'bitcoinjs-lib';
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { getAndCheckAtomicalInfo, logBanner } from "./command-helpers";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { IWalletRecord } from "../utils/validate-wallet-storage";



export class DeleteInteractiveCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private atomicalId: string,
    private path: string,
    private keysToDelete: string[],
    private owner: IWalletRecord,
    private funding: IWalletRecord,
    private options: BaseRequestOptions
  ) {
  }
  async run(): Promise<any> {
    logBanner(`Delete Interactive`);
    if (!this.path || this.path.trim().length === 0 || typeof this.path !== 'string') {
      throw new Error(`Error: Path must be set and a valid string`)
    }

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
    const keysToDeleteWithTrue = {}
    for (const item of this.keysToDelete) {
      keysToDeleteWithTrue[item] = true;
    }
    await atomicalBuilder.setData({
      ...keysToDeleteWithTrue,
      $action: 'delete',
      $path: this.path,
    });

    // Add the atomical to update
    const inputUtxoPartial2 = Object.assign({}, inputUtxoPartial, {
      hash: 'ad11617660b9c7d0bef6e9f723d5a85f5b1a60dd2e34f0144371fd61c0c76c43'
    })
    atomicalBuilder.addInputUtxo(inputUtxoPartial2, this.owner.WIF)

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


