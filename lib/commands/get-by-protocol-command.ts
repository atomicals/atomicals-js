import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import { decorateAtomical } from "../utils/atomical-format-helpers";
import { GetCommand } from "./get-command";

export class GetByProtocolCommand implements CommandInterface {
 
  constructor(private electrumApi: ElectrumApiInterface,
    private name: string,
    private fetchType: AtomicalsGetFetchType = AtomicalsGetFetchType.GET
  ) {
 
  }
  async run(): Promise<any> {
    const responseResult = await this.electrumApi.atomicalsGetByProtocol(this.name);
    if (!responseResult.result || !responseResult.result.atomical_id) {
      return {
        success: false,
        data: responseResult.result
      }
    }
    const getDefaultCommand = new GetCommand( this.electrumApi, responseResult.result.atomical_id, this.fetchType);
    const getDefaultCommandResponse = await getDefaultCommand.run();
    const updatedRes = Object.assign({},
      getDefaultCommandResponse.data,
      {
        result: decorateAtomical(getDefaultCommandResponse.data.result)
      }
    );
    return {
      success: true,
      data: updatedRes
    }
  }
}