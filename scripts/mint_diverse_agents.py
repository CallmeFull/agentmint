"""Mint 4 diverse agents directly via contract to show variety in the gallery."""
import json
import time
from pathlib import Path
from eth_account import Account
from web3 import Web3

# Load creds
env = {}
for line in Path("/home/ubuntu/agentmint/.env").read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip().strip("'").strip('"')

PK = env["PRIVATE_KEY"]
RPC = env.get("OG_RPC") or env.get("NEXT_PUBLIC_OG_RPC")
CONTRACT = env.get("NEXT_PUBLIC_AGENTMINT_ADDRESS") or "0x8cF902DF7f4E353B02886538d30bF5F170a70B1f"

# Load ABI
abi = json.loads(Path("/home/ubuntu/agentmint/lib/abis/AgentMintV2.json").read_text())

w3 = Web3(Web3.HTTPProvider(RPC, request_kwargs={"timeout": 30}))
account = Account.from_key(PK)
print(f"Deployer: {account.address}")
print(f"Balance: {w3.from_wei(w3.eth.get_balance(account.address), 'ether')} 0G")
print(f"Contract: {CONTRACT}")

contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT), abi=abi)

# 4 diverse agents
agents = [
    {
        "name": "Captain Jack Sparrow",
        "description": "A witty 18th century pirate captain from the Caribbean",
        "traits": ["cunning", "charming", "drunk", "lucky"],
        "color": "#c2410c",
    },
    {
        "name": "Hattori Heiji",
        "description": "A stoic samurai from feudal Japan with honor above all",
        "traits": ["disciplined", "honorable", "silent", "wise"],
        "color": "#dc2626",
    },
    {
        "name": "Dr. Luna Stargazer",
        "description": "An eccentric astrophysicist obsessed with black holes",
        "traits": ["curious", "eccentric", "intelligent", "playful"],
        "color": "#7c3aed",
    },
    {
        "name": "Bard the Comedian",
        "description": "A medieval jester who turns everything into a pun",
        "traits": ["witty", "chaotic", "warm", "loud"],
        "color": "#facc15",
    },
]

# Personality JSON template (what gets stored in 0G Storage)
def make_personality(agent):
    return {
        "name": agent["name"],
        "description": agent["description"],
        "traits": agent["traits"],
        "color": agent["color"],
        "soul_hash": "0x" + agent["name"].encode().hex().ljust(64, "0")[:64],
        "created_at": int(time.time()),
        "version": "v2",
    }

# Pseudo storage root hash (we use keccak of the JSON for on-chain reference)
from web3 import Web3 as W3
def keccak_root(p):
    return W3.keccak(text=json.dumps(p, sort_keys=True)).hex()

# MINT_PRICE = 0.001 ether
MINT_PRICE = w3.to_wei(0.001, "ether")

for agent in agents:
    personality = make_personality(agent)
    root_hash = keccak_root(personality)
    token_uri = f"0g://{root_hash}"

    print(f"\n=== Minting: {agent['name']} ===")
    print(f"  rootHash: {root_hash[:18]}…")

    # Build mint tx
    tx = contract.functions.mint(token_uri, root_hash).build_transaction({
        "from": account.address,
        "value": MINT_PRICE,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 500_000,
        "gasPrice": w3.eth.gas_price,
        "chainId": 16602,
    })

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"  tx: {tx_hash.hex()}")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    print(f"  status: {receipt['status']} (block {receipt['blockNumber']})")
    if receipt["status"] != 1:
        print(f"  ❌ FAILED")
        continue

    # Get token ID from logs
    logs = contract.events.AgentMinted().process_receipt(receipt)
    if logs:
        token_id = logs[0]["args"]["tokenId"]
        print(f"  ✓ Token ID: {token_id}")

    # Save personality to /tmp for later upload
    out = Path(f"/tmp/agent_{agent['name'].replace(' ', '_')}.json")
    out.write_text(json.dumps(personality, indent=2))
    print(f"  saved: {out}")

    time.sleep(2)  # rate limit

# Check totals
total = contract.functions.totalMinted().call()
print(f"\n✓ Total minted: {total}")
