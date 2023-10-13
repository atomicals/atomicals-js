import { APIInterface, BaseRequestOptions } from "./interfaces/api.interface";
const bitcoin = require('bitcoinjs-lib');
import * as ecc from 'tiny-secp256k1';
bitcoin.initEccLib(ecc);
export { ElectrumApiMock } from "./api/electrum-api-mock";
import { ConfigurationInterface } from "./interfaces/configuration.interface";
import { ElectrumApiInterface } from "./api/electrum-api.interface";
import { ElectrumApi } from "./api/electrum-api";
export { ElectrumApi } from "./api/electrum-api";
import { AtomicalsGetFetchType, CommandInterface } from "./commands/command.interface";
import { WalletCreateCommand } from "./commands/wallet-create-command";
import { MintInteractiveNftCommand } from "./commands/mint-interactive-nft-command";
import { CommandResultInterface } from "./commands/command-result.interface";
import { WalletInitCommand } from "./commands/wallet-init-command";
import { WalletPhraseDecodeCommand } from "./commands/wallet-phrase-decode-command";
import { ServerVersionCommand } from "./commands/server-version-command";
import { GetCommand } from "./commands/get-command";
import { ListCommand } from "./commands/list-command";
import { GetAtomicalsAddressCommand } from "./commands/get-atomicals-address-command";
import { GetUtxosCommand } from "./commands/get-utxos";
import { TxCommand } from "./commands/tx-command";
import { GetAtomicalsAtLocationCommand } from "./commands/get-atomicals-at-location-command";
import { DownloadCommand } from "./commands/download-command";
import { AddressInfoCommand } from "./commands/address-info-command";
import { WalletInfoCommand } from "./commands/wallet-info-command";
import { TransferInteractiveNftCommand } from "./commands/transfer-interactive-nft-command";
import { WalletImportCommand } from "./commands/wallet-import-command";
import { AddressHistoryCommand } from "./commands/address-history-command";
import { FileMap } from "./interfaces/filemap.interface";
import { RenderPreviewsCommand } from "./commands/render-previews-command";
import { SetInteractiveCommand } from "./commands/set-interactive-command";
import { TransferInteractiveFtCommand } from "./commands/transfer-interactive-ft-command";
import { IValidatedWalletInfo, IWalletRecord } from "./utils/validate-wallet-storage";
import { TransferInteractiveUtxosCommand } from "./commands/transfer-interactive-utxos-command";
import { MintInteractiveFtCommand } from "./commands/mint-interactive-ft-command";
import { GetByRealmCommand } from "./commands/get-by-realm-command";
import { GetByTickerCommand } from "./commands/get-by-ticker-command";
import { GetByContainerCommand } from "./commands/get-by-container-command";
import { MintInteractiveRealmCommand } from "./commands/mint-interactive-realm-command";
import { MintInteractiveContainerCommand } from "./commands/mint-interactive-container-command";
import { MintInteractiveDftCommand } from "./commands/mint-interactive-dft-command";
import { InitInteractiveDftCommand } from "./commands/init-interactive-dft-command";
import { MintInteractiveSubrealmCommand } from "./commands/mint-interactive-subrealm-command";
import { ResolveCommand } from "./commands/resolve-command";
import { SealInteractiveCommand } from "./commands/seal-interactive-command";
import { GetRealmInfoCommand } from "./commands/get-subrealm-info-command";
import { SearchTickersCommand } from "./commands/search-tickers-command";
import { SearchContainersCommand } from "./commands/search-containers-command";
import { SearchRealmsCommand } from "./commands/search-realms-command";
import { SummarySubrealmsCommand } from "./commands/summary-subrealms-command";
import { SummaryContainersCommand } from "./commands/summary-containers-command";
import { SummaryRealmsCommand } from "./commands/summary-realms-command";
import { SummaryTickersCommand } from "./commands/summary-tickers-command";
import { PendingSubrealmsCommand } from "./commands/pending-subrealms-command";
import { SetRelationInteractiveCommand } from "./commands/set-relation-interactive-command";
import { MintInteractiveDatCommand } from "./commands/mint-interactive-dat-command";
import { MergeInteractiveUtxosCommand } from "./commands/merge-interactive-utxos";
import { SplatInteractiveCommand } from "./commands/splat-interactive-command";
import { EmitInteractiveCommand } from "./commands/emit-interactive-command";
import { DeleteInteractiveCommand } from "./commands/delete-interactive-command";
import { DisableSubrealmRulesInteractiveCommand } from "./commands/disable-subrealm-rules-command";
import { EnableSubrealmRulesCommand } from "./commands/enable-subrealm-rules-command";
import { SplitInteractiveCommand } from "./commands/split-interactive-command";
import { GetGlobalCommand } from "./commands/get-global-command";
import { GetFtInfoCommand } from "./commands/get-dft-info-command";
import { BroadcastCommand } from "./commands/broadcast-command";
export { decorateAtomicals } from "./utils/atomical-format-helpers";
export { addressToP2PKH } from "./utils/address-helpers";
export { getExtendTaprootAddressKeypairPath } from "./utils/address-keypair-path";
export { createKeyPair } from "./utils/create-key-pair";
export { buildAtomicalsFileMapFromRawTx, hexifyObjectWithUtf8, isValidRealmName, isValidSubRealmName } from "./utils/atomical-format-helpers";
export { createMnemonicPhrase } from "./utils/create-mnemonic-phrase";
export { detectAddressTypeToScripthash, detectScriptToAddressType } from "./utils/address-helpers";

