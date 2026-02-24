// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DRToken — Demand Response settlement token
contract DRToken is ERC20 {
    address public immutable owner;

    constructor(
        address ownerAddress,
        uint256 initialSupply
    ) ERC20("Demand Response Token", "DRT") {
        require(ownerAddress != address(0), "Zero owner");
        owner = ownerAddress;
        _mint(ownerAddress, initialSupply);
    }
}
