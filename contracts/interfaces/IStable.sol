// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

uint256 constant N_COINS = 2;

interface IStable {
  function balances(uint256) external view returns (uint256);

  function A() external view returns (uint256);

  function get_virtual_price() external view returns (uint256);

  function calc_token_amount(uint256[N_COINS] memory amounts, bool deposit)
    external
    view
    returns (uint256);

  function add_liquidity(uint256[N_COINS] memory amounts, uint256 min_mint_amount) external;

  function get_dy(
    uint256 i,
    uint256 j,
    uint256 dx
  ) external view returns (uint256);

  function get_dy_underlying(
    uint256 i,
    uint256 j,
    uint256 dx
  ) external view returns (uint256);

  function exchange(
    uint256 i,
    uint256 j,
    uint256 dx,
    uint256 min_dy
  ) external;

  function remove_liquidity(uint256 _amount, uint256[N_COINS] memory min_amounts) external;

  function remove_liquidity_imbalance(uint256[N_COINS] memory amounts, uint256 max_burn_amount)
    external;

  function calc_withdraw_one_coin(uint256 _token_amount, uint256 i) external view returns (uint256);

  function remove_liquidity_one_coin(
    uint256 _token_amount,
    uint256 i,
    uint256 min_amount
  ) external;
}
