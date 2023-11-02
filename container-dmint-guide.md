# Container Decentralized Mint (dmint) Guide

## Objective:

The purpose of this guide is to explain how to set up an existing (non-sealed) container collection to do decentralized mints.

## What is dmint?

Decentralized Mint (dmint) is a way to allow users to put on-chain images to claim NFTs in a collection. The creator of the NFT collection
defines the mint height, rules and the specific image file hashes that must be matched in order to claim one of the items in the container collection.

## Steps to enable in container

### Step 0. Claim container 

First is to claim a container with the command:

```
yarn cli mint-container mycoolcontainername --satsbyte=10
```

Wait 3 confirmations and then the container is yours. We will reference the example name #mycoolcontainername below.

### Step 1. Prepare image folder of all NFT images

Create a folder, example "nftimages", and place all images that will become items in the decentralized container collection mint.

Recommended file names like "0000.png", to "9999.png". Any valid image such as jpg, png, gif is allowed. 

Run the following command to create the dmint manifest chunks. It is required to chunk items into about 3334 items maximum to avoid Blockchain data
limitations.  Generate the command to produce chunks0.json, chunks1.json, etc.... (if your collection has les than 3334 items then only one chunk will be created)

```
yarn cli prepare-dmint-manifest ./nftimages chunks
yarn run v1.22.19
$ node dist/cli.js prepare-dmint-manifest ./nftimages chunks
Generating hashes for filename 0.png with hash 9850f1b04684a9db69a05b81f9c1354dafc60ed4530df9a663f2d776e552559c
Generating hashes for filename 1.png with hash e0bb2a5d8a80d989bfc4b5f06d18eba90d9dd3114511bd0b3db8aaabe296d497
{
  "folder": "./nftimages",
  "totalItems": 2,
  "chunkCount": 1
}

```

Here is a sample chunk file:

```
{
  "items": {
    "0.png": {
      "e": {
        "im.png:h": "9850f1b04684a9db69a05b81f9c1354dafc60ed4530df9a663f2d776e552559c"
      }
    },
    "1.png": {
      "e": {
        "im.png:h": "e0bb2a5d8a80d989bfc4b5f06d18eba90d9dd3114511bd0b3db8aaabe296d497"
      }
    }
  }
}
```

### Step 2. Upload each item chunk to container

For each of the chunk files, put into the container items like so:

```
yarn cli prepare-dmint-items mycoolcontainername ./chunks0.json --satsbyte=10
```

Do that for each of the chunks0.json, chunks1.json, etc. You must wait a block confirmation for each before being able to do the next chunk.

You may query anytime the state of your collection like:

```
yarn cli state #mycoolcontainername
```

### Step 3. Enable dmint and set mint height

Now that all of the `items` file hashes are saved to the container, we must enable the `dmint` configuration options with another command.

Set the block height that the mint should be allowed to be processed 

```
yarn cli prepare-dmint-config mycoolcontainername 812000 
```

You can also set the required minting bitwork (by default it is only 4 characters) with the options:

```
yarn cli prepare-dmint-config mycoolcontainername 812000 --mintbitworkc=76761
```

### Step 4. Validate the container is "dmint ready"

The final step is to wait until all the updates have settled and check with the command:

```
yarn cli state #mycoolcontainername
```

There should be a flag that says `"$dmint_config": { "status": "ready "}` to indicate everything is correct.
If there are any errors, then an errors field will explain the problem. Then correct the errors and check again.

Once all the errors are resolved and the status is `ready`

### Step 5. Seal the container  

After the container is in the ready state in Step 4, then seal it with

```
yarn cli seal #mycoolcontainername
```

### Step 6: Users can mint the items in the container!

The user will provide the specific item name id of the item they want to mint and the file that matches the `im.png:h` sha256d hash of the image.
Validation is peformed to ensure the file bytes and hashes match for the file id

```
yarn cli mint-dmitem #mycoolcontainername "0000" "file1.png"
```
