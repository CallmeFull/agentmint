"""
0G Faucet claim via 2Captcha Turnstile solver + Playwright.
"""
import time
import os
import re
from pathlib import Path
from twocaptcha import TwoCaptcha
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

# Read TWOCAPTCHA key directly from .env (avoids encoding issues)
with open("/home/ubuntu/.hermes/.env") as f:
    for line in f:
        if line.startswith("TWOCAPTCHA_API_KEY="):
            API_KEY = line.split("=", 1)[1].strip()
            break
print(f"2Captcha key len: {len(API_KEY)}")

SITE_KEY = "0x4AAAAAADBynHtsbCXCRdxU"
PAGE_URL = "https://faucet.0g.ai"

# Load wallet
env = {}
with open("/home/ubuntu/.agentmint.env") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip("'").strip('"')

WALLET = env["ZERO_CUP_WALLET_ADDRESS"]
print(f"Wallet: {WALLET[:6]}...{WALLET[-4:]}")

# Solve Turnstile
print("Solving Turnstile via 2Captcha...")
solver = TwoCaptcha(API_KEY)
result = solver.turnstile(sitekey=SITE_KEY, url=PAGE_URL)
token = result["code"]
print(f"Got token (len={len(token)})")

# Submit via Playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = browser.new_context(
        user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        viewport={"width": 1280, "height": 800},
    )
    page = ctx.new_page()
    page.goto(PAGE_URL, wait_until="domcontentloaded", timeout=60000)
    time.sleep(3)
    # Fill address
    addr_input = page.locator("input[placeholder*='0x']").first
    addr_input.fill(WALLET)
    time.sleep(1)
    # Inject Turnstile token
    page.evaluate(f"""
        const t = document.querySelector('input[name="cf-turnstile-response"]');
        if (t) {{
            t.value = '{token}';
            t.dispatchEvent(new Event('input', {{bubbles: true}}));
            t.dispatchEvent(new Event('change', {{bubbles: true}}));
        }}
    """)
    time.sleep(2)
    # Click request
    try:
        page.get_by_role("button", name="Request Tokens").click()
    except Exception as e:
        print(f"Click err: {e}")
    time.sleep(10)
    body = page.locator("body").inner_text()[:1500]
    print(f"Body after submit:\n{body}")
    page.screenshot(path="/home/ubuntu/agentmint/faucet_solved.png", full_page=True)
    # Check balance
    import urllib.request, json
    req = urllib.request.Request(
        "https://evmrpc-testnet.0g.ai",
        data=json.dumps({"jsonrpc": "2.0", "method": "eth_getBalance", "params": [WALLET, "latest"], "id": 1}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read())
        balance_wei = int(data.get("result", "0x0"), 16)
        balance = balance_wei / 10**18
        print(f"\nBalance: {balance} 0G ({balance_wei} wei)")
    ctx.close()
    browser.close()
