import { createPublicClient, http, Block } from "viem";
import { sepolia } from "viem/chains";

const ALCHEMY_SEPOLIA_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/Sb_ZVOzN9QemOqEaY_K1S";

export const client = createPublicClient({
  chain: sepolia,
  transport: http(ALCHEMY_SEPOLIA_URL),
});

export async function getBlockByNumber(blockNumber: bigint): Promise<Block> {
  return await client.getBlock({ blockNumber });
}

export async function getERCAssetTransfers() {
  const res = await fetch(ALCHEMY_SEPOLIA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "alchemy_getAssetTransfers",
      params: [{ fromBlock: "0x0", excludeZeroValue: true, category: ["erc721", "erc1155"] }],
      id: 1,
    }),
  });
  return res.json();
}

export async function getTokenBalances(address: string) {
  const res = await fetch(ALCHEMY_SEPOLIA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "alchemy_getTokenBalances",
      params: [address],
      id: 1,
    }),
  });
  return res.json();
}
