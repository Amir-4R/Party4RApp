// =============================================================================
// damma/components/BoneyardPanel.tsx — vertical wooden boneyard pile
// =============================================================================
// Right-side panel with a wooden frame + gold trim, a stacked-tile visual, the
// remaining count badge, and an optional "tap to draw" hint. Purely visual —
// engine logic stays in the parent.
// =============================================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { dammaPalette, withAlpha } from "@/src/games/shared/gameTheme";
import { DAMMA_TEXTURES } from "./assets";
import { GOLD, WOOD_DARK, WOOD_LIGHT, WOOD_MID } from "./theme";

export interface BoneyardPanelProps {
  count: number;
  canDraw: boolean;             // tile is drawable right now (your turn + must draw)
  onDraw: () => void;
  pal: ReturnType<typeof dammaPalette>;
  label?: string;               // header text — defaults to "Boneyard"
  hint?: string;                // sub-hint when canDraw is true
  emptyLabel?: string;          // shown when count is 0
  testID?: string;
}

export default function BoneyardPanel({
  count, canDraw, onDraw, pal,
  label = "Boneyard", hint = "Tap to draw", emptyLabel = "Empty",
  testID = "damma-boneyard",
}: BoneyardPanelProps) {
  return (
    <LinearGradient
      colors={[WOOD_LIGHT, WOOD_MID, WOOD_DARK]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.boneyardWoodFrame}
    >
      {/* Photorealistic walnut overlay over the wood gradient. */}
      <ImageBackground
        source={DAMMA_TEXTURES.wood}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        imageStyle={{ opacity: 0.7, borderRadius: 18 }}
      />
      <View pointerEvents="none" style={styles.boneyardGoldTrim} />
      <View style={styles.boneyard}>
        <Text style={styles.boneyardLabel}>{label}</Text>
        <TouchableOpacity
          testID={testID}
          disabled={!canDraw}
          onPress={onDraw}
          activeOpacity={0.85}
          style={[
            styles.boneyardPile,
            {
              borderColor: canDraw ? FUTURISTIC.brand : withAlpha(pal.railLight, 0.35),
              shadowColor: canDraw ? FUTURISTIC.brand : "transparent",
            },
          ]}
        >
          {count > 0 ? (
            <>
              {/* Stacked tile backs using the photorealistic tile_back asset. */}
              {count > 2 && (
                <Image
                  source={DAMMA_TEXTURES.tileBack}
                  style={[styles.boneyardCardImg, { transform: [{ translateX: -4 }, { translateY: -4 }] }]}
                  resizeMode="cover"
                />
              )}
              {count > 1 && (
                <Image
                  source={DAMMA_TEXTURES.tileBack}
                  style={[styles.boneyardCardImg, { transform: [{ translateX: -2 }, { translateY: -2 }] }]}
                  resizeMode="cover"
                />
              )}
              <Image
                source={DAMMA_TEXTURES.tileBack}
                style={styles.boneyardCardImg}
                resizeMode="cover"
              />
            </>
          ) : (
            <View style={[styles.boneyardCard, {
              backgroundColor: "transparent", borderColor: withAlpha(pal.railLight, 0.25),
              borderWidth: 1, borderStyle: "dashed",
            }]}>
              <Text style={{ color: withAlpha("#FFFFFF", 0.4), fontSize: 10 }}>{emptyLabel}</Text>
            </View>
          )}
          <View style={styles.boneyardBadge}>
            <Text style={styles.boneyardCount}>{count}</Text>
          </View>
        </TouchableOpacity>
        {canDraw && <Text style={styles.boneyardHint}>{hint}</Text>}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  boneyardWoodFrame: {
    width: 56,
    borderRadius: 14,
    padding: 4,
    shadowColor: "#000", shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    position: "relative",
    overflow: "hidden",
  },
  boneyardGoldTrim: {
    ...StyleSheet.absoluteFillObject,
    margin: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(GOLD, 0.5),
  },
  boneyard: {
    flex: 1, alignItems: "center", justifyContent: "flex-start",
    paddingTop: 6, gap: 2,
  },
  boneyardLabel: {
    color: GOLD, fontSize: 8, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  boneyardPile: {
    width: 40, height: 56,
    borderRadius: 6, borderWidth: 1.5, padding: 0,
    alignItems: "center", justifyContent: "center",
    shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    position: "relative",
    marginTop: 6,
  },
  boneyardCard: {
    position: "absolute",
    width: 34, height: 50,
    borderRadius: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  boneyardCardImg: {
    position: "absolute",
    width: 34, height: 50,
    borderRadius: 5,
  },
  boneyardBadge: {
    position: "absolute", top: -7, right: -7,
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: GOLD,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: WOOD_DARK,
  },
  boneyardCount: { color: "#1A0E06", fontSize: 10, fontWeight: "900" },
  boneyardHint: { color: GOLD, fontSize: 8, fontWeight: "700", textAlign: "center", marginTop: 2 },
});
