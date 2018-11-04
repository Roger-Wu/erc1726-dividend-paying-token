pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "./DividendPayingTokenInterface.sol";
import "./math/SafeMathUint.sol";
import "./math/SafeMathInt.sol";

/// @title Dividend Paying Token
/// @author Roger Wu (https://github.com/roger-wu)
/// @dev A mintable ERC20 token that allows anyone to pay and distribute dividends
/// to token holders
/// and allows token holders to withdraw their deserved dividends.
/// Based on the source code of PoWH3D: https://etherscan.io/address/0xB3775fB83F7D12A36E0475aBdD1FCA35c091efBe#code
contract DividendPayingToken is MintableToken, DividendPayingTokenInterface {
  using SafeMath for uint256;
  using SafeMathUint for uint256;
  using SafeMathInt for int256;

  /// @dev With the existence of `magnitude`, we can properly distribute dividends
  ///   when the amount of received ether is small.
  uint256 constant internal magnitude = 2**64;

  uint256 internal magnifiedDividendsPerShare;

  /// @dev
  /// Before minting or transferring tokens, the dividends of a user
  ///   can be calculated with this formula (pseudo code):
  ///   `dividendsOf(_user) = dividendsPerShare * balanceOf(_user);`.
  /// After minting or transferring tokens, the dividends of `_user`
  ///   should not be changed, but since `balanceOf(_user)` is changed,
  ///   `dividendsPerShare * balanceOf(_user)` is changed too.
  /// To keep the calculated `dividendsOf(_user)` unchanged, we add
  ///   a correction term to the formula:
  ///   `dividendsOf(_user) = dividendsPerShare * balanceOf(_user)
  ///    + dividendsCorrectionOf(_user);`.
  ///   `dividendsCorrectionOf(_user) = -1 * dividendsPerShare
  ///    * increasedBalanceOf(_user);`
  mapping(address => int256) internal magnifiedDividendsCorrections;
  mapping(address => uint256) internal withdrawnDividends;

  constructor() public {}

  /// @dev Fallback function to allow anyone to deposit dividends.
  function() public payable {
    payAndDistributeDividends();
  }

  /// @dev Allow anyone to deposit ether to this contract.
  /// The deposited ether is distributed to token holders.
  function payAndDistributeDividends() public payable {
    require(msg.value > 0);
    require(totalSupply_ > 0);

    magnifiedDividendsPerShare = magnifiedDividendsPerShare.add(
      (msg.value).mul(magnitude) / totalSupply_
    );
    emit DividendsDistributed(msg.sender, msg.value);
  }

  /// @dev Withdraw the dividends of a token holder.
  function withdrawDividends() public {
    address _user = msg.sender;
    uint256 _withdrawableDividends = withdrawableDividendsOf(_user);
    if (_withdrawableDividends > 0) {
      withdrawnDividends[_user] = withdrawnDividends[_user].add(_withdrawableDividends);
      emit DividendsWithdrawn(_user, _withdrawableDividends);
      _user.transfer(_withdrawableDividends);
    }
  }

  /// @dev View the total amount of dividends of a token holder.
  /// Including withdrawn and not yet withdrawn dividends.
  /// @param _user The address of a token holder.
  /// @return The total amount of dividends in wei.
  function accumulativeDividendOf(address _user)
    public
    view
    returns(uint256)
  {
    // (magnifiedDividendsPerShare * balances[_user] - magnifiedDividendsCorrections[_user]) / magnitude
    return magnifiedDividendsPerShare.mul(balances[_user]).toInt256Safe()
      .add(magnifiedDividendsCorrections[_user]).toUint256Safe() /
      magnitude;
  }

  /// @dev View the amount of withdrawable dividends of a token holder.
  /// @param _user The address of a token holder.
  /// @return The amount of withdrawable dividends in wei.
  function withdrawableDividendsOf(address _user)
    public
    view
    returns(uint256)
  {
    return accumulativeDividendOf(_user).sub(withdrawnDividends[_user]);
  }

  /// @dev View the amount of withdrawable dividends of a token holder.
  /// @param _user The address of a token holder.
  /// @return The amount of withdrawn dividends in wei.
  function withdrawnDividendsOf(address _user) public view returns(uint256) {
    return withdrawnDividends[_user];
  }

  /// @dev Function to mint tokens
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
    /// @dev Update magnifiedDividendsCorrections to keep dividends unchanged.
    magnifiedDividendsCorrections[_to] = magnifiedDividendsCorrections[_to]
      .sub( (magnifiedDividendsPerShare.mul(_amount)).toInt256Safe() );
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
  /// Update magnifiedDividendsCorrections to keep dividends unchanged.
  /// @param _from address The address which you want to send tokens from
  /// @param _to address The address which you want to transfer to
  /// @param _value uint256 the amount of tokens to be transferred
  function _transfer(address _from, address _to, uint256 _value) internal {
    balances[_from] = balances[_from].sub(_value);
    balances[_to] = balances[_to].add(_value);

    int256 _correction = magnifiedDividendsPerShare.mul(_value).toInt256Safe();
    magnifiedDividendsCorrections[_from] = magnifiedDividendsCorrections[_from]
      .add(_correction);
    magnifiedDividendsCorrections[_to] = magnifiedDividendsCorrections[_to]
      .sub(_correction);

    emit Transfer(_from, _to, _value);
  }
}
