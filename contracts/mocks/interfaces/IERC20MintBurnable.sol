// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IERC20MintBurnable is IERC20Metadata {
  function mint(address to, uint256 amount) external;

  function mintMe(uint256 amount) external;

  function burn(address to, uint256 amount) external;

  function burnMe(uint256 amount) external;
}
