// =============================================================================
// damma/components/assets.ts — central registry for the 6 luxury textures
// =============================================================================
// These PNGs were generated once via Gemini Nano Banana (see
// /app/backend/scripts/generate_damma_assets.py) and live inside the bundled
// Expo assets/ directory. Centralising the imports keeps Metro happy and lets
// us swap a texture in a single place if the design ever changes.
// =============================================================================

export const DAMMA_TEXTURES = {
  /** Seamless dark green velvet/felt texture for the table surface. */
  felt:       require("../../../../assets/damma/felt_green.png"),
  /** Seamless dark walnut wood grain for the table frame, boneyard panel & hand tray. */
  wood:       require("../../../../assets/damma/wood_walnut.png"),
  /** Transparent gold filigree ornament used around the title. */
  ornament:   require("../../../../assets/damma/gold_ornament.png"),
  /** Premium ivory-and-gold "tile back" used in the boneyard pile. */
  tileBack:   require("../../../../assets/damma/tile_back.png"),
  /** Photorealistic blank ivory domino tile (face). */
  tileFace:   require("../../../../assets/damma/tile_face_blank.png"),
  /** Gold metallic sheen used as a button background. */
  buttonGold: require("../../../../assets/damma/btn_gold_sheen.png"),
} as const;

export type DammaTextureKey = keyof typeof DAMMA_TEXTURES;
