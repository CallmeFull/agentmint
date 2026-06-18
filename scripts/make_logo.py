"""Generate a real AgentMint logo with PIL."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 512, 512

# Create gradient background
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
px = img.load()
for y in range(H):
    for x in range(W):
        dx, dy = x - 256, y - 256
        d = (dx*dx + dy*dy) ** 0.5
        t = min(d / 360, 1)
        r = int(76 * (1-t) + 6 * t)
        g = int(29 * (1-t) + 182 * t)
        b = int(149 * (1-t) + 212 * t)
        px[x, y] = (r, g, b, 255)

# Add inner "rounded square" for badge feel
draw = ImageDraw.Draw(img)
# Outer ring
draw.rounded_rectangle([64, 64, W-64, H-64], radius=72, outline=(255, 255, 255, 200), width=6)

# Try fonts
font_paths = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/tmp/kerrigan/src/qt/res/fonts/Inter/Inter-Bold.ttf",
    "/tmp/kerrigan/src/qt/res/fonts/Orbitron/Orbitron-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
]
font = None
for fp in font_paths:
    if os.path.exists(fp):
        try:
            font = ImageFont.truetype(fp, 56)
            break
        except:
            continue

# Big "AM" monogram
big_font = None
for fp in font_paths:
    if os.path.exists(fp):
        try:
            big_font = ImageFont.truetype(fp, 180)
            break
        except:
            continue

# Draw "AM" big in center
if big_font:
    text = "AM"
    bbox = draw.textbbox((0, 0), text, font=big_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (W - tw) / 2 - bbox[0]
    y = (H - th) / 2 - bbox[1] - 30
    # Shadow
    draw.text((x+3, y+3), text, fill=(0, 0, 0, 120), font=big_font)
    # Main text
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=big_font)

# Draw "AgentMint" below
if font:
    text = "AgentMint"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (W - tw) / 2 - bbox[0]
    y = H - 130
    draw.text((x+2, y+2), text, fill=(0, 0, 0, 120), font=font)
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)

# Save
os.makedirs("/home/ubuntu/agentmint/public", exist_ok=True)
img.save("/home/ubuntu/agentmint/public/logo.png")
print("✅ logo.png saved")

# Thumbnail: 1024x576 (16:9) with wider layout
TW, TH = 1024, 576
timg = Image.new("RGBA", (TW, TH), (0, 0, 0, 0))
tpx = timg.load()
for y in range(TH):
    for x in range(TW):
        dx, dy = x - TW/2, y - TH/2
        d = (dx*dx + dy*dy) ** 0.5
        t = min(d / 500, 1)
        r = int(76 * (1-t) + 6 * t)
        g = int(29 * (1-t) + 182 * t)
        b = int(149 * (1-t) + 212 * t)
        tpx[x, y] = (r, g, b, 255)

tdraw = ImageDraw.Draw(timg)
# Title
tfont = None
for fp in font_paths:
    if os.path.exists(fp):
        try:
            tfont = ImageFont.truetype(fp, 80)
            break
        except:
            continue

if tfont:
    title = "AgentMint"
    bbox = tdraw.textbbox((0, 0), title, font=tfont)
    tw = bbox[2] - bbox[0]
    x = (TW - tw) / 2 - bbox[0]
    y = 100
    tdraw.text((x+3, y+3), title, fill=(0, 0, 0, 120), font=tfont)
    tdraw.text((x, y), title, fill=(255, 255, 255, 255), font=tfont)

if font:
    sub = "iNFT Generator on 0G"
    bbox = tdraw.textbbox((0, 0), sub, font=font)
    tw = bbox[2] - bbox[0]
    x = (TW - tw) / 2 - bbox[0]
    y = 220
    tdraw.text((x+2, y+2), sub, fill=(0, 0, 0, 100), font=font)
    tdraw.text((x, y), sub, fill=(200, 240, 255, 255), font=font)

# "AM" badge bottom right
if big_font:
    text = "AM"
    bbox = tdraw.textbbox((0, 0), text, font=big_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tdraw.rounded_rectangle([TW-220, TH-220, TW-20, TH-20], radius=40, outline=(255, 255, 255, 180), width=4)
    tdraw.text((TW-220+30, TH-220+10), text, fill=(255, 255, 255, 220), font=big_font)

timg.save("/home/ubuntu/agentmint/public/thumbnail.png")
print("✅ thumbnail.png saved")

os.system("ls -la /home/ubuntu/agentmint/public/")
