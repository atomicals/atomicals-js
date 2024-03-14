import { parentPort } from "worker_threads";
import { KeyPairInfo, getKeypairInfo } from "./address-keypair-path";
import { script, payments } from "bitcoinjs-lib";
import { BitworkInfo, hasValidBitwork } from "./atomical-format-helpers";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from "ecpair";

const tinysecp: TinySecp256k1Interface = ecc;
const bitcoin = require("bitcoinjs-lib");
import * as chalk from "chalk";

bitcoin.initEccLib(ecc);
import { initEccLib, networks, Psbt } from "bitcoinjs-lib";

initEccLib(tinysecp as any);
import {
    AtomicalsPayload,
    NETWORK,
    RBF_INPUT_SEQUENCE,
} from "../commands/command-helpers";
import {
    AtomicalOperationBuilderOptions,
    DUST_AMOUNT,
    FeeCalculations,
    MAX_SEQUENCE,
    SEQ_RANGE_BUCKET,
    OUTPUT_BYTES_BASE,
    ParentInputAtomical,
} from "./atomical-operation-builder";
import { ATOMICALS_PROTOCOL_ENVELOPE_ID } from "../types/protocol-tags";
import { chunkBuffer } from "./file-utils";
import { witnessStackToScriptWitness } from "../commands/witness_stack_to_script_witness";
import { IInputUtxoPartial } from "../types/UTXO.interface";

const ECPair: ECPairAPI = ECPairFactory(tinysecp);

interface RevealerInput {
    copiedData: AtomicalsPayload;
    seqStart: number;
    seqEnd: number;
    revealerOptions: AtomicalOperationBuilderOptions;
    fundingWIF: string;
    utxoOfCommitAddress: any;
    fees: FeeCalculations;
    performBitworkForRevealTx: boolean;
    revealerBitworkInfoReveal: BitworkInfo;
    revealerInputUtxos: Array<{
        utxo: IInputUtxoPartial;
        keypairInfo: KeyPairInfo;
    }>;
    revealerAdditionalOutputs: Array<{
        address: string;
        value: number;
    }>;
    parentAtomicalInfo: ParentInputAtomical | null | any;
    scriptP2TR: any;
    hashLockP2TR: any;
}

