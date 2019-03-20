const { BN, constants, ether, balance, expectEvent, shouldFail } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS } = constants;

const DividendPayingToken = artifacts.require('DividendPayingToken');


contract('DividendPayingToken', function (accounts) {
  const [owner, tokenHolder1, tokenHolder2, tokenHolder3, anyone] = accounts;
  const gasPrice = new BN('1');
  const baseGasCost = new BN('21000');

  // before each `it`, even in `describe`
  beforeEach(async function () {
    this.token = await DividendPayingToken.new();
  });

  it('end-to-end gas test', async function () {
    // do something before testing gas consumption
    await this.token.mint(tokenHolder1, ether('1'), {from: owner, gasPrice});
    await this.token.mint(tokenHolder2, ether('1'), {from: owner, gasPrice});
    await this.token.transfer(tokenHolder2, ether('0.1'), {from: tokenHolder1, gasPrice});
    await this.token.transfer(tokenHolder1, ether('0.2'), {from: tokenHolder2, gasPrice});
    await this.token.distributeDividends({from: anyone, value: ether('1'), gasPrice});
    await this.token.transfer(tokenHolder2, ether('0.1'), {from: tokenHolder1, gasPrice});
    await this.token.transfer(tokenHolder1, ether('0.2'), {from: tokenHolder2, gasPrice});

    let balanceDiff;
    balanceDiff = await balance.difference(
      owner,
      async () => {
        await this.token.mint(tokenHolder1, ether('1'), {from: owner, gasPrice});
      }
    );
    console.log(`ordinary mint: ${balanceDiff} gas, exec: ${balanceDiff.add(baseGasCost)} gas`);

    balanceDiff = await balance.difference(
      tokenHolder1,
      async () => {
        await this.token.transfer(tokenHolder2, ether('0.3'), {from: tokenHolder1, gasPrice});
      }
    );
    console.log(`ordinary transfer: ${balanceDiff} gas, exec: ${balanceDiff.add(baseGasCost)} gas`);

    balanceDiff = await balance.difference(
      anyone,
      async () => {
        await this.token.distributeDividends({from: anyone, value: ether('1'), gasPrice});
      }
    );
    balanceDiff = balanceDiff.add(ether('1'));
    console.log(`ordinary distributeDividends: ${balanceDiff} gas, exec: ${balanceDiff.add(baseGasCost)} gas`);
  });
});
