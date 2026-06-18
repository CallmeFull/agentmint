"""Walk through the public URL and take screenshots + record video of the full flow."""
import asyncio
from playwright.async_api import async_playwright
import time
import os

os.makedirs("/home/ubuntu/agentmint/demo", exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            record_video_dir="/home/ubuntu/agentmint/demo",
            record_video_size={"width": 1280, "height": 720},
        )
        page = await ctx.new_page()

        url = "https://tiger-cleaning-clothes-satisfy.trycloudflare.com"
        print(f"=== Walking through {url} ===")

        # 1. Landing page
        print("1. Landing page...")
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)
        await page.screenshot(path="/home/ubuntu/agentmint/demo/01_landing.png", full_page=True)

        # 2. Explore page
        print("2. Explore page...")
        await page.goto(f"{url}/explore", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)
        await page.screenshot(path="/home/ubuntu/agentmint/demo/02_explore.png", full_page=True)

        # 3. Leaderboard
        print("3. Leaderboard...")
        await page.goto(f"{url}/leaderboard", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)
        await page.screenshot(path="/home/ubuntu/agentmint/demo/03_leaderboard.png", full_page=True)

        # 4. Agent page (back to main, with description typed in)
        print("4. Agent page with description...")
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # Find the textarea for description
        textarea = page.locator("textarea").first
        if await textarea.count() > 0:
            await textarea.fill("A grumpy lighthouse keeper who has stood watch for 300 years and speaks in short, weather-beaten sentences.")
            await page.wait_for_timeout(1000)
            await page.screenshot(path="/home/ubuntu/agentmint/demo/04_description.png", full_page=True)

        # 5. Click "Generate personality" (if button exists)
        print("5. Generate personality button...")
        try:
            gen_btn = page.get_by_role("button", name="Generate personality").first
            if await gen_btn.count() > 0:
                await gen_btn.click()
                await page.wait_for_timeout(8000)
                await page.screenshot(path="/home/ubuntu/agentmint/demo/05_generated.png", full_page=True)
        except Exception as e:
            print(f"   Generate button error: {e}")

        await ctx.close()
        await browser.close()

        # Find the recorded video
        import glob
        videos = glob.glob("/home/ubuntu/agentmint/demo/*.webm")
        if videos:
            print(f"\nVideo saved: {videos[0]}")
            for v in videos:
                size = os.path.getsize(v) / 1024
                print(f"  {v}: {size:.1f} KB")

asyncio.run(main())
