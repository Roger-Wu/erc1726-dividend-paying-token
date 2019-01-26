pragma solidity ^0.4.24;


/// @title Dividend Paying Token Interface
/// @author Roger Wu (https://github.com/roger-wu)
/// @dev The interface of profitable token which allows people to
/// deposit/withdraw/view the dividends of token holders.
interface DividendPayingTokenInterface {
  // pay ether to all token holders
  function payAndDistributeDividends() external payable;

  // withdraw the dividends of a token holder
  function withdrawDividend() external;

  // view the amount of dividends that can be withdrawn by a token holder
  function withdrawableDividendOf(address _user)
    external view returns(uint256);

  // view the amount of dividends that has been withdrawn by a token holder
  function withdrawnDividendOf(address _user) external view returns(uint256);

  // view the total amount of dividends that a token holder has earned
  // = withdrawableDividendOf(_user) + withdrawnDividendOf(_user)
  function accumulativeDividendOf(address _user)
    external view returns(uint256);

  // view the total amount of dividends that have been paid to this contract
  // function totalDividends() external view returns(uint256);

  event DividendsDistributed(
    address indexed from,
    uint256 weiAmount
  );
  event DividendsWithdrawn(
    address indexed to,
    uint256 weiAmount
  );
}
