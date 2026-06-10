"""
One-shot asset generator for the premium Damma (Dominoes) UI.

Generates 6 luxury PNG textures using Gemini Nano Banana
(gemini-3.1-flash-image-preview) and writes them to
/app/frontend/assets/damma/ so the Expo app can consume them as
<ImageBackground> textures.

Usage (run from /app):
    cd /app && python -m backend.scripts.generate_damma_assets

Idempotent: re-runs will overwrite existing files. Each asset is named
with a stable filename so the React code can reference them by import.
"""

import asyncio
import base64
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Always load the .env from the backend folder so EMERGENT_LLM_KEY is available
HERE = Path(__file__).resolve().parent
BACKEND_DIR = HERE.parent
load_dotenv(BACKEND_DIR / ".env")

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

OUTPUT_DIR = Path("/app/frontend/assets/damma")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Each prompt is engineered to produce a high-quality seamless asset that
# we can tile or stretch over the existing premium UI gradients.
ASSETS: list[tuple[str, str]] = [
    (
        "felt_green.png",
        (
            "A seamless, tileable, high-resolution texture of dark green casino billiard table felt "
            "fabric. Show very fine fabric weave detail with subtle natural variation. Color: deep "
            "emerald to forest green (#0E5A2D to #063318) with subtle warm highlights. Soft, even "
            "studio lighting from above. Photorealistic. No logos, no shadows of objects, no border, "
            "completely flat top-down view. The texture must tile without visible seams. 1024x1024."
        ),
    ),
    (
        "wood_walnut.png",
        (
            "A seamless, tileable, high-resolution texture of polished dark walnut wood with a "
            "luxury finish — like a premium board-game table edge. Deep mahogany to walnut tones "
            "(#1F0E05 to #6E4520). Subtle, realistic wood grain running horizontally, soft "
            "natural sheen, no knots, no nails, no scratches. Even studio lighting, perfectly "
            "flat top-down view. Must tile seamlessly. 1024x1024."
        ),
    ),
    (
        "gold_ornament.png",
        (
            "An elegant, symmetrical art-deco gold decorative ornament / filigree divider on a "
            "fully TRANSPARENT background (PNG with alpha channel). Polished metallic gold "
            "(#D4AF37 with #B8860B accents and subtle highlights). Thin, refined lines, no text, "
            "no people, no animals, no other colors. Looks like a thin gold border element "
            "suitable for a luxury game title. Vertically centered, very thin, ornate filigree. "
            "1024x256 aspect."
        ),
    ),
    (
        "tile_back.png",
        (
            "A single rectangular domino tile back — like a luxury playing card back — viewed "
            "straight from the front. Premium ivory cream base (#F5F1E6) with a thin gold "
            "(#D4AF37) double border, a subtle dark green emerald centerpiece pattern with very "
            "fine geometric tracery. Soft realistic shadow underneath. Centered on a fully "
            "TRANSPARENT background. The tile occupies most of the canvas. 768x1024."
        ),
    ),
    (
        "tile_face_blank.png",
        (
            "A single blank rectangular domino tile viewed from straight above, photorealistic. "
            "Premium ivory cream surface (#F5F1E6 to #FFFCEC) with a subtle soft bevel along all "
            "edges, a thin black hairline divider down the middle, slight natural variation in "
            "the ivory, no pips/dots, no numbers, no text. Realistic soft shadow under the tile. "
            "Fully TRANSPARENT background. The tile occupies ~85% of the canvas. 1024x512."
        ),
    ),
    (
        "btn_gold_sheen.png",
        (
            "A horizontal seamless gold metallic sheen texture for a premium game button. "
            "Polished metallic gold gradient (#D4AF37 at center to #B8860B at edges) with a soft "
            "specular highlight running across the middle. No text, no icons, no border. Perfectly "
            "horizontal, top-down studio lighting, photorealistic, no logos. 1024x256."
        ),
    ),
]


async def generate_one(prompt: str, out_path: Path) -> bool:
    """Generate a single PNG and write it to disk. Returns True on success."""
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("[ERR] EMERGENT_LLM_KEY missing in environment")
        return False

    # IMPORTANT: a fresh LlmChat per asset is required per the playbook.
    chat = LlmChat(
        api_key=api_key,
        session_id=f"damma-asset-{out_path.stem}",
        system_message="You are a premium-game asset generator. Always produce ONLY the requested "
                       "image with the exact background described — never add captions or watermarks.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
        modalities=["image", "text"]
    )

    msg = UserMessage(text=prompt)
    try:
        text, images = await chat.send_message_multimodal_response(msg)
    except Exception as exc:  # network / model failure
        print(f"[ERR] {out_path.name}: {exc}")
        return False

    if not images:
        snippet = (text[:120] if text else "<no text>")
        print(f"[ERR] {out_path.name}: model returned no image. Text: {snippet!r}")
        return False

    image_bytes = base64.b64decode(images[0]["data"])
    out_path.write_bytes(image_bytes)
    print(f"[OK ] {out_path.name}: {len(image_bytes) // 1024} KB")
    return True


async def main() -> int:
    print(f"Writing assets to {OUTPUT_DIR}")
    success_count = 0
    for filename, prompt in ASSETS:
        ok = await generate_one(prompt, OUTPUT_DIR / filename)
        if ok:
            success_count += 1
    print(f"\nDone — {success_count}/{len(ASSETS)} assets generated.")
    return 0 if success_count == len(ASSETS) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
