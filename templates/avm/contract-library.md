# Atomicals Virtual Machine Contract Library

This is a work in progress repository of sample AVM contracts.

## Crowd Funding

A crowd funding contract to collect funds in the form of ARC-20 tokens. The deployer specifies a time limit, expressed as a block height and also an authorized public key which is allowed to withdraw the ARC-2O tokens after the block height has elapsed.

[protocol.crowdfund-basic.json](protocol.crowdfund-basic.json)

### How it works

#### Method 0 (constructor)

Expects 2 arguments: <pubkey> <blockheight> to initialize the contract.

*Preconditions:*

Authentication: None
Input Params: <pubkey> <blockheight>
Input Tokens: None

*Postcondition:*

Data state table updated to format like:

```
{
    "00": { 
        "00": "<public key bytes>",
        "01": "<block height bytes>"
    }
}
```
Script Method Definition:  `00870000537af00051537af0`
Script Breakdown:

```
0087 // Selects method 0 (constructor)
0000 // Initializes the OP_KV_PUT keyspace and key value for the pubkey. 
537a // OP_ROLL the 3rd item from the stack to the top (which is the input pubkey param)
f0   // Saves the pubkey provided into { "00": { "00": "<pubkey bytes>" }}
0051 // Initializes the OP_KV_PUT keyspace and key value for the block height.
537a // OP_ROLL the 3rd item from the stack to the top (which is the input block height)
f0   // Saves the block height provided into { "00": { "01": "<block height bytes>" }}
```

Upon successful execution the data state will be updated to the post condition.


#### Method 1 (deposit)

Allows anyone to deposit ARC-20 tokens into the crowd fund as long as the block height has not been reached.

*Preconditions:*

Authentication: None
Input Params: None
Input Tokens: Exactly 1 FT token type

*Postcondition:*

Internal token state updated with incoming FT token.

```
{
    "<atomical ft token id>": <updated balance>
}
```

Script Method Definition:  `51870058fb0001efa08800f651880000f7d3`
Script breakdown:

```
5187    // Selects method 1 (deposit)
0058fb  // Get current block height
0001ef  // Get internal data block height stored
a088    // Ensure current block height is less than internal stored block height
00f6    // Count number of unique FT types being deposited (Only permit 1 to be deposited)
5188    // Verify only 1 unique FT type is provided
0000f7  // OP_FT_ITEM: Get the first FT id and put it on stack
d3      // Add the incoming FT balance to the internal balance
```
 
Upon successful execution the data state will remain the same. The internal FT token 
internal state will be updated with a structure of the form in the post condition.

The deposit method allows any ARC20 (FT) tokens to be deposited prior to the defined block height being reached.

#### Method 2 (withdraw)

After the defined block height is reached, the specified defined pubkey can withdraw any or all of the ARC20 FT tokens. A non-authorized attempt will fail.

*Preconditions:*

Authentication: Required
Input Params: <token id index to withdraw> <amount to withdraw> <output index to withdraw to>
Input Tokens: None

*Postcondition:*

Internal token state is updated to reflect the balance remaining after withdrawal is performed

```
{
    "<atomical ft token id>": <reduced updated balance>
}
```

A withdrawal is performed for token amount to the specified address.

Script Method Definition:  `52870058fb0001efa2880000efc18800f7f2`
Script breakdown:

```
5287    // OP_EQUAL: Selects method 2 (withdraw)
0058fb  // OP_GETBLOCKINFO: Get current height
0001ef  // OP_KV_GET: Get saved state height
a288    // OP_GREATERTHANOREQUAL+OP_EQUALVERIFY: Current height greater than defined height
0000ef  // OP_KV_GET: Get saved state pubkey
c1      // OP_CHECKAUTHSIGVERIFY: Authenticate the method call and put pubkey on stack
88      // OP_EQUALVERIFY: Validate the authenticated user's pubkey matches the internal data pubkey
00f7    // OP_FT_ITEM: Get atomical id by index from internal token state
f2      // OP_FT_WITHDRAW: Withdraw by atomical id and put it to the output index provide by user
```
 
Upon successful execution the data state will remain the same. The internal FT token 
internal state will be updated to reduce the balance by the amount withdrawn.

The authenticated may call the withdraw method as many times as necessary to withdraw all tokens.
This sample crowd funding contract only supports withdrawing one at a time, but could be easily modified
to support withdrawing multiple at the same time.

### End to End Steps (TODO)

1. Put the protocol code on-chain in (protocol.crowdfund.json)[protocol.crowdfund.json] 