export { bitcoin };
export class Atomicals implements APIInterface {
  constructor(private electrumApi: ElectrumApiInterface) {
  }
  static async renderPreviews(filesmap: FileMap, body: boolean): Promise<any> {
    try {
      const command: CommandInterface = new RenderPreviewsCommand(filesmap, body);
      return command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    }
  }

  static async walletCreate(): Promise<any> {
    try {
      const command: CommandInterface = new WalletCreateCommand();
      return command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    }
  }

  static async walletImport(wif: string, alias: string): Promise<any> {
    try {
      const command: CommandInterface = new WalletImportCommand(wif, alias);
      return command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    }
  }

  static async walletPhraseDecode(phrase: string, path: string): Promise<any> {
    try {
      const command: CommandInterface = new WalletPhraseDecodeCommand(phrase, path);
      return command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    }
  }

  static async walletInit(): Promise<any> {
    try {
      const command: CommandInterface = new WalletInitCommand();
      return command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    }
  }
  async serverVersion(): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new ServerVersionCommand(this.electrumApi);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async mintDatInteractive(files: string[], address: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new MintInteractiveDatCommand(this.electrumApi, files, address, WIF, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }


  async mintNftInteractive(files: string[], address: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new MintInteractiveNftCommand(this.electrumApi, files, address, WIF, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async mintRealmInteractive(requestRealm: string, address: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new MintInteractiveRealmCommand(this.electrumApi, requestRealm, address, WIF, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }


  async mintSubrealmInteractive(requestSubRealm: string, address: string, WIF: string, owner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new MintInteractiveSubrealmCommand(this.electrumApi, requestSubRealm, address, WIF, owner, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async mintContainerInteractive(requestContainer: string, address: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new MintInteractiveContainerCommand(this.electrumApi, requestContainer, address, WIF, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async mintFtInteractive(files: string[], supply: number, address: string, requestTicker: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new MintInteractiveFtCommand(this.electrumApi, files, supply, address, requestTicker, WIF, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async mintDftInteractive(address: string, ticker: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new MintInteractiveDftCommand(this.electrumApi, address, ticker, WIF, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async initDftInteractive(files: string[], address: string, requestTicker: string, mintAmount: number, maxMints: number, mintHeight: number, mintBitworkc: string, mintBitworkr: string, WIF: string, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new InitInteractiveDftCommand(this.electrumApi, files, address, requestTicker, mintAmount, maxMints, mintHeight, mintBitworkc, mintBitworkr, WIF, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async disableSubrealmRules(realmOrSubrealm: string, funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new DisableSubrealmRulesInteractiveCommand(this.electrumApi, realmOrSubrealm, funding, atomicalOwner, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async enableSubrealmRules(realmOrSubrealm: string, files: string[], funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new EnableSubrealmRulesCommand(this.electrumApi, realmOrSubrealm, files, funding, atomicalOwner, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async setRelationInteractive(atomicalId: string, relationName, values: string[], funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new SetRelationInteractiveCommand(this.electrumApi, atomicalId, relationName, values, atomicalOwner, funding, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async splatInteractive(atomicalId: string, funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new SplatInteractiveCommand(this.electrumApi, atomicalId, atomicalOwner, funding, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async splitItneractive(atomicalId: string, funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
    
      await this.electrumApi.open();
      const command: CommandInterface = new SplitInteractiveCommand(this.electrumApi, atomicalId, atomicalOwner, funding, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }
  async emitInteractive(atomicalId: string, files: string[], funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new EmitInteractiveCommand(this.electrumApi, atomicalId, files, atomicalOwner, funding, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async setInteractive(atomicalId: string, files: string[], funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new SetInteractiveCommand(this.electrumApi, atomicalId, files, atomicalOwner, funding, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async deleteInteractive(atomicalId: string, filesToDelete: string[], funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new DeleteInteractiveCommand(this.electrumApi, atomicalId, filesToDelete, funding, atomicalOwner, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async sealInteractive(atomicalId: string, funding: IWalletRecord, atomicalOwner: IWalletRecord, options: BaseRequestOptions): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new SealInteractiveCommand(this.electrumApi, atomicalId, atomicalOwner, funding, options);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async transferInteractiveNft(atomicalId: string, owner: IWalletRecord, funding: IWalletRecord, receiveAddress: string, satsbyte: number, satsoutput: number): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new TransferInteractiveNftCommand(
        this.electrumApi,
        atomicalId,
        owner.WIF,
        receiveAddress,
        funding.WIF,
        satsbyte,
        satsoutput);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async transferInteractiveFt(atomicalId: string, owner: IWalletRecord, funding: IWalletRecord, validatedWalletInfo: IValidatedWalletInfo, satsbyte: number): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new TransferInteractiveFtCommand(
        this.electrumApi,
        atomicalId,
        owner.WIF,
        funding.WIF,
        validatedWalletInfo,
        satsbyte);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async transferInteractiveUtxos(owner: IWalletRecord, funding: IWalletRecord, validatedWalletInfo: IValidatedWalletInfo, satsbyte: number): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new TransferInteractiveUtxosCommand(
        this.electrumApi,
        owner.WIF,
        funding.WIF,
        validatedWalletInfo,
        satsbyte);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async global(hashes = 10, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetGlobalCommand(this.electrumApi, hashes);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async dump(keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      let response = await this.electrumApi.dump();
      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async resolveAtomical(atomicalIdOrNumberOrVariousName: string, atomicalsGetFetchType: AtomicalsGetFetchType, verbose = false, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new ResolveCommand(this.electrumApi, atomicalIdOrNumberOrVariousName, atomicalsGetFetchType, verbose);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async getRealmInfo(atomicalIdOrNumberOrVariousName: string, verbose = false, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetRealmInfoCommand(this.electrumApi, atomicalIdOrNumberOrVariousName, verbose);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async getAtomical(atomicalAliasOrId: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetCommand(this.electrumApi, atomicalAliasOrId);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async getAtomicalFtInfo(atomicalAliasOrId: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetFtInfoCommand(this.electrumApi, atomicalAliasOrId);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async getAtomicalLocation(atomicalAliasOrId: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetCommand(this.electrumApi, atomicalAliasOrId, AtomicalsGetFetchType.LOCATION);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async getAtomicalState(atomicalAliasOrId: string, verbose: boolean = false, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetCommand(this.electrumApi, atomicalAliasOrId, AtomicalsGetFetchType.STATE, verbose);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }
  async getAtomicalStateHistory(atomicalAliasOrId: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetCommand(this.electrumApi, atomicalAliasOrId, AtomicalsGetFetchType.STATE_HISTORY);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async getAtomicalEventHistory(atomicalAliasOrId: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetCommand(this.electrumApi, atomicalAliasOrId, AtomicalsGetFetchType.EVENT_HISTORY);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async getAtomicalHistory(atomicalAliasOrId: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetCommand(this.electrumApi, atomicalAliasOrId, AtomicalsGetFetchType.TX_HISTORY);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async searchTickers(prefix: string | null, asc = true, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new SearchTickersCommand(this.electrumApi, prefix, asc);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async searchContainers(prefix: string, asc = true, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new SearchContainersCommand(this.electrumApi, prefix, asc);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async searchRealms(prefix: string, asc = true, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new SearchRealmsCommand(this.electrumApi, prefix, asc);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async getAtomicalByRealm(realm: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetByRealmCommand(this.electrumApi, realm);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async getAtomicalByTicker(ticker: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetByTickerCommand(this.electrumApi, ticker);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async getAtomicalByContainer(container: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetByContainerCommand(this.electrumApi, container);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async addressInfo(address: string, verbose: boolean): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new AddressInfoCommand(this.electrumApi, address, verbose);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async pendingSubrealms(address: string, funding: IWalletRecord, satsbyte: number, display = false, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new PendingSubrealmsCommand(this.electrumApi, address, funding.WIF, satsbyte, display);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async summarySubrealms(address: string, filter?: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new SummarySubrealmsCommand(this.electrumApi, address, filter);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async summaryContainers(address: string, filter?: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new SummaryContainersCommand(this.electrumApi, address, filter);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }


  async summaryRealms(address: string, filter?: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new SummaryRealmsCommand(this.electrumApi, address, filter);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async summaryTickers(address: string, filter?: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new SummaryTickersCommand(this.electrumApi, address, filter);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async walletInfo(address: string, verbose: boolean, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new WalletInfoCommand(this.electrumApi, address, verbose);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }


  async list(offset: number, limit: number, asc: boolean): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new ListCommand(this.electrumApi, offset, limit, asc);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async getUtxos(address: string, keepElectrumAlive = false): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetUtxosCommand(this.electrumApi, address);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      if (!keepElectrumAlive) {
        this.electrumApi.close();
      }
    }
  }

  async getHistory(address: string): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new AddressHistoryCommand(this.electrumApi, address);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async getAtomicals(address: string): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetAtomicalsAddressCommand(this.electrumApi, address);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async getTx(txid: string, verbose: boolean): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new TxCommand(this.electrumApi, txid, verbose);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async download(locationIdOrTxId: string): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new DownloadCommand(this.electrumApi, locationIdOrTxId);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }


  async broadcast(rawtx: string): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new BroadcastCommand(this.electrumApi, rawtx);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }


  async getAtomicalsAtLocation(location: string): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new GetAtomicalsAtLocationCommand(this.electrumApi, location);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }

  async mergeInteractiveUtxos(owner: IWalletRecord, funding: IWalletRecord, validatedWalletInfo: IValidatedWalletInfo, satsbyte: number): Promise<CommandResultInterface> {
    try {
      await this.electrumApi.open();
      const command: CommandInterface = new MergeInteractiveUtxosCommand(
        this.electrumApi,
        owner.WIF,
        funding.WIF,
        validatedWalletInfo,
        satsbyte);
      return await command.run();
    } catch (error: any) {
      return {
        success: false,
        message: error.toString(),
        error
      }
    } finally {
      this.electrumApi.close();
    }
  }
}

export function instance(config: ConfigurationInterface, electrumUrl: string): APIInterface {
  return new Atomicals(ElectrumApi.createClient(electrumUrl));
}

try {
  // Running under node, we are in command line mode
  if (typeof window !== 'undefined') {
    // otherwise we are being used as a kind of library
    window['atomicals'] = {
      instance: instance
    };
  }
}
catch (ex) {
  // Window is not defined, must be running in windowless node env...
  console.log("atomicals window object not found. Skipping initialization on window object")
}

