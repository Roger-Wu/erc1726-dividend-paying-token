pragma solidity ^0.5.0;


/// @title Dividend-Paying Token Interface
/// @author Roger Wu (https://github.com/roger-wu)
/// @dev The interface of a dividend-paying token contract.
///   1. Anyone can pay and distribute ether to all token holders.
///   2. A token holder can then view or withdraw the ether distributed to them from the contract.
interface DividendPayingTokenInterface {
  /// @notice Pay and distribute ether to token holders as dividends.
  /// @dev It reverts when the total supply of tokens is 0.
  /// It emits the `DividendsDistributed` event if the amount of received ether is not 0.
  function payAndDistributeDividends() external payable;

  /// @notice Withdraw the ether distributed to the sender.
  /// @dev It emits the `DividendWithdrawn` event if the amount of withdrawn ether is not 0.
  function withdrawDividend() external;

  /// @notice View the amount of dividend in wei that a token holder can withdraw.
  /// @param _owner The address of a token holder.
  /// @return The amount of dividend in wei that the token holder can withdraw.
  function dividendOf(address _owner) external view returns(uint256);

  /// @dev This emits when anyone sends ether to this contract via
  /// payAndDistributeDividends or fallback function.
  /// @param from The address which sends ether to this contract.
  /// @param weiAmount The amount of wei sent to this contract.
  event DividendsDistributed(
    address indexed from,
    uint256 weiAmount
  );

  /// @dev This emits when a token holder withdraws their dividend.
  /// @param to The address which withdraws ether from this contract.
  /// @param weiAmount The amount of wei withdrawn to the token holder.
  event DividendWithdrawn(
    address indexed to,
    uint256 weiAmount
  );
}
