import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as cloneDeep from 'lodash.clonedeep';
import { BitworkInfo, buildAtomicalsFileMapFromRawTx, getTxIdFromAtomicalId, hexifyObjectWithUtf8, isValidBitworkString } from "../utils/atomical-format-helpers";
import { fileWriter, jsonFileReader, jsonFileWriter } from "../utils/file-utils";
import * as fs from 'fs';
import * as mime from 'mime-types';
import { FileMap } from "../interfaces/filemap.interface";
import { basename, extname } from "path";
import { hash256 } from 'bitcoinjs-lib/src/crypto';
import { MerkleTree } from 'merkletreejs'
const SHA256 = require('crypto-js/sha256')
import { sha256 } from "js-sha256";
function isInvalidImageExtension(extName) {
  return extName !== '.jpg' && extName !== '.gif' && extName !== '.jpeg' && extName !== '.png' && extName !== '.svg' && extName !== '.webp' &&
    extName !== '.mp3' && extName !== '.mp4' && extName !== '.mov' && extName !== '.webm' && extName !== '.avi' && extName !== '.mpg'
}
function isJsonExtension(extName) {
  return extName === '.json';
}
export class CreateDmintManifestCommand implements CommandInterface {
  constructor(
    private folder: string,
    private mintHeight: number,
    private bitworkc: string,
    private outputName: string,
  ) {
    if (this.mintHeight < 0 || this.mintHeight > 10000000) {
      throw new Error('Invalid Mint height')
    }
    if (!isValidBitworkString(bitworkc)) {
      throw new Error(`Invalid Bitwork string. When in doubt use '7777'`)
    }
  }
  async run(): Promise<any> {
    // Read the folder for any images
    const itemsChunked: any = [
      {}
    ];
    let chunkNum = 0;
    let counter = 0;
    const files = fs.readdirSync(this.folder);
    const filemap = {};

    const leafItems: any = [];
    const blankHash = '0000000000000000000000000000000000000000000000000000000000000000'
    for (const file of files) {
      if (file === '.' || file === '..') {
        continue;
      }
      const basePath = basename(file);
      const extName = extname(file);
      const splitBase = basePath.split('.');

      if (splitBase.length !== 2) {
        throw new Error('Image file must have exactly with dot extension: ' + basePath)
      }
      const rawName = splitBase[0];

      if (isJsonExtension(extName)) {
        // filemap[rawName] = filemap[rawName] || {}
        const jsonFile: any = await jsonFileReader(this.folder + '/' + file);
        /*filemap[rawName]['props'] = {
          ...jsonFile
        }*/
      }
      if (isInvalidImageExtension(extName)) {
        continue;
      }
      filemap[rawName] = filemap[rawName] || {}
      const fileBuf = fs.readFileSync(this.folder + '/' + file);
      const hashed = hash256(fileBuf);
      const hashedStr = hashed.toString('hex');
      console.log(`Generating hashes for filename ${basePath} with hash ${hashedStr}`);
      const filename = 'image' + extName;
      filemap[rawName][filename] = {
        '$b': fileBuf.toString('hex')
      }
      counter++;
      const leafVector = rawName + filename + hashedStr;
      leafItems.push({
        id: rawName,
        filename,
        hashedStr,
        leafVector,
        fileBuf: fileBuf.toString('hex')
      });
    };
    const leaves = leafItems.map(x => SHA256(x.leafVector))
    const tree = new MerkleTree(leaves, SHA256)
    const root = tree.getRoot().toString('hex')

    for (const leafItem of leafItems) {
      const leaf = SHA256(leafItem.leafVector)
      const proof = tree.getProof(leaf)
      tree.verify(proof, leaf, root)
      filemap[leafItem.id]['args'] = {
        request_dmitem: leafItem.id,
        main: leafItem.filename,
        proof: (proof.map((item) => {
          return {
            p: item.position === 'right' ? true : item.position === 'left' ? false : null,
            d: item.data.toString('hex')
          }
        })),
        i: true // Default everything to immutable
      }
      filemap[leafItem.id]['leafVector'] =  leafItem.leafVector
      filemap[leafItem.id]['hash'] =  leafItem.hashedStr
      filemap[leafItem.id]['fileBuf'] =  leafItem.fileBuf
    }

    const bitworkResult: BitworkInfo | null = isValidBitworkString(this.bitworkc);

    if (bitworkResult?.prefix.length as number > 6) {
      throw new Error('CLI does not permit setting bitwork prefix of length greater than 6');
    }
 
    const timestamp = (new Date()).getTime();
    const dirName = this.outputName + '-' + timestamp;
    if (!fs.existsSync(dirName)){
        fs.mkdirSync(dirName);
    }

    await jsonFileWriter(`${dirName}/dmint.json`, {
      dmint: {
        v: "1",
        mint_height: this.mintHeight,
        merkle: root,
        immutable: true,
        rules: [
          {
            p: ".*",
            bitworkc: bitworkResult?.hex_bitwork as string
          }
        ]
      }
    });
    for (const itemProp in filemap) {
      if (!filemap.hasOwnProperty(itemProp)) {
        continue;
      }
      await jsonFileWriter(`${dirName}/item-${itemProp}.json`, {
        "mainHash": filemap[itemProp].hash,
        "targetVector": filemap[itemProp].leafVector,
        "targetHash": SHA256(filemap[itemProp].leafVector).toString(),
        "data": {
          args: {
            request_dmitem: itemProp,
            main: filemap[itemProp].args.main,
            i: filemap[itemProp].args.i,
            proof: filemap[itemProp].args.proof
          },
          [filemap[itemProp].args.main]: {
            '$b': filemap[itemProp].fileBuf
          },  
        }
      });
    }
    
    return {
      success: true,
      data: {
        folder: this.folder,
        totalItems: counter,
      }
    };
  }
}