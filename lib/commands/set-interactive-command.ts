import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from '@bitcoinerlab/secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
import * as bitcoin from 'bitcoinjs-lib';
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { getAndCheckAtomicalInfo, logBanner, prepareFilesDataAsObject } from "./command-helpers";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { IWalletRecord } from "../utils/validate-wallet-storage";



export class SetInteractiveCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private atomicalId: string,
    private path: string,
    private files: string[],
    private owner: IWalletRecord,
    private funding: IWalletRecord,
    private options: BaseRequestOptions
  ) {

  }
  async run(): Promise<any> {
    logBanner(`Set Interactive`);
    if (!this.path || this.path.trim().length === 0 || typeof this.path !== 'string') {
      throw new Error(`Error: Path must be set and a valid string`)
    }
    // Attach any default data

    let filesData = await prepareFilesDataAsObject(this.files);
    const updatedFilesWithPath = Object.assign({}, filesData, {
      $path: this.path
    });
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
    await atomicalBuilder.setData(updatedFilesWithPath);
    // Add the atomical to update
    const inputUtxoPartial2 = Object.assign({}, inputUtxoPartial, {
      hash: 'f44b6df6312b775cd923d3430bf2f12221072e6aa47dd11467f5a1b9971d24a8'
    })
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