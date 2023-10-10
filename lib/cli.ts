import { Command } from 'commander';
import { Atomicals } from '.';
import * as dotenv from 'dotenv'
import { ConfigurationInterface } from './interfaces/configuration.interface';
import { ElectrumApi } from './api/electrum-api';
import { validateCliInputs } from './utils/validate-cli-inputs';
import { IValidatedWalletInfo, IWalletRecord, validateWalletStorage } from './utils/validate-wallet-storage';
import * as qrcode from 'qrcode-terminal';
import { performAddressAliasReplacement } from './utils/address-helpers';
import { AtomicalsGetFetchType } from './commands/command.interface';
import { fileReader } from './utils/file-utils';
dotenv.config();

/////////////////////////////////////////////////////////////////////////////////////////////
// General Helper Functions
/////////////////////////////////////////////////////////////////////////////////////////////
function printOperationResult(data: any, error?: boolean) {
  if (error) {
    console.log('Operation failed.');
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`Operation succeeded.`);
    console.log(JSON.stringify(data, null, 2));
  }
}
function handleResultLogging(result: any) {
  if (!result || !result.success) {
    printOperationResult(result, true);
  } else {
    printOperationResult(result.data);
  }
}

function getRandomBitwork4() {
  const r = Math.floor(1000 + Math.random() * 9000);
  return r + '';
}

function groupAtomicalsUtxosByAtomicalId(atomical_utxos: any[]) {
  const sorted = {};
  // console.log('atomical_utxos', JSON.stringify(atomical_utxos, null, 2));
  for (const utxo of atomical_utxos) {

    for (const atomicalId of utxo['atomicals']) {
      sorted[atomicalId] = sorted[atomicalId] || [];
      sorted[atomicalId].push({
        ...utxo,
        atomicals: undefined
      })
    }
  }
  return sorted
}
function showWalletFTBalancesDetails(obj: any, showutxos = false) {
  const atomicalsUtxosByAtomicalId = groupAtomicalsUtxosByAtomicalId(obj.atomicals_utxos);
  for (const atomicalId in obj.atomicals_balances) {
    if (!obj.atomicals_balances.hasOwnProperty(atomicalId)) {
      continue;
    }
    const atomical = obj.atomicals_balances[atomicalId];
    if (atomical['type'] !== 'FT') {
      continue;
    }
    console.log('-----');
    console.log('Atomical id:', atomicalId)
    console.log('Atomical number:', atomical['atomical_number'])
    console.log('Atomical type:', atomical['type'])
    console.log('Atomical subtype:', atomical['subtype'])
    console.log('Requested ticker:', atomical['request_ticker'])
    console.log('Requested ticker status:', atomical['request_ticker_status']['status'])
    console.log('Ticker:', atomical['ticker'])
    console.log('Confirmed balance:', atomical['confirmed'])
    console.log('UTXOs for Atomical:', atomicalsUtxosByAtomicalId[atomicalId].length);
    if (showutxos)
      console.log(JSON.stringify(atomicalsUtxosByAtomicalId[atomicalId], null, 2));
  }
  return;
}

function showWalletDetails(obj: any, type: 'nft' | 'ft', showExtra = false, showBalancesOnly = false) {
  if (showBalancesOnly) {
    const atomicalsUtxosByAtomicalId = groupAtomicalsUtxosByAtomicalId(obj.atomicals_utxos);

    for (const atomicalId in obj.atomicals_balances) {
      if (!obj.atomicals_balances.hasOwnProperty(atomicalId)) {
        continue;
      }
      const atomical = obj.atomicals_balances[atomicalId];
      if (atomical['type'] !== 'FT') {
        continue;
      }
      console.log('-----');
      console.log('Atomical id:', atomicalId)
      console.log('Atomical number:', atomical['atomical_number'])
      console.log('Atomical type:', atomical['type'])
      console.log('Atomical subtype:', atomical['subtype'])
      console.log('Requested ticker:', atomical['request_ticker'])
      console.log('Requested ticker status:', atomical['request_ticker_status']['status'])
      console.log('Ticker:', atomical['ticker'])
      console.log('Confirmed balance:', atomical['confirmed'])
      console.log('UTXOs for Atomical:', atomicalsUtxosByAtomicalId[atomicalId].length);
    }
    return;
  }
  if (showExtra) {
    console.log(JSON.stringify(obj, null, 2));
  } else {
    const atomicals_balances_summarized = {}
    for (const prop in obj.atomicals_balances) {
      if (!obj.atomicals_balances.hasOwnProperty(prop)) {
        continue;
      }
      atomicals_balances_summarized[prop] = {
        ...obj.atomicals_balances[prop],
        data: undefined
      }
    }
    const summaryOnly = {
      address: obj.address,
      scripthash: obj.scripthash,
      atomicals_count: obj.atomicals_count,
      // atomicals_utxos: obj.atomicals_utxos,
      atomicals_balances: atomicals_balances_summarized,
      total_confirmed: obj.total_confirmed,
      total_unconfirmed: obj.total_unconfirmed,
      atomicals_confirmed: obj.atomicals_confirmed,
      atomicals_unconfirmed: obj.atomicals_unconfirmed,
      regular_confirmed: obj.regular_confirmed,
      regular_unconfirmed: obj.regular_unconfirmed,
      regular_utxo_count: obj.regular_utxo_count,
      // regular_utxos: obj.regular_utxos,
    }
    console.log(JSON.stringify(summaryOnly, null, 2));
  }
}

function resolveWalletAliasNew(walletInfo: IValidatedWalletInfo, alias: string | undefined, defaultValue: any): IWalletRecord {
  if (!alias) {
    return defaultValue;
  }
  if (walletInfo[alias]) {
    return walletInfo[alias];
  }
  if (walletInfo.imported[alias]) {
    return walletInfo.imported[alias]
  }
  throw 'No wallet alias found by name ' + alias;
}

/////////////////////////////////////////////////////////////////////////////////////////////
// Start of Command Line Options Definitions
/////////////////////////////////////////////////////////////////////////////////////////////

const program = new Command();

program
  .name('Atomicals CLI Utility')
  .description('Command line utility for interacting with Atomicals')
  .version('1.0.0');

program.command('server-version')
  .description('Get electrumx server version info')
  .action(async (options) => {
    try {
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const result = await atomicals.serverVersion();
      console.log('result', result);
    } catch (error) {
      console.log(error);
    }
  });

/////////////////////////////////////////////////////////////////////////////////////////////
// Wallet and Local Wallet Commands
/////////////////////////////////////////////////////////////////////////////////////////////

