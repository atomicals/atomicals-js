import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as cloneDeep from 'lodash.clonedeep';
import { BitworkInfo, buildAtomicalsFileMapFromRawTx, getTxIdFromAtomicalId, hexifyObjectWithUtf8, isValidBitworkConst, isValidBitworkString, isValidDmitemName, isObject } from "../utils/atomical-format-helpers";
import { fileWriter, jsonFileReader, jsonFileWriter } from "../utils/file-utils";
import * as fs from 'fs';
import * as mime from 'mime-types';
import { FileMap } from "../interfaces/filemap.interface";
import { basename, extname, join } from "path";
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

function isInvalidFile(file: string, folder: string) {
    const filePath = join(folder, file);
    const stats = fs.statSync(filePath);

    // Skip any folder
    if (stats.isDirectory()) {
        console.log(`Skipping ${file}...`);
        return true;
    }

    // Skip any file whose name starts with '.' or 'dmint'
    if (file.startsWith('.') || file.startsWith('dmint')) {
        console.log(`Skipping ${file}...`);
        return true;
    }

    // Skip any non-dmitem file
    const basePath = basename(file);
    const splitBase = basePath.split('.');
    const rawName = splitBase[0];
    if (!isValidDmitemName(rawName)) {
        return true;
    }

    return false;
}

interface ProofItemKV {
    p: boolean;
    d: string;
}

interface ArgsKV {
    request_dmitem: string;
    main: string;
    i: boolean;
    proof?: [ProofItemKV];
}

interface DmitemKV {
    mainHash: string;
    data: ArgsKV;
    targetVector?: string;
    targethash?: string;
}

// Check Json key value pair validity
// More checking can be done here
function _checkDmitemKV(kv: any): kv is DmitemKV {
    const hasBasicKeys = typeof kv.mainHash === 'string' && isObject(kv.data);
    const hasValidData = isObject(kv.data.args) && typeof kv.data.args.request_dmitem === 'string' &&
        typeof kv.data.args.main === 'string' && typeof kv.data.args.i === 'boolean';

    return hasBasicKeys && hasValidData;
}

function _validateJson(data: any): boolean {
    try {
        if (_checkDmitemKV(data)) {
            return true;
        } else {
            console.error("Invalid dmitem JSON data structure!");
        }
    } catch (err) {
        console.error("Error parsing dmitem JSON:", err);
    }

    return false
}

function isValidJson(data: any) {
    return _validateJson(data);
}

export class CreateDmintCommand implements CommandInterface {
  constructor(
    private folder: string,
    private mintHeight: number,
    private bitworkc: string
  ) {
    if (this.mintHeight < 0 || this.mintHeight > 10000000) {
      throw new Error('Invalid Mint height')
    }
    if (!isValidBitworkConst(bitworkc) && !isValidBitworkString(bitworkc)) {
      throw new Error(`Invalid Bitwork string. When in doubt use '7777'`)
    }
  }
  async run(): Promise<any> {
    let counter = 0;
    const files = fs.readdirSync(this.folder);
    const leafItems: any = [];
    const jsonFiles = {};
    for (const file of files) {
      if (isInvalidFile(file, this.folder)) {
        continue;
      }
      counter++;
      const jsonFile: any = await jsonFileReader(`${this.folder}/${file}`)
      // Check data validity of Dmitems
      if (!isValidJson(jsonFile)) {
        throw new Error(`${file}: Invalid Dmitem Json.`)
      }
      jsonFiles[jsonFile['data']['args']['request_dmitem']] = jsonFile;
      const itemName = jsonFile['data']['args']['request_dmitem'];
      const mainName = jsonFile['data']['args']['main'];
      const mainFile = Buffer.from(jsonFile['data'][mainName]['$b'], 'hex');
      const hashed = hash256(mainFile);
      const hashedStr = hashed.toString('hex');
      if (jsonFile['data']['args']['bitworkc'] === 'any') {
        throw new Error('cannot use ANY bitworkc in item');
      }
      if (jsonFile['data']['args']['bitworkr'] === 'any') {
        throw new Error('cannot use ANY bitworkr in item');
      }
      let itemBitworkc = 'any';
      if (jsonFile['data']['args']['bitworkc']) {
        itemBitworkc = jsonFile['data']['args']['bitworkc'] ? jsonFile['data']['args']['bitworkc'] : 'any';
      }
      let itemBitworkr = 'any';
      if (jsonFile['data']['args']['bitworkr']) {
        itemBitworkr = jsonFile['data']['args']['bitworkr'] ? jsonFile['data']['args']['bitworkr'] : 'any';
      }
      const leafVector = itemName + ':' + itemBitworkc + ':' + itemBitworkr + ':' + mainName + ':' + hashedStr;
      leafItems.push({
        itemName,
        file,
        leafVector,
        hashedStr
      });
    };
    const leaves = leafItems.map(x => SHA256(x.leafVector))
    const tree = new MerkleTree(leaves, SHA256)
    const root = tree.getRoot().toString('hex')
    let items = 0;
    for (const leafItem of leafItems) {
      const leaf = SHA256(leafItem.leafVector)
      const proof = tree.getProof(leaf)
      tree.verify(proof, leaf, root)
      jsonFiles[leafItem.itemName]['data']['args']['proof'] = (proof.map((item) => {
        return {
          p: item.position === 'right' ? true : item.position === 'left' ? false : null,
          d: item.data.toString('hex')
        }
      }));
      jsonFiles[leafItem.itemName]['targetVector'] = leafItem.leafVector
      jsonFiles[leafItem.itemName]['targethash'] = leafItem.hashedStr
      await jsonFileWriter(`${this.folder}/${leafItem.file}`, jsonFiles[leafItem.itemName]);
      items++;
    }
    const timestamp = (new Date()).getTime();
    const dmintFilename = 'dmint-' + timestamp + '.json';
    await jsonFileWriter(`${this.folder}/${dmintFilename}`, {
      dmint: {
        v: "1",
        mint_height: this.mintHeight,
        merkle: root,
        immutable: true,
        items,
        rules: [
          {
            p: ".*",
            bitworkc: this.bitworkc
          }
        ]
      }
    });

    return {
      success: true,
      data: {
        folder: this.folder,
        totalItems: counter,
      }
    };
  }
}
