import { CommandResultInterface } from "../commands/command-result.interface";
import { AtomicalsGetFetchType } from "../commands/command.interface";
import { GetSubrealmInfoCommandResultInterface } from "../commands/get-subrealm-info-command";
import { IValidatedWalletInfo, IWalletRecord } from "../utils/validate-wallet-storage";

export interface BaseRequestOptions {
    meta?: string[] | any;
    ctx?: string[] | any;
    init?: string[] | any;
    satsbyte?: number;
    satsoutput?: number;
    container?: string;
    bitworkc?: string;
    bitworkr?: string;
    parent?: string;
    parentOwner?: IWalletRecord;
    disableMiningChalk?: boolean;
    disableautoencode?: boolean;
}
 
export const BASE_REQUEST_OPTS_DEFAULTS = {
    satsbyte: 10,
    satsoutput: 1000
}

export interface APIInterface {
    // Mint non-fungible-token methods (NFT)
    mintNftInteractive(files: string[], address: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface>;
    mintRealmInteractive(requestRealm: string, address: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface>;
    mintSubrealmInteractive(requestSubRealm: string, address: string, WIF: string, owner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface>;
    mintContainerInteractive(requestContainer: string, address: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface>;
    mintContainerItemInteractive(container: string, itemId: string, manifestFile: string, address: string, WIF: string, owner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface>;

    // Mint fungible-token methods (FT)
    mintFtInteractive(files: string[], supply: number, address: string, requestTicker: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface>;
    mintDftInteractive(address: string, ticker: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface>;
    initDftInteractive(files: string[], address: string, requestTicker: string, mintAmount: number, maxMints: number, mintHeight: number, mintBitworkc: string, mintBitworkr: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface>;
    
    // Create data transaction (Non-Atomical/Non-Token)
    mintDatInteractive(filepath: string, givenFileName: string, address: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface>;

    // Modify methods
    enableSubrealmRules(realmOrSubrealm: string, file: string, funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface>;
    disableSubrealmRules(realmOrSubrealm: string, funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface>;
    setInteractive(atomicalId: string, jsonFilename: string, funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface>;
    deleteInteractive(atomicalId: string, keysToDelete: string[], funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface>;
    sealInteractive(atomicalId: string, funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface>;
    splatInteractive(atomicalId: string, funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface>;
    splitItneractive(atomicalId: string, funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface>;
    setContainerDmintInteractive(containerName: string, jsonFile: string, funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface>;
    
    // Transfer methods
    transferInteractiveNft(atomicalId: string, owner: IWalletRecord, funding: IWalletRecord, receiveAddress: string, satsbyte: number, satsoutput: number, atomicalIdReceipt?: string): Promise<CommandResultInterface>;
    transferInteractiveFt(atomicalId: string, owner: IWalletRecord, funding: IWalletRecord, validatedWalletInfo: IValidatedWalletInfo, satsbyte: number, nofunding: boolean, atomicalIdReceipt?: string): Promise<CommandResultInterface>;
    transferInteractiveUtxos(owner: IWalletRecord, funding: IWalletRecord, validatedWalletInfo: IValidatedWalletInfo, satsbyte: number, nofunding: boolean): Promise<CommandResultInterface>;
    transferInteractiveBuilder(owner: IWalletRecord, funding: IWalletRecord, validatedWalletInfo: IValidatedWalletInfo, satsbyte: number, nofunding: boolean, atomicalIdReceipt?: string): Promise<CommandResultInterface>;
    mergeInteractiveUtxos(owner: IWalletRecord, funding: IWalletRecord, validatedWalletInfo: IValidatedWalletInfo, satsbyte: number): Promise<CommandResultInterface>;

    // Summaries of specific types of tokens such as: Realm, Container, and Tickers
    summarySubrealms(address: string, filter: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    summaryContainers(address: string, filter: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    summaryRealms(address: string, filter: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    summaryTickers(address: string, filter: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    pendingSubrealms(address: string, funding: IWalletRecord, satsbyte: number, keepElectrumAlive: boolean): Promise<CommandResultInterface>;

    // Set/delete relationships such as container membership
    // atomicalId: string, relationName, values: string[], funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions
    setRelationInteractive(atomicalId: string, relationName, values: string[], funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface>;
    
    // Query and search
    getAtomicalFtInfo(atomicalId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomical(atomicalId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalLocation(atomicalId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalHistory(atomicalId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalState(atomicalId: string, verbose: boolean, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalStateHistory(atomicalId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalEventHistory(atomicalId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    searchTickers(prefix: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    searchRealms(prefix: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    searchContainers(prefix: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalByRealm(realm: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalByTicker(ticker: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalByContainerItem(container: string, itemId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalByContainerItemValidated(container: string, itemId: string,  manifestFile: string, address: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;

    resolveAtomical(atomicalIdOrNumberOrVariousName: string, atomicalsGetFetchType: AtomicalsGetFetchType, verbose: boolean, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getRealmInfo(atomicalIdOrNumberOrVariousName: string, verbose: boolean, keepElectrumAlive: boolean): Promise<GetSubrealmInfoCommandResultInterface>;
    list(offset: number, limit: number, asc: boolean, verbose: boolean): Promise<CommandResultInterface>;
    getAtomicals(address: string): Promise<CommandResultInterface>;
    getAtomicalsAtLocation(address: string): Promise<CommandResultInterface>;
    getUtxos(address: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    broadcast(rawtx: string): Promise<CommandResultInterface>;
    download(locationIdOrTxId: string, name: string): Promise<CommandResultInterface>;
    walletInfo(address: string, verbose: boolean, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    serverVersion(): Promise<CommandResultInterface>;
}
