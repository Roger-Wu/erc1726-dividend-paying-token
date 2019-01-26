pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "./DividendPayingTokenInterface.sol";
import "./math/SafeMathUint.sol";
import "./math/SafeMathInt.sol";

/// @title Dividend Paying Token
/// @author Roger Wu (https://github.com/roger-wu)
/// @dev A mintable ERC20 token that allows anyone to pay and distribute dividends
/// to token holders and allows token holders to withdraw their dividend.
/// Based on the source code of PoWH3D: https://etherscan.io/address/0xB3775fB83F7D12A36E0475aBdD1FCA35c091efBe#code
contract DividendPayingToken is MintableToken, DividendPayingTokenInterface {
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

  constructor() public {}

  /// @dev Fallback function to allow anyone to pay and distribute dividends.
  function() public payable {
    payAndDistributeDividends();
  }

  /// @dev Allow anyone to pay ether to this contract.
  /// The paid ether is distributed to token holders.
  /// In each distribution, there is a small amount of ether not distributed,
  ///   the magnified amount of which is
  ///   `msg.value * magnitude - (msg.value * magnitude / totalSupply_)
  ///    * totalSupply_`.
  /// With a well-chosen `magnitude`, the amount of undistributed ether
  ///   (de-magnified) can be less than 1 wei.
  /// We can keep track of the undistributed ether and add them back
  ///   in the next distribution, but doing this costs more than saved,
  ///   so we don't do that.
  function payAndDistributeDividends() public payable {
    require(msg.value > 0);
    require(totalSupply_ > 0);

    magnifiedDividendPerShare = magnifiedDividendPerShare.add(
      (msg.value).mul(magnitude) / totalSupply_
    );
    emit DividendsDistributed(msg.sender, msg.value);
  }

  /// @dev Withdraw the dividends of a token holder.
  function withdrawDividend() public {
    address _user = msg.sender;
    uint256 _withdrawableDividend = withdrawableDividendOf(_user);
    if (_withdrawableDividend > 0) {
      withdrawnDividends[_user] = withdrawnDividends[_user].add(_withdrawableDividend);
      emit DividendsWithdrawn(_user, _withdrawableDividend);
      _user.transfer(_withdrawableDividend);
    }
  }

  /// @dev View the accumulative amount of dividend of a token holder.
  /// Including withdrawn and not yet withdrawn dividend.
  /// = (magnifiedDividendPerShare * balances[_user] - magnifiedDividendCorrections[_user]) / magnitude
  /// @param _user The address of a token holder.
  /// @return The accumulative amount of dividend of a token holder in wei.
  function accumulativeDividendOf(address _user)
    public
    view
    returns(uint256)
  {
    return magnifiedDividendPerShare.mul(balances[_user]).toInt256Safe()
      .add(magnifiedDividendCorrections[_user]).toUint256Safe() /
      magnitude;
  }

  /// @dev View the amount of withdrawable dividend of a token holder.
  /// @param _user The address of a token holder.
  /// @return The amount of withdrawable dividend of a token holder in wei.
  function withdrawableDividendOf(address _user)
    public
    view
    returns(uint256)
  {
    return accumulativeDividendOf(_user).sub(withdrawnDividends[_user]);
  }

  /// @dev View the amount of withdrawable dividends of a token holder.
  /// @param _user The address of a token holder.
  /// @return The amount of withdrawn dividend of a token holder in wei.
  function withdrawnDividendOf(address _user) public view returns(uint256) {
    return withdrawnDividends[_user];
  }

  /// @dev Function to mint tokens
  /// Update magnifiedDividendCorrections to keep dividends unchanged.
  /// @param _to The address that will receive the minted tokens.
  /// @param _amount The amount of tokens to mint.
  /// @return A boolean that indicates if the operation was successful.
  function mint(
    address _to,
    uint256 _amount
  )
    public
    hasMintPermission
    canMint
    returns (bool)
  {
    magnifiedDividendCorrections[_to] = magnifiedDividendCorrections[_to]
      .sub( (magnifiedDividendPerShare.mul(_amount)).toInt256Safe() );
    return super.mint(_to, _amount);
  }

  /// @dev Transfer token for a specified address
  /// @param _to The address to transfer to.
  /// @param _value The amount to be transferred.
  function transfer(address _to, uint256 _value) public returns (bool) {
    require(_value <= balances[msg.sender]);
    require(_to != address(0));

    _transfer(msg.sender, _to, _value);
    return true;
  }

  /// @dev Transfer tokens from one address to another
  /// @param _from address The address which you want to send tokens from
  /// @param _to address The address which you want to transfer to
  /// @param _value uint256 the amount of tokens to be transferred
  function transferFrom(
    address _from,
    address _to,
    uint256 _value
  )
    public
    returns (bool)
  {
    require(_value <= balances[_from]);
    require(_value <= allowed[_from][msg.sender]);
    require(_to != address(0));

    allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
    _transfer(_from, _to, _value);
    return true;
  }

  /// @dev Transfer tokens from one address to another.
  /// Update magnifiedDividendCorrections to keep dividends unchanged.
  /// @param _from address The address which you want to send tokens from
  /// @param _to address The address which you want to transfer to
  /// @param _value uint256 the amount of tokens to be transferred
  function _transfer(address _from, address _to, uint256 _value) internal {
    balances[_from] = balances[_from].sub(_value);
    balances[_to] = balances[_to].add(_value);

    int256 _magCorrection = magnifiedDividendPerShare.mul(_value).toInt256Safe();
    magnifiedDividendCorrections[_from] = magnifiedDividendCorrections[_from].add(_magCorrection);
    magnifiedDividendCorrections[_to] = magnifiedDividendCorrections[_to].sub(_magCorrection);

    emit Transfer(_from, _to, _value);
  }
}
