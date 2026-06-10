"""Retry-only script for the 3 Damma assets that previously failed."""
import asyncio, base64, os, sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
from emergentintegrations.llm.chat import LlmChat, UserMessage

OUTPUT_DIR = Path("/app/frontend/assets/damma")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MISSING = [
    ("felt_green.png",
     "A seamless, tileable, high-resolution texture of dark green casino billiard table felt fabric. "
     "Very fine fabric weave detail with subtle natural variation. Color: deep emerald to forest "
     "green (#0E5A2D to #063318) with subtle warm highlights. Soft even studio lighting from above. "
     "Photorealistic. No logos, no shadows, no border, completely flat top-down view. Must tile "
     "without visible seams. 1024x1024."),
    ("gold_ornament.png",
     "An elegant, symmetrical art-deco gold decorative ornament / filigree divider on a fully "
     "TRANSPARENT background (PNG with alpha channel). Polished metallic gold (#D4AF37 with "
     "#B8860B accents and subtle highlights). Thin refined lines, no text, no people, no animals, "
     "no other colors. Looks like a thin gold border element suitable for a luxury game title. "
     "Vertically centered, very thin, ornate filigree. 1024x256 aspect."),
    ("tile_face_blank.png",
     "A single blank rectangular domino tile viewed from straight above, photorealistic. Premium "
     "ivory cream surface (#F5F1E6 to #FFFCEC) with a subtle soft bevel along all edges, a thin "
     "black hairline divider down the middle, slight natural variation in the ivory, no pips/dots, "
     "no numbers, no text. Realistic soft shadow under the tile. Fully TRANSPARENT background. "
     "The tile occupies ~85% of the canvas. 1024x512."),
]

async def gen(name: str, prompt: str) -> bool:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    chat = LlmChat(
        api_key=api_key, session_id=f"damma-retry-{name}",
        system_message="You are a premium-game asset generator. Produce ONLY the requested image."
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image","text"])
    try:
        _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    except Exception as e:
        print(f"[ERR] {name}: {e}")
        return False
    if not images:
        print(f"[ERR] {name}: no image returned")
        return False
    out = OUTPUT_DIR / name
    out.write_bytes(base64.b64decode(images[0]["data"]))
    print(f"[OK ] {name}: {out.stat().st_size // 1024} KB")
    return True

async def main():
    n_ok = 0
    for name, prompt in MISSING:
        # Skip if it already exists (no need to regenerate).
        if (OUTPUT_DIR / name).exists():
            print(f"[SKIP] {name} already exists")
            n_ok += 1
            continue
        ok = await gen(name, prompt)
        n_ok += int(ok)
        await asyncio.sleep(2)  # be gentle on the budget meter
    print(f"\n{n_ok}/{len(MISSING)} OK")

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
