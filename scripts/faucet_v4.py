"""Try 0G faucet with 2Captcha on a fresh wallet (correct endpoint)."""
import os
import sys
import json
import time
import requests
from dotenv import dotenv_values

env = dotenv_values('/home/ubuntu/.hermes/.env')
CAPTCHA_KEY = env.get('TWOCAPTCHA_API_KEY', '')

with open('/tmp/faucet_wallet.json') as f:
    wallet = json.load(f)
ADDRESS = wallet['address']
print(f"Target: {ADDRESS}")

# 1. Submit Turnstile task to 2Captcha
print("Submitting Turnstile task...")
r = requests.post('https://2captcha.com/createTask', json={
    'clientKey': CAPTCHA_KEY,
    'task': {
        'type': 'TurnstileTaskProxyless',
        'websiteURL': 'https://faucet.0g.ai/',
        'websiteKey': '0x4AAAAAADBynHtsbCXCRdxU',
    }
}, timeout=30)
data = r.json()
if data.get('errorId'):
    print(f"  ERROR: {data}")
    sys.exit(1)
task_id = data['taskId']
print(f"  task_id: {task_id}")

# 2. Poll for the result
print("Polling for result...")
token = None
for i in range(24):
    time.sleep(5)
    r = requests.post('https://2captcha.com/getTaskResult', json={
        'clientKey': CAPTCHA_KEY,
        'taskId': task_id,
    }, timeout=30)
    d = r.json()
    if d.get('errorId'):
        print(f"  ERROR: {d}")
        sys.exit(1)
    if d.get('status') == 'ready':
        token = d['solution']['token']
        print(f"  Got token (len={len(token)})")
        break
    print(f"  attempt {i+1}: {d.get('status')}")

if not token:
    print("Failed to get token")
    sys.exit(1)

# 3. POST to /claim (not /request)
print("Posting to /claim...")
r = requests.post('https://faucet-api.udhaykumarbala.dev/api/claim', json={
    'wallet_address': ADDRESS,
    'turnstile_token': token,
}, timeout=30)
print(f"  status: {r.status_code}")
print(f"  body: {r.text[:500]}")
