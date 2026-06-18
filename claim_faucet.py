"""
Claim 0G testnet tokens via 2Captcha + direct API.
"""
import os
import time
import requests

# Read 2Captcha key directly
with open("/home/ubuntu/.hermes/.env") as f:
    API_KEY = None
    for line in f:
        if line.startswith("TWOCAPTCHA_API_KEY="):
            API_KEY = line.split("=", 1)[1].strip()
            break
assert API_KEY and len(API_KEY) >= 32, f"Bad 2captcha key: {API_KEY}"
print(f"2Captcha key loaded (len={len(API_KEY)})")

# Read wallet
with open("/home/ubuntu/.agentmint.env") as f:
    WALLET = None
    for line in f:
        if line.startswith("ZERO_CUP_WALLET_ADDRESS="):
            WALLET = line.split("=", 1)[1].strip()
            break
print(f"Wallet: {WALLET}")

SITE_KEY = "0x4AAAAAADBynHtsbCXCRdxU"
ENDPOINT = "https://faucet-api.udhaykumarbala.dev/api/claim"

# Solve Turnstile
print("Solving Turnstile via 2Captcha v2...")
result = requests.post("https://2captcha.com/createTask", json={
    "clientKey": API_KEY,
    "task": {
        "type": "TurnstileTaskProxyless",
        "websiteURL": "https://faucet.0g.ai",
        "websiteKey": SITE_KEY,
        "domain": "challenges.cloudflare.com",
    }
}).json()
print(f"createTask: {result}")
task_id = result.get("taskId")
if not task_id:
    exit(1)

token = None
for i in range(60):
    time.sleep(5)
    res = requests.post("https://2captcha.com/getTaskResult", json={
        "clientKey": API_KEY,
        "taskId": task_id,
    }).json()
    if res.get("status") == "ready":
        token = res["solution"]["token"]
        print(f"Token (len={len(token)})")
        break
    elif res.get("status") != "processing":
        print(f"Error: {res}")
        break

if not token:
    print("No token after 5min")
    exit(1)

# Submit
print(f"\nSubmitting claim to {ENDPOINT}...")
resp = requests.post(ENDPOINT, json={
    "wallet_address": WALLET,
    "turnstile_token": token,
}, headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}, timeout=30)
print(f"Status: {resp.status_code}")
print(f"Body: {resp.text[:1000]}")

# Wait + check balance
time.sleep(5)
req = requests.post(
    "https://evmrpc-testnet.0g.ai",
    json={"jsonrpc": "2.0", "method": "eth_getBalance", "params": [WALLET, "latest"], "id": 1},
    headers={"Content-Type": "application/json"},
    timeout=15,
)
data = req.json()
balance_wei = int(data.get("result", "0x0"), 16)
print(f"\nBalance: {balance_wei / 10**18} 0G ({balance_wei} wei)")
