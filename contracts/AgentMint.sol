// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title AgentMint — iNFT Generator
 * @notice Mints an ERC-721 NFT representing an ownable AI agent.
 *         The agent's personality metadata is stored on 0G Storage;
 *         the on-chain tokenURI stores the root hash + URI parts.
 *
 * Each iNFT is a unique, ownable, conversational AI agent that
 *  - has a personality system prompt (stored on 0G Storage)
 *  - can be "summoned" by its owner to chat via 0G Compute
 *  - can be transferred to other addresses (NFTs are tradeable)
 *
 * Inspired by ERC-7857 (iNFT) but simplified for 0G Zero Cup demo.
 */
contract AgentMint is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId = 1;
    uint256 public constant MINT_PRICE = 0.001 ether;

    // Number of iNFTs minted
    uint256 public totalMinted;

    // Mapping: tokenId => creator address
    mapping(uint256 => address) public creatorOf;

    // Mapping: tokenId => personality root hash (bytes32) on 0G Storage
    mapping(uint256 => bytes32) public personalityHashOf;

    // Mapping: tokenId => number of times the agent has been "summoned" (chat sessions)
    mapping(uint256 => uint256) public summonCountOf;

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
        uint256 sessionId
    );

    constructor() ERC721("AgentMint iNFT", "AGENTMINT") Ownable(msg.sender) {}

    /// @notice Mint a new iNFT with a personality stored on 0G Storage.
    /// @param tokenURI_ The full tokenURI (typically `0g://<rootHash>` or a gateway URL).
    /// @param personalityHash The 32-byte Merkle root hash of the personality JSON on 0G Storage.
    function mint(string memory tokenURI_, bytes32 personalityHash) public payable returns (uint256) {
        require(msg.value >= MINT_PRICE, "AgentMint: insufficient mint price");

        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        creatorOf[tokenId] = msg.sender;
        personalityHashOf[tokenId] = personalityHash;
        totalMinted++;

        emit AgentMinted(tokenId, msg.sender, msg.sender, tokenURI_, personalityHash);
        return tokenId;
    }

    /// @notice Mark an iNFT as summoned (a chat session was started).
    /// @dev Increments a counter; the actual chat happens off-chain via 0G Compute.
    function recordSummon(uint256 tokenId) public {
        require(_ownerOf(tokenId) != address(0), "AgentMint: nonexistent token");
        summonCountOf[tokenId] += 1;
        emit AgentSummoned(tokenId, msg.sender, summonCountOf[tokenId]);
    }

    /// @notice Withdraw mint revenue to contract owner.
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "AgentMint: no balance");
        (bool ok, ) = payable(owner()).call{value: balance}("");
        require(ok, "AgentMint: withdraw failed");
    }

    /// @notice Read the iNFT's full personality metadata pointer.
    function getAgentData(uint256 tokenId) public view returns (
        address creator,
        address ownerAddr,
        string memory tokenURI_,
        bytes32 personalityHash,
        uint256 summonCount
    ) {
        require(_ownerOf(tokenId) != address(0), "AgentMint: nonexistent token");
        return (
            creatorOf[tokenId],
            ownerOf(tokenId),
            tokenURI(tokenId),
            personalityHashOf[tokenId],
            summonCountOf[tokenId]
        );
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

    receive() external payable {}
}
