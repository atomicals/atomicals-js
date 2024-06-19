import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
import * as readline from 'readline';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import * as qrcode from 'qrcode-terminal';
import {
  initEccLib,
  networks,
} from "bitcoinjs-lib";

import { jsonFileWriter } from "../utils/file-utils";
import { detectAddressTypeToScripthash, performAddressAliasReplacement } from "../utils/address-helpers";
import { toXOnly } from "../utils/create-key-pair";
import { getKeypairInfo, KeyPairInfo } from "../utils/address-keypair-path";
import { NETWORK, RBF_INPUT_SEQUENCE, calculateUtxoFundsRequired, logBanner, readJsonFileAsCompleteDataObjectEncodeAtomicalIds, readJsonFileAsCompleteDataObjectEncodeBMarkers } from "./command-helpers";
import { onlyUnique } from "../utils/utils";
import { IValidatedWalletInfo, IWalletRecord } from "../utils/validate-wallet-storage";
import { compactIdToOutpoint, isAtomicalId } from "../utils/atomical-format-helpers";
import { ATOMICALS_PROTOCOL_ENVELOPE_ID } from "../types/protocol-tags";
import { BaseRequestOptions } from "../interfaces/api.interface";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);


export interface IUtxoBalanceSummary {
  utxos: any[];
}

export interface ISelectedUtxo {
  txid: string;
  index: number;
  value: number;
  script: any;
  atomicals: string[];
}

export interface AmountToSend {
  address?: string;
  opReturn?: string;
  value: number;
}

export interface IBalanceInfo {
  utxos: Array<{
    txid: string;
    script: any;
    value: number;
    index: number;
  }>;
}

export interface TransferConfigInterface {
  balanceInfo: IBalanceInfo;
  selectedUtxos: ISelectedUtxo[];
  outputs: Array<AmountToSend>
}

