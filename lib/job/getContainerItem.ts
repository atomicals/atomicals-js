import { Atomicals, ElectrumApi } from "..";
import { delay } from "./utils";

export const getContainerItem = async (
  container: string,
  count: number,
  options: any = {}
) => {
  let array: number[] = [];
  if (options.itemId) {
    array = [options.itemId];
  } else {
    array = Array.from({ length: count }, (_, index) => index + 1);
  }
  const atomicals = new Atomicals(
    ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || "")
  );
  const list: number[] = [];
  for await (const itemId of array) {
    try {
        const modifiedStripped =
        container.indexOf("#") === 0 ? container.substring(1) : container;
      await delay(options.delay || 500);
      atomicals
        .getAtomicalByContainerItem(modifiedStripped, String(itemId))
        .then((result) => {
          if (result.success === true && result.data.status === null) {
            console.log(`========ID: ${itemId}，可以打！========`);
            list.push(itemId);
          } else {
            if(Number(itemId) % 100 === 0) {
                console.log(`ID: ${itemId}，被打了！`);
            }
            
          }
        });
    } catch (error) {
        
    }

  }
  console.log(`可以打: `, list);
};
