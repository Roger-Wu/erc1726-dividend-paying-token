const { ether } = require('openzeppelin-solidity/test/helpers/ether');
const { ethGetBalance } = require('openzeppelin-solidity/test/helpers/web3');
const { expectThrow } = require("openzeppelin-solidity/test/helpers/expectThrow");
// not using openzeppelin-solidity's because it doesn't properly check if big numbers equal
const expectEvent = require("./helpers/expectEvent");

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

const DividendPayingToken = artifacts.require('DividendPayingToken');

contract('DividendPayingToken', function (accounts) {
  const [owner, tokenHolder1, tokenHolder2, tokenHolder3, anyone] = accounts;
  const gasPrice = new BigNumber(1);

  // before each it
  beforeEach(async function () {
    this.token = await DividendPayingToken.new();
  });

  it('should not allow anyone to mint', async function () {
    await expectThrow(
      this.token.mint(ether(1), anyone, {from: anyone})
    );
  });

  it('should not be able to pay and distribute dividends when total supply is 0', async function () {
    await expectThrow(
      this.token.payAndDistributeDividends({from: anyone, value: ether(1)})
    );
  });

  it('should allow the owner to mint tokens to tokenHolder1', async function () {
    await this.token.mint(tokenHolder1, ether(1), {from: owner});

    (await this.token.balanceOf(tokenHolder1)).should.be.bignumber.equal(ether(1));
    (await this.token.totalDividends()).should.be.bignumber.equal(ether(0));
    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(0));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));
  });

  it('should allow anyone to pay and distribute dividends', async function () {
    await this.token.mint(tokenHolder1, ether(1), {from: owner});
    await this.token.mint(tokenHolder2, ether(3), {from: owner});

    await expectThrow(
      this.token.payAndDistributeDividends({from: anyone, value: 0})
    );

    await expectEvent.inTransaction(
      this.token.payAndDistributeDividends({from: anyone, value: ether(1)}),
      "DividendsDistributed", {
        from: anyone,
        weiAmount: ether(1),
      }
    );

    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawableDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0.75));
  });

  it('should allow anyone to pay and distribute dividends by sending ether to the contract', async function () {
    await this.token.mint(tokenHolder1, ether(1), {from: owner});
    await this.token.mint(tokenHolder2, ether(3), {from: owner});

    await expectThrow(
      this.token.sendTransaction({from: anyone, value: 0})
    );

    await expectEvent.inTransaction(
      this.token.sendTransaction({from: anyone, value: ether(1)}),
      "DividendsDistributed", {
        from: anyone,
        weiAmount: ether(1),
      }
    );

    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawableDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0.75));
  });

  it('should be able to withdraw dividends', async function () {
    await this.token.mint(tokenHolder1, ether(1), {from: owner});
    await this.token.mint(tokenHolder2, ether(3), {from: owner});
    await this.token.payAndDistributeDividends({from: anyone, value: ether(1)});

    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));

    const balance1 = await ethGetBalance(tokenHolder1);
    const receipt = await this.token.withdrawDividends({from: tokenHolder1, gasPrice: gasPrice});
    expectEvent.inLogs(receipt.logs, "DividendsWithdrawn", {
        to: tokenHolder1,
        weiAmount: ether(0.25),
      }
    );

    const balance2 = await ethGetBalance(tokenHolder1);
    const fee = gasPrice.times(receipt.receipt.gasUsed);
    balance2.should.be.bignumber.equal( balance1.plus(ether(0.25)).minus(fee));

    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
  });

  it('should distribute dividends properly', async function () {
    await this.token.mint(tokenHolder1, ether(1), {from: owner});
    await this.token.mint(tokenHolder2, ether(3), {from: owner});
    await this.token.payAndDistributeDividends({from: anyone, value: ether(1)});

    (await this.token.totalDividends()).should.be.bignumber.equal(ether(1));

    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));

    (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether(0.75));
    (await this.token.withdrawableDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0.75));
    (await this.token.withdrawnDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0));
  });

  it('should keep dividends unchanged after minting tokens', async function () {
    await this.token.mint(tokenHolder1, ether(1), {from: owner});
    await this.token.mint(tokenHolder2, ether(3), {from: owner});
    await this.token.payAndDistributeDividends({from: anyone, value: ether(1)});

    await this.token.mint(tokenHolder1, ether(1), {from: owner});

    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));
  });

  it('should keep dividends unchanged after transferring tokens', async function () {
    await this.token.mint(tokenHolder1, ether(1), {from: owner});
    await this.token.mint(tokenHolder2, ether(3), {from: owner});
    await this.token.payAndDistributeDividends({from: anyone, value: ether(1)});

    await this.token.transfer(tokenHolder2, ether(0.1), {from: tokenHolder1});

    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));

    (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether(0.75));
    (await this.token.withdrawableDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0.75));
    (await this.token.withdrawnDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0));
  });

  it('should keep dividends unchanged after transferFrom', async function () {
    await this.token.mint(tokenHolder1, ether(1), {from: owner});
    await this.token.mint(tokenHolder2, ether(3), {from: owner});
    await this.token.payAndDistributeDividends({from: anyone, value: ether(1)});

    await this.token.approve(tokenHolder3, ether(0.1), {from: tokenHolder1});
    await this.token.transferFrom(tokenHolder1, tokenHolder2, ether(0.1), {from: tokenHolder3});

    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0.25));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));

    (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether(0.75));
    (await this.token.withdrawableDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0.75));
    (await this.token.withdrawnDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0));
  });

  it('should correctly distribute dividends after transferring tokens', async function () {
    await this.token.mint(tokenHolder1, ether(0.2), {from: owner});
    await this.token.mint(tokenHolder2, ether(0.3), {from: owner});
    await this.token.payAndDistributeDividends({from: anyone, value: ether(1)});
    await this.token.transfer(tokenHolder2, ether(0.1), {from: tokenHolder1});
    await this.token.payAndDistributeDividends({from: anyone, value: ether(5)});

    (await this.token.totalDividends()).should.be.bignumber.equal(ether(6));

    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(1.4));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(1.4));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));

    (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether(4.6));
    (await this.token.withdrawableDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(4.6));
    (await this.token.withdrawnDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0));
  });

  it('should pass end-to-end test', async function () {
    let balanceBefore;
    let balanceAfter;
    let receipt;
    let fee;

    // mint and payAndDistributeDividends
    await this.token.mint(tokenHolder1, ether(2), {from: owner});
    await this.token.payAndDistributeDividends({from: anyone, value: ether(10)});

    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(10));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(10));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));

    // transfer
    await this.token.transfer(tokenHolder2, ether(2), {from: tokenHolder1});
    (await this.token.balanceOf(tokenHolder1)).should.be.bignumber.equal(ether(0));
    (await this.token.balanceOf(tokenHolder2)).should.be.bignumber.equal(ether(2));
    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(10));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(10));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));
    (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether(0));
    (await this.token.withdrawableDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0));
    (await this.token.withdrawnDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0));

    // tokenHolder1 withdraw
    balanceBefore = await ethGetBalance(tokenHolder1);
    receipt = await this.token.withdrawDividends({from: tokenHolder1, gasPrice: gasPrice});
    balanceAfter = await ethGetBalance(tokenHolder1);
    fee = gasPrice.times(receipt.receipt.gasUsed);
    balanceAfter.should.be.bignumber.equal( balanceBefore.plus(ether(10)).minus(fee));
    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(10));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(10));

    // deposit
    await this.token.payAndDistributeDividends({from: anyone, value: ether(10)});
    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(10));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(10));
    (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether(10));
    (await this.token.withdrawableDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(10));
    (await this.token.withdrawnDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0));

    // mint
    await this.token.mint(tokenHolder1, ether(3), {from: owner});
    (await this.token.balanceOf(tokenHolder1)).should.be.bignumber.equal(ether(3));

    // deposit
    await this.token.payAndDistributeDividends({from: anyone, value: ether(10)});
    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(16));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(6));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(10));
    (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether(14));
    (await this.token.withdrawableDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(14));
    (await this.token.withdrawnDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0));

    // now tokens: 3, 2

    await this.token.transfer(tokenHolder3, ether(2), {from: tokenHolder2});

    // 3, 0, 2

    await this.token.mint(tokenHolder2, ether(4), {from: owner});
    await this.token.mint(tokenHolder3, ether(1), {from: owner});

    // 3 4 3

    await this.token.transfer(tokenHolder1, ether(2), {from: tokenHolder2});

    // 5 2 3

    await this.token.transfer(tokenHolder3, ether(5), {from: tokenHolder1});

    // 0 2 8

    await this.token.transfer(tokenHolder2, ether(2), {from: tokenHolder3});

    // 0 4 6

    await this.token.transfer(tokenHolder1, ether(3), {from: tokenHolder2});

    // 3, 1, 6

    (await this.token.balanceOf(tokenHolder1)).should.be.bignumber.equal(ether(3));
    (await this.token.balanceOf(tokenHolder2)).should.be.bignumber.equal(ether(1));
    (await this.token.balanceOf(tokenHolder3)).should.be.bignumber.equal(ether(6));

    // deposit
    await this.token.payAndDistributeDividends({from: anyone, value: ether(10)});
    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(19));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(9));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(10));
    (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether(15));
    (await this.token.withdrawableDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(15));
    (await this.token.withdrawnDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0));
    (await this.token.accumulativeDividendOf(tokenHolder3)).should.be.bignumber.equal(ether(6));
    (await this.token.withdrawableDividendsOf(tokenHolder3)).should.be.bignumber.equal(ether(6));
    (await this.token.withdrawnDividendsOf(tokenHolder3)).should.be.bignumber.equal(ether(0));


    // tokenHolder1 withdraw
    balanceBefore = await ethGetBalance(tokenHolder1);
    receipt = await this.token.withdrawDividends({from: tokenHolder1, gasPrice: gasPrice});
    balanceAfter = await ethGetBalance(tokenHolder1);
    fee = gasPrice.times(receipt.receipt.gasUsed);
    balanceAfter.should.be.bignumber.equal( balanceBefore.plus(ether(9)).minus(fee));
    (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether(19));
    (await this.token.withdrawableDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(0));
    (await this.token.withdrawnDividendsOf(tokenHolder1)).should.be.bignumber.equal(ether(19));

    // tokenHolder2 withdraw
    balanceBefore = await ethGetBalance(tokenHolder2);
    receipt = await this.token.withdrawDividends({from: tokenHolder2, gasPrice: gasPrice});
    balanceAfter = await ethGetBalance(tokenHolder2);
    fee = gasPrice.times(receipt.receipt.gasUsed);
    balanceAfter.should.be.bignumber.equal( balanceBefore.plus(ether(15)).minus(fee));
    (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether(15));
    (await this.token.withdrawableDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(0));
    (await this.token.withdrawnDividendsOf(tokenHolder2)).should.be.bignumber.equal(ether(15));

    // tokenHolder3 withdraw
    balanceBefore = await ethGetBalance(tokenHolder3);
    receipt = await this.token.withdrawDividends({from: tokenHolder3, gasPrice: gasPrice});
    balanceAfter = await ethGetBalance(tokenHolder3);
    fee = gasPrice.times(receipt.receipt.gasUsed);
    balanceAfter.should.be.bignumber.equal( balanceBefore.plus(ether(6)).minus(fee));
    (await this.token.accumulativeDividendOf(tokenHolder3)).should.be.bignumber.equal(ether(6));
    (await this.token.withdrawableDividendsOf(tokenHolder3)).should.be.bignumber.equal(ether(0));
    (await this.token.withdrawnDividendsOf(tokenHolder3)).should.be.bignumber.equal(ether(6));
  });
});
