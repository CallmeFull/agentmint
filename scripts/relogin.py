"""Re-login to 0G Arena to refresh expired auth cookies."""
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

env = load_env()
email = "saefulramadhan4001@gmail.com"
password = env["ZERO_CUP_PASSWORD"]

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = browser.new_context(
        user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        viewport={"width": 1280, "height": 900},
    )
    page = ctx.new_page()
    page.goto("https://0g.ai/arena/login?next=/hackathons", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_selector("input[type=password]", timeout=20000)
    time.sleep(2)
    page.locator("input[type=email]").fill(email)
    page.locator("input[type=password]").fill(password)
    page.get_by_role("button", name="Sign in").click()
    time.sleep(4)
    print("After login URL:", page.url)
    page.screenshot(path="relogin_result.png", full_page=True)
    ctx.storage_state(path=".auth_cookies.json")
    print("✓ Auth cookies saved")
    browser.close()
