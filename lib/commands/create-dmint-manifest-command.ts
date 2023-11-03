import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as cloneDeep from 'lodash.clonedeep';
import { buildAtomicalsFileMapFromRawTx, getTxIdFromAtomicalId, hexifyObjectWithUtf8 } from "../utils/atomical-format-helpers";
import { fileWriter, jsonFileWriter } from "../utils/file-utils";
import * as fs from 'fs';
import * as mime from 'mime-types';
import { FileMap } from "../interfaces/filemap.interface";
import { basename, extname } from "path";
import { hash256 } from 'bitcoinjs-lib/src/crypto';

function isInvalidExtension(extName) {
  return extName !== '.jpg' && extName !== '.gif' && extName !== '.jpeg' && extName !== '.png' && extName !== '.svg' && extName !== '.webp' &&
  extName !== '.mp3' && extName !== '.mp4' && extName !== '.mov' && extName !== '.webm' && extName !== '.avi' && extName !== '.mpg'
} 
export class CreateDmintManifestCommand implements CommandInterface {
  constructor(
    private folder: string,
    private outputName: string,
  ) {
  }
  async run(): Promise<any> {
    // Read the folder for any images
    const itemsChunked: any = [
      {}
    ];
    let chunkNum = 0;
    let counter = 0;
    const files = fs.readdirSync(this.folder);

    for (const file of files) {
      if (file === '.' || file === '..') {
        continue;
      }
      const basePath = basename(file);
      const extName = extname(file);

      if (isInvalidExtension(extName)) {
        continue;
      }
      
      if (counter > 0 && counter % 3334 === 0) {
        chunkNum++;
        itemsChunked.push({})
      }

      const fileBuf = fs.readFileSync(this.folder + '/' + file);
      const hashed = hash256(fileBuf);
      const hashedStr = hashed.toString('hex');
      console.log(`Generating hashes for filename ${basePath} with hash ${hashedStr}`);
      const splitBase = basePath.split('.');
      if (splitBase.length !== 2) {
        throw new Error('Image file must have exactly with dot extension: ' + basePath)
      }
      itemsChunked[chunkNum][splitBase[0]] = {
        e: {
          ['im' + extName + ':h']: hashedStr
        }
      }
      counter++;
    };

    let chunkCount = 0;
    for (const chunk of itemsChunked) {
      await jsonFileWriter(this.outputName + chunkCount + '.json', {
        items: chunk
      });
      chunkCount++;
    }
    return {
      success: true,
      data: {
        folder: this.folder,
        totalItems: counter,
        chunkCount,
      }
    };
  }
}