program.command('wallet-create')
  .description('Creates and displays new 12-word secret mnemonic phrase along with the primary and funding addresses')
  .action(async (options) => {
    const result = await Atomicals.walletCreate();
    console.log('Generated mnemonic phrase:');
    console.log(`phrase: ${result.data.phrase}`);
    console.log(`Primary address (P2TR): ${result.data.primary.address}`);
    console.log(`Primary address WIF: ${result.data.primary.WIF}`);
    console.log(`Primary address path: ${result.data.primary.path}`);
    console.log(`Funding address (P2TR): ${result.data.funding.address}`);
    console.log(`Funding address WIF: ${result.data.funding.WIF}`);
    console.log(`Funding address path: ${result.data.funding.path}`);
    console.log(result)
    console.log(`------------------------------------------------------`);
  });

program.command('wallet-decode')
  .description('Decode secret mnemonic phrase to display derive address and key at provided path')
  .argument('<phrase>', 'string')
  .option('-p, --path <string>', 'Derivation path to use', `m/44'/0'/0'/0/0`)
  .action(async (phrase, options) => {
    let path = options.path;
    const result = await Atomicals.walletPhraseDecode(phrase, path);
    console.log('Provided mnemonic phrase:');
    console.log(`phrase: ${result.data.phrase}`);
    console.log(`Requested Derivation Path: ${path}`);
    console.log(`Address: ${result.data.address}`);
    console.log(`Address path: ${result.data.path}`);
    console.log(`Address WIF: ${result.data.WIF}`);
    console.log(result)
    console.log(`------------------------------------------------------`);
  });

program.command('wallet-init')
  .description('Initializes a new wallet at wallet.json')
  .action(async (options) => {
    try {
      const result = await Atomicals.walletInit();
      console.log('Wallet created at wallet.json');
      console.log(`phrase: ${result.data.phrase}`);
      console.log(`Primary address (P2TR): ${result.data.primary.address}`);
      console.log(`Primary address WIF: ${result.data.primary.WIF}`);
      console.log(`Primary address path: ${result.data.primary.path}`);
      console.log(`Funding address (P2TR): ${result.data.funding.address}`);
      console.log(`Funding address WIF: ${result.data.funding.WIF}`);
      console.log(`Funding address path: ${result.data.funding.path}`);
      console.log(`------------------------------------------------------`);
    } catch (err) {
      console.log('Error', err);
    }
  });

program.command('wallet-import')
  .description('Import a wallet by WIF and assign it to provided alias')
  .argument('<wif>', 'string')
  .argument('<alias>', 'string')
  .action(async (wif, alias, options) => {
    try {
      await validateWalletStorage();
      await Atomicals.walletImport(wif, alias);
      console.log('Success! wallet.json updated')
    } catch (error) {
      console.log(error);
    }
  });

program.command('address-script')
  .description('Encodes an address or wallet alias as the hex output script')
  .argument('<addressOrAlias>', 'string')
  .action(async (addressOrAlias, options) => {
    const walletInfo = await validateWalletStorage();
    const result: { output: any, address: string } = performAddressAliasReplacement(walletInfo, addressOrAlias || undefined);
    console.log('Address:', result.address)
    console.log('Script:', result.output.toString('hex'))
    console.log(`------------------------------------------------------`);
  });


