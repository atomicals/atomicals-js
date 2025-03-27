import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
const bitcoinMessage = require('bitcoinjs-message')
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { checkBaseRequestOptions } from "../utils/atomical-format-helpers";
import { jsonFileReader } from "../utils/file-utils";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { GetByProtocolCommand } from "./get-by-protocol-command";
import { NETWORK, readFileAsCompleteDataObject, readJsonFileAsCompleteDataObjectEncodeAtomicalIds, readJsonFileAsCompleteDataObjectEncodeFields, readJsonFileAsCompleteDataObjectEncodeHash } from "./command-helpers";
import { GetByContractCommand } from "./get-by-contract-command";
import { IWalletRecord } from "../utils/validate-wallet-storage";
import { witnessStackToScriptWitness } from "./witness_stack_to_script_witness";
import { getKeypairInfo, KeyPairInfo } from "../utils/address-keypair-path";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const crypto = require("crypto");
const eccrypto = require("eccrypto");


export interface ICallDetails {
  contractName: string;
  methodNumber: number;
};

export class CallInteractiveContractCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private callFile: string,
    private auth: IWalletRecord,
    private funding: IWalletRecord,
  ) {
    this.options = checkBaseRequestOptions(this.options)
  }

  validateCallDataFormat(callData) {
    if (!callData['u'] || !callData['auth'] || !callData['n']) {
      return false;
    }
    return true;
  }

  async run(): Promise<any> {
    let callData = await readJsonFileAsCompleteDataObjectEncodeAtomicalIds(this.callFile, false);
    callData['auth'] = this.auth.publicKey;
    const success = this.validateCallDataFormat(callData);
    if (!success) {
      console.log('callData', callData);
      throw new Error('Call data format requires fields n, u and auth')
    }
    const contractName = callData['n'];
    callData['u'] = Buffer.from(callData['u'], 'hex');

    console.log("====================================================================")
    console.log("Call Contract Interactive")
    console.log("====================================================================")

    // Get the contract
    const getContractCommand = new GetByContractCommand(this.electrumApi, contractName, AtomicalsGetFetchType.GET);
    const getContractCommandResult = await getContractCommand.run();
    if (!getContractCommandResult.success || !getContractCommandResult.data || !getContractCommandResult.data.result || !getContractCommandResult.data.result.atomical_id) {
      throw 'Unknown contract name';
    }
    const protocolName = getContractCommandResult.data.result['$instance_of_protocol'];
    const getProtocolCommand = new GetByProtocolCommand(this.electrumApi, protocolName, AtomicalsGetFetchType.GET);
    const getProtocolCommandResult = await getProtocolCommand.run();
    if (!getProtocolCommandResult.success || !getProtocolCommandResult.data || !getProtocolCommandResult.data.result || !getProtocolCommandResult.data.result.atomical_id) {
      throw 'Unknown protocol instance name';
    }
    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      rbf: this.options.rbf,
      satsbyte: this.options.satsbyte,
      address: this.funding.address,
      disableMiningChalk: this.options.disableMiningChalk,
      opType: 'c',
      nftOptions: {
        satsoutput: this.options.satsoutput as any
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });
    atomicalBuilder.setBitworkCommit(this.options.bitworkc || "a");
    await atomicalBuilder.setData(callData);
    const protocolLockCodeHex = getProtocolCommandResult.data.result['mint_data']['fields']['code']['$b'];
    atomicalBuilder.setBeforeRevealSignCallback(async (commitUtxo: any, psbt: any) => {
      callData['n'] = Buffer.from(callData['n'], 'utf8');
      callData['u'] = Buffer.from(callData['u'], 'hex');
      let outputVectorsHex = '';
      for (const output of psbt.txOutputs) {
        let numberValue: any = Buffer.allocUnsafe(8);
        numberValue.writeBigUInt64LE(BigInt(output.value));
        outputVectorsHex += numberValue.toString('hex');
        outputVectorsHex += output.script.toString('hex');
      }
      const signature = await this.makeSig(commitUtxo.txid, commitUtxo.vout, callData['u'], protocolLockCodeHex, outputVectorsHex, this.auth);
      let encodedSigPushData = this.encodePushDataToScript(signature);
      psbt.addOutput({
        script: encodedSigPushData,
        value: 0
      });
    });
    // The receiver output
    atomicalBuilder.addOutput({
      address: this.funding.address,
      value: this.options.satsoutput as any || 1000
    });
    const result = await atomicalBuilder.start(this.funding.WIF);
    return {
      success: true,
      data: result
    }
  }

  async makeSig(txid: string, index: number, unlockScript, lockScript, outputVectorsHex, auth: IWalletRecord) {
    let hexAuthMessage: any = (Buffer.from(txid, 'hex').reverse()).toString('hex');
    let numberValue: any = Buffer.allocUnsafe(4);
    numberValue.writeUint32LE(index);
    hexAuthMessage += numberValue.toString('hex');
    hexAuthMessage += unlockScript.toString('hex');
    hexAuthMessage += lockScript;
    hexAuthMessage += outputVectorsHex;
    console.log('authMessage', hexAuthMessage)
    const keyPair = ECPair.fromWIF(auth.WIF)
    const privateKey = keyPair.privateKey;
    const publicKey = eccrypto.getPublic(keyPair.privateKey);
    const buf = Buffer.from(hexAuthMessage, 'hex')
    // Always hash you message to sign!
    const msg = crypto.createHash("sha256").update(buf).digest();
    const signature = await eccrypto.sign(privateKey, msg).then(async (sig) => {
      console.log("Signature in DER format (hex):", sig.toString('hex'))
      return await eccrypto.verify(publicKey, msg, sig).then(function () {
        return sig;
      })
    });
    return signature;
  }
  encodePushDataToScript(sig) {
    const hashscript = bitcoin.script.fromASM('OP_RETURN ' + Buffer.from('sig', 'utf8').toString('hex') + ' ' + sig.toString('hex'));
    return hashscript;
  }
}