// This is the revealer's message event listener
if (parentPort) {
    parentPort.on("message", async (message: RevealerInput) => {
        // Extract parameters from the message
        const {
            copiedData,
            seqStart,
            seqEnd,
            revealerOptions,
            fundingWIF,
            utxoOfCommitAddress,
            fees,
            performBitworkForRevealTx,
            revealerBitworkInfoReveal,
            revealerInputUtxos,
            revealerAdditionalOutputs,
            parentAtomicalInfo,
            scriptP2TR,
            hashLockP2TR,
        } = message;

        let newSeqStart = seqStart;
        let newSeqEnd = seqEnd;
        let sequence = newSeqStart;
        let revealerPerformBitworkForRevealTx = performBitworkForRevealTx;

        const fundingKeypairRaw = ECPair.fromWIF(fundingWIF);
        const fundingKeypair = getKeypairInfo(fundingKeypairRaw);

        let atomPayload = new AtomicalsPayload(copiedData);

        let updatedBaseReveal: { scriptP2TR; hashLockP2TR; hashscript } =
            revealerPrepareCommitRevealConfig(
                revealerOptions.opType,
                fundingKeypair,
                atomPayload
            );

        const tapLeafScript = {
            leafVersion: updatedBaseReveal.hashLockP2TR.redeem.redeemVersion,
            script: updatedBaseReveal.hashLockP2TR.redeem.output,
            controlBlock:
                updatedBaseReveal.hashLockP2TR.witness![
                    updatedBaseReveal.hashLockP2TR.witness!.length - 1
                ],
        };

        let unixtime = Math.floor(Date.now() / 1000);
        let noncesGenerated = 0;
        let finalCopyData, solutionPrelimTx, solutionTime, solutionSequence;

        // Start mining loop, terminates when a valid proof of work is found or stopped manually
        do {
            // Introduce a minor delay to avoid overloading the CPU
            await sleep(0);

            // This revealer has tried all assigned sequence range but it did not find solution.
            if (sequence > newSeqEnd) {
                if (newSeqEnd <= MAX_SEQUENCE - SEQ_RANGE_BUCKET) {
                    newSeqStart += SEQ_RANGE_BUCKET;
                    newSeqEnd += SEQ_RANGE_BUCKET;
                    sequence = newSeqStart;
                } else {
                    // revealer stop mining w/o solution found
                    solutionSequence = -1;
                }
            }
            if (sequence % 10000 == 0) {
                console.log(
                    "Started reveal mining for sequence: " +
                        sequence +
                        " - " +
                        Math.min(sequence + 10000, newSeqEnd)
                );
            }

            let totalInputsforReveal = 0; // We calculate the total inputs for the reveal to determine to make change output or not
            let totalOutputsForReveal = 0; // Calculate total outputs for the reveal and compare to totalInputsforReveal and reveal fee
            // Create a new PSBT (Partially Signed Bitcoin Transaction)
            let psbtStart = new Psbt({ network: NETWORK });
            psbtStart.setVersion(1);

            psbtStart.addInput({
                sequence: revealerOptions.rbf ? RBF_INPUT_SEQUENCE : undefined,
                hash: utxoOfCommitAddress.txid,
                index: utxoOfCommitAddress.vout,
                witnessUtxo: {
                    value: utxoOfCommitAddress.value,
                    script: updatedBaseReveal.hashLockP2TR.output!,
                },
                tapLeafScript: [tapLeafScript],
            });
            totalInputsforReveal += utxoOfCommitAddress.value;

            // Add any additional inputs that were assigned
            for (const additionalInput of revealerInputUtxos) {
                psbtStart.addInput({
                    sequence: revealerOptions.rbf
                        ? RBF_INPUT_SEQUENCE
                        : undefined,
                    hash: additionalInput.utxo.hash,
                    index: additionalInput.utxo.index,
                    witnessUtxo: additionalInput.utxo.witnessUtxo,
                    tapInternalKey:
                        additionalInput.keypairInfo.childNodeXOnlyPubkey,
                });
                totalInputsforReveal += additionalInput.utxo.witnessUtxo.value;
            }

            // Note, we do not assign any outputs by default.
            // The caller must decide how many outputs to assign always
            // The reason is the caller knows the context to create them in
            // Add any additional outputs that were assigned
            for (const additionalOutput of revealerAdditionalOutputs) {
                psbtStart.addOutput({
                    address: additionalOutput.address,
                    value: additionalOutput.value,
                });
                totalOutputsForReveal += additionalOutput.value;
            }

            if (parentAtomicalInfo) {
                psbtStart.addInput({
                    sequence: revealerOptions.rbf
                        ? RBF_INPUT_SEQUENCE
                        : undefined,
                    hash: parentAtomicalInfo.parentUtxoPartial.hash,
                    index: parentAtomicalInfo.parentUtxoPartial.index,
                    witnessUtxo:
                        parentAtomicalInfo.parentUtxoPartial.witnessUtxo,
                    tapInternalKey:
                        parentAtomicalInfo.parentKeyInfo.childNodeXOnlyPubkey,
                });
                totalInputsforReveal +=
                    parentAtomicalInfo.parentUtxoPartial.witnessUtxo.value;
                psbtStart.addOutput({
                    address: parentAtomicalInfo.parentKeyInfo.address,
                    value: parentAtomicalInfo.parentUtxoPartial.witnessUtxo
                        .value,
                });
                totalOutputsForReveal +=
                    parentAtomicalInfo.parentUtxoPartial.witnessUtxo.value;
            }

            if (noncesGenerated % 10000 == 0) {
                unixtime = Math.floor(Date.now() / 1000);
            }
            const data = Buffer.from(unixtime + ":" + sequence, "utf8");
            const embed = bitcoin.payments.embed({ data: [data] });

            if (performBitworkForRevealTx) {
                psbtStart.addOutput({
                    script: embed.output!,
                    value: 0,
                });
            }
            addRevealOutputIfChangeRequired(
                totalInputsforReveal,
                totalOutputsForReveal,
                fees.revealFeeOnly,
                psbtStart,
                fundingKeypair.address,
                revealerOptions.satsbyte
            );

            psbtStart.signInput(0, fundingKeypair.childNode);
            // Sign all the additional inputs, if there were any
            let signInputIndex = 1;
            for (const additionalInput of revealerInputUtxos) {
                psbtStart.signInput(
                    signInputIndex,
                    additionalInput.keypairInfo.tweakedChildNode
                );
                signInputIndex++;
            }
            if (parentAtomicalInfo) {
                console.log("parentAtomicalInfo", parentAtomicalInfo);
                psbtStart.signInput(
                    signInputIndex,
                    parentAtomicalInfo.parentKeyInfo.tweakedChildNode
                );
            }
            // We have to construct our witness script in a custom finalizer
            const customFinalizer = (_inputIndex: number, input: any) => {
                const scriptSolution = [input.tapScriptSig[0].signature];
                const witness = scriptSolution
                    .concat(tapLeafScript.script)
                    .concat(tapLeafScript.controlBlock);
                return {
                    finalScriptWitness: witnessStackToScriptWitness(witness),
                };
            };
            psbtStart.finalizeInput(0, customFinalizer);
            // Finalize all the additional inputs, if there were any
            let finalizeInputIndex = 1;
            for (
                ;
                finalizeInputIndex <= revealerInputUtxos.length;
                finalizeInputIndex++
            ) {
                psbtStart.finalizeInput(finalizeInputIndex);
            }
            if (parentAtomicalInfo) {
                psbtStart.finalizeInput(finalizeInputIndex);
            }

            const prelimTx = psbtStart.extractTransaction();
            const checkTxid = prelimTx.getId();
            if (
                hasValidBitwork(
                    checkTxid,
                    revealerBitworkInfoReveal?.prefix as any,
                    revealerBitworkInfoReveal?.ext as any
                )
            ) {
                // Valid proof of work found, log success message
                console.log(
                    chalk.green(prelimTx.getId(), ` sequence: (${sequence})`)
                );
                console.log(
                    "\nBitwork matches reveal txid! ",
                    prelimTx.getId(),
                    `@ time: ${Math.floor(Date.now() / 1000)}`
                );

                finalCopyData = copiedData;
                solutionPrelimTx = prelimTx;
                solutionTime = unixtime;
                solutionSequence = sequence;
                revealerPerformBitworkForRevealTx = false;
                break;
            }

            sequence++;
            noncesGenerated++;
        } while (revealerPerformBitworkForRevealTx);

        if (solutionSequence && solutionSequence != -1) {
            // send a result or message back to the main thread
            console.log(
                "got one finalCopyData:" + JSON.stringify(finalCopyData)
            );
            console.log(
                "got one solutionPrelimTx:" + JSON.stringify(solutionPrelimTx)
            );
            console.log(
                "got one solutionSequence:" + JSON.stringify(solutionSequence)
            );

            parentPort!.postMessage({
                finalCopyData,
                solutionTime,
                solutionSequence,
            });
        }
    });
}

