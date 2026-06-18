"""Try multiple faucet endpoints to get more 0G tokens."""
import requests
import time

KEY_PREFIX = "TWOCAPTCHA_API_KEY="
API_KEY = None
with open("/home/ubuntu/.hermes/.env") as f:
    for line in f:
        if line.startswith(KEY_PREFIX):
            API_KEY = line.split("=", 1)[1].strip()
            break

KEY_PREFIX2 = "ZERO_CUP_WALLET_ADDRESS="
WALLET = None
with open("/home/ubuntu/.agentmint.env") as f:
    for line in f:
        if line.startswith(KEY_PREFIX2):
            WALLET = line.split("=", 1)[1].strip()
            break

print(f"Wallet: {WALLET}")

# Get fresh turnstile
result = requests.post("https://2captcha.com/createTask", json={
    "clientKey": API_KEY,
    "task": {
        "type": "TurnstileTaskProxyless",
        "websiteURL": "https://faucet.0g.ai",
        "websiteKey": "0x4AAAAAADBynHtsbCXCRdxU",
        "domain": "challenges.cloudflare.com",
    }
}).json()
task_id = result.get("taskId")
print(f"Solving task {task_id}...")

token = None
for i in range(60):
    time.sleep(5)
    res = requests.post("https://2captcha.com/getTaskResult", json={"clientKey": API_KEY, "taskId": task_id}).json()
    if res.get("status") == "ready":
        token = res["solution"]["token"]
        print("Token ready")
        break

if not token:
    print("No token")
    exit(1)

endpoints = [
    "https://faucet-api.udhaykumarbala.dev/api/claim",
    "https://faucet.0g.ai/api/claim",
    "https://faucet.0g.ai/api/v1/claim",
    "https://faucet.0g.ai/api/drip",
    "https://faucet.0g.ai/api/faucet",
]
for url in endpoints:
    try:
        r = requests.post(url, json={"wallet_address": WALLET, "turnstile_token": token}, timeout=15)
        print(f"[{r.status_code}] POST {url}: {r.text[:200]}")
    except Exception as e:
        print(f"[ERR] {url}: {e}")
