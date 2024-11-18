# Atomicals Command-line Tool

The command-line tool to fetch, deploy, mint, transfer, and manipulate Atomicals Digital Assets.

Visit the [Atomicals Guidebook](https://atomicals-community.github.io/atomicals-guide/) to get to know about Atomicals!

> Multiple templates are covered for setting up Fungible-tokens, NFT collections, Realm & Sub-realm, and Social-FI!
> Check them out at https://github.com/atomicals/atomicals-js/tree/main/templates.

**Table Of Contents**
<!-- TOC -->
* [Atomicals Command-line Tool](#atomicals-command-line-tool)
    * [Other Atomicals Tools](#other-atomicals-tools)
    * [Install](#install)
    * [Quick Start](#quick-start)
      * [0. Environment File (.env)](#0-environment-file-env)
      * [1. Wallet Setup](#1-wallet-setup)
      * [2. Explore the CLI](#2-explore-the-cli)
<!-- TOC -->

### Other Atomicals Tools

- Atomicals ElectrumX Indexer Server (https://github.com/atomicals/atomicals-electrumx)

### Install

Use `yarn` (or `pnpm`) package manager instead of `npm`.

```shell
# Download the GitHub repo:
git clone https://github.com/atomicals/atomicals-js.git

cd atomicals-js

# Build: If you don't have yarn & node installed
# npm install -g node
# npm install -g yarn

yarn install
yarn run build

# See all commands at:
yarn run cli --help
```

### Quick Start

First, install packages and build, then follow the steps here to create your first Atomical and query the status.
Use `yarn cli`to get a list of all commands available.

#### 0. Environment File (.env)

The environment file comes with defaults (`.env.example`), but it is highly recommended to install and operate your own
ElectrumX server. Web browser communication is possible through the `wss` (secure websockets) interface of ElectrumX.

```dotenv
ELECTRUMX_PROXY_BASE_URL=https://ep.your-atomicals-electrumx-host/proxy

# Optional
WALLET_PATH=./wallets
WALLET_FILE=wallet.json

# The number of concurrent processes to be used. This should not exceed the number of CPU cores available.
# If not set, the default behavior is to use all available CPU cores minus one.
CONCURRENCY=4
```

#### 1. Wallet Setup

The purpose of the wallet is to create p2tr (pay-to-taproot) spend scripts and to receive change from the transactions
made for the various operations.
_Do not put more funds than you can afford to lose, as this is still beta!_

To initialize a new `wallet.json` file that will store your address for receiving change use the `wallet-init` command.
Alternatively, you may populate the `wallet.json` manually, ensuring that the address at `m/86'/0'/0'/0/0`
equals the address and the `derivePath` is set correctly.

Configure the path in the environment `.env` file to point to your wallet file. defaults to `./wallet.json`

Default:

```dotenv
WALLET_PATH=.
WALLET_FILE=wallet.json
```

Update to `wallets/` directory:

```dotenv
WALLET_PATH=./wallets
WALLET_FILE=wallet.json
```

Create the wallet:

```shell
yarn cli wallet-init

>>>

Wallet created at wallet.json
phrase: maple maple maple maple maple maple maple maple maple maple maple maple
Legacy address (for change): 1FXL2CJ9nAC...u3e9Evdsa2pKrPhkag
Derive Path: m/86'/0'/0'/0/0
WIF: L5Sa65gNR6QsBjqK.....r6o4YzcqNRnJ1p4a6GPxqQQ
------------------------------------------------------
```

#### 2. Explore the CLI

Get all the commands available:

```shell
yarn cli --help
```
