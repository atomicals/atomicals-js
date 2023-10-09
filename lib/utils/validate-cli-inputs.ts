import { ConfigurationInterface } from '../interfaces/configuration.interface';
export const validateCliInputs = (): ConfigurationInterface => {
  let electrumxWebsocketUrl = '';
  // Validate the BITCOIND_RPCURL 
  if (process.env.ELECTRUMX_PROXY_BASE_URL) {
    electrumxWebsocketUrl = process.env.ELECTRUMX_PROXY_BASE_URL;
  }

  return {
    electrumxWebsocketUrl,
    satsPerByte: parseInt(process.env.SATS_PER_BYTE || '8'),
    minFundingSatoshisPerUtxo: parseInt(process.env.MIN_FUNDING_SATOSHIS_PER_UTXO || '10000', 10)
  }
}
