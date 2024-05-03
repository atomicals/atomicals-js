# Atomicals Javascript Library

Use `yarn` package manager instead of `npm`. Instructions below (They are: `npm install -g yarn`)

In the latest version of the CLI processing library the option switches (the settings starting with `--`) are not processed correctly and it would lead to
too small of a fee being set and result in your transactions not being mined.

Workaround: Use `yarn` instead of `npm`


### Install, Build and Run Tests

## Install

```
# Download the GitHub repo:
git clone https://github.com/atomicals/atomicals-js.git

cd atomicals-js

# Build:
# If you don't have yarn & node installed
# npm install -g node
# npm install -g yarn

yarn install
yarn run build

#See all commands at:

yarn run cli --help

```

### Quick Start - Command Line (CLI)

First, install packages and build, then follow the steps here to create your first Atomical and query the status. Use `yarn cli`to get a list of all commands available.

#### 0. Environment File (.env)

The environment file comes with defaults (`.env.example`), but it is highly recommended to install and operate your own ElectrumX server. Web browser communication is possible through the `wss` (secure websockets) interface of ElectrumX.

```
ELECTRUMX_PROXY_BASE_URL=https://ep.your-atomicals-electrumx-host/proxy

// Optional
WALLET_PATH=./wallets
WALLET_FILE=wallet.json

// The number of concurrent processes to be used. This should not exceed the number of CPU cores available. If not set, the default behavior is to use all available CPU cores minus one.
CONCURRENCY=4
```


#### 1. Wallet Setup

The purpose of the wallet is to create p2tr (pay-to-taproot) spend scripts and to receive change from the transactions made for the various operations. _Do not put more funds than you can afford to lose, as this is still beta!_

To initialize a new `wallet.json` file that will store your address for receiving change use the `wallet-init` command. Alternatively, you may populate the `wallet.json` manually, ensuring that the address at `m/44'/0'/0'/0/0` equals the address and the derivePath is set correctly.

Configure the path in the environment `.env` file to point to your wallet file. defaults to `./wallet.json`

Default:

```
WALLET_PATH=.
WALLET_FILE=wallet.json
```

Update to `wallets/` directory:

```
WALLET_PATH=./wallets
WALLET_FILE=wallet.json
```

Create the wallet:

```
yarn cli wallet-init

>>>

Wallet created at wallet.json
phrase: maple maple maple maple maple maple maple maple maple maple maple maple
Legacy address (for change): 1FXL2CJ9nAC...u3e9Evdsa2pKrPhkag
Derive Path: m/44'/0'/0'/0/0
WIF: L5Sa65gNR6QsBjqK.....r6o4YzcqNRnJ1p4a6GPxqQQ
------------------------------------------------------
```

#### 2. Explore the CLI

Get all of the commands available:

```
yarn cli --help
```


## ElectrumX Server RPC Interface

Atomicals ElectrumX (https://github.com/atomicals/atomicals-electrumx)

