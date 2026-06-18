"""AgentMint v2 walkthrough — landing, generate, chat, evolution UI."""
import os
import asyncio
from playwright.async_api import async_playwright

PUBLIC_URL = os.environ.get("PUBLIC_URL", "https://tiger-cleaning-clothes-satisfy.trycloudflare.com")
OUT_DIR = "demo"
os.makedirs(OUT_DIR, exist_ok=True)

# Captions: shown on each screenshot
SCRIPT = [
    ("01_landing.png", 0, "AgentMint — Mint an evolving AI agent as an NFT"),
    ("02_generate.png", 1000, "Generate personality from a prompt"),
    ("03_generated.png", 2500, "Personality + 0G Storage metadata generated"),
    ("04_agent_page.png", 3500, "Agent detail: level, XP, milestone, voting"),
    ("05_chat.png", 5000, "Real 0G Compute chat (qwen2.5-omni-7b)"),
    ("06_voting.png", 7000, "Upvote the agent — score goes up"),
]

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await ctx.new_page()
        await page.goto(PUBLIC_URL, wait_until="networkidle")
        await page.wait_for_timeout(2000)

        # 01 landing
        await page.screenshot(path=f"{OUT_DIR}/01_landing.png", full_page=True)
        print("✓ 01 landing")

        # 02 generate
        prompt = "A sarcastic pirate captain who hates Mondays"
        await page.fill("input[name=prompt], textarea, input[type=text]", prompt)
        await page.wait_for_timeout(500)
        await page.screenshot(path=f"{OUT_DIR}/02_generate.png", full_page=True)
        print("✓ 02 generate")

        # Click "Generate" button
        try:
            await page.click("button:has-text('Generate')", timeout=2000)
        except:
            try:
                await page.click("button:has-text('Mint')", timeout=2000)
            except:
                await page.click("button[type=submit]", timeout=2000)

        # 03 generated
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{OUT_DIR}/03_generated.png", full_page=True)
        print("✓ 03 generated")

        # Try to navigate to an existing agent page (Agent #1)
        try:
            await page.goto(f"{PUBLIC_URL}/agent/1", wait_until="networkidle", timeout=10000)
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{OUT_DIR}/04_agent_page.png", full_page=True)
            print("✓ 04 agent page")
        except Exception as e:
            print(f"  agent page skipped: {e}")

        # 05 chat - try to send a message
        try:
            chat_input = page.locator("input[placeholder*=message], input[placeholder*=chat], textarea").first
            await chat_input.fill("Hello, who are you?")
            await page.wait_for_timeout(500)
            send_btn = page.locator("button:has-text('Send'), button[type=submit]").first
            await send_btn.click()
            await page.wait_for_timeout(5000)
            await page.screenshot(path=f"{OUT_DIR}/05_chat.png", full_page=True)
            print("✓ 05 chat")
        except Exception as e:
            print(f"  chat skipped: {e}")

        # 06 voting - click upvote
        try:
            upvote = page.locator("button:has-text('Upvote'), button:has-text('👍'), button:has-text('+')").first
            await upvote.click()
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{OUT_DIR}/06_voting.png", full_page=True)
            print("✓ 06 voting")
        except Exception as e:
            print(f"  voting skipped: {e}")

        await browser.close()
        print("\nDone! Demo screenshots in", OUT_DIR)

asyncio.run(main())
