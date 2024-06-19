/**
This file was created by the user:
https://github.com/danieleth2/atomicals-js/commit/02e854cc71c0f6c6559ff35c2093dc8d526b5d72
*/
import { parentPort } from "worker_threads";
import { KeyPairInfo, getKeypairInfo } from "./address-keypair-path";
import { script, payments } from "bitcoinjs-lib";
import { BitworkInfo, hasValidBitwork } from "./atomical-format-helpers";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from "ecpair";

const tinysecp: TinySecp256k1Interface = require("tiny-secp256k1");
const bitcoin = require("bitcoinjs-lib");
import * as chalk from "chalk";

bitcoin.initEccLib(ecc);
import { initEccLib, networks, Psbt } from "bitcoinjs-lib";

initEccLib(tinysecp as any);
import {
    AtomTypeOp,
    AtomicalsPayload,
    NETWORK,
    RBF_INPUT_SEQUENCE,
} from "../commands/command-helpers";
import {
    AtomicalOperationBuilderOptions,
    DUST_AMOUNT,
    EXCESSIVE_FEE_LIMIT,
    FeeCalculations,
    MAX_SEQUENCE,
    OUTPUT_BYTES_BASE,
} from "./atomical-operation-builder";
import { Worker } from "worker_threads";
import { ATOMICALS_PROTOCOL_ENVELOPE_ID } from "../types/protocol-tags";
import { chunkBuffer } from "./file-utils";

const ECPair: ECPairAPI = ECPairFactory(tinysecp);

interface WorkerInput {
    copiedData: AtomicalsPayload;
    seqStart: number;
    seqEnd: number;
    workerOptions: AtomicalOperationBuilderOptions;
    fundingWIF: string;
    fundingUtxo: any;
    fees: FeeCalculations;
    performBitworkForCommitTx: boolean;
    workerBitworkInfoCommit: BitworkInfo;
    iscriptP2TR: any;
    ihashLockP2TR: any;
}

// This is the worker's message event listener
if (parentPort) {
    parentPort.on("message", async (message: WorkerInput) => {
        // Extract parameters from the message
        const {
            copiedData,
            seqStart,
            seqEnd,
            workerOptions,
            fundingWIF,
            fundingUtxo,
            fees,
            performBitworkForCommitTx,
            workerBitworkInfoCommit,
            iscriptP2TR,
            ihashLockP2TR,
        } = message;

        let sequence = seqStart;
        let workerPerformBitworkForCommitTx = performBitworkForCommitTx;
        let scriptP2TR = iscriptP2TR;
        let hashLockP2TR = ihashLockP2TR;

        const fundingKeypairRaw = ECPair.fromWIF(fundingWIF);
        const fundingKeypair = getKeypairInfo(fundingKeypairRaw);

        copiedData["args"]["time"] = Math.floor(Date.now() / 1000);

        let atomPayload = new AtomicalsPayload(copiedData);

        let updatedBaseCommit: { scriptP2TR; hashLockP2TR; hashscript } =
            workerPrepareCommitRevealConfig(
                workerOptions.opType,
                fundingKeypair,
                atomPayload
            );

        const tabInternalKey = Buffer.from(
            fundingKeypair.childNodeXOnlyPubkey as number[]
        );
        const witnessUtxo = {
            value: fundingUtxo.value,
            script: Buffer.from(fundingKeypair.output, "hex"),
        };

        const totalInputsValue = fundingUtxo.value;
        const totalOutputsValue = getOutputValueForCommit(fees);
        const calculatedFee = totalInputsValue - totalOutputsValue;

        let needChangeFeeOutput = false;
        // In order to keep the fee-rate unchanged, we should add extra fee for the new added change output.
        const expectedFee =
            fees.commitFeeOnly +
            (workerOptions.satsbyte as any) * OUTPUT_BYTES_BASE;
        const differenceBetweenCalculatedAndExpected =
            calculatedFee - expectedFee;
        if (
            calculatedFee > 0 &&
            differenceBetweenCalculatedAndExpected > 0 &&
            differenceBetweenCalculatedAndExpected >= DUST_AMOUNT
        ) {
            // There were some excess satoshis, but let's verify that it meets the dust threshold to make change
            needChangeFeeOutput = true;
        }

        let prelimTx;
        let fixedOutput = {
            address: updatedBaseCommit.scriptP2TR.address,
            value: getOutputValueForCommit(fees),
        };
        let finalCopyData, finalPrelimTx;

        let lastGenerated = 0;
        let generated = 0;
        let lastTime = Date.now();

        // Start mining loop, terminates when a valid proof of work is found or stopped manually
        do {
            // If the sequence has exceeded the max sequence allowed, generate a newtime and reset the sequence until we find one.
            if (sequence > seqEnd) {
                copiedData["args"]["time"] = Math.floor(Date.now() / 1000);

                atomPayload = new AtomicalsPayload(copiedData);
                const newBaseCommit: { scriptP2TR; hashLockP2TR; hashscript } =
                    workerPrepareCommitRevealConfig(
                        workerOptions.opType,
                        fundingKeypair,
                        atomPayload
                    );
                updatedBaseCommit = newBaseCommit;
                fixedOutput = {
                    address: updatedBaseCommit.scriptP2TR.address,
                    value: getOutputValueForCommit(fees),
                };

                sequence = seqStart;
            }
            if (sequence % 10000 == 0) {
                console.log(
                    "Started mining for sequence: " +
                        sequence +
                        " - " +
                        Math.min(sequence + 10000, MAX_SEQUENCE)
                );
            }

            // Create a new PSBT (Partially Signed Bitcoin Transaction)
            let psbtStart = new Psbt({ network: NETWORK });
            psbtStart.setVersion(1);

            // Add input and output to PSBT
            psbtStart.addInput({
                hash: fundingUtxo.txid,
                index: fundingUtxo.index,
                sequence: sequence,
                tapInternalKey: tabInternalKey,
                witnessUtxo: witnessUtxo,
            });
            psbtStart.addOutput(fixedOutput);

            // Add change output if needed
            if (needChangeFeeOutput) {
                psbtStart.addOutput({
                    address: fundingKeypair.address,
                    value: differenceBetweenCalculatedAndExpected,
                });
            }

            // Extract the transaction and get its ID
            prelimTx = psbtStart.extractTransaction(true);
            const checkTxid = prelimTx.getId();

            // Check if there is a valid proof of work
            if (
                workerPerformBitworkForCommitTx &&
                hasValidBitwork(
                    checkTxid,
                    workerBitworkInfoCommit?.prefix as any,
                    workerBitworkInfoCommit?.ext as any
                )
            ) {
                psbtStart.signInput(0, fundingKeypair.tweakedChildNode);
                psbtStart.finalizeAllInputs();
                prelimTx = psbtStart.extractTransaction();

                // Valid proof of work found, log success message
                console.log(
                    chalk.green(prelimTx.getId(), ` sequence: (${sequence})`)
                );
                console.log(
                    "\nBitwork matches commit txid! ",
                    prelimTx.getId(),
                    `@ time: ${Math.floor(Date.now() / 1000)}`
                );

                finalCopyData = copiedData;
                finalPrelimTx = prelimTx;
                workerPerformBitworkForCommitTx = false;
                break;
            }

            sequence++;
            generated++;

            if (generated % 10000 === 0) {
                const hashRate = ((generated - lastGenerated) / (Date.now() - lastTime)) * 1000;
                console.log(
                    'Hash rate:',
                    hashRate.toFixed(2),
                    'Op/s ',
                );
                lastTime = Date.now();
                lastGenerated = generated;
                await immediate();
            }
        } while (workerPerformBitworkForCommitTx);

        // send a result or message back to the main thread
        console.log(
            "Got one finalCopyData: " + JSON.stringify(finalCopyData)
        );
        console.log(
            "Got one finalPrelimTx: " + finalPrelimTx.toString()
        );
        console.log("Got one finalSequence: " + JSON.stringify(sequence));

        parentPort!.postMessage({
            finalCopyData,
            finalSequence: sequence,
        });
    });
}

