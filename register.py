"""
0G Arena register — fills form using creds from .env, never echoes them.
Uses Python Playwright to bypass the Hermes browser_type echo issue.
"""
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ENV_PATH = Path("/home/ubuntu/.agentmint.env")

def load_env():
    env = {}
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip("'").strip('"')
    return env

def main():
    env = load_env()
    password = env["ZERO_CUP_PASSWORD"]
    wallet_addr = env["ZERO_CUP_WALLET_ADDRESS"]

    name = "Saeful Ramadhan"
    handle = "saefulramadhan"
    email = "saefulramadhan4001@gmail.com"

    print(f"Loaded creds from {ENV_PATH}")
    print(f"Wallet: {wallet_addr[:6]}...{wallet_addr[-4:]}")
    print(f"Name={name}, Handle={handle}, Email={email}")
    print(f"Password: {'*' * 16} ({len(password)} chars)")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )
        page = ctx.new_page()
        page.goto("https://0g.ai/arena/register", wait_until="domcontentloaded", timeout=60000)
        # Wait for visible form inputs (skip hidden Next.js server action refs)
        page.wait_for_selector("input:not([type=hidden])", timeout=20000)
        time.sleep(2)  # let React hydrate

        # Fill via DOM, not type (avoids keystroke echo in any toolchain)
        visible_inputs = page.locator("input:not([type=hidden])")
        count = visible_inputs.count()
        print(f"Visible inputs: {count}")
        visible_inputs.nth(0).fill(name)
        visible_inputs.nth(1).fill(handle)
        visible_inputs.nth(2).fill(email)
        # Find password specifically
        pwd_input = page.locator("input[type=password]")
        pwd_input.fill(password)

        # Verify fills
        print("Form values (masked):")
        for i in range(count):
            inp = visible_inputs.nth(i)
            v = inp.input_value()
            t = inp.get_attribute("type") or ""
            if t == "password":
                print(f"  [{i}] (password): {'*' * len(v)} ({len(v)} chars)")
            else:
                print(f"  [{i}] ({t}): {v}")

        # Click submit
        page.get_by_role("button", name="Create account").click()
        # Wait for navigation or error
        time.sleep(3)

        # Check result
        url = page.url
        title = page.title()
        print(f"After submit: url={url}, title={title}")

        # Capture screenshot
        page.screenshot(path="/home/ubuntu/agentmint/register_result.png", full_page=True)
        print("Screenshot: /home/ubuntu/agentmint/register_result.png")

        # Dump body text snippet for verification
        body = page.locator("body").inner_text()[:500]
        print(f"Body text (first 500):\n{body}")

        ctx.close()
        browser.close()

if __name__ == "__main__":
    main()
