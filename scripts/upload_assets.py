"""Upload logo + thumbnail to 0G Storage."""
import os
import sys
import time
from pathlib import Path
from web3 import Web3
from web3.middleware import geth_poa_middleware

# Use the OG SDK directly
from eth_account import Account
from eth_typing import HexStr
from web3 import Web3 as Web3Class

# Use the actual 0G SDK
import subprocess
result = subprocess.run(
    ["node", "/home/ubuntu/agentmint/scripts/upload_assets_node.js"],
    capture_output=True, text=True
)
print(result.stdout)
if result.returncode != 0:
    print("STDERR:", result.stderr)
    sys.exit(1)
