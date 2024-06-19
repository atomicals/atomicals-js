import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { KeyPairInfo, getKeypairInfo } from "./address-keypair-path";
import * as os from "os";
import {
    BitworkInfo,
    hasValidBitwork,
    isAtomicalId,
    isValidBitworkString,
    isValidContainerName,
    isValidContractName,
    isValidProtocolName,
    isValidRealmName,
    isValidSubRealmName,
    isValidTickerName,
} from "./atomical-format-helpers";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from "ecpair";

const tinysecp: TinySecp256k1Interface = ecc;
const bitcoin = require("bitcoinjs-lib");
import * as chalk from "chalk";

bitcoin.initEccLib(ecc);
import { initEccLib, Psbt } from "bitcoinjs-lib";

initEccLib(tinysecp as any);
import {
    AtomTypeOp,
    AtomicalsPayload,
    NETWORK,
    RBF_INPUT_SEQUENCE,
    calculateFundsRequired,
    getAndCheckAtomicalInfo,
    prepareCommitRevealConfig,
    prepareFilesDataAsObject,
} from "../commands/command-helpers";
import { getFundingUtxo } from "./select-funding-utxo";
import { sleeper } from "./utils";
import { witnessStackToScriptWitness } from "../commands/witness_stack_to_script_witness";
import { IInputUtxoPartial } from "../types/UTXO.interface";
import { IWalletRecord } from "./validate-wallet-storage";
import { parentPort, Worker } from "worker_threads";
import * as readline from 'readline';

const ECPair: ECPairAPI = ECPairFactory(tinysecp);
export const DEFAULT_SATS_BYTE = 10;
const DEFAULT_SATS_ATOMICAL_UTXO = 1000;
const SEND_RETRY_SLEEP_SECONDS = 15;
const SEND_RETRY_ATTEMPTS = 20;
export const DUST_AMOUNT = 546;
export const BASE_BYTES = 10.5;
export const INPUT_BYTES_BASE = 57.5;
export const OUTPUT_BYTES_BASE = 43;
export const EXCESSIVE_FEE_LIMIT: number = 1000000; // Limit to 1/100 of a BTC for now
export const MAX_SEQUENCE = 0xffffffff;
export const avmConst = "brl";
interface WorkerOut {
    finalCopyData: AtomicalsPayload;
    finalSequence: number;
}

export enum REALM_CLAIM_TYPE {
    DIRECT = "direct",
    RULE = "rule",
}

export interface ParentInputAtomical {
    parentId: string;
    parentUtxoPartial: IInputUtxoPartial;
    parentKeyInfo: KeyPairInfo;
}

export interface FeeCalculations {
    commitAndRevealFeePlusOutputs: number;
    commitAndRevealFee: number;
    revealFeePlusOutputs: number;
    commitFeeOnly: number;
    revealFeeOnly: number;
}

function logMiningProgressToConsole(
    dowork: boolean,
    disableMiningChalk,
    txid,
    nonces
) {
    if (!dowork) {
        return;
    }
    if (disableMiningChalk) {
        if (nonces % 10000 === 0) {
            console.log(
                "Generated nonces: ",
                nonces,
                ", time: ",
                Math.floor(Date.now() / 1000)
            );
        }
        return;
    }
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(chalk.red(txid, " nonces: ", nonces));
}

function printBitworkLog(bitworkInfo: BitworkInfo, commit?: boolean) {
    if (!bitworkInfo) {
        return;
    }
    console.log(
        `\nAtomicals Bitwork Mining - Requested bitwork proof-of-work mining for the ${commit ? "commit" : "reveal"
        } transaction.`
    );
    if (commit) {
        console.log(`bitworkc (input): ${bitworkInfo.input_bitwork}`);
        console.log(`bitworkc (decoded): ${bitworkInfo.hex_bitwork}`);
    } else {
        console.log(`bitworkr (input): ${bitworkInfo.input_bitwork}`);
        console.log(`bitworkr (decoded): ${bitworkInfo.hex_bitwork}`);
    }
    console.log(
        `---------\nWARNING: This might take a very long time depending on the speed of the CPU.`
    );
    console.log(`Time to mine estimates: `);
    console.log(
        `- prefix length <= 4: about a minute or two. ~65,536 hashes on average.`
    );
    console.log(
        `- prefix length 5: several minutes. ~1,048,576 hashes on average.`
    );
    console.log(
        `- prefix length 6: up to an hour or more. ~16,777,216 hashes on average.`
    );
    console.log(
        `- prefix length >= 7: a few hours or much longer. >268,435,456 hashes on average.`
    );
    console.log(`\nStarting mining now...\n`);
}

export enum REQUEST_NAME_TYPE {
    NONE = "NONE",
    CONTAINER = "CONTAINER",
    TICKER = "TICKER",
    REALM = "REALM",
    SUBREALM = "SUBREALM",
    ITEM = "ITEM",
    PROTOCOL = "PROTOCOL",
    CONTRACT = "CONTRACT"
}

export interface AtomicalOperationBuilderOptions {
    electrumApi: ElectrumApiInterface;
    rbf?: boolean;
    satsbyte?: number; // satoshis
    address: string;
    opType: AtomTypeOp;
    requestContainerMembership?: string;
    bitworkc?: string;
    bitworkr?: string;
    disableMiningChalk?: boolean;
    meta?: string[] | any;
    init?: string[] | any;
    ctx?: string[] | any;
    verbose?: boolean;
    nftOptions?: {
        satsoutput: number;
    };
    datOptions?: {
        satsoutput: number;
    };
    ftOptions?: {
        fixedSupply: number;
        ticker: string;
    };
    dftOptions?: {
        maxMints: number;
        mintAmount: number;
        mintHeight: number;
        ticker: string;
        mintBitworkr?: string;
    };
    dmtOptions?: {
        mintAmount: number;
        ticker: string;
    };
    skipOptions?: {};
    splatOptions?: {
        satsoutput: number;
    };
}

