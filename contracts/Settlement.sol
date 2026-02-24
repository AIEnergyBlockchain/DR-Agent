// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IEventManagerSettlement {
    enum Status {
        Pending,
        Active,
        Closed,
        Settled
    }

    struct EventData {
        bytes32 eventId;
        uint64 startTime;
        uint64 endTime;
        uint256 targetKw;
        uint256 rewardRate;
        uint256 penaltyRate;
        Status status;
        address creator;
    }

    function getEventInfo(bytes32 eventId) external view returns (EventData memory);

    function markSettled(bytes32 eventId) external;
}

interface IProofRegistryView {
    struct SiteProof {
        bytes32 siteId;
        uint256 baselineKwh;
        uint256 actualKwh;
        uint256 reductionKwh;
        bytes32 proofHash;
        string uri;
        uint64 submittedAt;
        address submitter;
    }

    function isSubmitted(bytes32 eventId, bytes32 siteId)
        external
        view
        returns (bool);

    function getSiteProof(bytes32 eventId, bytes32 siteId)
        external
        view
        returns (SiteProof memory);
}

contract Settlement {
    enum SettlementStatus {
        None,
        Settled,
        Claimed
    }

    struct SettlementRecord {
        bytes32 eventId;
        bytes32 siteId;
        int256 payout;
        SettlementStatus status;
        uint64 settledAt;
        uint64 claimedAt;
    }

    address public operator;
    IEventManagerSettlement public eventManager;
    IProofRegistryView public proofRegistry;
    IERC20 public drtToken;

    mapping(address => bool) public authorizedServices;
    mapping(bytes32 => mapping(bytes32 => SettlementRecord)) private settlements;

    event AuthorizedServiceUpdated(address indexed service, bool allowed);
    event SiteSettled(
        bytes32 indexed eventId,
        bytes32 indexed siteId,
        int256 payout
    );
    event RewardClaimed(
        bytes32 indexed eventId,
        bytes32 indexed siteId,
        int256 payout,
        address indexed claimer
    );

    modifier onlyOperator() {
        require(msg.sender == operator, "Not operator");
        _;
    }

    modifier onlyOperatorOrService() {
        require(
            msg.sender == operator || authorizedServices[msg.sender],
            "Not operator/service"
        );
        _;
    }

    constructor(
        address eventManagerAddress,
        address proofRegistryAddress,
        address operatorAddress,
        address drtTokenAddress
    ) {
        require(eventManagerAddress != address(0), "Zero event manager");
        require(proofRegistryAddress != address(0), "Zero proof registry");
        require(operatorAddress != address(0), "Zero operator");
        require(drtTokenAddress != address(0), "Zero DRT token");

        eventManager = IEventManagerSettlement(eventManagerAddress);
        proofRegistry = IProofRegistryView(proofRegistryAddress);
        operator = operatorAddress;
        drtToken = IERC20(drtTokenAddress);
    }

    function setAuthorizedService(address service, bool allowed)
        external
        onlyOperator
    {
        require(service != address(0), "Zero service");
        authorizedServices[service] = allowed;
        emit AuthorizedServiceUpdated(service, allowed);
    }

    function settleEvent(bytes32 eventId, bytes32[] calldata siteIds)
        external
        onlyOperatorOrService
    {
        require(siteIds.length > 0, "Empty siteIds");

        IEventManagerSettlement.EventData memory eventData = eventManager
            .getEventInfo(eventId);
        require(
            eventData.status != IEventManagerSettlement.Status.Settled,
            "Event already settled"
        );
        require(
            eventData.status == IEventManagerSettlement.Status.Closed,
            "Event must be closed"
        );

        uint256 targetShare = eventData.targetKw / siteIds.length;

        for (uint256 i = 0; i < siteIds.length; i++) {
            bytes32 siteId = siteIds[i];
            require(
                proofRegistry.isSubmitted(eventId, siteId),
                "Proof missing"
            );
            require(
                settlements[eventId][siteId].status == SettlementStatus.None,
                "Already settled"
            );

            IProofRegistryView.SiteProof memory proof = proofRegistry.getSiteProof(
                eventId,
                siteId
            );
            int256 payout = _calculatePayout(
                proof.reductionKwh,
                targetShare,
                eventData.rewardRate,
                eventData.penaltyRate
            );

            settlements[eventId][siteId] = SettlementRecord({
                eventId: eventId,
                siteId: siteId,
                payout: payout,
                status: SettlementStatus.Settled,
                settledAt: uint64(block.timestamp),
                claimedAt: 0
            });

            emit SiteSettled(eventId, siteId, payout);
        }

        eventManager.markSettled(eventId);
    }

    function claimReward(bytes32 eventId, bytes32 siteId) external {
        SettlementRecord storage record = settlements[eventId][siteId];
        require(record.status == SettlementStatus.Settled, "Not claimable");

        IProofRegistryView.SiteProof memory proof = proofRegistry.getSiteProof(
            eventId,
            siteId
        );
        require(proof.submitter == msg.sender, "Not proof submitter");

        record.status = SettlementStatus.Claimed;
        record.claimedAt = uint64(block.timestamp);

        // Transfer DRT tokens for positive payouts
        if (record.payout > 0) {
            uint256 amount = uint256(record.payout);
            require(drtToken.transfer(msg.sender, amount), "DRT transfer failed");
        }

        emit RewardClaimed(eventId, siteId, record.payout, msg.sender);
    }

    function getSettlement(bytes32 eventId, bytes32 siteId)
        external
        view
        returns (SettlementRecord memory)
    {
        require(
            settlements[eventId][siteId].status != SettlementStatus.None,
            "Settlement not found"
        );
        return settlements[eventId][siteId];
    }

    function _calculatePayout(
        uint256 reductionKwh,
        uint256 targetShare,
        uint256 rewardRate,
        uint256 penaltyRate
    ) internal pure returns (int256) {
        if (reductionKwh >= targetShare) {
            return int256(targetShare * rewardRate);
        }

        uint256 reward = reductionKwh * rewardRate;
        uint256 penalty = (targetShare - reductionKwh) * penaltyRate;
        return int256(reward) - int256(penalty);
    }
}
