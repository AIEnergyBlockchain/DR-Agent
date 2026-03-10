// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICMRelayer
 * @notice Interchain Messaging relayer for DR Agent cross-chain operations.
 *
 * Validates Avalanche Warp Messages and relays bridge/settlement commands
 * across chains. In production, message signatures are verified by the
 * Avalanche P-Chain validator set. This contract provides the on-chain
 * receive endpoint that the Warp precompile delivers messages to.
 *
 * Message types:
 *   - BRIDGE_TRANSFER (0x01): Token bridge lock/mint/burn/unlock
 *   - SETTLEMENT_SYNC (0x02): Cross-chain settlement state sync
 *   - PROOF_ATTESTATION (0x03): Cross-chain proof verification
 */
contract ICMRelayer {
    enum MessageType { BridgeTransfer, SettlementSync, ProofAttestation }

    struct CrossChainMessage {
        bytes32 sourceChainId;
        bytes32 messageId;
        MessageType messageType;
        address sender;
        bytes payload;
        uint64 timestamp;
        bool processed;
    }

    address public operator;
    mapping(bytes32 => bool) public trustedChains;
    mapping(bytes32 => CrossChainMessage) public messages;
    mapping(bytes32 => bool) public processedMessages;

    uint256 public messageCount;

    event MessageReceived(
        bytes32 indexed messageId,
        bytes32 indexed sourceChainId,
        MessageType messageType,
        address sender
    );

    event MessageProcessed(
        bytes32 indexed messageId,
        bool success
    );

    event TrustedChainUpdated(bytes32 indexed chainId, bool trusted);

    modifier onlyOperator() {
        require(msg.sender == operator, "ICMRelayer: not operator");
        _;
    }

    constructor(address _operator) {
        require(_operator != address(0), "ICMRelayer: zero operator");
        operator = _operator;
    }

    function setTrustedChain(bytes32 chainId, bool trusted) external onlyOperator {
        trustedChains[chainId] = trusted;
        emit TrustedChainUpdated(chainId, trusted);
    }

    /**
     * @notice Receive a cross-chain message (called by Warp precompile or relayer service).
     */
    function receiveMessage(
        bytes32 sourceChainId,
        bytes32 messageId,
        uint8 messageType,
        address sender,
        bytes calldata payload
    ) external onlyOperator {
        require(trustedChains[sourceChainId], "ICMRelayer: untrusted source chain");
        require(messages[messageId].timestamp == 0, "ICMRelayer: duplicate message");
        require(messageType <= uint8(MessageType.ProofAttestation), "ICMRelayer: invalid type");

        messages[messageId] = CrossChainMessage({
            sourceChainId: sourceChainId,
            messageId: messageId,
            messageType: MessageType(messageType),
            sender: sender,
            payload: payload,
            timestamp: uint64(block.timestamp),
            processed: false
        });

        messageCount += 1;

        emit MessageReceived(messageId, sourceChainId, MessageType(messageType), sender);
    }

    /**
     * @notice Mark a message as processed after the target contract has handled it.
     */
    function markProcessed(bytes32 messageId, bool success) external onlyOperator {
        require(messages[messageId].timestamp > 0, "ICMRelayer: message not found");
        require(!processedMessages[messageId], "ICMRelayer: already processed");

        processedMessages[messageId] = true;
        messages[messageId].processed = true;

        emit MessageProcessed(messageId, success);
    }

    function isProcessed(bytes32 messageId) external view returns (bool) {
        return processedMessages[messageId];
    }

    function getMessage(bytes32 messageId) external view returns (CrossChainMessage memory) {
        require(messages[messageId].timestamp > 0, "ICMRelayer: message not found");
        return messages[messageId];
    }
}