*Note*: (TODO) The protocol is already defined on testnet at (txid)[https://mempool.space/txid/txid] under the protocol name `crowdfund-basic`.

To define a new version, under a different name, execute the following CLI command:

```
yarn cli define-protocol <your-crowdfund-name>
```

2. Using the defined `crowdfund-basic` above (or the name of the version you deployed in Step 1), deploy an instance of a contract for that protocol:

```
yarn cli deploy-contract crowdfund-basic
```

## ARC20 Token Teleporation across Proof-of-Work Blockchains

Teleport ARC20 tokens to a secondary proof-of-work blockchain such as Radiant and back again to BTC.

This contract leverages the fact that Radiant uses SHA512/256 algorithm and we can lock ARC20 tokens inside
an AVM smart contract to only be unlockable if the corresponding surrogate tokens on Radiant were provably 
burned. The AVM smart contract locks the tokens to a Radiant reference token Id. The tokens on Radiant can
be transferred like regular L1 tokens and any token owner at a future point in time can burn the surrogate tokens on Radiant
to claim back their allotted proportion of the original locked ARC20 tokens on BTC.

The key innovation that allows this to happen efficiently is the unique induction reference system of Radiant blockchain
and it's SHA512/256 proof of work algorithm. The AVM smart contract establishes a covenant that only allows
the tokens on the BTC side to be unlocked provided a Radiant block header with a sufficiently high difficulty and SPV merkle proof is provided of the proof of burn of the surrogate tokens.

[protocol.pow-teleport.json](protocol.pow-teleport.json)

### How it works

#### Method 0 (constructor)

Expects 2 arguments: <surrogateTokenId> <surrogateMinDifficulty> to initialize the contract. The `surrogateTokenId` is the assetId of
a Radiant L1 fungible token. (36 bytes) and `surrogateMinDifficulty` is the minimum target block header difficulty required to prove that a burn of the surrogate token on Radiant. The main idea is that the system is secure as long as the total value of the tokens being
teleported back from Radiant do not exceed the energy cost of mining a fake block header exceeding the `surrogateMinDifficulty`.

In practice, we can extend this to requiring *N* block confirmations to increase security.

*Preconditions:*

Authentication: None
Input Params: <surrogateTokenId> <surrogateMinDifficulty>
Input Tokens: Exactly 1 ARC20 token type of any quantity

*Postcondition:*

Data state table updated to format like:

```
{
    "00": { 
        "00": "<surrogateTokenId>", // "st"
        "01": "<surrogateMinDifficulty>" // "min"
    }
}

```
Internal token state updated with incoming FT token balance

```
{
    "<atomical ft token id>": <initial balance>
}
```

Script Method Definition:  `00870000537af00051537af0`
Script Breakdown:

```
0087 // Selects method 0 (constructor)
0000 // Initializes the OP_KV_PUT keyspace and key value for the surrogateTokenId. 
537a // OP_ROLL the 3rd item from the stack to the top (which is the input surrogateTokenId param)
f0   // Saves the surrogateTokenId provided into { "00": { "00": "<surrogateTokenId bytes>" }}
0051 // Initializes the OP_KV_PUT keyspace and key value for the surrogateMinDifficulty.
537a // OP_ROLL the 3rd item from the stack to the top (which is the input surrogateMinDifficulty)
f0   // Saves the surrogateMinDifficulty provided into { "00": { "01": "<surrogateMinDifficulty bytes>" }}
```

Upon successful execution the data state will be updated to the post condition. The ARC20 tokens are effectively locked
for the duration of the contract life-time until the `teleportBackToBtc` is called to release the tokens.

#### Method 1 (teleportBackToBtc)

Allows anyone to unlock the ARC20 tokens by provably burning the corresponding surrogate tokens on the Radiant blockchain and providing
the block headers, SPV merkle proof and raw transactions showing the quantity burned.

*Preconditions:*

Authentication: None
Input Params: <surrogateParentBurnRawTx> <surrogateBurnRawTx> <surrogateBlockHeader> <surrogateBlockMerkleProof>
Input Tokens: None

*Postcondition:*

Internal token state will be updated according to how many units were withdrawn via demonstrable burn on the secondary blockchain Radiant.

```
{
    "<atomical ft token id>": <reduced balance>
}
```

Script Method Definition:  `todo`

Upon successful execution the data state will remain the same. The internal FT token internal state will update and reduce the balance for each withdrawal of the originally deposited ARC20 tokens. The only way to withdraw tokens is by providing the provable burn of the surrogate tokens on the secondary blockchain.
 