export class AtomicalOperationBuilder {
    private userDefinedData: AtomicalsPayload | null = null;
    private containerMembership: string | null = null;
    private bitworkInfoCommit: BitworkInfo | null = null;
    private bitworkInfoReveal: BitworkInfo | null = null;
    private requestName: string | null = null;
    private requestParentId: string | null = null;
    private requestProtocolName?: string;
    private requestNameType: REQUEST_NAME_TYPE = REQUEST_NAME_TYPE.NONE;
    private meta: any = {};
    private args: any = {};
    private init: any = {};
    private ctx: any = {};
    private parentInputAtomical: ParentInputAtomical | null = null;
    private inputUtxos: Array<{
        utxo: IInputUtxoPartial;
        keypairInfo: KeyPairInfo;
    }> = [];
    private additionalOutputs: Array<{
        address: string;
        value: number;
    }> = [];

    constructor(private options: AtomicalOperationBuilderOptions) {
        if (!this.options) {
            throw new Error("Options required");
        }
        if (!this.options.electrumApi) {
            throw new Error("electrumApi required");
        }
        if (!this.options.satsbyte) {
            this.options.satsbyte = DEFAULT_SATS_BYTE;
        }
        if (this.options.opType === "nft") {
            if (!this.options.nftOptions) {
                throw new Error("nftOptions required for nft type");
            }
        }
        if (this.options.opType === "ft") {
            if (!this.options.ftOptions) {
                throw new Error("ftOptions required for ft type");
            }
        }
        if (this.options.opType === "dft") {
            if (!this.options.dftOptions) {
                throw new Error("dftOptions required for dft type");
            }
        }
        if (this.options.opType === "dmt") {
            if (!this.options.dmtOptions) {
                throw new Error("dmtOptions required for dmt type");
            }
        }
    }

    setRBF(value: boolean) {
        this.options.rbf = value;
    }

    setRequestContainer(name: string) {
        if (this.options.opType !== "nft") {
            throw new Error(
                "setRequestContainer can only be set for NFT types"
            );
        }
        const trimmed = name.startsWith("#") ? name.substring(1) : name;
        isValidContainerName(name);
        this.requestName = trimmed;
        this.requestNameType = REQUEST_NAME_TYPE.CONTAINER;
        this.requestParentId = null;
    }

    setRequestRealm(name: string) {
        if (this.options.opType !== "nft") {
            throw new Error("setRequestRealm can only be set for NFT types");
        }
        const trimmed = name.startsWith("+") ? name.substring(1) : name;
        isValidRealmName(name);
        this.requestName = trimmed;
        this.requestNameType = REQUEST_NAME_TYPE.REALM;
        this.requestParentId = null;
    }

    setRequestProtocol(name: string) {
        if (this.options.opType !== "def") {
            throw new Error("setRequestProtocol needs opType to be 'avm'");
        }
        isValidProtocolName(name);
        this.requestName = name;
        this.requestNameType = REQUEST_NAME_TYPE.PROTOCOL;
    }

    setRequestContract(name: string, protocolName: string) {
        if (this.options.opType !== "new") {
            throw new Error("setRequestContract needs opType to be 'avm'");
        }
        isValidContractName(name);
        this.requestName = name;
        this.requestProtocolName = protocolName;
        this.requestNameType = REQUEST_NAME_TYPE.CONTRACT;
    }

    setRequestSubrealm(
        name: string,
        parentRealmId: string,
        realmClaimType: REALM_CLAIM_TYPE
    ) {
        if (this.options.opType !== "nft") {
            throw new Error("setRequestSubrealm can only be set for NFT types");
        }
        if (!isAtomicalId(parentRealmId)) {
            throw new Error("Invalid parent realm atomical id for subrealm");
        }
        if (name.indexOf(".") === -1) {
            throw new Error("Cannot request subrealm for a top level realm");
        }
        const trimmed = name.startsWith("+") ? name.substring(1) : name;
        const splitNames = trimmed.split(".");
        const subrealmFinalPart = splitNames[splitNames.length - 1];
        isValidSubRealmName(subrealmFinalPart);
        this.requestName = subrealmFinalPart;
        this.requestParentId = parentRealmId;
        this.requestNameType = REQUEST_NAME_TYPE.SUBREALM;

        if (realmClaimType === REALM_CLAIM_TYPE.DIRECT) {
            this.setArgs({
                claim_type: "direct",
            });
        } else if (realmClaimType === REALM_CLAIM_TYPE.RULE) {
            this.setArgs({
                claim_type: "rule",
            });
        } else {
            throw new Error("RealmClaimType must be DIRECT or RULE");
        }
    }

    setRequestItem(itemId: string, parentContainerId: string) {
        if (this.options.opType !== "nft") {
            throw new Error("setRequestItem can only be set for NFT types");
        }
        if (!isAtomicalId(parentContainerId)) {
            throw new Error("Invalid parent container atomical id for item");
        }
        this.requestName = itemId;
        this.requestParentId = parentContainerId;
        this.requestNameType = REQUEST_NAME_TYPE.ITEM;
    }

