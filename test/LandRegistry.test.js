import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("LandRegistry Smart Contract", function () {
  let landRegistry;
  let admin;
  let owner1;
  let owner2;
  let stranger;

  const sampleDocHash = ethers.keccak256(ethers.toUtf8Bytes("sample-deed-pdf-hash"));
  const wrongDocHash = ethers.keccak256(ethers.toUtf8Bytes("tampered-deed-pdf-hash"));

  beforeEach(async function () {
    [admin, owner1, owner2, stranger] = await ethers.getSigners();
    const LandRegistry = await ethers.getContractFactory("LandRegistry");
    landRegistry = await LandRegistry.deploy();
    await landRegistry.waitForDeployment();
  });

  it("1. Should allow admin to register land and emit LandRegistered event", async function () {
    await expect(
      landRegistry.registerLand(
        101,
        owner1.address,
        "Plot 12, Sector 4",
        "Indiranagar",
        "Bengaluru Urban",
        "Karnataka",
        "SUR-101",
        2400,
        sampleDocHash
      )
    ).to.emit(landRegistry, "LandRegistered");

    const count = await landRegistry.getLandCount();
    expect(count).to.equal(1n);

    const details = await landRegistry.getLandDetails(101);
    expect(details.propertyId).to.equal(101n);
    expect(details.currentOwner).to.equal(owner1.address);
    expect(details.surveyNumber).to.equal("SUR-101");
    expect(details.area).to.equal(2400n);
    expect(details.documentHash).to.equal(sampleDocHash);
    expect(details.exists).to.equal(true);
  });

  it("2. Should reject unauthorized non-admin land registration", async function () {
    await expect(
      landRegistry
        .connect(owner1)
        .registerLand(
          102,
          owner1.address,
          "Plot 13",
          "Baner",
          "Pune",
          "Maharashtra",
          "SUR-102",
          1800,
          sampleDocHash
        )
    ).to.be.revertedWith("Only registry admin is authorized");
  });

  it("3. Should reject duplicate Property IDs and duplicate Survey Numbers", async function () {
    await landRegistry.registerLand(
      101,
      owner1.address,
      "Plot 12",
      "Indiranagar",
      "Bengaluru Urban",
      "Karnataka",
      "SUR-101",
      2400,
      sampleDocHash
    );

    await expect(
      landRegistry.registerLand(
        101,
        owner2.address,
        "Plot 99",
        "Baner",
        "Pune",
        "Maharashtra",
        "SUR-999",
        1500,
        sampleDocHash
      )
    ).to.be.revertedWith("Property ID already registered");

    await expect(
      landRegistry.registerLand(
        102,
        owner2.address,
        "Plot 99",
        "Baner",
        "Pune",
        "Maharashtra",
        "SUR-101",
        1500,
        sampleDocHash
      )
    ).to.be.revertedWith("Survey number already registered");
  });

  it("4. Should verify existing property and document hash accurately", async function () {
    await landRegistry.registerLand(
      101,
      owner1.address,
      "Plot 12",
      "Indiranagar",
      "Bengaluru Urban",
      "Karnataka",
      "SUR-101",
      2400,
      sampleDocHash
    );

    const [existsOk, matchOk, currentOwner] = await landRegistry.verifyLand(101, sampleDocHash);
    expect(existsOk).to.equal(true);
    expect(matchOk).to.equal(true);
    expect(currentOwner).to.equal(owner1.address);

    const [existsMismatch, matchFail] = await landRegistry.verifyLand(101, wrongDocHash);
    expect(existsMismatch).to.equal(true);
    expect(matchFail).to.equal(false);

    const [existsMissing, matchMissing] = await landRegistry.verifyLand(9999, sampleDocHash);
    expect(existsMissing).to.equal(false);
    expect(matchMissing).to.equal(false);
  });

  it("5. Should allow current owner to request ownership transfer and emit TransferRequested", async function () {
    await landRegistry.registerLand(
      101,
      owner1.address,
      "Plot 12",
      "Indiranagar",
      "Bengaluru Urban",
      "Karnataka",
      "SUR-101",
      2400,
      sampleDocHash
    );

    await expect(
      landRegistry.connect(owner1).requestTransfer(101, owner2.address)
    ).to.emit(landRegistry, "TransferRequested");

    const pending = await landRegistry.getPendingTransfer(101);
    expect(pending.active).to.equal(true);
    expect(pending.proposedOwner).to.equal(owner2.address);
    expect(pending.recipientAccepted).to.equal(false);
  });

  it("6. Should reject invalid transfer requests (non-owner, zero address, self-transfer, duplicate, non-existent)", async function () {
    await expect(
      landRegistry.connect(owner1).requestTransfer(999, owner2.address)
    ).to.be.revertedWith("Property does not exist");

    await landRegistry.registerLand(
      101,
      owner1.address,
      "Plot 12",
      "Indiranagar",
      "Bengaluru Urban",
      "Karnataka",
      "SUR-101",
      2400,
      sampleDocHash
    );

    await expect(
      landRegistry.connect(stranger).requestTransfer(101, owner2.address)
    ).to.be.revertedWith("Only current owner can initiate transfer");

    await expect(
      landRegistry.connect(owner1).requestTransfer(101, ethers.ZeroAddress)
    ).to.be.revertedWith("Invalid recipient wallet address");

    await expect(
      landRegistry.connect(owner1).requestTransfer(101, owner1.address)
    ).to.be.revertedWith("Cannot transfer property to current owner");

    await landRegistry.connect(owner1).requestTransfer(101, owner2.address);
    await expect(
      landRegistry.connect(owner1).requestTransfer(101, stranger.address)
    ).to.be.revertedWith("Pending transfer already exists");
  });

  it("7. Should allow proposed recipient to accept transfer and emit TransferAccepted", async function () {
    await landRegistry.registerLand(
      101,
      owner1.address,
      "Plot 12",
      "Indiranagar",
      "Bengaluru Urban",
      "Karnataka",
      "SUR-101",
      2400,
      sampleDocHash
    );
    await landRegistry.connect(owner1).requestTransfer(101, owner2.address);

    await expect(landRegistry.connect(owner2).acceptTransfer(101)).to.emit(
      landRegistry,
      "TransferAccepted"
    );

    const pending = await landRegistry.getPendingTransfer(101);
    expect(pending.recipientAccepted).to.equal(true);
  });

  it("8. Should reject acceptance by unauthorized account", async function () {
    await landRegistry.registerLand(
      101,
      owner1.address,
      "Plot 12",
      "Indiranagar",
      "Bengaluru Urban",
      "Karnataka",
      "SUR-101",
      2400,
      sampleDocHash
    );
    await landRegistry.connect(owner1).requestTransfer(101, owner2.address);

    await expect(landRegistry.connect(stranger).acceptTransfer(101)).to.be.revertedWith(
      "Only proposed recipient can accept transfer"
    );
  });

  it("9. Should allow admin to approve accepted transfer, update owner, and emit OwnershipTransferred", async function () {
    await landRegistry.registerLand(
      101,
      owner1.address,
      "Plot 12",
      "Indiranagar",
      "Bengaluru Urban",
      "Karnataka",
      "SUR-101",
      2400,
      sampleDocHash
    );
    await landRegistry.connect(owner1).requestTransfer(101, owner2.address);

    // Cannot approve before recipient accepts
    await expect(landRegistry.connect(admin).approveTransfer(101)).to.be.revertedWith(
      "Recipient has not accepted the transfer yet"
    );

    await landRegistry.connect(owner2).acceptTransfer(101);

    // Non-admin cannot approve
    await expect(landRegistry.connect(owner1).approveTransfer(101)).to.be.revertedWith(
      "Only registry admin is authorized"
    );

    await expect(landRegistry.connect(admin).approveTransfer(101))
      .to.emit(landRegistry, "OwnershipTransferred")
      .withArgs(101, owner1.address, owner2.address, await getNextBlockTimestamp());

    const details = await landRegistry.getLandDetails(101);
    expect(details.currentOwner).to.equal(owner2.address);

    const owner1Props = await landRegistry.getOwnerProperties(owner1.address);
    const owner2Props = await landRegistry.getOwnerProperties(owner2.address);
    expect(owner1Props.length).to.equal(0);
    expect(owner2Props).to.deep.equal([101n]);
  });

  it("10. Should allow admin to reject transfer and emit TransferRejected", async function () {
    await landRegistry.registerLand(
      101,
      owner1.address,
      "Plot 12",
      "Indiranagar",
      "Bengaluru Urban",
      "Karnataka",
      "SUR-101",
      2400,
      sampleDocHash
    );
    await landRegistry.connect(owner1).requestTransfer(101, owner2.address);

    await expect(landRegistry.connect(admin).rejectTransfer(101)).to.emit(
      landRegistry,
      "TransferRejected"
    );

    const pending = await landRegistry.getPendingTransfer(101);
    expect(pending.rejected).to.equal(true);
    expect(pending.active).to.equal(false);

    const details = await landRegistry.getLandDetails(101);
    expect(details.currentOwner).to.equal(owner1.address);
  });

  it("11. Should allow current owner to cancel active transfer and emit TransferCancelled", async function () {
    await landRegistry.registerLand(
      101,
      owner1.address,
      "Plot 12",
      "Indiranagar",
      "Bengaluru Urban",
      "Karnataka",
      "SUR-101",
      2400,
      sampleDocHash
    );
    await landRegistry.connect(owner1).requestTransfer(101, owner2.address);

    await expect(landRegistry.connect(stranger).cancelTransfer(101)).to.be.revertedWith(
      "Only current owner can cancel transfer"
    );

    await expect(landRegistry.connect(owner1).cancelTransfer(101)).to.emit(
      landRegistry,
      "TransferCancelled"
    );

    const pending = await landRegistry.getPendingTransfer(101);
    expect(pending.cancelled).to.equal(true);
    expect(pending.active).to.equal(false);
  });

  it("12. Should maintain accurate on-chain ownership history across multiple transfers", async function () {
    await landRegistry.registerLand(
      101,
      owner1.address,
      "Plot 12",
      "Indiranagar",
      "Bengaluru Urban",
      "Karnataka",
      "SUR-101",
      2400,
      sampleDocHash
    );

    await landRegistry.connect(owner1).requestTransfer(101, owner2.address);
    await landRegistry.connect(owner2).acceptTransfer(101);
    await landRegistry.connect(admin).approveTransfer(101);

    await landRegistry.connect(owner2).requestTransfer(101, stranger.address);
    await landRegistry.connect(stranger).acceptTransfer(101);
    await landRegistry.connect(admin).approveTransfer(101);

    const history = await landRegistry.getOwnershipHistory(101);
    expect(history).to.deep.equal([owner1.address, owner2.address, stranger.address]);
  });

  async function getNextBlockTimestamp() {
    const latest = await ethers.provider.getBlock("latest");
    return BigInt(latest.timestamp + 1);
  }
});
