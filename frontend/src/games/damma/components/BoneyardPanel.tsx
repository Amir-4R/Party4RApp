// =============================================================================
// damma/components/BoneyardPanel.tsx — vertical wooden boneyard pile
// =============================================================================
// Right-side panel with a wooden frame + gold trim, a stacked-tile visual, the
// remaining count badge, and an optional "tap to draw" hint. Purely visual —
// engine logic stays in the parent.
// =============================================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { FUTURISTIC } from "@/src/theme/futuristic";
import { dammaPalette, withAlpha } from "@/src/games/shared/gameTheme";
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
              {count > 2 && (
                <LinearGradient
                  colors={[pal.railLight, pal.rail]}
                  style={[styles.boneyardCard, { transform: [{ translateX: -4 }, { translateY: -4 }] }]}
                />
              )}
              {count > 1 && (
                <LinearGradient
                  colors={[pal.railLight, pal.rail]}
                  style={[styles.boneyardCard, { transform: [{ translateX: -2 }, { translateY: -2 }] }]}
                />
              )}
              <LinearGradient
                colors={[pal.railLight, pal.rail]}
                style={styles.boneyardCard}
              >
                <Ionicons name="apps" size={20} color={withAlpha("#FFFFFF", 0.6)} />
              </LinearGradient>
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
    width: 84,
    borderRadius: 18,
    padding: 6,
    shadowColor: "#000", shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
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
    paddingTop: 12, gap: 4,
  },
  boneyardLabel: {
    color: GOLD, fontSize: 10, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 1,
  },
  boneyardPile: {
    width: 56, height: 78,
    borderRadius: 8, borderWidth: 2, padding: 0,
    alignItems: "center", justifyContent: "center",
    shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    position: "relative",
    marginTop: 10,
  },
  boneyardCard: {
    position: "absolute",
    width: 48, height: 70,
    borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  boneyardBadge: {
    position: "absolute", top: -8, right: -8,
    minWidth: 24, height: 24, borderRadius: 12,
    backgroundColor: GOLD,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 2, borderColor: WOOD_DARK,
  },
  boneyardCount: { color: "#1A0E06", fontSize: 11, fontWeight: "900" },
  boneyardHint: { color: GOLD, fontSize: 9, fontWeight: "700", textAlign: "center", marginTop: 4 },
});
