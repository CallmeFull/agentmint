"""AgentMint v3 walkthrough — records a real video using Playwright."""
import os
import asyncio
from playwright.async_api import async_playwright

PUBLIC_URL = os.environ.get("PUBLIC_URL", "https://tiger-cleaning-clothes-satisfy.trycloudflare.com")
OUT_DIR = "demo"
os.makedirs(OUT_DIR, exist_ok=True)

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            record_video_dir=OUT_DIR,
            record_video_size={"width": 1280, "height": 800},
        )
        page = await ctx.new_page()

        # 1. Landing
        await page.goto(PUBLIC_URL, wait_until="networkidle")
        await page.wait_for_timeout(2000)

        # 2. Generate
        prompt = "A sarcastic pirate captain who hates Mondays"
        try:
            await page.fill("textarea", prompt)
        except:
            await page.fill("input[type=text]", prompt)
        await page.wait_for_timeout(500)
        try:
            await page.click("button:has-text('Generate')", timeout=2000)
        except:
            try:
                await page.click("button[type=submit]", timeout=2000)
            except:
                pass
        await page.wait_for_timeout(4000)

        # 3. Agent detail (Agent #1 with real evolution)
        try:
            await page.goto(f"{PUBLIC_URL}/agent/1", wait_until="networkidle", timeout=10000)
            await page.wait_for_timeout(3000)

            # 4. Chat
            chat = page.locator('input[placeholder*="message" i], textarea[placeholder*="message" i]').first
            await chat.fill("What is your favorite memory?")
            await page.wait_for_timeout(500)
            try:
                await page.click("button:has-text('Send')", timeout=2000)
            except:
                try:
                    await page.click("button[type=submit]", timeout=2000)
                except:
                    pass
            await page.wait_for_timeout(7000)

            # 5. Upvote
            try:
                upvote = page.locator("button:has-text('👍')").first
                await upvote.click(timeout=2000)
                await page.wait_for_timeout(2000)
            except:
                pass

        except Exception as e:
            print(f"agent page skipped: {e}")

        await page.wait_for_timeout(2000)
        await browser.close()

        # Find the video file
        import glob
        videos = glob.glob(f"{OUT_DIR}/*.webm")
        if videos:
            v = sorted(videos, key=os.path.getmtime)[-1]
            target = f"{OUT_DIR}/walkthrough.webm"
            if v != target:
                os.rename(v, target)
            print(f"\n✓ Video: {target} ({os.path.getsize(target)} bytes)")

asyncio.run(main())
