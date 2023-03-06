// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20MintBurnable } from "./interfaces/IERC20MintBurnable.sol";

contract FakeERC20 is IERC20MintBurnable, ERC20 {
  // solhint-disable-next-line no-empty-blocks
  constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function mintMe(uint256 amount) external {
    _mint(msg.sender, amount);
  }

  function burn(address to, uint256 amount) external {
    _burn(to, amount);
  }

  function burnMe(uint256 amount) external {
    _burn(msg.sender, amount);
  }
}
