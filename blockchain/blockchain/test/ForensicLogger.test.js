/**
 * ForensicLogger.test.js — Unit tests for the ForensicLogger contract.
 *
 * Run: npx hardhat test
 */

import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("ForensicLogger", function () {
  let forensicLogger;
  let owner;
  let otherAccount;

  // A sample SHA-256 hash (32 bytes)
  const sampleHash =
    "0xa3f1e0b5c6d7890123456789abcdef0123456789abcdef0123456789abcdef01";

  const sampleHash2 =
    "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

  beforeEach(async function () {
    [owner, otherAccount] = await ethers.getSigners();

    const ForensicLogger = await ethers.getContractFactory("ForensicLogger");
    forensicLogger = await ForensicLogger.deploy();
    await forensicLogger.waitForDeployment();
  });

  // ---- Deployment tests ---------------------------------------------------

  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      expect(await forensicLogger.owner()).to.equal(owner.address);
    });

    it("should start with zero logs", async function () {
      expect(await forensicLogger.getLogCount()).to.equal(0n);
    });
  });

  // ---- logEvent tests -----------------------------------------------------

  describe("logEvent", function () {
    it("should store a forensic hash", async function () {
      const tx = await forensicLogger.logEvent(sampleHash);
      await tx.wait();

      expect(await forensicLogger.getLogCount()).to.equal(1n);
    });

    it("should emit ForensicHashLogged event", async function () {
      await expect(forensicLogger.logEvent(sampleHash))
        .to.emit(forensicLogger, "ForensicHashLogged");
    });

    it("should reject calls from non-owner", async function () {
      await expect(
        forensicLogger.connect(otherAccount).logEvent(sampleHash)
      ).to.be.revertedWith("ForensicLogger: caller is not the owner");
    });

    it("should store multiple events sequentially", async function () {
      await (await forensicLogger.logEvent(sampleHash)).wait();
      await (await forensicLogger.logEvent(sampleHash2)).wait();

      expect(await forensicLogger.getLogCount()).to.equal(2n);

      const log0 = await forensicLogger.getLog(0);
      expect(log0.forensicHash).to.equal(sampleHash);

      const log1 = await forensicLogger.getLog(1);
      expect(log1.forensicHash).to.equal(sampleHash2);
    });
  });

  // ---- View function tests ------------------------------------------------

  describe("View functions", function () {
    beforeEach(async function () {
      await (await forensicLogger.logEvent(sampleHash)).wait();
    });

    it("getLog should return correct entry", async function () {
      const [timestamp, hash, reporter] = await forensicLogger.getLog(0);
      expect(hash).to.equal(sampleHash);
      expect(reporter).to.equal(owner.address);
      expect(timestamp).to.be.gt(0n);
    });

    it("getLog should revert on out-of-bounds index", async function () {
      await expect(forensicLogger.getLog(99)).to.be.revertedWith(
        "ForensicLogger: index out of bounds"
      );
    });

    it("getHashByTimestamp should return stored hash", async function () {
      const [timestamp] = await forensicLogger.getLog(0);
      const hash = await forensicLogger.getHashByTimestamp(timestamp);
      expect(hash).to.equal(sampleHash);
    });
  });
});