    setRequestTicker(name: string) {
        if (this.options.opType !== "dft" && this.options.opType !== "ft") {
            throw new Error(
                "setRequestTicker can only be set for dft or ft types"
            );
        }
        const trimmed = name.startsWith("$") ? name.substring(1) : name;
        isValidTickerName(trimmed);
        this.requestName = trimmed;
        this.requestNameType = REQUEST_NAME_TYPE.TICKER;
        this.requestParentId = null;
    }

    /**
     * For each array element do:
     *
     * - determine if it's a file, or a file with an alias, or a scalar/json object type
     *
     * @param fieldTypeHints The type hint string array
     */
    static async getDataObjectFromStringTypeHints(fieldTypeHints: string[]) {
        return prepareFilesDataAsObject(fieldTypeHints);
    }

    setData(data: any, log = false) {
        if (!data) {
            return;
        }
        if (typeof data !== "object") {
            throw new Error("Data must be an object");
        }
        /*if (data['args']) {
            throw new Error(`Data cannot have field named 'args' set manually. Use setArgs method.`);
        }*/
        if (data["meta"]) {
            throw new Error(
                `Data cannot have field named 'meta' set manually. Use options config.`
            );
        }
        if (data["ctx"]) {
            throw new Error(
                `Data cannot have field named 'ctx' set manually. Use options config.`
            );
        }
        if (data["init"]) {
            throw new Error(
                `Data cannot have field named 'init' set manually. Use options config.`
            );
        }
        this.userDefinedData = data;
        if (log) {
            console.log("setData", this.userDefinedData);
        }
    }

    setAvmArgs(args: any) {
        this.args = args;
    }

    getData(): any | null {
        return this.userDefinedData;
    }

    setArgs(args: any) {
        this.args = args;
    }

    getArgs(): any {
        return this.args;
    }

    private setInit(init: any) {
        this.init = init;
    }

    getInit(): any {
        return this.init;
    }

    private setMeta(meta: any) {
        this.meta = meta;
    }

    getMeta(): any {
        return this.meta;
    }

    private setCtx(ctx: any) {
        this.ctx = ctx;
    }

    getCtx(): any {
        return this.ctx;
    }

    setContainerMembership(containerName: string | null | undefined) {
        if (!containerName) {
            throw new Error("Empty container name");
        }
        const trimmedContainerName = containerName.startsWith("#")
            ? containerName.substring(1)
            : containerName;
        if (!isValidContainerName(trimmedContainerName)) {
            return;
        }
        this.containerMembership = trimmedContainerName;
    }

    setBitworkCommit(bitworkString: string | undefined) {
        if (!bitworkString) {
            return;
        }
        this.bitworkInfoCommit = isValidBitworkString(bitworkString);
    }

    setBitworkReveal(bitworkString: string | undefined) {
        if (!bitworkString) {
            return;
        }
        this.bitworkInfoReveal = isValidBitworkString(bitworkString);
    }

    /**
     *
     * @param utxoPartial The UTXO to spend in the constructed tx
     * @param wif The signing WIF key for the utxo
     */
    addInputUtxo(utxoPartial: IInputUtxoPartial, wif: string) {
        const keypairInput = ECPair.fromWIF(wif);
        const keypairInputInfo = getKeypairInfo(keypairInput);
        this.inputUtxos.push({
            utxo: utxoPartial,
            keypairInfo: keypairInputInfo,
        });
    }

    /**
     * Set an input parent for linking with $parent reference of the operation to an input spend
     */
    setInputParent(input: ParentInputAtomical) {
        // Validate the parentId is an atomical id in compact form
        if (!isAtomicalId(input.parentId)) {
            throw new Error("Invalid parent atomical id: " + input.parentId);
        }
        this.parentInputAtomical = input;
    }

    private getInputParent(): ParentInputAtomical | null {
        if (!this.parentInputAtomical) {
            return null;
        }
        return this.parentInputAtomical;
    }

    /**
     * Additional output to add, to be used with addInputUtxo normally
     * @param output Output to add
     */
    addOutput(output: { address: string; value: number }) {
        this.additionalOutputs.push(output);
    }

    isEmpty(obj) {
        return Object.keys(obj).length === 0;
    }

