// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MintERC20 is ERC20 {
  constructor() ERC20("MINT", "MT") {}

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function burn(address to, uint256 amount) external {
    _burn(to, amount);
  }
}
