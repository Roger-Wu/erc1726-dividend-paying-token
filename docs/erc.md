---
eip:
title: Dividend-Paying Token Standard
author: Roger Wu (@Roger-Wu) <gsetcrw@gmail.com>, Tom Lam (@erinata) <tomlam@uchicago.edu>
type: Standards Track
category: ERC
status: Draft
created: 2019-01-27
---

## Simple Summary

A standard interface for dividend-paying tokens.


## Abstract

The following standard allows for the implementation of a standard API for dividend-paying tokens within smart contracts.
This standard provides basic functionality to allow anyone to pay and distribute ether to all token holders.
A token holder can then view or withdraw the ether distributed to them from the contract.


## Motivation

While the number of tokens and dapps with dividend paying features is growing, there is few widely adopted standard interfaces for such contracts.
A standard interface allows wallet/exchange applications to work with any dividend-paying token on Ethereum, which makes it much easier to view and manage dividends from different sources.

In this EIP, we propose a standard interface and a well-tested implementation for a dividend-paying token contract.
We hope that our work could help the community to reach a consensus of the standard.


## Specification

```solidity
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
```

OPTIONAL viewing functions for dividend-paying token:

```solidity
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
```

## Implementation

Our implementation of a mintable dividend-paying ERC20 token: https://github.com/Roger-Wu/DividendPayingToken


## Backwards Compatibility

The interface is designed to be compatible with ERC20 tokens.


## Copyright
Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).