// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title DRTBridge
 * @notice Simplified ICTT-style bridge for DRT token cross-chain transfers.
 *
 * Architecture (mirrors Avalanche ICTT pattern):
 *   Home chain (C-Chain / Fuji):  lock DRT  → emit BridgeSend
 *   Remote chain (Custom L1):     mint DRT.r → emit BridgeReceive
 *
 *   Remote chain:  burn DRT.r → emit BridgeSend
 *   Home chain:    unlock DRT → emit BridgeReceive
 *
 * In production, BridgeSend events are relayed by Avalanche Warp Messaging
 * (ICM) validators. This contract provides the on-chain lock/mint/burn/unlock
 * mechanism that the relayer calls into.
 *
 * Roles:
 *   - operator: admin functions (pause, set relayer)
 *   - relayer:  authorized address that calls receiveTokens (ICM relayer)
 */
contract DRTBridge {
    using SafeERC20 for IERC20;

    enum BridgeMode { Home, Remote }

    IERC20 public token;
    BridgeMode public mode;
    address public operator;
    address public relayer;
    bool public paused;

    bytes32 public remoteChainId;
    address public remoteBridge;

    uint256 public totalBridged;
    uint256 public nonce;

    event BridgeSend(
        uint256 indexed nonce,
        address indexed sender,
        uint256 amount,
        bytes32 destinationChainId,
        address destinationBridge
    );

    event BridgeReceive(
        uint256 indexed sourceNonce,
        address indexed recipient,
        uint256 amount,
        bytes32 sourceChainId
    );

    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event BridgePaused(bool paused);
    event RemoteBridgeSet(bytes32 chainId, address bridge);

    modifier onlyOperator() {
        require(msg.sender == operator, "DRTBridge: not operator");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer, "DRTBridge: not relayer");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "DRTBridge: paused");
        _;
    }

    constructor(
        address _token,
        BridgeMode _mode,
        address _operator,
        address _relayer
    ) {
        require(_token != address(0), "DRTBridge: zero token");
        require(_operator != address(0), "DRTBridge: zero operator");
        require(_relayer != address(0), "DRTBridge: zero relayer");

        token = IERC20(_token);
        mode = _mode;
        operator = _operator;
        relayer = _relayer;
    }

    // --- Admin ---

    function setRelayer(address _relayer) external onlyOperator {
        require(_relayer != address(0), "DRTBridge: zero relayer");
        address old = relayer;
        relayer = _relayer;
        emit RelayerUpdated(old, _relayer);
    }

    function setPaused(bool _paused) external onlyOperator {
        paused = _paused;
        emit BridgePaused(_paused);
    }

    function setRemoteBridge(bytes32 _chainId, address _bridge) external onlyOperator {
        require(_bridge != address(0), "DRTBridge: zero remote bridge");
        remoteChainId = _chainId;
        remoteBridge = _bridge;
        emit RemoteBridgeSet(_chainId, _bridge);
    }

    // --- Bridge operations ---

    /**
     * @notice Send tokens across the bridge.
     * Home mode: locks tokens in this contract.
     * Remote mode: burns tokens from sender.
     */
    function sendTokens(uint256 amount) external whenNotPaused {
        require(amount > 0, "DRTBridge: zero amount");
        require(remoteBridge != address(0), "DRTBridge: remote bridge not set");

        if (mode == BridgeMode.Home) {
            token.safeTransferFrom(msg.sender, address(this), amount);
        } else {
            // Remote mode: burn via the DRTokenRemote interface
            (bool ok, ) = address(token).call(
                abi.encodeWithSignature("burn(address,uint256)", msg.sender, amount)
            );
            require(ok, "DRTBridge: burn failed");
        }

        nonce += 1;
        totalBridged += amount;

        emit BridgeSend(nonce, msg.sender, amount, remoteChainId, remoteBridge);
    }

    /**
     * @notice Receive tokens from the other side of the bridge.
     * Called by the relayer after verifying the cross-chain message.
     * Home mode: unlocks tokens to recipient.
     * Remote mode: mints tokens to recipient.
     */
    function receiveTokens(
        uint256 sourceNonce,
        address recipient,
        uint256 amount,
        bytes32 sourceChainId
    ) external onlyRelayer whenNotPaused {
        require(amount > 0, "DRTBridge: zero amount");
        require(recipient != address(0), "DRTBridge: zero recipient");

        if (mode == BridgeMode.Home) {
            token.safeTransfer(recipient, amount);
        } else {
            // Remote mode: mint via DRTokenRemote
            (bool ok, ) = address(token).call(
                abi.encodeWithSignature("mint(address,uint256)", recipient, amount)
            );
            require(ok, "DRTBridge: mint failed");
        }

        emit BridgeReceive(sourceNonce, recipient, amount, sourceChainId);
    }

    /**
     * @notice View locked balance (meaningful on Home mode only).
     */
    function lockedBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
