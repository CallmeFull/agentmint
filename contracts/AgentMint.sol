// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title AgentMint v2 — Evolving iNFT Generator
 * @notice Mints an ERC-721 NFT representing an ownable AI agent that EVOLVES with every chat.
 *         - Level grows with chat sessions (1 → 2 → 3 → ...)
 *         - New traits unlock at milestones (level 3, 5, 10, 25, 50)
 *         - "Mood" shifts based on interaction patterns
 *         - On-chain reputation: positive/negative feedback affects evolution
 *
 * Personality metadata is stored on 0G Storage; the on-chain tokenURI stores the root hash.
 * Inspired by ERC-7857 (iNFT) with an evolution layer.
 */
contract AgentMint is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId = 1;
    uint256 public constant MINT_PRICE = 0.001 ether;

    // ---- Stats ----
    uint256 public totalMinted;
    uint256 public totalSummons;
    uint256 public totalUpvotes;
    uint256 public totalDownvotes;

    // ---- Per-token data ----
    mapping(uint256 => address) public creatorOf;
    mapping(uint256 => bytes32) public personalityHashOf;
    mapping(uint256 => uint256) public summonCountOf;     // total chats
    mapping(uint256 => uint256) public levelOf;            // derived: floor(sqrt(chats/2)) + 1
    mapping(uint256 => uint256) public upvotesOf;
    mapping(uint256 => uint256) public downvotesOf;
    mapping(uint256 => uint256) public birthBlockOf;
    mapping(uint256 => uint256) public lastSummonBlockOf;

    // ---- Evolution milestones (cumulative trait unlocks) ----
    uint256 public constant MS_INITIATE = 0;
    uint256 public constant MS_CURIOUS  = 5;
    uint256 public constant MS_WISE     = 15;
    uint256 public constant MS_ANCIENT  = 40;
    uint256 public constant MS_MYTHIC   = 100;

    // ---- Mood tracking ----
    // 0=neutral, 1=curious, 2=inspired, 3=melancholic, 4=playful, 5=stern
    mapping(uint256 => uint8) public moodOf;
    mapping(uint256 => uint256) public lastMoodChangeOf;

    // ---- Events ----
    event AgentMinted(
        uint256 indexed tokenId,
        address indexed creator,
        address indexed owner,
        string tokenURI,
        bytes32 personalityHash
    );

    event AgentSummoned(
        uint256 indexed tokenId,
        address indexed summoner,
        uint256 sessionId,
        uint256 newLevel,
        string milestoneName
    );

    event AgentEvolved(
        uint256 indexed tokenId,
        uint256 newLevel,
        string milestoneName
    );

    event AgentVoted(
        uint256 indexed tokenId,
        address indexed voter,
        bool positive,
        int256 newScore
    );

    // helper for the event since int256 is not indexable
    function _emitVoteEvent(uint256 tokenId, bool positive) internal {
        emit AgentVoted(tokenId, msg.sender, positive, scoreOf(tokenId));
    }

    constructor() ERC721("AgentMint iNFT", "AGENTMINT") Ownable(msg.sender) {}

    /// @notice Mint a new iNFT.
    function mint(string memory tokenURI_, bytes32 personalityHash) public payable returns (uint256) {
        require(msg.value >= MINT_PRICE, "AgentMint: insufficient mint price");
        require(personalityHash != bytes32(0), "AgentMint: empty personality hash");

        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        creatorOf[tokenId] = msg.sender;
        personalityHashOf[tokenId] = personalityHash;
        birthBlockOf[tokenId] = block.number;
        moodOf[tokenId] = 0; // neutral
        levelOf[tokenId] = 1;

        totalMinted++;

        emit AgentMinted(tokenId, msg.sender, msg.sender, tokenURI_, personalityHash);
        return tokenId;
    }

    /// @notice Record a chat session with the agent. Triggers level-up + milestone events.
    function recordSummon(uint256 tokenId) public {
        require(_ownerOf(tokenId) != address(0), "AgentMint: nonexistent token");

        summonCountOf[tokenId] += 1;
        lastSummonBlockOf[tokenId] = block.number;
        totalSummons++;

        uint256 newLevel = _calculateLevel(summonCountOf[tokenId]);
        string memory milestone = _activeMilestoneName(summonCountOf[tokenId]);

        bool leveledUp = newLevel > levelOf[tokenId];
        if (leveledUp) {
            levelOf[tokenId] = newLevel;
            emit AgentEvolved(tokenId, newLevel, milestone);
        }

        emit AgentSummoned(tokenId, msg.sender, summonCountOf[tokenId], newLevel, milestone);
    }

    /// @notice Upvote / downvote an iNFT. Reputation grows linearly.
    function vote(uint256 tokenId, bool positive) public {
        require(_ownerOf(tokenId) != address(0), "AgentMint: nonexistent token");
        if (positive) {
            upvotesOf[tokenId] += 1;
            totalUpvotes++;
        } else {
            downvotesOf[tokenId] += 1;
            totalDownvotes++;
        }
        emit AgentVoted(tokenId, msg.sender, positive, scoreOf(tokenId));
    }

    /// @notice Compute current evolution level from chat count.
    /// Level = floor(sqrt(chats / 2)) + 1
    function _calculateLevel(uint256 chats) internal pure returns (uint256) {
        if (chats == 0) return 1;
        // Heron's method for integer sqrt of (chats/2)
        uint256 n = chats / 2;
        if (n == 0) return 1;
        uint256 x = n;
        uint256 y = (x + 1) / 2;
        while (y < x) {
            x = y;
            y = (x + n / x) / 2;
        }
        return x + 1;
    }

    /// @notice Return the active milestone name for a given chat count.
    function _activeMilestoneName(uint256 chats) internal pure returns (string memory) {
        if (chats >= MS_MYTHIC)  return "Mythic";
        if (chats >= MS_ANCIENT) return "Ancient";
        if (chats >= MS_WISE)    return "Wise";
        if (chats >= MS_CURIOUS) return "Curious";
        return "Initiate";
    }

    /// @notice Return the active milestone ability for a given chat count.
    function _activeMilestoneAbility(uint256 chats) internal pure returns (string memory) {
        if (chats >= MS_MYTHIC)  return "speaks in riddles and prophecy";
        if (chats >= MS_ANCIENT) return "references shared memory";
        if (chats >= MS_WISE)    return "offers unexpected insights";
        if (chats >= MS_CURIOUS) return "asks deeper questions";
        return "speaks plainly";
    }

    /// @notice Public view of the active milestone for a token.
    function currentMilestone(uint256 tokenId) public view returns (string memory name, string memory ability) {
        require(_ownerOf(tokenId) != address(0), "AgentMint: nonexistent token");
        return (_activeMilestoneName(summonCountOf[tokenId]), _activeMilestoneAbility(summonCountOf[tokenId]));
    }

    /// @notice Reputation score (upvotes - downvotes).
    function scoreOf(uint256 tokenId) public view returns (int256) {
        return int256(upvotesOf[tokenId]) - int256(downvotesOf[tokenId]);
    }

    /// @notice Returns a "rarity" tier: 0=common, 1=uncommon, 2=rare, 3=epic, 4=legendary, 5=mythic
    function rarityTier(uint256 tokenId) public view returns (uint8) {
        if (levelOf[tokenId] >= 50) return 5;
        if (levelOf[tokenId] >= 25) return 4;
        if (levelOf[tokenId] >= 10) return 3;
        if (levelOf[tokenId] >= 5)  return 2;
        if (levelOf[tokenId] >= 3)  return 1;
        return 0;
    }

    /// @notice Read the iNFT's full personality metadata + evolution state.
    function getAgentData(uint256 tokenId) public view returns (
        address creator,
        address ownerAddr,
        string memory tokenURI_,
        bytes32 personalityHash,
        uint256 summonCount,
        uint256 level,
        string memory milestoneName,
        string memory milestoneAbility,
        int256 score,
        uint8 rarity,
        uint8 mood,
        uint256 birthBlock
    ) {
        require(_ownerOf(tokenId) != address(0), "AgentMint: nonexistent token");
        return (
            creatorOf[tokenId],
            ownerOf(tokenId),
            tokenURI(tokenId),
            personalityHashOf[tokenId],
            summonCountOf[tokenId],
            levelOf[tokenId],
            _activeMilestoneName(summonCountOf[tokenId]),
            _activeMilestoneAbility(summonCountOf[tokenId]),
            scoreOf(tokenId),
            rarityTier(tokenId),
            moodOf[tokenId],
            birthBlockOf[tokenId]
        );
    }

    /// @notice Get a snapshot of all milestones (for off-chain display).
    function getMilestones() public pure returns (
        uint256[5] memory chatsRequired,
        string[5] memory names,
        string[5] memory abilities
    ) {
        chatsRequired = [uint256(0), MS_CURIOUS, MS_WISE, MS_ANCIENT, MS_MYTHIC];
        names[0] = "Initiate"; names[1] = "Curious"; names[2] = "Wise"; names[3] = "Ancient"; names[4] = "Mythic";
        abilities[0] = "speaks plainly";
        abilities[1] = "asks deeper questions";
        abilities[2] = "offers unexpected insights";
        abilities[3] = "references shared memory";
        abilities[4] = "speaks in riddles and prophecy";
        return (chatsRequired, names, abilities);
    }

    /// @notice Helper for off-chain indexers.
    function tokensOfOwner(address ownerAddr) public view returns (uint256[] memory) {
        uint256 balance = balanceOf(ownerAddr);
        uint256[] memory tokens = new uint256[](balance);
        uint256 idx = 0;
        for (uint256 i = 1; i < _nextTokenId; i++) {
            if (ownerOf(i) == ownerAddr) {
                tokens[idx++] = i;
            }
        }
        return tokens;
    }

    /// @notice Withdraw mint revenue to contract owner.
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "AgentMint: no balance");
        (bool ok, ) = payable(owner()).call{value: balance}("");
        require(ok, "AgentMint: withdraw failed");
    }

    receive() external payable {}
}
