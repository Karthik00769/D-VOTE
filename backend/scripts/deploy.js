const hre = require("hardhat");

async function main() {
  const DVote = await hre.ethers.getContractFactory("DVote");
  const dvote = await DVote.deploy();

  console.log(`DVote deployed to: ${dvote.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
