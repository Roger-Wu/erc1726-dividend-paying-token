const { BN, constants, ether, balance, expectEvent, shouldFail } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS } = constants;

const DividendPayingToken = artifacts.require('DividendPayingToken');

contract('DividendPayingToken', function (accounts) {
  const [owner, tokenHolder1, tokenHolder2, tokenHolder3, anyone] = accounts;
  const gasPrice = new BN('1');

  // before each `it`, even in `describe`
  beforeEach(async function () {
    this.token = await DividendPayingToken.new();
  });

  describe('mint', function () {
    describe('when someone other than the owner tries to mint tokens', function () {
      it('reverts', async function () {
        await shouldFail.reverting(
          this.token.mint(anyone, ether('1'), {from: anyone})
        );
      });
    });

    describe('when the contract owner tries to mint tokens', function () {
      describe('when the recipient is the zero address', function () {
        it('reverts', async function () {
          await shouldFail.reverting(
            this.token.mint(ZERO_ADDRESS, ether('1'), {from: owner})
          );
        });
      });

      describe('when the recipient is not the zero address', function () {
        it('mint tokens to the recipient', async function () {
          await this.token.mint(tokenHolder1, ether('1'), {from: owner});

          (await this.token.balanceOf(tokenHolder1)).should.be.bignumber.equal(ether('1'));
          (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
          (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
          (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
        });
      });
    });
  });

  describe('distributeDividends', function () {
    describe('when anyone tries to pay and distribute dividends', function () {
      describe('when the total supply is 0', function () {
        it('reverts', async function () {
          await shouldFail.reverting(
            this.token.distributeDividends({from: anyone, value: ether('1')})
          );
        });
      });

      describe('when paying 0 ether', function () {
        it('should succeed but nothing happens', async function () {
          await this.token.mint(tokenHolder1, ether('1'), {from: owner});

          await this.token.distributeDividends({from: anyone, value: ether('0')});

          (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
          (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
          (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
        });
      });

      describe('when the total supply is not 0', function () {
        it('should pay and distribute dividends to token holders', async function () {
          await this.token.mint(tokenHolder1, ether('1'), {from: owner});
          await this.token.mint(tokenHolder2, ether('3'), {from: owner});

          const { logs } = await this.token.distributeDividends({from: anyone, value: ether('1')});
          await expectEvent.inLogs(logs, 'DividendsDistributed', {
              from: anyone,
              weiAmount: ether('1'),
            }
          );

          (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
          (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
          (await this.token.dividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
          (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));

          (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0.75'));
          (await this.token.withdrawableDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0.75'));
          (await this.token.dividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0.75'));
          (await this.token.withdrawnDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0'));
        });
      });
    });

    describe('when anyone tries to pay and distribute dividends by sending ether to the contract', function () {
      describe('when the total supply is 0', function () {
        it('reverts', async function () {
          await shouldFail.reverting(
            this.token.sendTransaction({from: anyone, value: ether('1')})
          );
        });
      });

      describe('when paying 0 ether', function () {
        it('should succeed but nothing happens', async function () {
          await this.token.mint(tokenHolder1, ether('1'), {from: owner});

          await this.token.sendTransaction({from: anyone, value: ether('0')});

          (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
          (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
          (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
        });
      });

      describe('when the total supply is not 0', function () {
        it('should pay and distribute dividends to token holders', async function () {
          await this.token.mint(tokenHolder1, ether('1'), {from: owner});
          await this.token.mint(tokenHolder2, ether('3'), {from: owner});

          const { logs } = await this.token.sendTransaction({from: anyone, value: ether('1')});
          await expectEvent.inLogs(logs, 'DividendsDistributed', {
              from: anyone,
              weiAmount: ether('1'),
            }
          );

          (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
          (await this.token.withdrawableDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0.75'));
        });
      });
    });
  });

  describe('transfer', function () {
    beforeEach(async function () {
      await this.token.mint(tokenHolder1, ether('1'), {from: owner});
    });

    describe('when the recipient is the zero address', function () {
      it('reverts', async function () {
        await shouldFail.reverting(
          this.token.transfer(ZERO_ADDRESS, ether('0.5'), {from: tokenHolder1})
        );
      });
    });

    describe('when the recipient is not the zero address', function () {
      describe('when the sender does not have enough balance', function () {
        it('reverts', async function () {
          await shouldFail.reverting(
            this.token.transfer(tokenHolder2, ether('2'), {from: tokenHolder1})
          );
        });
      });

      describe('when the sender has enough balance', function () {
        it('transfers the requested amount', async function () {
          await this.token.transfer(tokenHolder2, ether('0.25'), {from: tokenHolder1});

          (await this.token.balanceOf(tokenHolder1)).should.be.bignumber.equal(ether('0.75'));
          (await this.token.balanceOf(tokenHolder2)).should.be.bignumber.equal(ether('0.25'));
          });

        it('emits a transfer event', async function () {
          const { logs } = await this.token.transfer(tokenHolder2, ether('0.25'), {from: tokenHolder1});

          expectEvent.inLogs(logs, 'Transfer', {
            from: tokenHolder1,
            to: tokenHolder2,
            value: ether('0.25'),
          });
        });
      });
    });
  });

  describe('transfer from', function () {
    const mintAmount = ether('9');
    const approveAmount = ether('3');
    const transferAmount = ether('1');
    const spender = anyone;

    beforeEach(async function () {
      await this.token.mint(tokenHolder1, mintAmount, {from: owner});
    });

    describe('when the recipient is not the zero address', function () {
      describe('when the spender has enough approved balance', function () {
        beforeEach(async function () {
          await this.token.approve(spender, approveAmount, { from: tokenHolder1 });
        });

        describe('when the initial holder has enough balance', function () {
          let logs;

          beforeEach(async function () {
            const receipt = await this.token.transferFrom(tokenHolder1, tokenHolder2, transferAmount, { from: spender });
            logs = receipt.logs;
          });

          it('transfers the requested amount', async function () {
            (await this.token.balanceOf(tokenHolder1)).should.be.bignumber.equal( mintAmount.sub(transferAmount) );
            (await this.token.balanceOf(tokenHolder2)).should.be.bignumber.equal( transferAmount );
          });

          it('decreases the spender allowance', async function () {
            (await this.token.allowance(tokenHolder1, spender)).should.be.bignumber.equal( approveAmount.sub(transferAmount) );
          });

          it('emits a transfer event', async function () {
            expectEvent.inLogs(logs, 'Transfer', {
              from: tokenHolder1,
              to: tokenHolder2,
              value: transferAmount,
            });
          });

          it('emits an approval event', async function () {
            expectEvent.inLogs(logs, 'Approval', {
              owner: tokenHolder1,
              spender: spender,
              value: approveAmount.sub(transferAmount),
            });
          });
        });

        describe('when the initial holder does not have enough balance', function () {
          const _approveAmount = mintAmount.addn(1);
          const _transferAmount = _approveAmount;

          beforeEach(async function () {
            await this.token.approve(spender, _approveAmount, { from: tokenHolder1 });
          });

          it('reverts', async function () {
            await shouldFail.reverting(this.token.transferFrom(tokenHolder1, tokenHolder2, _transferAmount, { from: spender }));
          });
        });
      });

      describe('when the spender does not have enough approved balance', function () {
        beforeEach(async function () {
          await this.token.approve(spender, approveAmount, { from: tokenHolder1 });
        });

        describe('when the initial holder has enough balance', function () {
          const _transferAmount = approveAmount.addn(1);

          it('reverts', async function () {
            await shouldFail.reverting(this.token.transferFrom(tokenHolder1, tokenHolder2, _transferAmount, { from: spender }));
          });
        });

        describe('when the initial holder does not have enough balance', function () {
          const _transferAmount = mintAmount.addn(1);

          it('reverts', async function () {
            await shouldFail.reverting(this.token.transferFrom(tokenHolder1, tokenHolder2, _transferAmount, { from: spender }));
          });
        });
      });
    });

    describe('when the recipient is the zero address', function () {
      beforeEach(async function () {
        await this.token.approve(spender, approveAmount, { from: tokenHolder1 });
      });

      it('reverts', async function () {
        await shouldFail.reverting(this.token.transferFrom(tokenHolder1, ZERO_ADDRESS, transferAmount, { from: spender }));
      });
    });
  });

  describe('withdrawDividend', function () {
    it('should be able to withdraw dividend', async function () {
      await this.token.mint(tokenHolder1, ether('1'), {from: owner});
      await this.token.mint(tokenHolder2, ether('3'), {from: owner});
      await this.token.distributeDividends({from: anyone, value: ether('1')});

      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));

      const balance1 = await balance.current(tokenHolder1);
      const receipt = await this.token.withdrawDividend({from: tokenHolder1, gasPrice: gasPrice});
      expectEvent.inLogs(receipt.logs, 'DividendWithdrawn', {
          to: tokenHolder1,
          weiAmount: ether('0.25'),
        }
      );

      const balance2 = await balance.current(tokenHolder1);
      const fee = gasPrice.mul(new BN(receipt.receipt.gasUsed));
      balance2.should.be.bignumber.equal( balance1.add(ether('0.25')).sub(fee) );

      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));

      // withdraw again. should succeed and withdraw nothing
      const receipt2 = await this.token.withdrawDividend({from: tokenHolder1, gasPrice: gasPrice});
      const balance3 = await balance.current(tokenHolder1);
      const fee2 = gasPrice.mul(new BN(receipt2.receipt.gasUsed));
      balance3.should.be.bignumber.equal( balance2.sub(fee2));

      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
    });
  });

  describe('keep dividends unchanged in several cases', function () {
    it('should keep dividends unchanged after minting tokens', async function () {
      await this.token.mint(tokenHolder1, ether('1'), {from: owner});
      await this.token.mint(tokenHolder2, ether('3'), {from: owner});
      await this.token.distributeDividends({from: anyone, value: ether('1')});

      await this.token.mint(tokenHolder1, ether('1'), {from: owner});

      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
    });

    it('should keep dividends unchanged after transferring tokens', async function () {
      await this.token.mint(tokenHolder1, ether('1'), {from: owner});
      await this.token.mint(tokenHolder2, ether('3'), {from: owner});
      await this.token.distributeDividends({from: anyone, value: ether('1')});

      await this.token.transfer(tokenHolder2, ether('1'), {from: tokenHolder1});

      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));

      (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0.75'));
      (await this.token.withdrawableDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0.75'));
      (await this.token.withdrawnDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0'));
    });

    it('should keep dividends unchanged after transferFrom', async function () {
      await this.token.mint(tokenHolder1, ether('1'), {from: owner});
      await this.token.mint(tokenHolder2, ether('3'), {from: owner});
      await this.token.distributeDividends({from: anyone, value: ether('1')});

      await this.token.approve(tokenHolder3, ether('1'), {from: tokenHolder1});
      await this.token.transferFrom(tokenHolder1, tokenHolder2, ether('1'), {from: tokenHolder3});

      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0.25'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));

      (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0.75'));
      (await this.token.withdrawableDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0.75'));
      (await this.token.withdrawnDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0'));
    });

    it('should correctly distribute dividends after transferring tokens', async function () {
      await this.token.mint(tokenHolder1, ether('2'), {from: owner});
      await this.token.mint(tokenHolder2, ether('3'), {from: owner});
      await this.token.distributeDividends({from: anyone, value: ether('5')});

      await this.token.transfer(tokenHolder2, ether('1'), {from: tokenHolder1});
      await this.token.distributeDividends({from: anyone, value: ether('50')});

      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('12'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('12'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));

      (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('43'));
      (await this.token.withdrawableDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('43'));
      (await this.token.withdrawnDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0'));
    });
  });

  describe('end-to-end test', function () {
    it('should pass end-to-end test', async function () {
      let balanceBefore;
      let balanceAfter;
      let receipt;
      let fee;

      // mint and distributeDividends
      await this.token.mint(tokenHolder1, ether('2'), {from: owner});
      await this.token.distributeDividends({from: anyone, value: ether('10')});

      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('10'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('10'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));

      // transfer
      await this.token.transfer(tokenHolder2, ether('2'), {from: tokenHolder1});
      (await this.token.balanceOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
      (await this.token.balanceOf(tokenHolder2)).should.be.bignumber.equal(ether('2'));
      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('10'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('10'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
      (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0'));
      (await this.token.withdrawableDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0'));
      (await this.token.withdrawnDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0'));

      // tokenHolder1 withdraw
      balanceBefore = await balance.current(tokenHolder1);
      receipt = await this.token.withdrawDividend({from: tokenHolder1, gasPrice: gasPrice});
      balanceAfter = await balance.current(tokenHolder1);
      fee = gasPrice.mul(new BN(receipt.receipt.gasUsed));
      balanceAfter.should.be.bignumber.equal( balanceBefore.add(ether('10')).sub(fee));
      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('10'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('10'));

      // deposit
      await this.token.distributeDividends({from: anyone, value: ether('10')});
      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('10'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('10'));
      (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('10'));
      (await this.token.withdrawableDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('10'));
      (await this.token.withdrawnDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0'));

      // mint
      await this.token.mint(tokenHolder1, ether('3'), {from: owner});
      (await this.token.balanceOf(tokenHolder1)).should.be.bignumber.equal(ether('3'));

      // deposit
      await this.token.distributeDividends({from: anyone, value: ether('10')});
      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('16'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('6'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('10'));
      (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('14'));
      (await this.token.withdrawableDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('14'));
      (await this.token.withdrawnDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0'));

      // now tokens: 3, 2

      await this.token.transfer(tokenHolder3, ether('2'), {from: tokenHolder2});

      // 3, 0, 2

      await this.token.mint(tokenHolder2, ether('4'), {from: owner});
      await this.token.mint(tokenHolder3, ether('1'), {from: owner});

      // 3 4 3

      await this.token.transfer(tokenHolder1, ether('2'), {from: tokenHolder2});

      // 5 2 3

      await this.token.transfer(tokenHolder3, ether('5'), {from: tokenHolder1});

      // 0 2 8

      await this.token.transfer(tokenHolder2, ether('2'), {from: tokenHolder3});

      // 0 4 6

      await this.token.transfer(tokenHolder1, ether('3'), {from: tokenHolder2});

      // 3, 1, 6

      (await this.token.balanceOf(tokenHolder1)).should.be.bignumber.equal(ether('3'));
      (await this.token.balanceOf(tokenHolder2)).should.be.bignumber.equal(ether('1'));
      (await this.token.balanceOf(tokenHolder3)).should.be.bignumber.equal(ether('6'));

      // deposit
      await this.token.distributeDividends({from: anyone, value: ether('10')});
      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('19'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('9'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('10'));
      (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('15'));
      (await this.token.withdrawableDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('15'));
      (await this.token.withdrawnDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0'));
      (await this.token.accumulativeDividendOf(tokenHolder3)).should.be.bignumber.equal(ether('6'));
      (await this.token.withdrawableDividendOf(tokenHolder3)).should.be.bignumber.equal(ether('6'));
      (await this.token.withdrawnDividendOf(tokenHolder3)).should.be.bignumber.equal(ether('0'));


      // tokenHolder1 withdraw
      balanceBefore = await balance.current(tokenHolder1);
      receipt = await this.token.withdrawDividend({from: tokenHolder1, gasPrice: gasPrice});
      balanceAfter = await balance.current(tokenHolder1);
      fee = gasPrice.mul(new BN(receipt.receipt.gasUsed));
      balanceAfter.should.be.bignumber.equal( balanceBefore.add(ether('9')).sub(fee));
      (await this.token.accumulativeDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('19'));
      (await this.token.withdrawableDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('0'));
      (await this.token.withdrawnDividendOf(tokenHolder1)).should.be.bignumber.equal(ether('19'));

      // tokenHolder2 withdraw
      balanceBefore = await balance.current(tokenHolder2);
      receipt = await this.token.withdrawDividend({from: tokenHolder2, gasPrice: gasPrice});
      balanceAfter = await balance.current(tokenHolder2);
      fee = gasPrice.mul(new BN(receipt.receipt.gasUsed));
      balanceAfter.should.be.bignumber.equal( balanceBefore.add(ether('15')).sub(fee));
      (await this.token.accumulativeDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('15'));
      (await this.token.withdrawableDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('0'));
      (await this.token.withdrawnDividendOf(tokenHolder2)).should.be.bignumber.equal(ether('15'));

      // tokenHolder3 withdraw
      balanceBefore = await balance.current(tokenHolder3);
      receipt = await this.token.withdrawDividend({from: tokenHolder3, gasPrice: gasPrice});
      balanceAfter = await balance.current(tokenHolder3);
      fee = gasPrice.mul(new BN(receipt.receipt.gasUsed));
      balanceAfter.should.be.bignumber.equal( balanceBefore.add(ether('6')).sub(fee));
      (await this.token.accumulativeDividendOf(tokenHolder3)).should.be.bignumber.equal(ether('6'));
      (await this.token.withdrawableDividendOf(tokenHolder3)).should.be.bignumber.equal(ether('0'));
      (await this.token.withdrawnDividendOf(tokenHolder3)).should.be.bignumber.equal(ether('6'));
    });
  });
});
