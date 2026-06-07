// =============================================================================
// src/games/chess/ChessPieceSvg.tsx — Realistic, hand-carved chess pieces
// =============================================================================
// SVG path data adapted from the public-domain "Cburnett" chess set used by
// Wikipedia / Lichess. Each piece is a single rendered SVG with:
//   • Solid silhouette fill (ivory / charcoal)
//   • Dark/light stroke outline for the carved "sculpted" look
//   • Subtle inner highlight (simulates polished marble or carved wood)
// All paths are normalised on a 45×45 viewBox.
// =============================================================================
import React from "react";
import { View } from "react-native";
import Svg, { Path, G } from "react-native-svg";
import type { PieceType } from "./engine";

export interface ChessPieceSvgProps {
  type: PieceType;
  color: "white" | "black";
  size: number;
}

const STROKE_WHITE = "#E8C547";   // soft luminous gold (easier on eyes)
const STROKE_BLACK = "#C4A1F0";   // soft lavender purple (easier on eyes)
const FILL_WHITE   = "#FFF8E0";   // bright ivory
const FILL_BLACK   = "#15151C";   // soft black (slightly lifted from pitch)
// Inner accent fills (subtle, used for highlights)
const HIGHLIGHT_WHITE = "#FFE08A"; // pale gold sheen
const HIGHLIGHT_BLACK = "#3A1B5A"; // deep amethyst sheen

// ─── Path data (simplified Cburnett, public domain) ─────────────────────────
const PATHS: Record<PieceType, string[]> = {
  // King
  k: [
    "M 22.5,11.63 L 22.5,6 M 20,8 L 25,8",
    "M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25",
    "M 11.5,37 C 17,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 19,16 9.5,13 6.5,19.5 C 3.5,25.5 11.5,30 11.5,30 L 11.5,37 Z",
  ],
  // Queen — coronet + chalice body
  q: [
    "M 9,26 C 17.5,24.5 27.5,24.5 36,26 L 38,14 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,9.5 L 19.5,24.5 L 14.3,10.9 L 14,25 L 7,14 L 9,26 Z",
    "M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 10.7,36 10.7,36 C 9,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 36,37.5 34.3,36 C 34.3,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 Z",
    "M 11.5,30 C 15,29 30,29 33.5,30",
    "M 12,33.5 C 18,32.5 27,32.5 33,33.5",
  ],
  // Rook — castle silhouette
  r: [
    "M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 Z",
    "M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 Z",
    "M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14",
    "M 34,14 L 31,17 L 14,17 L 11,14",
    "M 31,17 L 31,29.5 L 14,29.5 L 14,17",
    "M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5",
  ],
  // Bishop — mitre + body
  b: [
    "M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 Z",
    "M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 Z",
    "M 25,8 A 2.5,2.5 0 1 1 20,8 A 2.5,2.5 0 1 1 25,8 Z",
  ],
  // Knight — horse head
  n: [
    "M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18",
    "M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,5.5 16.5,4.5 16.5,4.5 L 17.5,6.5 L 18.5,4.5 C 18.5,4.5 22.85,4.926 25,9 C 28,14 24,18 24,18 Z",
    "M 9.5,25.5 A 0.5,0.5 0 1 1 8.5,25.5 A 0.5,0.5 0 1 1 9.5,25.5 Z",
    "M 14.933,15.75 A 0.5,1.5 30 1 1 14.067,15.25 A 0.5,1.5 30 1 1 14.933,15.75 Z",
  ],
  // Pawn — simple drum
  p: [
    "M 22.5,9 C 20.39,9 18.68,10.71 18.68,12.82 C 18.68,13.69 18.97,14.5 19.47,15.14 C 17.46,16.25 16.09,18.38 16.09,20.8 C 16.09,22.83 17.06,24.65 18.58,25.81 C 14.92,27.07 12,30.18 12,33.69 C 12,36.31 14.66,38.5 18,38.5 L 27,38.5 C 30.34,38.5 33,36.31 33,33.69 C 33,30.18 30.08,27.07 26.42,25.81 C 27.94,24.65 28.91,22.83 28.91,20.8 C 28.91,18.38 27.54,16.25 25.53,15.14 C 26.03,14.5 26.32,13.69 26.32,12.82 C 26.32,10.71 24.61,9 22.5,9 Z",
  ],
};

export default function ChessPieceSvg({ type, color, size }: ChessPieceSvgProps) {
  const fill = color === "white" ? FILL_WHITE : FILL_BLACK;
  const stroke = color === "white" ? STROKE_WHITE : STROKE_BLACK;
  const paths = PATHS[type];
  // Drop-shadow color matches team accent (soft gold / soft purple)
  const shadowColor = color === "white" ? "rgba(232,197,71,0.45)" : "rgba(196,161,240,0.45)";
  return (
    <View style={{
      width: size, height: size,
      alignItems: "center", justifyContent: "center",
      shadowColor, shadowOpacity: 1, shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    }}>
      <Svg width={size} height={size} viewBox="0 0 45 45">
        {paths.map((d, i) => (
          <Path
            key={i}
            d={d}
            fill={fill}
            stroke={stroke}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fillRule="evenodd"
          />
        ))}
      </Svg>
    </View>
  );
}
