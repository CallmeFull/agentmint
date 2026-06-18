"""
Auth + navigate to hackathon. Persists cookies for re-use.
"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ENV = Path("/home/ubuntu/.agentmint.env")
COOKIES = Path("/home/ubuntu/agentmint/.auth_cookies.json")

def load_creds():
    env = {}
    for line in ENV.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip("'").strip('"')
    return env

def sign_in(page, email_addr, password):
    page.goto("https://0g.ai/arena/login", wait_until="domcontentloaded", timeout=60000)
    time.sleep(3)
    page.wait_for_selector("input:not([type=hidden])", timeout=15000)
    inputs = page.locator("input:not([type=hidden])")
    inputs.nth(0).fill(email_addr)
    inputs.nth(1).fill(password)
    page.get_by_role("button", name="Sign in").click()
    time.sleep(6)
    # Body is rendered even if URL still says /login (Next.js quirk)
    body = page.locator("body").inner_text()
    if "Welcome, Saeful" in body or "MY HACKATHONS" in body:
        print(f"✓ Signed in (body shows dashboard, URL={page.url})")
        return
    raise RuntimeError(f"Sign in failed. URL={page.url} body={body[:300]}")

def main():
    env = load_creds()
    email_addr = "saefulramadhan4001@gmail.com"
    password = env["ZERO_CUP_PASSWORD"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        )
        page = ctx.new_page()
        sign_in(page, email_addr, password)

        # Save cookies for future runs
        ctx.storage_state(path=str(COOKIES))
        print(f"✓ Cookies saved to {COOKIES}")

        # Click "Browse hackathons"
        browse = page.get_by_role("link", name="Browse hackathons").first
        if browse.count() > 0:
            browse.click()
            time.sleep(3)
        print(f"URL: {page.url}")
        body = page.locator("body").inner_text()[:3000]
        print(f"Body:\n{body}")
        page.screenshot(path="/home/ubuntu/agentmint/hackathons.png", full_page=True)

        ctx.close()
        browser.close()

if __name__ == "__main__":
    main()
