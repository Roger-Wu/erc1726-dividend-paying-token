pragma solidity ^0.5.0;


/// @title Dividend-Paying Token Optional Interface
/// @author Roger Wu (https://github.com/roger-wu)
/// @dev The optional viewing interface of a dividend-paying token contract.
interface DividendPayingTokenOptionalInterface {
  /// @notice View the amount of dividend in wei that a token holder can withdraw.
  /// @param _owner The address of a token holder.
  /// @return The amount of dividend in wei that the token holder can withdraw.
  function withdrawableDividendOf(address _owner) external view returns(uint256);

  /// @notice View the amount of dividend in wei that a token holder has withdrawn.
  /// @param _owner The address of a token holder.
  /// @return The amount of dividend in wei that the token holder has withdrawn.
  function withdrawnDividendOf(address _owner) external view returns(uint256);

  /// @notice View the total amount of dividend in wei that a token holder has earned.
  /// = withdrawableDividendOf(_owner) + withdrawnDividendOf(_owner)
  /// @param _owner The address of a token holder.
  /// @return The accumulative amount of dividend in wei that the token holder has earned.
  function accumulativeDividendOf(address _owner) external view returns(uint256);
}
