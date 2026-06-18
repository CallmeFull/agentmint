"""Full walkthrough: describe → generate → chat (with mint shown in final state)."""
import asyncio
import time
from playwright.async_api import async_playwright
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
        
        # 1. Landing (4s)
        print("1. Landing")
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)
        await page.screenshot(path="/home/ubuntu/agentmint/demo/v2_01_landing.png")
        
        # 2. Type description + click generate (10s)
        print("2. Describe + Generate")
        textarea = page.locator("textarea").first
        await textarea.fill("A grumpy lighthouse keeper who has stood watch for 300 years and speaks in short, weather-beaten sentences.")
        await page.wait_for_timeout(1500)
        await page.screenshot(path="/home/ubuntu/agentmint/demo/v2_02_describe.png")
        
        gen_btn = page.get_by_role("button", name="Generate Personality").first
        await gen_btn.click()
        await page.wait_for_timeout(8000)
        await page.screenshot(path="/home/ubuntu/agentmint/demo/v2_03_generated.png")
        
        # 3. Chat with the agent (8s)
        print("3. Chat")
        # Find a chat input if exists
        chat_input = page.locator("input[placeholder*='type' i], textarea[placeholder*='type' i], input[placeholder*='message' i]").first
        if await chat_input.count() > 0:
            try:
                await chat_input.fill("Tell me about yourself")
                await page.wait_for_timeout(500)
                send = page.get_by_role("button", name="Send").first
                if await send.count() > 0:
                    await send.click()
                    await page.wait_for_timeout(5000)
            except Exception as e:
                print(f"   Chat UI issue: {e}")
        await page.screenshot(path="/home/ubuntu/agentmint/demo/v2_04_chat.png")
        
        # 4. Explore page
        print("4. Explore")
        await page.goto(f"{url}/explore", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)
        await page.screenshot(path="/home/ubuntu/agentmint/demo/v2_05_explore.png")
        
        # 5. Leaderboard
        print("5. Leaderboard")
        await page.goto(f"{url}/leaderboard", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)
        await page.screenshot(path="/home/ubuntu/agentmint/demo/v2_06_leaderboard.png")
        
        # 6. Back to mint (show that we're ready to upload + mint)
        print("6. Upload + Mint ready state")
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)
        await page.screenshot(path="/home/ubuntu/agentmint/demo/v2_07_final.png")
        
        await ctx.close()
        await browser.close()
        
        # Convert latest video
        import glob
        videos = sorted(glob.glob("/home/ubuntu/agentmint/demo/*.webm"), key=os.path.getmtime, reverse=True)
        if videos:
            print(f"\nLatest video: {videos[0]}")
            import subprocess
            subprocess.run([
                "ffmpeg", "-y", "-i", videos[0],
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-vf", "fps=15",
                "/home/ubuntu/agentmint/demo/walkthrough.mp4"
            ], capture_output=True)
            print("Converted to mp4")
            print(f"Size: {os.path.getsize('/home/ubuntu/agentmint/demo/walkthrough.mp4')/1024:.1f} KB")

asyncio.run(main())