program.command('address')
  .description('Get balances and Atomicals stored at an address')
  .argument('<address>', 'string')
  .option('--history', 'Verbose output to include history or not')
  .action(async (address, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const history = options.history ? true : false;
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const receive: { output: any, address: string } = performAddressAliasReplacement(walletInfo, address || undefined);
      const result: any = await atomicals.addressInfo(receive.address, history);
      qrcode.generate(result.data?.address, { small: false });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('wallets')
  .description('Get balances and atomicals stored at internal wallets')
  .option('--history', 'Shows history of txids for each wallet if enabled')
  .option('--all', 'Shows all loaded wallets and not just the primary and funding')
  .option('--extra', 'Show extended wallet information such as specific utxos. Default is to only show a summary.')
  .option('--balances', 'Show FT token balances')
  .option('--noqr', 'Hide QR codes')
  .option('--alias <string>', 'Restrict to only showing one of the imported wallets identified by the alias')
  .option('--type <string>', 'Show NFT or FT types only. By default shows both')
  .option('--identify <string>', 'Restrict to only showing one of the imported wallets identified by the address (if it is found)')
  .option('--address <string>', 'Show the data and a QR code for an arbitrary address. Not expected to be loaded into local wallets.')
  .action(async (options) => {
    try {
      const all = options.all ? true : false;
      const history = options.history ? true : false;
      const alias = options.alias ? options.alias : null;
      const extra = options.extra ? options.extra : null;
      const address = options.address ? options.address : null;
      const noqr = options.noqr ? options.noqr : null;
      const balancesOnly = options.balances ? options.balances : null;
      const identify = options.identify ? options.identify : null;
      const show = options.address ? options.address : null;
      const type = options.type ? options.type : 'all';
      if (type && (type.toLowerCase() !== 'all' && type.toLowerCase() !== 'nft' && type.toLowerCase() != 'ft')) {
        throw `Invalid type ${type}`
      }
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const electrum = ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || '');
      const atomicals = new Atomicals(config, electrum);
      const keepElectrumAlive = true;
      if (alias) {
        if (!walletInfo.imported || !walletInfo.imported[alias]) {
          throw `No wallet with alias ${alias}`
        }
        let result: any = await atomicals.walletInfo(walletInfo.imported[alias].address, history, keepElectrumAlive);
        console.log("\n========================================================================================================")
        console.log(`Wallet Information - ${alias} Address - ${result.data?.address}`)
        console.log("========================================================================================================")
        if (!noqr) {
          qrcode.generate(result.data?.address, { small: false });
        }
        showWalletDetails(result.data, type, extra, balancesOnly)
      } else if (identify) {
        console.log("\n========================================================================================================")
        console.log(`Request Identify Wallet: ${identify}`)
        console.log("========================================================================================================")
        let foundWallet = false;
        for (const walletAlias in walletInfo.imported) {
          if (!walletInfo.imported[walletAlias]) {
            continue;
          }
          if (walletInfo.imported[walletAlias].address === identify) {
            foundWallet = true;
            let result: any = await atomicals.walletInfo(walletInfo.imported[walletAlias].address, history, keepElectrumAlive);
            console.log("\n========================================================================================================")
            console.log(`Wallet Information - ${walletAlias} Address`)
            console.log("========================================================================================================")
            if (!noqr) {
              qrcode.generate(result.data?.address, { small: false });
            }
            showWalletDetails(result.data, type, extra, balancesOnly)
          }
        }

        if (!foundWallet) {
          console.log(`No imported wallet found with address ${identify}`)
        }
      } else if (show) {
        console.log("\n========================================================================================================")
        console.log(`Request Show Address: ${show}`)
        console.log("========================================================================================================")
        let result: any = await atomicals.walletInfo(show, history, keepElectrumAlive);
        console.log("\n========================================================================================================")
        console.log(`Address Information - ${show} Address - ${result.data?.address}`)
        console.log("========================================================================================================")
        if (!noqr) {
          qrcode.generate(result.data?.address, { small: false });
        }
        showWalletDetails(result.data, type, extra, balancesOnly)
      } else {
        // Just show the primary and funding address
        let result: any = await atomicals.walletInfo(walletInfo.primary.address, history, keepElectrumAlive);
        console.log("\n========================================================================================================")
        console.log(`1. Wallet Information - Primary Address - ${result.data?.address}`)
        console.log("========================================================================================================")
        if (!noqr) {
          qrcode.generate(result.data?.address, { small: false });
        }
        showWalletDetails(result.data, type, extra, balancesOnly)

        result = await atomicals.walletInfo(walletInfo.funding.address, history, keepElectrumAlive);
        console.log("\n========================================================================================================")
        console.log(`2. Wallet Information - Funding Address - ${result.data?.address}`)
        console.log("========================================================================================================")
        if (!noqr) {
          qrcode.generate(result.data?.address, { small: false });
        }
        showWalletDetails(result.data, type, extra, balancesOnly)

        if (all) {
          let counter = 3;
          if (walletInfo.imported) {
            for (const walletAlias in walletInfo.imported) {
              if (!walletInfo.imported.hasOwnProperty(walletAlias)) {
                continue;
              }
              result = await atomicals.walletInfo(walletInfo.imported[walletAlias].address, history, keepElectrumAlive);
              console.log("\n========================================================================================================")
              console.log(`${counter}. Wallet Information - ${walletAlias} Address - ${result.data?.address}`)
              console.log("========================================================================================================")
              if (!noqr) {
                qrcode.generate(result.data?.address, { small: false });
              }
              showWalletDetails(result.data, type, extra, balancesOnly)
              counter++;
            }
          }
        }
      }
      console.log("\n\n");
      await electrum.close();
    } catch (error) {
      console.log(error);
    }
  });
program.command('balances')
  .description('Get balances and atomicals stored at internal wallets')
  .option('--noqr', 'Hide QR codes')
  .option('--utxos', 'Show utxos too')
  .option('--all', 'Shows all loaded wallets and not just the primary and funding')
  .option('--alias <string>', 'Restrict to only showing one of the imported wallets identified by the alias')
  .option('--address <string>', 'Restrict to only showing by address. Using this option with --alias has no effect.')
  .action(async (options) => {
    try {
      const alias = options.alias ? options.alias : null;
      const noqr = options.noqr ? options.noqr : null;
      const address = options.address ? options.address : null;
      const all = options.all ? true : false;
      const utxos = options.utxos ? true : false;
      const balancesOnly = true
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const electrum = ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || '');
      const atomicals = new Atomicals(config, electrum);
      const keepElectrumAlive = true;
      if (alias) {
        if (!walletInfo.imported || !walletInfo.imported[alias]) {
          throw `No wallet with alias ${alias}`
        }
        let result: any = await atomicals.walletInfo(walletInfo.imported[alias].address, false, keepElectrumAlive);
        console.log("\n========================================================================================================")
        console.log(`Wallet Information - ${alias} Address - ${result.data?.address}`)
        console.log("========================================================================================================")
        if (!noqr) {
          qrcode.generate(result.data?.address, { small: false });
        }
        showWalletFTBalancesDetails(result.data, utxos)
      } else if (address) {
        let result: any = await atomicals.walletInfo(address, false, keepElectrumAlive);
        console.log("\n========================================================================================================")
        console.log(`Wallet Information - Address - ${result.data?.address}`)
        console.log("========================================================================================================")
        if (!noqr) {
          qrcode.generate(result.data?.address, { small: false });
        }
        showWalletFTBalancesDetails(result.data, utxos)
      } else {
        // Just show the primary and funding address
        let result: any = await atomicals.walletInfo(walletInfo.primary.address, false, keepElectrumAlive);
        console.log("\n========================================================================================================")
        console.log(`1. Wallet Information - Primary Address - ${result.data?.address}`)
        console.log("========================================================================================================")
        if (!noqr) {
          qrcode.generate(result.data?.address, { small: false });
        }
        showWalletFTBalancesDetails(result.data, utxos)

        result = await atomicals.walletInfo(walletInfo.funding.address, false, keepElectrumAlive);
        console.log("\n========================================================================================================")
        console.log(`2. Wallet Information - Funding Address - ${result.data?.address}`)
        console.log("========================================================================================================")
        if (!noqr) {
          qrcode.generate(result.data?.address, { small: false });
        }
        showWalletFTBalancesDetails(result.data, utxos)

        if (all) {
          let counter = 3;
          if (walletInfo.imported) {
            for (const walletAlias in walletInfo.imported) {
              if (!walletInfo.imported.hasOwnProperty(walletAlias)) {
                continue;
              }
              result = await atomicals.walletInfo(walletInfo.imported[walletAlias].address, false, keepElectrumAlive);
              console.log("\n========================================================================================================")
              console.log(`${counter}. Wallet Information - ${walletAlias} Address - ${result.data?.address}`)
              console.log("========================================================================================================")
              if (!noqr) {
                qrcode.generate(result.data?.address, { small: false });
              }
              showWalletFTBalancesDetails(result.data, utxos)
              counter++;
            }
          }
        }
      }
      console.log("\n\n");
      await electrum.close();
    } catch (error) {
      console.log(error);
    }
  });