export class CallContractInteractiveCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private callFile: string,
    private useOpreturn: boolean,
    private identity: IWalletRecord,
    private owner: IWalletRecord,
    private funding: IWalletRecord,
    private validatedWalletInfo: IValidatedWalletInfo,
    private nofunding?: boolean,
  ) {
  } 
  
  async run(): Promise<any> {
    let callData = await readJsonFileAsCompleteDataObjectEncodeBMarkers(this.callFile, true, "$b");
    console.log(JSON.stringify(callData, null, 2));
    const keypairIdentity = ECPair.fromWIF(this.identity.WIF);
    const keypairOwner = ECPair.fromWIF(this.owner.WIF);
    const keypairFunding = ECPair.fromWIF(this.funding.WIF);
    const keypairIdentityInfo: KeyPairInfo = getKeypairInfo(keypairIdentity)
    const keypairFundingInfo: KeyPairInfo = getKeypairInfo(keypairFunding)
    const keypairOwnerInfo: KeyPairInfo = getKeypairInfo(keypairOwner)
    console.log("====================================================================")
    console.log("Call Contract Interactive")
    console.log("====================================================================")
    const callContractFormatValidation: any = await this.validateCallDataFormat(callData);
    if (!callContractFormatValidation.success) {
      console.log('callData', callData);
      throw new Error('Call validation failed')
    }
    const transferOptions: TransferConfigInterface = await this.promptTransferOptions(keypairOwnerInfo.address);
    const tx = await this.buildCallSendTransaction(transferOptions, keypairIdentityInfo, keypairFundingInfo, this.options.satsbyte);
    return {
      tx
    }
  }

  async validateCallDataFormat(callData) {
    return {
      success: false
    }
  }

  async promptTransferOptions(address: any): Promise<TransferConfigInterface> {
    const balanceInfo: IUtxoBalanceSummary = await this.getUtxoBalanceSummary(address);
    const sumValues = balanceInfo.utxos.reduce((accum, item) => accum + item.value, 0);
    console.log(`Current Owner Address: ${address}`);
    console.log(`Confirmed Balance: `, sumValues);

    if (balanceInfo.utxos.length === 0) {
      throw `No UTXOs available for address ${address}`;
    }

    console.log(`---------------------------------------------------------------------`);
    console.log(`Step 1. Select UTXOs to send`);
    console.log(`---`);
    console.log(`UTXOs Count: `, balanceInfo.utxos.length);
    console.log(`UTXOs: `);
    let i = 0;
    balanceInfo.utxos.map((utxo) => {
      console.log(`${i}.`);
      console.log(JSON.stringify(utxo, null, 2));
      i++;
    });

    const selectedUtxos: ISelectedUtxo[] = await this.promptUtxoSelection(balanceInfo);
    await this.promptIfDetectedSomeAtomicalsAtSameUtxos(selectedUtxos);

    console.log('Selected UTXOs For Sending: ', JSON.stringify(selectedUtxos, null, 2));
    console.log(`---------------------------------------------------------------------`);
    console.log(`Step 2. Enter receive amounts`);
    console.log(`UTXOs Chosen Count: `, selectedUtxos.length);
    const chosenSum = selectedUtxos.reduce((accum, item) => accum + item.value, 0);
    console.log(`UTXOs Chosen Balance: `, chosenSum);
    console.log(`---`);
    const outputs: AmountToSend[] = await this.promptAmountsToSend(this.validatedWalletInfo, chosenSum);

    console.log('Selected UTXOs: ', JSON.stringify(selectedUtxos, null, 2));
    console.log('Recipients: ', JSON.stringify(outputs, null, 2));
    console.log(`---------------------------------------------------------------------`);
    console.log(`Step 3. Confirm and send`);
    await this.promptContinue(balanceInfo, selectedUtxos);

    return {
      balanceInfo,
      selectedUtxos,
      outputs
    }
  }


  async promptIfDetectedSomeAtomicalsAtSameUtxos(selectedUtxos: ISelectedUtxo[]) {
    let isOtherAtomicalsFound = false;
    const indexesOfSelectedUtxosWithMultipleAtomicals: number[] = [];
    for (const utxo of selectedUtxos) {
      if (!utxo.atomicals) {
        continue;
      }
      if (utxo.atomicals.length) {
        isOtherAtomicalsFound = true;
      }
    }

    if (!isOtherAtomicalsFound) {
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      let reply: string = '';
      const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

      console.log(`WARNING! There are some chosen UTXOs which contain Atomicals which would be transferred at the same time.`);
      console.log(`It is recommended to use the "extract" (NFT) or "skip" (FT) operations to seperate them first.`)
      let i = 0;
      for (const item of indexesOfSelectedUtxosWithMultipleAtomicals) {
        console.log(`${i}.`)
        console.log(JSON.stringify(item, null, 2))
        i++;
      }
      reply = (await prompt("To ignore and continue type 'y' or 'n' to cancel: ") as any);

      if (reply === 'y' || reply === 'yes') {
        return;
      }

      if (reply === 'n' || reply === 'no') {
        throw 'Aborted. User cancelled';
      }

      throw 'Aborted';
    } finally {
      rl.close();
    }
  }

  async promptUtxoSelection(info: IUtxoBalanceSummary): Promise<ISelectedUtxo[]> {
    let selectedUtxos: ISelectedUtxo[] = [];


    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      let reply: string = '';
      const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

      while (reply !== 'f') {
        const currentBalance = selectedUtxos.reduce((accum, item) => accum + item.value, 0);
        console.log(`Selected amount: ${currentBalance}`);
        console.log(`Options: '*' for all, or enter specific UTXO number or 'f' for Finished selecting`)
        console.log('-')
        reply = (await prompt("Select which UTXOs to transfer: ") as any);
        switch (reply) {
          case '*':
            return info.utxos;
          case 'f':
            return selectedUtxos;
          default:
            const parsedNum = parseInt(reply, 10);
            if (parsedNum >= info.utxos.length || parsedNum < 0) {
              console.log('Invalid selection. Maximum: ' + (info.utxos.length - 1));
              continue;
            }
            selectedUtxos.push(info.utxos[parsedNum])
            // Filter out dups
            selectedUtxos = selectedUtxos.filter(onlyUnique);
            break;
        }
      }
      return selectedUtxos;
    } finally {
      rl.close();
    }
  }

  async promptContinue(info: IUtxoBalanceSummary, selectedUtxos: ISelectedUtxo[]) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      let reply: string = '';
      const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

      reply = (await prompt("Does everything look good above? To continue funding the transfer type 'y' or 'yes': ") as any);

      if (reply === 'y' || reply === 'yes') {
        return;
      }
      throw 'Aborted';
    } finally {
      rl.close();
    }
  }

  async getUtxoBalanceSummary(address): Promise<IUtxoBalanceSummary> {
    const res = await this.electrumApi.atomicalsByAddress(address);
    const utxosFiltered: any = [];
    for (const utxo of res.utxos) {
      // DO NOT Ignore the utxos which have atomicals in them
      // This builder is meant to be flexible. 
      if (utxo.atomicals && utxo.atomicals.length) {
        // continue;
      }
      utxosFiltered.push({
        txid: utxo.txid,
        index: utxo.index,
        value: utxo.value,
        height: utxo.height,
        atomicals: utxo.atomicals
      });
    }
    return {
      utxos: utxosFiltered
    }
  }

  async promptAmountsToSend(validatedWalletInfo: IValidatedWalletInfo, availableBalance): Promise<AmountToSend[]> {
    let remainingBalance = availableBalance;
    const amountsToSend: AmountToSend[] = []
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

      while (remainingBalance > 0) {
        console.log(`Recipients: `);
        let accumulatd = 0;
        amountsToSend.map((item) => {
          console.log(`${item.address ? item.address : item.opReturn?.toString()}: ${item.value}`);
          accumulatd += item.value;
        })
        if (!amountsToSend.length) {
          console.log('No recipients yet...')
        }
        console.log('-')
        console.log(`Accumulated amount: ${accumulatd}`)
        console.log(`Remaining amount: ${remainingBalance}`)
        console.log(`'f' for Finished adding recipients`)
        console.log('-')

        let reply = (await prompt("Enter address and amount seperated by a space: ") as any);

        if (reply === 'f') {
          break;
        }
        const splitted = reply.split(/[ ,]+/);

        if (splitted[0] === 'op_return') {
          const generalData = Buffer.from(splitted[1], 'utf8')
          const embed = bitcoin.payments.embed({ data: [generalData] });
          const paymentRecieptOpReturn = embed.output!
  
          amountsToSend.push({
            opReturn: paymentRecieptOpReturn,
            value: 0
          });
        } else {

          let addressPart = performAddressAliasReplacement(validatedWalletInfo, splitted[0]);
          const valuePart = parseInt(splitted[1], 10);

          if (valuePart < 546 || !valuePart) {
            console.log('Invalid value, minimum: 546')
            continue;
          }
          if (remainingBalance - valuePart < 0) {
            console.log('Invalid value, maximum remaining: ' + remainingBalance);
            continue;
          }
          try {
            detectAddressTypeToScripthash(addressPart.address);
          } catch (err) {
            console.log('Invalid address')
            continue;
          }
  
          amountsToSend.push({
            address: addressPart.address,
            value: valuePart
          });
          remainingBalance -= valuePart;
        }
      }
      if (!this.nofunding) {
        if (remainingBalance > 0) {
          throw new Error('Remaining balance was not 0')
        }
      }
      console.log('Successfully allocated entire available amounts to recipients...')
      return amountsToSend;
    } finally {
      rl.close();
    }
  }

  async buildCallSendTransaction(transferOptions: TransferConfigInterface, keyPairAtomical: KeyPairInfo, keyPairFunding: KeyPairInfo, satsbyte): Promise<any> {

    const psbt = new bitcoin.Psbt({ network: NETWORK });
    let tokenBalanceIn = 0;
    let tokenBalanceOut = 0;
    let tokenInputsLength = 0;
    let tokenOutputsLength = 0;
    for (const utxo of transferOptions.selectedUtxos) {
      // Add the atomical input, the value from the input counts towards the total satoshi amount required
      const { output } = detectAddressTypeToScripthash(keyPairAtomical.address);
      psbt.addInput({
        sequence: this.options.rbf ? RBF_INPUT_SEQUENCE : undefined,
        hash: utxo.txid,
        index: utxo.index,
        witnessUtxo: { value: utxo.value, script: Buffer.from(output, 'hex') },
        tapInternalKey: keyPairAtomical.childNodeXOnlyPubkey,
      })
      tokenBalanceIn += utxo.value;
      tokenInputsLength++;
    }

    for (const output of transferOptions.outputs) {
      if (output.opReturn) {
        psbt.addOutput({
          value: output.value,
          script: output.opReturn
        });
      } else {
        psbt.addOutput({
          value: output.value,
          address: output.address,
        });
      }
     
      tokenBalanceOut += output.value;
      tokenOutputsLength++;
    }

    /*if (this.atomicalIdReceipt) {
      const outpoint = compactIdToOutpoint(this.atomicalIdReceipt);
      const atomEnvBuf = Buffer.from(ATOMICALS_PROTOCOL_ENVELOPE_ID, 'utf8');
      const payOpBuf = Buffer.from(this.atomicalIdReceiptType || 'p', 'utf8');
      const outpointBuf = Buffer.from(outpoint, 'hex')
      const embed = bitcoin.payments.embed({ data: [atomEnvBuf, payOpBuf, outpointBuf] });
      const paymentRecieptOpReturn = embed.output!
      psbt.addOutput({
        script: paymentRecieptOpReturn,
        value: 0,
      })
    }*/

    if (!this.nofunding) {
      // TODO DETECT THAT THERE NEEDS TO BE CHANGE ADDED AND THEN 
      if (tokenBalanceIn !== tokenBalanceOut) {
        throw 'Invalid input and output does not match for token. Developer Error.'
      }
    }
    const { expectedSatoshisDeposit } = calculateUtxoFundsRequired(transferOptions.selectedUtxos.length, transferOptions.outputs.length, satsbyte, 0);
    if (expectedSatoshisDeposit < 546) {
      throw 'Invalid expectedSatoshisDeposit. Developer Error.'
    }

    logBanner(`DEPOSIT ${expectedSatoshisDeposit / 100000000} BTC to ${keyPairFunding.address}`);
    qrcode.generate(keyPairFunding.address, { small: false });
    console.log(`...`)
    console.log(`...`)
    console.log(`WAITING UNTIL ${expectedSatoshisDeposit / 100000000} BTC RECEIVED AT ${keyPairFunding.address}`)
    console.log(`...`)
    console.log(`...`)
    let utxo = await this.electrumApi.waitUntilUTXO(keyPairFunding.address, expectedSatoshisDeposit, 5, false);
    console.log(`Detected UTXO (${utxo.txid}:${utxo.vout}) with value ${utxo.value} for funding the transfer operation...`);

    let basisValue = 0;
    if (!this.nofunding) {
      // Add the funding input
      psbt.addInput({
        sequence: this.options.rbf ? RBF_INPUT_SEQUENCE : undefined,
        hash: utxo.txid,
        index: utxo.outputIndex,
        witnessUtxo: { value: utxo.value, script: keyPairFunding.output },
        tapInternalKey: keyPairFunding.childNodeXOnlyPubkey,
      })
      basisValue = utxo.value;
    }

    const isMoreThanDustChangeRemaining = basisValue - expectedSatoshisDeposit >= 546;
    if (isMoreThanDustChangeRemaining) {
      // Add change output
      console.log(`Adding change output, remaining: ${basisValue - expectedSatoshisDeposit}`)
      psbt.addOutput({
        value: basisValue - expectedSatoshisDeposit,
        address: keyPairFunding.address,
      })
    }
    let i = 0;
    for (i = 0; i < tokenInputsLength; i++) {
      console.log(`Signing Atomical input ${i}...`)
      psbt.signInput(i, keyPairAtomical.tweakedChildNode)
    }
    // Sign the final funding input
    if (!this.nofunding) {
      console.log('Signing funding input...')
      psbt.signInput(i, keyPairFunding.tweakedChildNode)
    }
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const rawtx = tx.toHex();
    console.log(`Constructed Atomicals FT Transfer, attempting to broadcast: ${tx.getId()}`);
    let broadcastedTxId = await this.electrumApi.broadcast(rawtx);
    console.log(`Success!`);
    return {
      success: true,
      data: { txid: broadcastedTxId }
    }
  }

  accumulateAsc(amount: number, utxos: any[]) {
    const cloned = [...utxos];
    cloned.sort(function (a, b) {
      return a.value - b.value;
    });
    const selectedUtxos: any[] = []
    let remainingAmount = amount;
    for (const utxo of cloned) {
      selectedUtxos.push(utxo);
      remainingAmount -= amount;
      if (remainingAmount <= 0) {
        break;
      }
    }
    return selectedUtxos;
  }

  accumulateDesc(amount: number, utxos: any[]) {
    const cloned = [...utxos];
    cloned.sort(function (a, b) {
      return b.value - a.value;
    });
    const selectedUtxos: any[] = []
    let remainingAmount = amount;
    for (const utxo of cloned) {
      selectedUtxos.push(utxo);
      remainingAmount -= amount;
      if (remainingAmount <= 0) {
        break;
      }
    }
    return selectedUtxos;
  }
}