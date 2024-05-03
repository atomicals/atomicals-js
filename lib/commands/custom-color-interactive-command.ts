import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
import * as readline from 'readline';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { logBanner } from "./command-helpers";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { IWalletRecord } from "../utils/validate-wallet-storage";
import { GetAtomicalsAtLocationCommand } from "./get-atomicals-at-location-command";
import { GetUtxoPartialFromLocation } from "../utils/address-helpers";
import { IInputUtxoPartial } from "../types/UTXO.interface";
import { hasAtomicalType, isAtomicalId } from "../utils/atomical-format-helpers";

const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);


export class customColorInteractiveCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private locationId: string,
    private owner: IWalletRecord,
    private funding: IWalletRecord,
  ) {
  }
  async run(): Promise<any> {
    logBanner(`Custom color FTs Interactive`);
    const command: CommandInterface = new GetAtomicalsAtLocationCommand(this.electrumApi, this.locationId);
    const response: any = await command.run();
    if (!response || !response.success) {
      throw new Error(response);
    }
    const atomicals = response.data.atomicals;

    const hasNfts = hasAtomicalType('NFT', atomicals);
    if (hasNfts) {
      console.log('Found at least one NFT at the same location. The first output will contain the NFTs, and the second output, etc will contain the FTs split out. After you may use the splat command to separate multiple NFTs if they exist at the same location.')
    }

    const inputUtxoPartial: IInputUtxoPartial | any = GetUtxoPartialFromLocation(this.owner.address, response.data.location_info);
    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      rbf: this.options.rbf,
      satsbyte: this.options.satsbyte,
      address: this.owner.address,
      disableMiningChalk: this.options.disableMiningChalk,
      opType: 'z',
      skipOptions: {
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });

    // Add the owner of the atomicals at the location
    atomicalBuilder.addInputUtxo(inputUtxoPartial, this.owner.WIF)
    const atomicalsToColored: any = {}
    let index = 0;
    for (const atomical of atomicals) {
      if (!atomical.atomical_id) {
        throw new Error('Critical error atomical_id not set for FT');
      }
      if (!isAtomicalId(atomical.atomical_id)) {
        throw new Error('Critical error atomical_id is not valid for FT');
      }

      console.log('-')
      console.log(`current atomical_id: ${atomical.atomical_id}`)
      
      const outputs: {} = await this.promptCustomColored(index, atomical.value);

      // Make sure to make N outputs, for each atomical NFT
      atomicalsToColored[atomical.atomical_id] = outputs;
      for (const [key, value] of Object.entries(outputs)) {
        let atomical_value: number = value as number;
        if (atomical_value < 546 && atomical_value > 0) {
          atomical_value = 546
        }
        if (atomical_value == 0) {
          continue
        }
        atomicalBuilder.addOutput({
          address: inputUtxoPartial.address,
          value: atomical_value
        });
        index += 1;
      }
    }
    await atomicalBuilder.setData(atomicalsToColored);
    console.log(atomicalBuilder);
    await this.promptContinue();
    const result = await atomicalBuilder.start(this.funding.WIF);
    return {
      success: true,
      data: result
    }
  }

  async promptCustomColored(index, availableBalance): Promise<{}> {
    let remainingBalance = availableBalance;
    const atomicalColored = {};
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));
      while (remainingBalance > 0) {
        console.log('-')
        console.log(`Remaining amount: ${remainingBalance}`)

        const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));
        let reply = (await prompt("Current outputs uxto index is " + index + ", Please enter amount you want to separated: ") as any);

        console.log('--------');
        if (reply === 'f') {
          break;
        }
        const valuePart = parseInt(reply, 10);

        if (valuePart < 0 || !valuePart) {
          console.log('Invalid value, minimum: 1')
          continue;
        }

        if (remainingBalance - valuePart < 0) {
          console.log('Invalid value, maximum remaining: ' + remainingBalance);
          continue;
        }

        atomicalColored[index] = valuePart;
        remainingBalance -= valuePart;
        index += 1;
      }
      if (remainingBalance > 0) {
        throw new Error('Remaining balance was not 0')
      }
      console.log('Successfully allocated entire available amounts to recipients...')
      return atomicalColored;
    } finally {
      rl.close();
    }
  }

  async promptContinue() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      let reply: string = '';
      const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

      reply = (await prompt("Does everything look good above? To continue type 'y' or 'yes': ") as any);

      if (reply === 'y' || reply === 'yes') {
        return;
      }
      throw 'Aborted';
    } finally {
      rl.close();
    }
  }
}
