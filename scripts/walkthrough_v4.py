"""AgentMint v3 cinematic walkthrough — multi-agent showcase."""
import os
import time
from playwright.sync_api import sync_playwright

PUBLIC_URL = "https://tiger-cleaning-clothes-satisfy.trycloudflare.com"
OUT_DIR = "demo"
os.makedirs(OUT_DIR, exist_ok=True)

# (filename, wait_ms_before, action_after, caption)
SCRIPT = [
    # 1. Hero landing
    ("01_hero.png", 1500, None, "AgentMint — Evolving AI agents as on-chain iNFTs"),
    # 2. Stats + agents
    ("02_stats.png", 1000, None, "7 iNFTs minted, 17 chats, 34 compute calls, 7 storage roots"),
    # 3. Scroll to featured agents
    ("03_agents.png", 1500, "scroll_to_agents", "Live on-chain — Captain Jack Sparrow, Hattori Heiji, Dr. Luna, Bard"),
    # 4. Scroll to evolution
    ("04_evolution.png", 1000, "scroll_to_evolution", "Every chat makes them stronger — Initiate → Curious → Wise → Ancient"),
    # 5. Scroll to mint
    ("05_mint.png", 1000, "scroll_to_mint", "Mint your own in 60 seconds"),
    # 6. Agent detail (pirate)
    ("06_pirate.png", 2000, "navigate_agent_4", "Agent #4 — Captain Jack Sparrow (Legendary, Lv 3, Wise milestone)"),
    # 7. Chat with pirate
    ("07_pirate_chat.png", 1000, "chat_pirate", "Real 0G Compute chat — pirate responds in character"),
    # 8. Upvote
    ("08_vote.png", 2000, None, "On-chain voting — score & rarity update"),
    # 9. Samurai
    ("09_samurai.png", 2000, "navigate_agent_5", "Agent #5 — Hattori Heiji (Uncommon)"),
    # 10. Scientist
    ("10_scientist.png", 2000, "navigate_agent_6", "Agent #6 — Dr. Luna Stargazer (Rare)"),
    # 11. Bard
    ("11_bard.png", 2000, "navigate_agent_7", "Agent #7 — Bard the Comedian (Epic)"),
    # 12. Explore gallery
    ("12_explore.png", 2000, "navigate_explore", "Full gallery — all 7 minted agents"),
    # 13. Leaderboard
    ("13_leaderboard.png", 2000, "navigate_leaderboard", "Leaderboard — top agents ranked by level + votes"),
]

def run():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 800},
            device_scale_factor=2,  # higher quality
        )
        page = ctx.new_page()
        page.set_default_timeout(15000)

        # Initial load
        page.goto(PUBLIC_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)
        print("✓ Initial load OK")

        for filename, wait_ms, action, caption in SCRIPT:
            print(f"  → {filename}: {caption}")
            page.wait_for_timeout(wait_ms)

            if action == "scroll_to_agents":
                page.evaluate("window.scrollTo(0, 700)")
            elif action == "scroll_to_evolution":
                page.evaluate("window.scrollTo(0, 1400)")
            elif action == "scroll_to_mint":
                page.evaluate("window.scrollTo(0, 2200)")
            elif action == "navigate_agent_4":
                page.goto(f"{PUBLIC_URL}/agent/4", wait_until="domcontentloaded")
                page.wait_for_timeout(2500)
            elif action == "chat_pirate":
                # Find chat input, type, send
                try:
                    chat_input = page.locator("textarea").last
                    chat_input.fill("Ahoy! What's the greatest treasure you've ever found?")
                    page.wait_for_timeout(500)
                    send_btn = page.locator("button:has-text('Send'), button:has-text('Chat'), button:has-text('Ask')").first
                    send_btn.click()
                    page.wait_for_timeout(8000)  # wait for compute response
                except Exception as e:
                    print(f"    chat error: {e}")
            elif action == "navigate_agent_5":
                page.goto(f"{PUBLIC_URL}/agent/5", wait_until="domcontentloaded")
            elif action == "navigate_agent_6":
                page.goto(f"{PUBLIC_URL}/agent/6", wait_until="domcontentloaded")
            elif action == "navigate_agent_7":
                page.goto(f"{PUBLIC_URL}/agent/7", wait_until="domcontentloaded")
            elif action == "navigate_explore":
                page.goto(f"{PUBLIC_URL}/explore", wait_until="domcontentloaded")
            elif action == "navigate_leaderboard":
                page.goto(f"{PUBLIC_URL}/leaderboard", wait_until="domcontentloaded")

            page.wait_for_timeout(500)
            page.screenshot(path=f"{OUT_DIR}/{filename}", full_page=False)
            print(f"    saved {filename}")

        browser.close()
        print("\n✓ All screenshots saved to demo/")

if __name__ == "__main__":
    run()