    async start(fundingWIF: string): Promise<any> {
        const fundingKeypairRaw = ECPair.fromWIF(fundingWIF);
        const fundingKeypair = getKeypairInfo(fundingKeypairRaw);
        let performBitworkForRevealTx = !!this.bitworkInfoReveal;
        let performBitworkForCommitTx = !!this.bitworkInfoCommit;
        let scriptP2TR: any = null;
        let hashLockP2TR: any = null;

        if (this.options.meta) {
            this.setMeta(
                await AtomicalOperationBuilder.getDataObjectFromStringTypeHints(
                    this.options.meta
                )
            );
        }
        if (this.options.init) {
            this.setInit(
                await AtomicalOperationBuilder.getDataObjectFromStringTypeHints(
                    this.options.init
                )
            );
        }
        if (this.options.ctx) {
            this.setCtx(
                await AtomicalOperationBuilder.getDataObjectFromStringTypeHints(
                    this.options.ctx
                )
            );
        }

        let copiedData = Object.assign({}, this.userDefinedData); //

        if (!this.isEmpty(this.getArgs())) {
            copiedData["args"] = this.getArgs();
        }

        if (!this.isEmpty(this.getCtx())) {
            copiedData["ctx"] = this.getCtx();
        }

        if (!this.isEmpty(this.getMeta())) {
            copiedData["meta"] = this.getMeta();
        }

        if (!this.isEmpty(this.getInit())) {
            copiedData["init"] = this.getInit();
        }

        // If it's a container membership request, add it in
        if (this.containerMembership) {
            copiedData["in"] = `["#${this.containerMembership}"]`;
        }

        switch (this.requestNameType) {
            case REQUEST_NAME_TYPE.TICKER:
                copiedData["args"] = copiedData["args"] || {};
                copiedData["args"]["request_ticker"] = this.requestName;
                break;
            case REQUEST_NAME_TYPE.REALM:
                copiedData["args"] = copiedData["args"] || {};
                copiedData["args"]["request_realm"] = this.requestName;
                break;
            case REQUEST_NAME_TYPE.SUBREALM:
                copiedData["args"] = copiedData["args"] || {};
                copiedData["args"]["request_subrealm"] = this.requestName;
                copiedData["args"]["parent_realm"] = this.requestParentId;
                break;
            case REQUEST_NAME_TYPE.CONTAINER:
                copiedData["args"] = copiedData["args"] || {};
                copiedData["args"]["request_container"] = this.requestName;
                break;
            case REQUEST_NAME_TYPE.ITEM:
                copiedData["args"] = copiedData["args"] || {};
                copiedData["args"]["request_dmitem"] = this.requestName;
                copiedData["args"]["parent_container"] = this.requestParentId;
                console.log(copiedData);
            case REQUEST_NAME_TYPE.PROTOCOL:
                copiedData["p"] = this.requestName;
                copiedData["op"] = "def";
                console.log(copiedData);
            case REQUEST_NAME_TYPE.CONTRACT:
                copiedData["p"] = this.requestProtocolName;
                // copiedData["name"] = this.requestName;
                copiedData["op"] = "deploy";
                copiedData["args"] = copiedData["args"] || {};
                console.log(copiedData);
            default:
                break;
        }

        if (performBitworkForCommitTx) {
            copiedData["args"] = copiedData["args"] || {};
            copiedData["args"]["bitworkc"] =
                this.bitworkInfoCommit?.hex_bitwork;
        }

        if (performBitworkForRevealTx) {
            copiedData["args"] = copiedData["args"] || {};
            copiedData["args"]["bitworkr"] =
                this.bitworkInfoReveal?.hex_bitwork;
        }

        if (this.options.opType === "dmt") {
            copiedData["args"] = copiedData["args"] || {};
            copiedData["args"]["mint_ticker"] = this.options.dmtOptions?.ticker;
        }

        let parentAtomicalInfo: ParentInputAtomical | null | any =
            this.getInputParent();
        if (parentAtomicalInfo) {
            copiedData["args"] = copiedData["args"] || {};
            copiedData["args"]["parents"] = {
                [parentAtomicalInfo.parentId]: 0,
            }; // Also supports one parent for now
        }

        if (this.options.satsbyte == -1) {
            const response: { result } = await this.options.electrumApi.estimateFee(1);
            let estimatedSatsByte = Math.ceil((response.result / 1000) * 100000000);
            if (isNaN(estimatedSatsByte)) {
                estimatedSatsByte = 200; // Something went wrong, just default to 30 bytes sat estimate
                console.log('satsbyte fee query failed, defaulted to: ', estimatedSatsByte)
            } else {
                this.options.satsbyte = estimatedSatsByte;
                console.log('satsbyte fee auto-detected to: ', estimatedSatsByte)
            }
        } else {
            console.log('satsbyte fee manually set to: ', this.options.satsbyte)
        }

        let unixtime = Math.floor(Date.now() / 1000);
        let nonce = Math.floor(Math.random() * 10000000);
        let noncesGenerated = 0;
        let atomicalId: string | null = null;
        let commitTxid: string | null = null;
        let revealTxid: string | null = null;
        let commitMinedWithBitwork = false;

        // Placeholder for only estimating tx deposit fee size.
        if (performBitworkForCommitTx) {
            // Use zero nonce in order for recoverable real addresses.
            copiedData["args"]["nonce"] = 0;
            copiedData["args"]["time"] = unixtime;
        }

        console.log("copiedData", copiedData);
        const mockAtomPayload = new AtomicalsPayload(copiedData);
        if (this.options.verbose) {
            console.log("copiedData", copiedData);
        }
        const payloadSize = mockAtomPayload.cbor().length;
        console.log("Payload CBOR Size (bytes): ", payloadSize);

        if (payloadSize <= 1000) {
            console.log("Payload Encoded: ", copiedData);
        }

        const mockBaseCommitForFeeCalculation: { scriptP2TR; hashLockP2TR } =
            prepareCommitRevealConfig(
                this.options.opType,
                fundingKeypair,
                mockAtomPayload
            );
        const fees: FeeCalculations =
            this.calculateFeesRequiredForAccumulatedCommitAndReveal(
                mockBaseCommitForFeeCalculation.hashLockP2TR.redeem.output.length,
                performBitworkForRevealTx
            );

        ////////////////////////////////////////////////////////////////////////
        // Begin Commit Transaction
        ////////////////////////////////////////////////////////////////////////

        if (performBitworkForCommitTx) {
            // Attempt to get funding UTXO information
            const fundingUtxo = await getFundingUtxo(
                this.options.electrumApi,
                fundingKeypair.address,
                fees.commitAndRevealFeePlusOutputs
            );

            // Log bitwork info if available
            printBitworkLog(this.bitworkInfoCommit as any, true);

            // Close the electrum API connection
            this.options.electrumApi.close();

            // Set the default concurrency level to the number of CPU cores minus 1
            const defaultConcurrency = os.cpus().length - 1;
            // Read the concurrency level from .env file
            const envConcurrency = process.env.CONCURRENCY
                ? parseInt(process.env.CONCURRENCY, 10)
                : -1;
            // Use envConcurrency if it is a positive number; otherwise, use defaultConcurrency
            const concurrency = envConcurrency > 0
                ? envConcurrency
                : defaultConcurrency;
            // Logging the set concurrency level to the console
            console.log(`Concurrency set to: ${concurrency}`);
            const workerOptions = this.options;
            const workerBitworkInfoCommit = this.bitworkInfoCommit;

            let workers: Worker[] = [];
            let resolveWorkerPromise;

            // Create a promise to await the completion of worker tasks
            const workerPromise = new Promise((resolve) => {
                resolveWorkerPromise = resolve;
            });

            let isWorkDone = false;

            // Function to stop all worker threads
            const stopAllWorkers = () => {
                workers.forEach((worker) => {
                    worker.terminate();
                });
                workers = [];
            };

            // Calculate the range of sequences to be assigned to each worker
            const seqRangePerWorker = Math.floor(MAX_SEQUENCE / concurrency);

            // Initialize and start worker threads
            for (let i = 0; i < concurrency; i++) {
                console.log("Initializing worker: " + i);
                const worker = new Worker("./dist/utils/miner-worker.js");

                // Handle messages from workers
                worker.on("message", async (message: WorkerOut) => {
                    console.log("Solution found, try composing the transaction...");

                    if (!isWorkDone) {
                        isWorkDone = true;
                        stopAllWorkers();

                        const atomPayload = new AtomicalsPayload(
                            message.finalCopyData
                        );

                        const updatedBaseCommit: {
                            scriptP2TR;
                            hashLockP2TR;
                            hashscript;
                        } = prepareCommitRevealConfig(
                            workerOptions.opType,
                            fundingKeypair,
                            atomPayload
                        );

                        let psbtStart = new Psbt({ network: NETWORK });
                        psbtStart.setVersion(1);

                        psbtStart.addInput({
                            hash: fundingUtxo.txid,
                            index: fundingUtxo.index,
                            sequence: message.finalSequence,
                            tapInternalKey: Buffer.from(
                                fundingKeypair.childNodeXOnlyPubkey as number[]
                            ),
                            witnessUtxo: {
                                value: fundingUtxo.value,
                                script: Buffer.from(fundingKeypair.output, "hex"),
                            },
                        });
                        psbtStart.addOutput({
                            address: updatedBaseCommit.scriptP2TR.address,
                            value: this.getOutputValueForCommit(fees),
                        });

                        this.addCommitChangeOutputIfRequired(
                            fundingUtxo.value,
                            fees,
                            psbtStart,
                            fundingKeypair.address
                        );

                        psbtStart.signInput(0, fundingKeypair.tweakedChildNode);
                        psbtStart.finalizeAllInputs();

                        const interTx = psbtStart.extractTransaction();

                        const rawtx = interTx.toHex();
                        await AtomicalOperationBuilder.finalSafetyCheckForExcessiveFee(
                            psbtStart,
                            interTx
                        );
                        if (!this.broadcastWithRetries(rawtx)) {
                            console.log("Error sending", interTx.getId(), rawtx);
                            throw new Error(
                                "Unable to broadcast commit transaction after attempts: " +
                                interTx.getId()
                            );
                        } else {
                            console.log("Success sent tx: ", interTx.getId());
                        }

                        commitMinedWithBitwork = true;
                        performBitworkForCommitTx = false;
                        // In both scenarios we copy over the args
                        if (!performBitworkForCommitTx) {
                            scriptP2TR = updatedBaseCommit.scriptP2TR;
                            hashLockP2TR = updatedBaseCommit.hashLockP2TR;
                        }

                        // Resolve the worker promise with the received message
                        resolveWorkerPromise(message);
                    }
                });
                worker.on("error", (error) => {
                    console.error("worker error: ", error);
                    if (!isWorkDone) {
                        isWorkDone = true;
                        stopAllWorkers();
                    }
                });

                worker.on("exit", (code) => {
                    if (code !== 0) {
                        console.error(`Worker stopped with exit code ${code}`);
                    }
                });

                // Calculate sequence range for this worker
                const seqStart = i * seqRangePerWorker;
                let seqEnd = seqStart + seqRangePerWorker - 1;

                // Ensure the last worker covers the remaining range
                if (i === concurrency - 1) {
                    seqEnd = MAX_SEQUENCE - 1;
                }

                // Send necessary data to the worker
                const messageToWorker = {
                    copiedData,
                    seqStart,
                    seqEnd,
                    workerOptions,
                    fundingWIF,
                    fundingUtxo,
                    fees,
                    performBitworkForCommitTx,
                    workerBitworkInfoCommit,
                    scriptP2TR,
                    hashLockP2TR,
                };
                worker.postMessage(messageToWorker);
                workers.push(worker);
            }

            console.log("Stay calm and grab a drink! Miner workers have started mining... ");

            // Await results from workers
            const messageFromWorker = await workerPromise;
            console.log("Workers have completed their tasks.");
        } else {
            scriptP2TR = mockBaseCommitForFeeCalculation.scriptP2TR;
            hashLockP2TR = mockBaseCommitForFeeCalculation.hashLockP2TR;
        }

        ////////////////////////////////////////////////////////////////////////
        // Begin Reveal Transaction
        ////////////////////////////////////////////////////////////////////////

        // The scriptP2TR and hashLockP2TR will contain the utxo needed for the commit and now can be revealed
        const utxoOfCommitAddress = await getFundingUtxo(
            this.options.electrumApi,
            scriptP2TR.address,
            this.getOutputValueForCommit(fees),
            commitMinedWithBitwork,
            5
        );
        commitTxid = utxoOfCommitAddress.txid;
        atomicalId = commitTxid + "i0"; // Atomicals are always minted at the 0'th output

        const tapLeafScript = {
            leafVersion: hashLockP2TR.redeem.redeemVersion,
            script: hashLockP2TR.redeem.output,
            controlBlock:
                hashLockP2TR.witness![hashLockP2TR.witness!.length - 1],
        };

        if (performBitworkForRevealTx) {
            printBitworkLog(this.bitworkInfoReveal as any);
        }
        noncesGenerated = 0;
        do {
            let totalInputsforReveal = 0; // We calculate the total inputs for the reveal to determine to make change output or not
            let totalOutputsForReveal = 0; // Calculate total outputs for the reveal and compare to totalInputsforReveal and reveal fee
            let nonce = Math.floor(Math.random() * 100000000);
            let unixTime = Math.floor(Date.now() / 1000);
            let psbt = new Psbt({ network: NETWORK });
            psbt.setVersion(1);
            psbt.addInput({
                sequence: this.options.rbf ? RBF_INPUT_SEQUENCE : undefined,
                hash: utxoOfCommitAddress.txid,
                index: utxoOfCommitAddress.vout,
                witnessUtxo: {
                    value: utxoOfCommitAddress.value,
                    script: hashLockP2TR.output!,
                },
                tapLeafScript: [tapLeafScript],
            });
            totalInputsforReveal += utxoOfCommitAddress.value;

            // Add any additional inputs that were assigned
            for (const additionalInput of this.inputUtxos) {
                psbt.addInput({
                    sequence: this.options.rbf ? RBF_INPUT_SEQUENCE : undefined,
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
            for (const additionalOutput of this.additionalOutputs) {
                psbt.addOutput({
                    address: additionalOutput.address,
                    value: additionalOutput.value,
                });
                totalOutputsForReveal += additionalOutput.value;
            }

            if (parentAtomicalInfo) {
                psbt.addInput({
                    sequence: this.options.rbf ? RBF_INPUT_SEQUENCE : undefined,
                    hash: parentAtomicalInfo.parentUtxoPartial.hash,
                    index: parentAtomicalInfo.parentUtxoPartial.index,
                    witnessUtxo:
                        parentAtomicalInfo.parentUtxoPartial.witnessUtxo,
                    tapInternalKey:
                        parentAtomicalInfo.parentKeyInfo.childNodeXOnlyPubkey,
                });
                totalInputsforReveal +=
                    parentAtomicalInfo.parentUtxoPartial.witnessUtxo.value;
                psbt.addOutput({
                    address: parentAtomicalInfo.parentKeyInfo.address,
                    value: parentAtomicalInfo.parentUtxoPartial.witnessUtxo
                        .value,
                });
                totalOutputsForReveal +=
                    parentAtomicalInfo.parentUtxoPartial.witnessUtxo.value;
            }

            if (noncesGenerated % 10000 == 0) {
                unixTime = Math.floor(Date.now() / 1000);
            }
            const data = Buffer.from(unixTime + ":" + nonce, "utf8");
            const embed = bitcoin.payments.embed({ data: [data] });

            if (performBitworkForRevealTx) {
                psbt.addOutput({
                    script: embed.output!,
                    value: 0,
                });
            }
            this.addRevealOutputIfChangeRequired(
                totalInputsforReveal,
                totalOutputsForReveal,
                fees.revealFeeOnly,
                fundingKeypair.address
            );

            psbt.signInput(0, fundingKeypair.childNode);
            // Sign all the additional inputs, if there were any
            let signInputIndex = 1;
            for (const additionalInput of this.inputUtxos) {
                psbt.signInput(
                    signInputIndex,
                    additionalInput.keypairInfo.tweakedChildNode
                );
                signInputIndex++;
            }
            if (parentAtomicalInfo) {
                console.log("parentAtomicalInfo", parentAtomicalInfo);
                psbt.signInput(
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
            psbt.finalizeInput(0, customFinalizer);
            // Finalize all the additional inputs, if there were any
            let finalizeInputIndex = 1;
            for (
                ;
                finalizeInputIndex <= this.inputUtxos.length;
                finalizeInputIndex++
            ) {
                psbt.finalizeInput(finalizeInputIndex);
            }
            if (parentAtomicalInfo) {
                psbt.finalizeInput(finalizeInputIndex);
            }

            const revealTx = psbt.extractTransaction();
            const checkTxid = revealTx.getId();
            logMiningProgressToConsole(
                performBitworkForRevealTx,
                this.options.disableMiningChalk,
                checkTxid,
                noncesGenerated
            );
            let shouldBroadcast = !performBitworkForRevealTx;
            if (
                performBitworkForRevealTx &&
                hasValidBitwork(
                    checkTxid,
                    this.bitworkInfoReveal?.prefix as any,
                    this.bitworkInfoReveal?.ext as any
                )
            ) {
                process.stdout.clearLine(0);
                process.stdout.cursorTo(0);
                process.stdout.write(
                    chalk.green(checkTxid, " nonces: " + noncesGenerated)
                );
                console.log(
                    "\nBitwork matches reveal txid! ",
                    revealTx.getId(),
                    "@ time: " + Math.floor(Date.now() / 1000)
                );
                shouldBroadcast = true;
            }
            // Broadcast either because there was no bitwork requested, and we are done. OR...
            // broadcast because we found the bitwork and it is ready to be broadcasted
            if (shouldBroadcast) {
                console.log("\nPrint raw tx in case of broadcast failure", revealTx.toHex());
                await AtomicalOperationBuilder.finalSafetyCheckForExcessiveFee(
                    psbt,
                    revealTx
                );
                console.log("\nBroadcasting tx...", revealTx.getId());
                const interTx = psbt.extractTransaction();
                const rawtx = interTx.toHex();
                if (!(await this.broadcastWithRetries(rawtx))) {
                    console.log("Error sending", revealTx.getId(), rawtx);
                    throw new Error(
                        "Unable to broadcast reveal transaction after attempts"
                    );
                } else {
                    console.log("Success sent tx: ", revealTx.getId());
                }
                revealTxid = interTx.getId();
                performBitworkForRevealTx = false; // Done
            }
            nonce++;
            noncesGenerated++;
        } while (performBitworkForRevealTx);

        const ret = {
            success: true,
            data: {
                commitTxid,
                revealTxid,
            },
        };
        if (
            this.options.opType === "nft" ||
            this.options.opType === "ft" ||
            this.options.opType === "dft" ||
            this.options.opType === "def" ||
            this.options.opType === "new"
        ) {
            ret["data"]["atomicalId"] = atomicalId;
        }
        if (this.options.opType === "dat") {
            ret["data"]["dataId"] = revealTxid + "i0";
            ret["data"]["urn"] = "atom:btc:dat:" + revealTxid + "i0";
        }
        return ret;
    }

    async broadcastWithRetries(rawtx: string): Promise<any> {
        let attempts = 0;
        let result = null;
        do {
            try {
                console.log("rawtx", rawtx);

                result = await this.options.electrumApi.broadcast(rawtx);
                if (result) {
                    break;
                }
            } catch (err) {
                console.log(
                    "Network error broadcasting (Trying again soon...)",
                    err
                );
                await this.options.electrumApi.resetConnection();
                // Put in a sleep to help the connection reset more gracefully in case there is some delay
                console.log(
                    `Will retry to broadcast transaction again in ${SEND_RETRY_SLEEP_SECONDS} seconds...`
                );
                await sleeper(SEND_RETRY_SLEEP_SECONDS);
            }
            attempts++;
        } while (attempts < SEND_RETRY_ATTEMPTS);
        return result;
    }

    static translateFromBase32ToHex(bitwork: string): string {
        return bitwork;
    }

    totalOutputSum(): number {
        let sum = 0;
        for (const additionalOutput of this.additionalOutputs) {
            sum += additionalOutput.value;
        }
        return sum;
    }

    getTotalAdditionalInputValues(): number {
        let sum = 0;
        for (const utxo of this.inputUtxos) {
            sum += utxo.utxo.witnessUtxo.value;
        }
        return sum;
    }

    getTotalAdditionalOutputValues(): number {
        let sum = 0;
        for (const output of this.additionalOutputs) {
            sum += output.value;
        }
        return sum;
    }

    calculateAmountRequiredForReveal(
        hashLockP2TROutputLen: number = 0,
        performBitworkForRevealTx: boolean = false
    ): number {
        // <Previous txid> <Output index> <Length of scriptSig> <Sequence number>
        // 32 + 4 + 1 + 4 = 41
        // <Witness stack item length> <Signature> ... <Control block>
        // (1 + 65 + 34) / 4 = 25
        // Total: 41 + 25 = 66
        //-----------------------------------------
        // OP_RETURN size
        // 8-bytes value, a one-byte script’s size
        const OP_RETURN_BYTES: number = 21 + 8 + 1;
        //-----------------------------------------
        const REVEAL_INPUT_BYTES_BASE = 66;
        // OP_RETURN size
        let hashLockCompactSizeBytes = 9;
        let op_Return_SizeBytes = 0;
        if (performBitworkForRevealTx) {
            op_Return_SizeBytes = OP_RETURN_BYTES;
        }
        if (hashLockP2TROutputLen <= 252) {
            hashLockCompactSizeBytes = 1;
        } else if (hashLockP2TROutputLen <= 0xffff) {
            hashLockCompactSizeBytes = 3;
        } else if (hashLockP2TROutputLen <= 0xffffffff) {
            hashLockCompactSizeBytes = 5;
        }
        return Math.ceil(
            (this.options.satsbyte as any) *
            (BASE_BYTES +
                // Reveal input
                REVEAL_INPUT_BYTES_BASE +
                (hashLockCompactSizeBytes + hashLockP2TROutputLen) / 4 +
                // Additional inputs
                this.inputUtxos.length * INPUT_BYTES_BASE +
                // Outputs
                this.additionalOutputs.length * OUTPUT_BYTES_BASE +
                // Bitwork Output OP_RETURN Size Bytes
                op_Return_SizeBytes)
        )
    }

    calculateFeesRequiredForCommit(): number {
        let fees = Math.ceil(
            (this.options.satsbyte as any) *
            (BASE_BYTES + 1 * INPUT_BYTES_BASE + 1 * OUTPUT_BYTES_BASE)
        );
        return fees;
    }

    getOutputValueForCommit(fees: FeeCalculations): number {
        // Note that `Additional inputs` refers to the additional inputs in a reveal tx.
        return fees.revealFeePlusOutputs - this.getTotalAdditionalInputValues();
    }

    getAdditionalFundingRequiredForReveal(): number | null {
        return 0;
    }

    /**
     * Get the commit and reveal fee. The commit fee assumes it is chained together
     * @returns
     */
    calculateFeesRequiredForAccumulatedCommitAndReveal(
        hashLockP2TROutputLen: number = 0,
        performBitworkForRevealTx: boolean = false
    ): FeeCalculations {
        const revealFee = this.calculateAmountRequiredForReveal(
            hashLockP2TROutputLen,
            performBitworkForRevealTx
        );
        const commitFee = this.calculateFeesRequiredForCommit();
        const commitAndRevealFee = commitFee + revealFee;
        const commitAndRevealFeePlusOutputs =
            commitFee + revealFee + this.totalOutputSum();
        const revealFeePlusOutputs = revealFee + this.totalOutputSum();
        const ret = {
            commitAndRevealFee,
            commitAndRevealFeePlusOutputs,
            revealFeePlusOutputs,
            commitFeeOnly: commitFee,
            revealFeeOnly: revealFee,
        };
        return ret;
    }

    /**
     * Adds an extra output at the end if it was detected there would be excess satoshis for the reveal transaction
     * @param fee Fee calculations
     * @returns
     */
    addRevealOutputIfChangeRequired(
        totalInputsValue: number,
        totalOutputsValue: number,
        revealFee: number,
        address: string
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
            (this.options.satsbyte as any) * OUTPUT_BYTES_BASE;
        // There were no excess satoshis, therefore no change is due
        if (excessSatoshisFound <= 0) {
            return;
        }
        // There were some excess satoshis, but let's verify that it meets the dust threshold to make change
        if (excessSatoshisFound >= DUST_AMOUNT) {
            this.addOutput({
                address: address,
                value: excessSatoshisFound,
            });
        }
    }

    /**
     * Adds an extra output at the end if it was detected there would be excess satoshis for the reveal transaction
     * @param fee Fee calculations
     * @returns
     */
    addCommitChangeOutputIfRequired(
        extraInputValue: number,
        fee: FeeCalculations,
        pbst: any,
        address: string
    ) {
        const totalInputsValue = extraInputValue;
        const totalOutputsValue = this.getOutputValueForCommit(fee);
        const calculatedFee = totalInputsValue - totalOutputsValue;
        // It will be invalid, but at least we know we don't need to add change
        if (calculatedFee <= 0) {
            return;
        }
        // In order to keep the fee-rate unchanged, we should add extra fee for the new added change output.
        const expectedFee =
            fee.commitFeeOnly +
            (this.options.satsbyte as any) * OUTPUT_BYTES_BASE;
        const differenceBetweenCalculatedAndExpected =
            calculatedFee - expectedFee;
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

    /**
     * a final safety check to ensure we don't accidentally broadcast a tx with too high of a fe
     * @param psbt Partially signed bitcoin tx coresponding to the tx to calculate the total inputs values provided
     * @param tx The tx to broadcast, uses the outputs to calculate total outputs
     */
    static async finalSafetyCheckForExcessiveFee(psbt: any, tx) {
        let sumInputs = 0;
        psbt.data.inputs.map((inp) => {
            sumInputs += inp.witnessUtxo.value;
        });
        let sumOutputs = 0;
        tx.outs.map((out) => {
            sumOutputs += out.value;
        });
        const fee = sumInputs - sumOutputs;
        if (fee > EXCESSIVE_FEE_LIMIT) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            try {
                let reply: string = '';
                const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));
                console.log(`Excessive fee ${fee} satoshis detected. Hardcoded to ${EXCESSIVE_FEE_LIMIT} satoshis. Aborting due to protect funds.`)
                const allowedInput = ['y', 'yes', 'n', 'no'];
                while (!allowedInput.includes(reply)) {
                    reply = (await prompt("To ignore and continue type 'y', or 'n' to cancel: ") as any);
                    if (!allowedInput.includes(reply)) {
                        console.log("Invalid input.");
                    }
                }
                if (reply === 'y' || reply === 'yes') {
                    return;
                }
                if (reply === 'n' || reply === 'no') {
                    throw 'Aborted for excessive fee. User cancelled';
                }
                throw 'Aborted for excessive fee.';
            } finally {
                rl.close()
            }
        }
    }

    /**
     * Helper function to resolve a parent atomical id and the wallet record into a format that's easily processable by setInputParent
     * @param electrumxApi
     * @param parentId
     * @param parentOwner
     */
    static async resolveInputParent(
        electrumxApi: ElectrumApiInterface,
        parentId,
        parentOwner: IWalletRecord
    ): Promise<ParentInputAtomical> {
        const { atomicalInfo, locationInfo, inputUtxoPartial } =
            await getAndCheckAtomicalInfo(
                electrumxApi,
                parentId,
                parentOwner.address as any
            );
        const parentKeypairInput = ECPair.fromWIF(parentOwner.WIF as any);
        const parentKeypairInputInfo = getKeypairInfo(parentKeypairInput);
        const inp: ParentInputAtomical = {
            parentId,
            parentUtxoPartial: inputUtxoPartial,
            parentKeyInfo: parentKeypairInputInfo,
        };
        return inp;
    }
}