function getOutputValueForCommit(fees: FeeCalculations): number {
    let sum = 0;
    // Note that `Additional inputs` refers to the additional inputs in a reveal tx.
    return fees.revealFeePlusOutputs - sum;
}

function addCommitChangeOutputIfRequired(
    extraInputValue: number,
    fee: FeeCalculations,
    pbst: any,
    address: string,
    satsbyte: any
) {
    const totalInputsValue = extraInputValue;
    const totalOutputsValue = getOutputValueForCommit(fee);
    const calculatedFee = totalInputsValue - totalOutputsValue;
    // It will be invalid, but at least we know we don't need to add change
    if (calculatedFee <= 0) {
        return;
    }
    // In order to keep the fee-rate unchanged, we should add extra fee for the new added change output.
    const expectedFee =
        fee.commitFeeOnly + (satsbyte as any) * OUTPUT_BYTES_BASE;
    const differenceBetweenCalculatedAndExpected = calculatedFee - expectedFee;
    if (differenceBetweenCalculatedAndExpected <= 0) {
        return;
    }
    // There were some excess satoshis, but let's verify that it meets the dust threshold to make change
    if (differenceBetweenCalculatedAndExpected >= DUST_AMOUNT) {
        pbst.addOutput({
            address: address,
            value: differenceBetweenCalculatedAndExpected,
        });
    }
}

export const workerPrepareCommitRevealConfig = (
    opType: AtomTypeOp,
    keypair: KeyPairInfo,
    atomicalsPayload: AtomicalsPayload,
    log = true
) => {
    const revealScript = appendMintUpdateRevealScript(
        opType,
        keypair,
        atomicalsPayload,
        log
    );
    const hashscript = script.fromASM(revealScript);
    const scriptTree = {
        output: hashscript,
    };
    const hash_lock_script = hashscript;
    const hashLockRedeem = {
        output: hash_lock_script,
        redeemVersion: 192,
    };
    const buffer = Buffer.from(keypair.childNodeXOnlyPubkey);
    const scriptP2TR = payments.p2tr({
        internalPubkey: buffer,
        scriptTree,
        network: NETWORK,
    });

    const hashLockP2TR = payments.p2tr({
        internalPubkey: buffer,
        scriptTree,
        redeem: hashLockRedeem,
        network: NETWORK,
    });
    return {
        scriptP2TR,
        hashLockP2TR,
        hashscript,
    };
};

export const appendMintUpdateRevealScript = (
    opType: AtomTypeOp,
    keypair: KeyPairInfo,
    payload: AtomicalsPayload,
    log: boolean = true
) => {
    let ops = `${keypair.childNodeXOnlyPubkey.toString(
        "hex"
    )} OP_CHECKSIG OP_0 OP_IF `;
    ops += `${Buffer.from(ATOMICALS_PROTOCOL_ENVELOPE_ID, "utf8").toString(
        "hex"
    )}`;
    ops += ` ${Buffer.from(opType, "utf8").toString("hex")}`;
    const chunks = chunkBuffer(payload.cbor(), 520);
    for (let chunk of chunks) {
        ops += ` ${chunk.toString("hex")}`;
    }
    ops += ` OP_ENDIF`;
    return ops;
};

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function immediate() {
    return new Promise(resolve => setImmediate(resolve));
}