/**
 * Adds an extra output at the end if it was detected there would be excess satoshis for the reveal transaction
 * @param fee Fee calculations
 * @returns
 */
function addRevealOutputIfChangeRequired(
    totalInputsValue: number,
    totalOutputsValue: number,
    revealFee: number,
    psbt: any,
    address: string,
    satsbyte: any
) {
    const currentSatoshisFeePlanned = totalInputsValue - totalOutputsValue;
    // It will be invalid, but at least we know we don't need to add change
    if (currentSatoshisFeePlanned <= 0) {
        return;
    }
    // In order to keep the fee-rate unchanged, we should add extra fee for the new added change output.
    const excessSatoshisFound =
        currentSatoshisFeePlanned -
        revealFee -
        (satsbyte as any) * OUTPUT_BYTES_BASE;
    // There were no excess satoshis, therefore no change is due
    if (excessSatoshisFound <= 0) {
        return;
    }
    // There were some excess satoshis, but let's verify that it meets the dust threshold to make change
    if (excessSatoshisFound >= DUST_AMOUNT) {
        psbt.addOutput({
            address: address,
            value: excessSatoshisFound,
        });
    }
}

export const revealerPrepareCommitRevealConfig = (
    opType:
        | "nft"
        | "ft"
        | "dft"
        | "dmt"
        | "sl"
        | "x"
        | "y"
        | "mod"
        | "evt"
        | "dat",
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
    opType:
        | "nft"
        | "ft"
        | "dft"
        | "dmt"
        | "sl"
        | "x"
        | "y"
        | "mod"
        | "evt"
        | "dat",
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
