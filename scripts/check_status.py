"""Check submission status and look for final submit button."""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1280, "height": 1200},
        storage_state=".auth_cookies.json",
    )
    page = ctx.new_page()
    page.set_default_timeout(15000)
    page.goto("https://0g.ai/arena/h/zero-cup/submit", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(3000)
    print("URL:", page.url)
    page.screenshot(path="submit_status_check.png", full_page=True)

    # Get all visible text containing relevant keywords
    content = page.content()

    import re
    # Find all visible status badges/labels
    keywords = ['draft', 'submitted', 'finalize', 'pending', 'saved', 'in review', 'open', 'closed', 'update', 'submit']
    for kw in keywords:
        # Find text nodes with this keyword
        matches = re.findall(r'>([^<]*' + kw + r'[^<]*)<', content, re.IGNORECASE)
        for m in matches[:3]:
            m = m.strip()
            if 2 < len(m) < 100:
                print(f"[{kw}]: {m}")

    # List all buttons
    print("\n--- ALL BUTTONS ---")
    btns = page.locator("button").all()
    for i, b in enumerate(btns):
        try:
            text = b.text_content() or ""
            visible = b.is_visible()
            if visible and text.strip():
                print(f"  [{i}] '{text.strip()[:60]}'")
        except:
            pass

    browser.close()
