const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("DVote", function () {
  let DVote, dvote, owner, addr1;

  beforeEach(async function () {
    DVote = await ethers.getContractFactory("DVote");
    [owner, addr1] = await ethers.getSigners();
    dvote = await DVote.deploy();
  });

  it("Should create an election", async function () {
    await dvote.createElection(
      "Test Election",
      "Test Purpose",
      Math.floor(Date.now() / 1000) + 3600,
      Math.floor(Date.now() / 1000) + 86400,
      ["Alice", "Bob"]
    );
    const election = await dvote.getElectionDetails(1);
    expect(election.title).to.equal("Test Election");
    expect(election.candidates.length).to.equal(2);
  });

  it("Should add a voter", async function () {
    await dvote.createElection(
      "Test Election",
      "Test Purpose",
      Math.floor(Date.now() / 1000) + 3600,
      Math.floor(Date.now() / 1000) + 86400,
      ["Alice", "Bob"]
    );
    await dvote.addVoter(1, addr1.address);
    const voter = await dvote.getVoterStatus(1, addr1.address);
    expect(voter.isRegistered).to.be.true;
  });
});
