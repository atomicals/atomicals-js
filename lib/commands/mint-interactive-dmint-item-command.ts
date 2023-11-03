import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";
import { AtomicalStatus } from "../interfaces/atomical-status.interface";
import { GetCommand } from "./get-command";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { checkBaseRequestOptions } from "../utils/atomical-format-helpers";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
export interface ResolvedRealm {
  atomical: AtomicalStatus
}
export class MintInteractiveContainerDmintItemCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private container: string,
    private requestDmitem: string,
    private address: string,
    private fundingWIF: string,
    private options: BaseRequestOptions,
  ) {
    this.options = checkBaseRequestOptions(this.options)
    this.container = this.container.startsWith('#') ? this.container.substring(1) : this.container;
  }
  async run(): Promise<any> {
    try {
      detectAddressTypeToScripthash(this.address);
      console.log("Initial mint address:", this.address);
    } catch (ex) {
      console.log('Error validating initial owner address');
      throw ex;
    }
    const getCmd = new GetCommand(this.electrumApi, this.container, AtomicalsGetFetchType.LOCATION);
    const getResponse = await getCmd.run();
    if (getResponse.success && getResponse.data.atomical_id) {
      return {
        success: false,
        msg: 'Error retrieving container parent atomical ' + this.container,
        data: getResponse.data
      }
    }
    console.log('Proceeding to mint with the available container dmint minting rules (if available)...')
    const commandMintWithRules = new MintInteractiveContainerDmintItemCommand(
      this.electrumApi,
      this.requestDmitem,
      getResponse.data.atomical_id,
      this.address,
      this.fundingWIF,
      this.options);
    const commandMintWithRulesResponse = await commandMintWithRules.run();
    if (commandMintWithRulesResponse.success) {
      return {
        success: true,
        data: commandMintWithRulesResponse.data
      }
    } return {
      success: false,
      data: commandMintWithRulesResponse.data
    }
  }
}