// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title DRTokenRemote
 * @notice Wrapped DRT on the Custom L1 side of an ICTT bridge.
 *
 * Only the designated bridge contract can mint/burn tokens, ensuring 1:1
 * peg with the DRToken locked on the home chain (Fuji C-Chain).
 */
contract DRTokenRemote is ERC20 {
    address public bridge;
    address public owner;

    event BridgeUpdated(address indexed oldBridge, address indexed newBridge);

    modifier onlyBridge() {
        require(msg.sender == bridge, "DRTokenRemote: caller is not the bridge");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "DRTokenRemote: caller is not the owner");
        _;
    }

    constructor(address _owner) ERC20("Demand Response Token (Remote)", "DRT.r") {
        require(_owner != address(0), "DRTokenRemote: zero owner");
        owner = _owner;
    }

    function setBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "DRTokenRemote: zero bridge");
        address oldBridge = bridge;
        bridge = _bridge;
        emit BridgeUpdated(oldBridge, _bridge);
    }

    function mint(address to, uint256 amount) external onlyBridge {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyBridge {
        _burn(from, amount);
    }
}
