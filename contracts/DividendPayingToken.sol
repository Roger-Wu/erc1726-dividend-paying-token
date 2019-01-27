pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "./DividendPayingTokenInterface.sol";
import "./DividendPayingTokenOptionalInterface.sol";
import "./math/SafeMathUint.sol";
import "./math/SafeMathInt.sol";

/// @title Dividend-Paying Token
/// @author Roger Wu (https://github.com/roger-wu)
/// @dev A mintable ERC20 token that allows anyone to pay and distribute dividends
/// to token holders and allows token holders to withdraw their dividend.
/// Reference: the source code of PoWH3D: https://etherscan.io/address/0xB3775fB83F7D12A36E0475aBdD1FCA35c091efBe#code
contract DividendPayingToken is ERC20Mintable, DividendPayingTokenInterface, DividendPayingTokenOptionalInterface {
  using SafeMath for uint256;
  using SafeMathUint for uint256;
  using SafeMathInt for int256;

  /// @dev With the existence of `magnitude`, we can properly distribute dividends
  ///   when the amount of received ether is small.
  uint256 constant internal magnitude = 2**64;

  uint256 internal magnifiedDividendPerShare;

  /// @dev
  /// Before minting or transferring tokens, the dividend of a _user
  ///   can be calculated with this formula:
  ///   `dividendOf(_user) = dps * balanceOf(_user);`.
  ///   (dps stands for dividendPerShare.)
  /// After minting or transferring tokens to a _user, the dividend of him
  ///   should not be changed, but since `balanceOf(_user)` is changed,
  ///   `dps * balanceOf(_user)` no longer == dividendOf(_user).
  /// To keep the calculated `dividendOf(_user)` unchanged, we add a correction term:
  ///   `dividendOf(_user) = dps * balanceOf(_user) + dividendCorrectionOf(_user);`.
  ///   where
  ///   `dividendCorrectionOf(_user) = -1 * dps * increasedBalanceOf(_user);`
  ///   so now even balanceOf(_user) is changed, dividendOf(_user) remains the same.
  mapping(address => int256) internal magnifiedDividendCorrections;
  mapping(address => uint256) internal withdrawnDividends;

  /// @dev Fallback function to allow anyone to pay and distribute dividends.
  function() external payable {
    payAndDistributeDividends();
  }

  /// @notice Pay and distribute ether to token holders as dividends.
  /// @dev It reverts if the total supply of tokens is 0.
  /// It emits the `DividendsDistributed` event if the amount of received ether is not 0.
  /// About undistributed ether:
  ///   In each distribution, there is a small amount of ether not distributed,
  ///     the magnified amount of which is
  ///     `msg.value * magnitude - (msg.value * magnitude / totalSupply()) * totalSupply()`.
  ///   With a well-chosen `magnitude`, the amount of undistributed ether
  ///     (de-magnified) in a distribution can be less than 1 wei.
  ///   We can actually keep track of the undistributed ether in a distribution
  ///     and try to distribute it in the next distribution,
  ///     but keeping track of some data on-chain costs much more than
  ///     the saved ether, so we don't do that.
  function payAndDistributeDividends() public payable {
    require(totalSupply() > 0);

    if (msg.value > 0) {
      magnifiedDividendPerShare = magnifiedDividendPerShare.add(
        (msg.value).mul(magnitude) / totalSupply()
      );
      emit DividendsDistributed(msg.sender, msg.value);
    }
  }

  /// @notice Withdraw the ether distributed to the sender.
  /// @dev It emits the `DividendWithdrawn` event if the amount of withdrawn ether is not 0.
  function withdrawDividend() public {
    uint256 _withdrawableDividend = withdrawableDividendOf(msg.sender);
    if (_withdrawableDividend > 0) {
      withdrawnDividends[msg.sender] = withdrawnDividends[msg.sender].add(_withdrawableDividend);
      emit DividendWithdrawn(msg.sender, _withdrawableDividend);
      (msg.sender).transfer(_withdrawableDividend);
    }
  }

  /// @notice View the amount of dividend in wei that a token holder can withdraw.
  /// @param _owner The address of a token holder.
  /// @return The amount of dividend in wei that the token holder can withdraw.
  function dividendOf(address _owner) external view returns(uint256) {
    return withdrawableDividendOf(_owner);
  }

  /// @notice View the amount of dividend in wei that a token holder can withdraw.
  /// @param _owner The address of a token holder.
  /// @return The amount of dividend in wei that the token holder can withdraw.
  function withdrawableDividendOf(address _owner) public view returns(uint256) {
    return accumulativeDividendOf(_owner).sub(withdrawnDividends[_owner]);
  }

  /// @notice View the amount of dividend in wei that a token holder has withdrawn.
  /// @param _owner The address of a token holder.
  /// @return The amount of dividend in wei that the token holder has withdrawn.
  function withdrawnDividendOf(address _owner) public view returns(uint256) {
    return withdrawnDividends[_owner];
  }

  /// @notice View the total amount of dividend in wei that a token holder has earned.
  /// = withdrawableDividendOf(_owner) + withdrawnDividendOf(_owner)
  /// @dev View the accumulative amount of dividend of a token holder.
  /// Including withdrawn and not yet withdrawn dividend.
  /// = (magnifiedDividendPerShare * balanceOf(_owner) + magnifiedDividendCorrections[_owner]) / magnitude
  /// @param _owner The address of a token holder.
  /// @return The accumulative amount of dividend in wei that the token holder has earned.
  function accumulativeDividendOf(address _owner) public view returns(uint256) {
    return magnifiedDividendPerShare.mul(balanceOf(_owner)).toInt256Safe()
      .add(magnifiedDividendCorrections[_owner]).toUint256Safe() / magnitude;
  }

  /// @dev Internal function that transfer tokens from one address to another.
  /// Update magnifiedDividendCorrections to keep dividends unchanged.
  /// @param from The address to transfer from.
  /// @param to The address to transfer to.
  /// @param value The amount to be transferred.
  function _transfer(address from, address to, uint256 value) internal {
    super._transfer(from, to, value);

    int256 _magCorrection = magnifiedDividendPerShare.mul(value).toInt256Safe();
    magnifiedDividendCorrections[from] = magnifiedDividendCorrections[from].add(_magCorrection);
    magnifiedDividendCorrections[to] = magnifiedDividendCorrections[to].sub(_magCorrection);
  }

  /// @dev Internal function that mints tokens to an account.
  /// Update magnifiedDividendCorrections to keep dividends unchanged.
  /// @param account The account that will receive the created tokens.
  /// @param value The amount that will be created.
  function _mint(address account, uint256 value) internal {
    super._mint(account, value);

    magnifiedDividendCorrections[account] = magnifiedDividendCorrections[account]
      .sub( (magnifiedDividendPerShare.mul(value)).toInt256Safe() );
  }

  /// @dev Internal function that burns an amount of the token of a given account.
  /// Update magnifiedDividendCorrections to keep dividends unchanged.
  /// @param account The account whose tokens will be burnt.
  /// @param value The amount that will be burnt.
  function _burn(address account, uint256 value) internal {
    super._burn(account, value);

    magnifiedDividendCorrections[account] = magnifiedDividendCorrections[account]
      .add( (magnifiedDividendPerShare.mul(value)).toInt256Safe() );
  }
}
