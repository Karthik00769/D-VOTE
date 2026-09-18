// Utility to get the DVote contract instance using ethers.js
import { ethers } from "ethers";
import { DVoteABI } from "./DVoteABI";

// Replace with your deployed contract address
export const DVOTE_CONTRACT_ADDRESS = "0x8069eeFF58F48A324f162b8fef361014d41Ebc28";

export function getDVoteContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(DVOTE_CONTRACT_ADDRESS, DVoteABI, signerOrProvider);
}
