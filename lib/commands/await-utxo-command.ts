import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
 
export class AwaitUtxoCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private address: string,
    private amount: number,
  ) {
  }
  async run(): Promise<any> {
    const result = await this.electrumApi.waitUntilUTXO(this.address, this.amount, 5);
    return {
      success: true,
      data: result,
    };
  }
}
