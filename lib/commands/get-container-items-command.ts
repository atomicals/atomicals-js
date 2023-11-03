import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import { decorateAtomical } from "../utils/atomical-format-helpers";
import { GetCommand } from "./get-command";

export class GetContainerItems implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private container: string
  ) {
  }
  async run(): Promise<any> {
    const trimmedContainer = this.container.startsWith('#') ? this.container.substring(1) : this.container;
    const responseResult = await this.electrumApi.atomicalsGetContainerItems(trimmedContainer);
    if (!responseResult.result) {
      return {
        success: false,
        data: responseResult.result
      }
    }
    return {
      success: true,
      data: responseResult
    }
  }
}