program.command('address-utxos')
  .description('List all utxos owned by an address')
  .argument('<address>', 'string')
  .action(async (address, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      // address = performAddressAliasReplacement(walletInfo, address);
      const receive: { output: any, address: string } = performAddressAliasReplacement(walletInfo, address || undefined);
      const result = await atomicals.getUtxos(receive.address);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('address-history')
  .description('List address history of an address')
  .argument('<address>', 'string')
  .action(async (address, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const receive: { output: any, address: string } = performAddressAliasReplacement(walletInfo, address || undefined);
      const result = await atomicals.getHistory(receive.address);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('tx')
  .description('Get any transaction')
  .argument('<txid>', 'string')
  .option('--verbose', 'Verbose output')
  .action(async (txid, options) => {
    try {
      await validateWalletStorage();
      const verbose = options.verbose ? true : false;
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const result = await atomicals.getTx(txid, verbose);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.log(error);
    }
  });

/////////////////////////////////////////////////////////////////////////////////////////////
// Name Retrieval Commands (Tickers, (Sub)Realms, Containers)
/////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Resolve a realm or subrealm
 * 
 * @param realm_or_subrealm Realm or subrealm to resolve
 * @param options 
 */
const resolveRealmAction = async (realm_or_subrealm, options) => {
  try {
    const config: ConfigurationInterface = validateCliInputs();
    const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
    const result: any = await atomicals.getAtomicalByRealm(realm_or_subrealm);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(error);
  }
}

program.command('get-ticker')
  .description('Get Atomical by ticker name')
  .argument('<ticker>', 'string')
  .option('--verbose', 'Verbose to show extended information.')
  .action(async (ticker, options) => {
    try {
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const result: any = await atomicals.getAtomicalByTicker(ticker);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.log(error);
    }
  });

program.command('get-container')
  .description('Get Atomical by container name')
  .argument('<container>', 'string')
  .option('--verbose', 'Verbose to show extended information.')
  .action(async (container, options) => {
    try {
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const result: any = await atomicals.getAtomicalByContainer(container);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.log(error);
    }
  });

program.command('resolve')
  .description(`Resolve a realm or subrealm. Alias for 'get-realm'`)
  .argument('<realm_or_subrealm>', 'string')
  .option('--verbose', 'Verbose to show extended information.')
  .action(async (realm_or_subrealm, options) => {
    await resolveRealmAction(realm_or_subrealm, options)
  });

program.command('get-realm')
  .description(`Resolve a realm or subrealm. Alias for 'resolve'`)
  .argument('<realm_or_subrealm>', 'string')
  .option('--verbose', 'Verbose to show extended information.')
  .action(async (realm_or_subrealm, options) => {
    await resolveRealmAction(realm_or_subrealm, options)
  });

program.command('realm-info')
  .description('Get realm and subrealm information of an atomical')
  .argument('<atomicalIdAlias>', 'string')
  .option('--verbose', 'Verbose output')
  .action(async (atomicalAliasOrId, options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const verbose = options.verbose ? true : false;
      const modifiedStripped = atomicalAliasOrId.indexOf('+') === 0 ? atomicalAliasOrId.substring(1) : atomicalAliasOrId;
      const result = await atomicals.getRealmInfo(modifiedStripped, verbose);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.log(error);
    }
  });

program.command('summary-subrealms')
  .description('Show summary of owned subrealms by wallet')
  .option('--owner <string>', 'Provide alternate wallet alias to query')
  .option('--filter <string>', 'Filter by status')
  .action(async (options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const filter = options.filter ? options.filter : undefined;
      const result: any = await atomicals.summarySubrealms(ownerWalletRecord.address, filter);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('summary-containers')
  .description('Show summary of owned containers by wallet')
  .option('--owner <string>', 'Provide alternate wallet alias to query')
  .option('--filter <string>', 'Filter by status')
  .action(async (options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const filter = options.filter ? options.filter : undefined;
      const result: any = await atomicals.summaryContainers(ownerWalletRecord.address, filter);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('summary-realms')
  .description('Show summary of owned realms by wallet')
  .option('--owner <string>', 'Provide alternate wallet alias to query')
  .option('--filter <string>', 'Filter by status')
  .action(async (options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const filter = options.filter ? options.filter : undefined;
      const result: any = await atomicals.summaryRealms(ownerWalletRecord.address, filter);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('summary-tickers')
  .description('Show summary of owned tokens by tickers by wallet')
  .option('--owner <string>', 'Provide alternate wallet alias to query')
  .option('--filter <string>', 'Filter by status')
  .action(async (options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const filter = options.filter ? options.filter : undefined;
      const result: any = await atomicals.summaryTickers(ownerWalletRecord.address, filter);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('find-tickers')
  .description('Search tickers')
  .option('--q <string>', 'Search query')
  .option('--asc <string>', 'Sort by ascending', 'true')
  .action(async (options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const verbose = options.verbose ? true : false;
      const q = options.q ? options.q : null;
      const asc = options.asc === 'true' ? true : false
      const result = await atomicals.searchTickers(q, verbose, asc);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('find-realms')
  .description('Search realms')
  .option('--q <string>', 'Search query')
  .option('--asc <string>', 'Sort by ascending', 'true')
  .action(async (options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const verbose = options.verbose ? true : false;
      const q = options.q ? options.q : null;
      const asc = options.asc === 'true' ? true : false
      const result = await atomicals.searchRealms(q, verbose, asc);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('find-containers')
  .description('Search containers')
  .option('--q <string>', 'Search query')
  .option('--asc <string>', 'Sort by ascending', 'true')
  .action(async (prefix, options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const verbose = options.verbose ? true : false;
      const q = options.q ? options.q : null;
      const asc = options.asc === 'true' ? true : false
      const result = await atomicals.searchContainers(q, verbose, asc);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

/////////////////////////////////////////////////////////////////////////////////////////////
// Modify, Updates, Events, Delete...
/////////////////////////////////////////////////////////////////////////////////////////////

program.command('set')
  .description('Set (update) an existing Atomical with data.')
  .argument('<atomicalIdAlias>', 'string')
  .argument('<path>', 'string')
  .argument('<data...>', 'string')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomical')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into output', '1000')
  .action(async (atomicalId, path, data, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const result: any = await atomicals.setInteractive(atomicalId, path, data, fundingWalletRecord, ownerWalletRecord, {
        satsbyte: parseInt(options.satsbyte, 10),
        satsoutput: parseInt(options.satsoutput, 10)
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('emit')
  .description('Emit an event for an existing Atomical with data.')
  .argument('<atomicalIdAlias>', 'string')
  .argument('<path>', 'string')
  .argument('<data...>', 'string')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomical')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into output', '1000')
  .action(async (atomicalId, path, data, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const result: any = await atomicals.emitInteractive(atomicalId, path, data, fundingWalletRecord, ownerWalletRecord, {
        satsbyte: parseInt(options.satsbyte, 10),
        satsoutput: parseInt(options.satsoutput, 10),
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });


program.command('set-relation')
  .description('Set relationship an existing Atomical with data.')
  .argument('<atomicalId>', 'string')
  .argument('<relationName>', 'string')
  .argument('<relationValues...>', 'string')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomical')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into output', '1000')
  .action(async (atomicalId, relationName, values, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const result: any = await atomicals.setRelationInteractive(atomicalId, relationName, values, fundingWalletRecord, ownerWalletRecord, {
        satsbyte: parseInt(options.satsbyte, 10),
        satsoutput: parseInt(options.satsoutput, 10)
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('delete')
  .description('Delete keys for existing Atomical.')
  .argument('<atomicalIdAlias>', 'string')
  .argument('<path>', 'string')
  .argument('<keystoDelete...>', 'string')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomical')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into output', '1000')
  .option('--bitworkc <string>', 'Whether to add any bitwork proof of work to the commit tx')
  .option('--bitworkr <string>', 'Whether to add any bitwork proof of work to the reveal tx.')
  .option('--disablechalk', 'Whether to disable the real-time chalked logging of each hash for mining. Improvements mining performance to set this flag')
  .action(async (atomicalId, path, keystoDelete, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const result: any = await atomicals.deleteInteractive(atomicalId, path, keystoDelete, ownerWalletRecord, fundingWalletRecord, {
        satsbyte: parseInt(options.satsbyte, 10),
        satsoutput: parseInt(options.satsoutput, 10),
        bitworkc: options.bitworkc,
        bitworkr: options.bitworkr,
        disableMiningChalk: options.disablechalk
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('seal')
  .description('Seal any NFT Atomical type permanently so that it can never be updated or transferred ever again.')
  .argument('<atomicalIdAlias>', 'string')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomical')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .action(async (atomicalId, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const result: any = await atomicals.sealInteractive(atomicalId, fundingWalletRecord, ownerWalletRecord, {
        satsbyte: parseInt(options.satsbyte)
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('splat')
  .description('Extract an NFT Atomical from a UTXO which contains multiple Atomicals')
  .argument('<locationId>', 'string')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomical')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into each output', '1000')
  .action(async (locationId, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const result: any = await atomicals.splatInteractive(locationId, fundingWalletRecord, ownerWalletRecord, {
        satsbyte: parseInt(options.satsbyte),
        satsoutput: parseInt(options.satsoutput),
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('split')
  .description('Split operation to seperate the FT Atomicals at a single UTXOs.')
  .argument('<locationId>', 'string')
  .option('--funding <string>', 'Use wallet alias wif key to be used for funding')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomical')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .action(async (locationId, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const result: any = await atomicals.splitItneractive(locationId, fundingWalletRecord, ownerWalletRecord, {
        satsbyte: parseInt(options.satsbyte)
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('get')
  .description('Get the status of an Atomical')
  .argument('<atomicalAliasOrId>', 'string')
  .option('--verbose', 'Verbose output')
  .action(async (atomicalAliasOrId, options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const verbose = options.verbose ? true : false;
      const result = await atomicals.resolveAtomical(atomicalAliasOrId, AtomicalsGetFetchType.GET, undefined, verbose);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('global')
  .description('Get global status')
  .option('--hashes <number>', 'How many atomicals block hashes to retrieve', '10')
  .action(async (options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const headersCount = parseInt(options.hashes, 10)
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const result = await atomicals.global(headersCount);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('dump')
  .description('dump')
  .action(async (options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const result = await atomicals.dump();
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('location')
  .description('Get locations of an Atomical')
  .argument('<atomicalAliasOrId>', 'string')
  .option('--verbose', 'Verbose output')
  .action(async (atomicalAliasOrId, options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const verbose = options.verbose ? true : false;
      const result = await atomicals.resolveAtomical(atomicalAliasOrId, AtomicalsGetFetchType.LOCATION, undefined, verbose);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('ftinfo')
  .description('Get FT specific info for an FT atomical')
  .argument('<atomicalAliasOrId>', 'string')
  .action(async (atomicalAliasOrId, options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const result = await atomicals.getAtomicalFtInfo(atomicalAliasOrId);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('state')
  .description('Get the state of an Atomical')
  .argument('<atomicalAliasOrId>', 'string')
  .argument('<path>', 'string')
  .option('--verbose', 'Verbose output')
  .action(async (atomicalAliasOrId, path, options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const verbose = options.verbose ? true : false;
      const result = await atomicals.resolveAtomical(atomicalAliasOrId, AtomicalsGetFetchType.STATE, path, verbose);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('state-history')
  .description('Get the state history of an Atomical')
  .argument('<atomicalAliasOrId>', 'string')
  .option('--verbose', 'Verbose output')
  .action(async (atomicalAliasOrId, options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const verbose = options.verbose ? true : false;
      const result = await atomicals.resolveAtomical(atomicalAliasOrId, AtomicalsGetFetchType.STATE_HISTORY, undefined, verbose);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('event-history')
  .description('Get the event state history of an Atomical')
  .argument('<atomicalAliasOrId>', 'string')
  .option('--verbose', 'Verbose output')
  .action(async (atomicalAliasOrId, options) => {
    try {
      await validateWalletStorage();

      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const verbose = options.verbose ? true : false;
      const result = await atomicals.resolveAtomical(atomicalAliasOrId, AtomicalsGetFetchType.EVENT_HISTORY, undefined, verbose);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });


/////////////////////////////////////////////////////////////////////////////////////////////
// Subrealm Minting and Payments Management Operations
/////////////////////////////////////////////////////////////////////////////////////////////

program.command('enable-subrealms')
  .description('Set and enable subrealm minting rules for a realm or subrealm')
  .argument('<realmOrSubRealm>', 'string')
  .argument('<rules...>')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomical')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into output', '1000')
  .option('--bitworkc <string>', 'Whether to add any bitwork proof of work to the commit tx')
  .option('--bitworkr <string>', 'Whether to add any bitwork proof of work to the reveal tx.')
  .option('--disablechalk', 'Whether to disable the real-time chalked logging of each hash for mining. Improvements mining performance to set this flag')
  .action(async (realmOrSubRealm, rules, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const result: any = await atomicals.enableSubrealmRules(realmOrSubRealm, rules, fundingWalletRecord, ownerWalletRecord, {
        satsbyte: parseInt(options.satsbyte),
        satsoutput: parseInt(options.satsoutput),
        bitworkc: options.bitworkc,
        bitworkr: options.bitworkr,
        disableMiningChalk: options.disablechalk
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('disable-subrealm-mints')
  .description('Delete the subrealm minting rules for a realm or subrealm')
  .argument('<realmOrSubRealm>', 'string')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomical')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into output', '1000')
  .option('--bitworkc <string>', 'Whether to add any bitwork proof of work to the commit tx')
  .option('--bitworkr <string>', 'Whether to add any bitwork proof of work to the reveal tx.')
  .option('--disablechalk', 'Whether to disable the real-time chalked logging of each hash for mining. Improvements mining performance to set this flag')
  .action(async (realmOrSubRealm, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const result: any = await atomicals.disableSubrealmRules(realmOrSubRealm, fundingWalletRecord, ownerWalletRecord, {
        satsbyte: parseInt(options.satsbyte),
        satsoutput: parseInt(options.satsoutput),
        bitworkc: options.bitworkc,
        bitworkr: options.bitworkr,
        disableMiningChalk: options.disablechalk
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('pending-subrealms')
  .description('Display pending subrealm Atomical requests and make payments')
  .option('--owner <string>', 'Show pending subrealms for an address or wallet')
  .option('--display', 'Show pending subrealms for an address or wallet')
  .option('--verbose', 'Show verbose raw output')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding and change')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .action(async (options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      const display = options.display ? true : false;
      const satsbyte = parseInt(options.satsbyte);
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      const result = await atomicals.pendingSubrealms(ownerWalletRecord.address, fundingWalletRecord, satsbyte, display);
      if (options.verbose) {
        handleResultLogging(result);
      }
    } catch (error) {
      console.log(error);
    }
  });

/////////////////////////////////////////////////////////////////////////////////////////////
// Mint NFTs, FTs Operations
/////////////////////////////////////////////////////////////////////////////////////////////

program.command('mint-ft')
  .description('Mint fungible token (FT) Atomical in direct issuance mode')
  .argument('<ticker>', 'string')
  .argument('<supply>', 'number')
  .argument('<files...>', 'string')
  .option('--meta <string...>', 'Populate the \'meta\' field with key value pairs or file contents')
  .option('--ctx <string...>', 'Populate the \'ctx\' field with key value pairs or file contents')
  .option('--init <string...>', 'Populate the \'init\' field with key value pairs or file contents')
  .option('--initialowner <string>', 'Initial owner wallet alias to mint the Atomical into')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding and change')
  .option('--bitworkc <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the commit transaction.')
  .option('--bitworkr <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the reveal transaction.')
  .option('--parent <string>', 'Whether to require a parent atomical to be spent along with the mint.')
  .option('--parentowner <string>', 'Wallet owner of the parent to spend along with the mint.')
  .option('--disablechalk', 'Whether to disable the real-time chalked logging of each hash for mining. Improvements mining performance to set this flag')
  .action(async (ticker, supply, files, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const requestTicker = ticker.toLowerCase();
      let parentOwnerRecord = resolveWalletAliasNew(walletInfo, options.parentowner, walletInfo.primary);
      let fundingRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let walletRecord = resolveWalletAliasNew(walletInfo, options.initialowner, walletInfo.primary);
      if (isNaN(supply)) {
        throw 'supply must be an integer';
      }
      const result: any = await atomicals.mintFtInteractive(files, parseInt(supply), walletRecord.address, requestTicker, fundingRecord.WIF, {
        meta: options.meta,
        ctx: options.ctx,
        init: options.init,
        satsbyte: parseInt(options.satsbyte),
        container: options.container,
        bitworkc: options.bitworkc ? options.bitworkc : getRandomBitwork4(),
        bitworkr: options.bitworkr,
        parent: options.parent,
        parentOwner: parentOwnerRecord,
        disableMiningChalk: options.disablechalk
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('init-dft')
  .description('Initialize fungible token (FT) atomical in decentralized issuance mode')
  .argument('<ticker>', 'string')
  .argument('<mint_amount>', 'number')
  .argument('<max_mints>', 'number')
  .argument('<mint_height>', 'number')
  .argument('<files...>', 'string')
  .option('--meta <string...>', 'Populate the \'meta\' field with key value pairs or file contents')
  .option('--ctx <string...>', 'Populate the \'ctx\' field with key value pairs or file contents')
  .option('--init <string...>', 'Populate the \'init\' field with key value pairs or file contents')
  .option('--funding <string>', 'Use wallet alias wif key to be used for funding and change')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--mintbitworkc <string>', 'Whether to require any bitwork proof of work to mint. Applies to the commit transaction.')
  .option('--mintbitworkr <string>', 'Whether to require any bitwork proof of work to mint. Applies to the reveal transaction.')
  .option('--bitworkc <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the commit transaction.')
  .option('--bitworkr <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the reveal transaction.')
  .option('--parent <string>', 'Whether to require a parent atomical to be spent along with the mint.')
  .option('--parentowner <string>', 'Wallet owner of the parent to spend along with the mint.')
  .option('--disablechalk', 'Whether to disable the real-time chalked logging of each hash for Bitwork mining. Improvements mining performance to set this flag')
  .action(async (ticker, mintAmount, maxMints, mintHeight, files, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const requestTicker = ticker.toLowerCase();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let walletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      let parentOwnerRecord = resolveWalletAliasNew(walletInfo, options.parentowner, walletInfo.primary);
      let fundingRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      const mintBitworkc = options.mintbitworkc ? options.mintbitworkc : getRandomBitwork4();
      const result: any = await atomicals.initDftInteractive(files, walletRecord.address, requestTicker, mintAmount, maxMints, mintHeight, mintBitworkc, options.mintbitworkr, fundingRecord.WIF, {
        meta: options.meta,
        ctx: options.ctx,
        init: options.init,
        satsbyte: parseInt(options.satsbyte),
        satsoutput: parseInt(options.satsoutput),
        container: options.container,
        bitworkc: options.bitworkc ? options.bitworkc : getRandomBitwork4(),
        bitworkr: options.bitworkr,
        parent: options.parent,
        parentOwner: parentOwnerRecord,
        disableMiningChalk: options.disablechalk
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('mint-dft')
  .description('Mint coins for a decentralized fungible token (FT)')
  .argument('<ticker>', 'string')
  .option('--initialowner <string>', 'Make change into this wallet')
  .option('--funding <string>', 'Use wallet alias wif key to be used for funding and change')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--disablechalk', 'Whether to disable the real-time chalked logging of each hash for Bitwork mining. Improvements mining performance to set this flag')
  .action(async (ticker, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      ticker = ticker.toLowerCase();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let walletRecord = resolveWalletAliasNew(walletInfo, options.initialowner, walletInfo.primary);
      let fundingRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      const result: any = await atomicals.mintDftInteractive(walletRecord.address, ticker, fundingRecord.WIF, {
        satsbyte: parseInt(options.satsbyte),
        disableMiningChalk: options.disablechalk
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });


program.command('mint-nft')
  .description('Mint non-fungible token (NFT) Atomical')
  .argument('<files...>', 'string')
  .option('--meta <string...>', 'Populate the \'meta\' field with key value pairs or file contents')
  .option('--ctx <string...>', 'Populate the \'ctx\' field with key value pairs or file contents')
  .option('--init <string...>', 'Populate the \'init\' field with key value pairs or file contents')
  .option('--initialowner <string>', 'Initial owner wallet alias to mint the Atomical into')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into the minted atomical', '1000')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding and change')
  .option('--container <string>', 'Name of the container to request')
  .option('--bitworkc <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the commit transaction.')
  .option('--bitworkr <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the reveal transaction.')
  .option('--parent <string>', 'Whether to require a parent atomical to be spent along with the mint.')
  .option('--parentowner <string>', 'Wallet owner of the parent to spend along with the mint.')
  .option('--disablechalk', 'Whether to disable the real-time chalked logging of each hash for mining. Improvements mining performance to set this flag')
  .action(async (files, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let walletRecord = resolveWalletAliasNew(walletInfo, options.initialowner, walletInfo.primary);
      let parentOwnerRecord = resolveWalletAliasNew(walletInfo, options.parentowner, walletInfo.primary);
      let fundingRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      const result: any = await atomicals.mintNftInteractive(files, walletRecord.address, fundingRecord.WIF, {
        meta: options.meta,
        ctx: options.ctx,
        init: options.init,
        satsbyte: parseInt(options.satsbyte),
        satsoutput: parseInt(options.satsoutput),
        container: options.container,
        bitworkc: options.bitworkc,
        bitworkr: options.bitworkr,
        parent: options.parent,
        parentOwner: parentOwnerRecord,
        disableMiningChalk: options.disablechalk
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('mint-realm')
  .description('Mint top level Realm non-fungible token (NFT) Atomical')
  .argument('<realm>', 'string')
  .option('--meta <string...>', 'Populate the \'meta\' field with key value pairs or file contents')
  .option('--ctx <string...>', 'Populate the \'ctx\' field with key value pairs or file contents')
  .option('--init <string...>', 'Populate the \'init\' field with key value pairs or file contents')
  .option('--initialowner <string>', 'Initial owner wallet alias to mint the Atomical into')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into the minted atomical', '1000')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding and change')
  .option('--container <string>', 'Name of the container to request')
  .option('--bitworkc <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the commit transaction.')
  .option('--bitworkr <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the reveal transaction.')
  .option('--parent <string>', 'Whether to require a parent atomical to be spent along with the mint.')
  .option('--parentowner <string>', 'Wallet owner of the parent to spend along with the mint.')
  .option('--disablechalk', 'Whether to disable the real-time chalked logging of each hash for mining. Improvements mining performance to set this flag')
  .action(async (realm, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let walletRecord = resolveWalletAliasNew(walletInfo, options.initialowner, walletInfo.primary);
      let parentOwnerRecord = resolveWalletAliasNew(walletInfo, options.parentowner, walletInfo.primary);
      let fundingRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      const result: any = await atomicals.mintRealmInteractive(realm, walletRecord.address, fundingRecord.WIF, {
        meta: options.meta,
        ctx: options.ctx,
        init: options.init,
        satsbyte: parseInt(options.satsbyte),
        satsoutput: parseInt(options.satsoutput),
        container: options.container,
        bitworkc: options.bitworkc ? options.bitworkc : getRandomBitwork4(),
        bitworkr: options.bitworkr,
        parent: options.parent,
        parentOwner: parentOwnerRecord,
        disableMiningChalk: options.disablechalk
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('mint-subrealm')
  .description('Mint subrealm non-fungible token (NFT) Atomical')
  .argument('<realm>', 'string')
  .option('--meta <string...>', 'Populate the \'meta\' field with key value pairs or file contents')
  .option('--ctx <string...>', 'Populate the \'ctx\' field with key value pairs or file contents')
  .option('--init <string...>', 'Populate the \'init\' field with key value pairs or file contents')
  .option('--owner <string>', 'Owner of the parent Atomical. Used for direct subrealm minting.')
  .option('--initialowner <string>', 'Initial owner wallet alias to mint the Atomical into')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into the minted atomical', '1000')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding and change')
  .option('--container <string>', 'Name of the container to request')
  .option('--bitworkc <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the commit transaction.')
  .option('--bitworkr <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the reveal transaction.')
  .option('--disablechalk', 'Whether to disable the real-time chalked logging of each hash for mining. Improvements mining performance to set this flag')
  .action(async (subrealm, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let walletRecord = resolveWalletAliasNew(walletInfo, options.initialowner, walletInfo.primary);
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      let fundingRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      const result: any = await atomicals.mintSubrealmInteractive(subrealm, walletRecord.address, fundingRecord.WIF, ownerWalletRecord, {
        meta: options.meta,
        ctx: options.ctx,
        init: options.init,
        satsbyte: parseInt(options.satsbyte),
        satsoutput: parseInt(options.satsoutput),
        container: options.container,
        bitworkc: options.bitworkc,
        bitworkr: options.bitworkr,
        disableMiningChalk: options.disablechalk
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('mint-container')
  .description('Mint container non-fungible token (NFT) Atomical')
  .argument('<container>', 'string')
  .option('--meta <string...>', 'Populate the \'meta\' field with key value pairs or file contents')
  .option('--ctx <string...>', 'Populate the \'ctx\' field with key value pairs or file contents')
  .option('--init <string...>', 'Populate the \'init\' field with key value pairs or file contents')
  .option('--initialowner <string>', 'Initial owner wallet alias to mint the Atomical into')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into the minted atomical', '1000')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding and change')
  .option('--container <string>', 'Name of the container to request to be a member of. Not to be confused with the \'mint-container\' command to create a new container')
  .option('--bitworkc <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the commit transaction.')
  .option('--bitworkr <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the reveal transaction.')
  .option('--parent <string>', 'Whether to require a parent atomical to be spent along with the mint.')
  .option('--parentowner <string>', 'Wallet owner of the parent to spend along with the mint.')
  .option('--disablechalk', 'Whether to disable the real-time chalked logging of each hash for mining. Improvements mining performance to set this flag')
  .action(async (container, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let walletRecord = resolveWalletAliasNew(walletInfo, options.initialowner, walletInfo.primary);
      let parentOwnerRecord = resolveWalletAliasNew(walletInfo, options.parentowner, walletInfo.primary);
      let fundingRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      const result: any = await atomicals.mintContainerInteractive(container, walletRecord.address, fundingRecord.WIF, {
        meta: options.meta,
        ctx: options.ctx,
        init: options.init,
        satsbyte: parseInt(options.satsbyte),
        satsoutput: parseInt(options.satsoutput),
        container: options.container,
        bitworkc: options.bitworkc ? options.bitworkc : getRandomBitwork4(),
        bitworkr: options.bitworkr,
        parent: options.parent,
        parentOwner: parentOwnerRecord,
        disableMiningChalk: options.disablechalk
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });


/////////////////////////////////////////////////////////////////////////////////////////////
// Transfer NFTs and FTs Operations
/////////////////////////////////////////////////////////////////////////////////////////////

program.command('transfer-nft')
  .description('Transfer Atomical NFT to new address')
  .argument('<atomicalId>', 'string')
  .argument('<address>', 'string')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomical')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding and change')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into the transferred atomical', '546')
  .action(async (atomicalId, address, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const satsbyte = parseInt(options.satsbyte);
      const satsoutput = parseInt(options.satsoutput)
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      const receive: { output: any, address: string } = performAddressAliasReplacement(walletInfo, address);
      const result = await atomicals.transferInteractiveNft(atomicalId, ownerWalletRecord, fundingWalletRecord, receive.address, satsbyte, satsoutput);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('transfer-ft')
  .description('Transfer Atomical FT to other addresses')
  .argument('<atomicalId>', 'string')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomical')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding and change')
  .option('--satsbyte <number>', 'Satoshis per byte in   fees', '15')
  .action(async (atomicalId, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const satsbyte = parseInt(options.satsbyte);
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      const result = await atomicals.transferInteractiveFt(atomicalId, ownerWalletRecord, fundingWalletRecord, walletInfo, satsbyte);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('transfer-utxos')
  .description('Transfer plain regular UTXOs to another addresses')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomical')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding and change')
  .option('--satsbyte <number>', 'Satoshis per byte in   fees', '15')
  .action(async (options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const satsbyte = parseInt(options.satsbyte);
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      const result = await atomicals.transferInteractiveUtxos(ownerWalletRecord, fundingWalletRecord, walletInfo, satsbyte);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('merge-atomicals')
  .description('Merge Atomicals UTXOs together for test purposes')
  .option('--owner <string>', 'Use wallet alias WIF key to move the Atomicals')
  .option('--funding <string>', 'Use wallet alias WIF key to be used for funding and change')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .action(async (options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const satsbyte = parseInt(options.satsbyte, 10);
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let ownerWalletRecord = resolveWalletAliasNew(walletInfo, options.owner, walletInfo.primary);
      let fundingWalletRecord = resolveWalletAliasNew(walletInfo, options.funding, walletInfo.funding);
      const result = await atomicals.mergeInteractiveUtxos(ownerWalletRecord, fundingWalletRecord, walletInfo, satsbyte);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('tx-history')
  .description('Get the history of an Atomical')
  .argument('<atomicalAliasOrId>', 'string')
  .option('--verbose', 'Verbose output')
  .action(async (atomicalAliasOrId, options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const verbose = options.verbose ? true : false;
      const result = await atomicals.resolveAtomical(atomicalAliasOrId, AtomicalsGetFetchType.TX_HISTORY, undefined, verbose);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('list')
  .description('List feed of Atomicals minted globally')
  .option('--limit <number>', 'Limit the number of results', '20')
  .option('--offset <number>', 'Offset for pagination', '-20')
  .option('--asc <string>', 'Whether to sort by ascending or descending', 'true')
  .action(async (options) => {
    try {
      const limit = options.limit;
      const offset = options.offset;
      const asc = options.asc === 'true' ? true : false
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const result = await atomicals.list(parseInt(limit, 10), parseInt(offset, 10), asc);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('address-atomicals')
  .description('List all atomicals owned by an address')
  .argument('<address>', 'string')
  .action(async (address, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      // address = performAddressAliasReplacement(walletInfo, address);
      const receive: { output: any, address: string } = performAddressAliasReplacement(walletInfo, address || undefined);
      const result = await atomicals.getAtomicals(receive.address);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('at-location')
  .description('Get Atomicals at a utxo location')
  .argument('<location>', 'string')
  .action(async (location, options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const result = await atomicals.getAtomicalsAtLocation(location);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });


/////////////////////////////////////////////////////////////////////////////////////////////
// General Data Storage and Retrieval (Non-Atomicals)
/////////////////////////////////////////////////////////////////////////////////////////////

program.command('store-dat')
  .description('Store general immutable data transaction that is not an NFT or FT')
  .argument('<files...>', 'string')
  .option('--meta <string...>', 'Populate the \'meta\' field with key value pairs or file contents')
  .option('--ctx <string...>', 'Populate the \'ctx\' field with key value pairs or file contents')
  .option('--init <string...>', 'Populate the \'init\' field with key value pairs or file contents')
  .option('--initialowner <string>', 'Initial owner wallet alias to mint the Atomical into')
  .option('--satsbyte <number>', 'Satoshis per byte in fees', '15')
  .option('--satsoutput <number>', 'Satoshis to put into output', '1000')
  .option('--bitworkc <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the commit transaction.')
  .option('--bitworkr <string>', 'Whether to put any bitwork proof of work into the token mint. Applies to the reveal transaction.')
  .option('--parent <string>', 'Whether to require a parent atomical to be spent along with the mint.')
  .option('--parentowner <string>', 'Wallet owner of the parent to spend along with the mint.')
  .option('--disablechalk', 'Whether to disable the real-time chalked logging of each hash for mining. Improvements mining performance to set this flag')
  .action(async (files, options) => {
    try {
      const walletInfo = await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      let walletRecord = resolveWalletAliasNew(walletInfo, options.initialowner, walletInfo.primary);
      let parentOwnerRecord = resolveWalletAliasNew(walletInfo, options.parentowner, walletInfo.primary);
      const result: any = await atomicals.mintDatInteractive(files, walletRecord.address, walletRecord.WIF, {
        meta: options.meta,
        ctx: options.ctx,
        init: options.init,
        satsbyte: parseInt(options.satsbyte, 10),
        satsoutput: parseInt(options.satsoutput, 10),
        bitworkc: options.bitworkc,
        bitworkr: options.bitworkr,
        parent: options.parent,
        parentOwner: parentOwnerRecord,
        disableMiningChalk: options.disablechalk
      });
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });

program.command('download')
  .description('Download a file from a locationId or atomicalId')
  .argument('<locationIdOrTxId>', 'string')
  .option('--body', 'Whether to include the body bytes in the print out or suppress it')
  .action(async (locationIdOrTxId, options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const result: any = await atomicals.download(locationIdOrTxId);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });


program.command('broadcast')
  .description('broadcast a rawtx')
  .option('--rawtx <string>', 'Rawtx')
  .option('--rawtxfile <string>', 'File path to the rawtx')
  .action(async (options) => {
    try {
      await validateWalletStorage();
      const config: ConfigurationInterface = validateCliInputs();
      if (!options.rawtx && !options.rawtxfile) {
        throw new Error("must specify either rawtx or rawtxfile")
      }
      let rawtx = options.rawtx;
      if (!rawtx) {
        rawtx = options.rawtxfile;
        rawtx = await fileReader(rawtx, 'utf8');
      }
      const atomicals = new Atomicals(config, ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const result: any = await atomicals.broadcast(rawtx);
      handleResultLogging(result);
    } catch (error) {
      console.log(error);
    }
  });


program.parse();
