// /app/frontend/src/components/VotingOverlay.tsx — Phase 4 voting UI
// A self-contained overlay shown over the room when a vote is active.
// The host integrates it by:
//   - listening for `vote_state` and `vote_result` WS messages
//   - rendering <VotingOverlay activeVote={...} onCast={...} onCancel={...} />

import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/constants/avatars";

export interface ActiveVote {
  id: string;
  kind: "skip" | "next";
  initiator: string;
  video_id?: string;
  video_url?: string;
  title?: string;
  yes: number;
  no: number;
  required: number;
  member_count: number;
  remaining_seconds: number;
}

interface Props {
  vote: ActiveVote;
  myUserId: string;
  myVote?: boolean | null;
  isHost: boolean;
  onCast: (yes: boolean) => void;
  onCancel: () => void;
}

export default function VotingOverlay({ vote, myUserId, myVote, isHost, onCast, onCancel }: Props) {
  const [remaining, setRemaining] = useState(vote.remaining_seconds);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setRemaining(vote.remaining_seconds);
  }, [vote.remaining_seconds, vote.id]);

  useEffect(() => {
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [vote.id, slide]);

  const canCancel = isHost || vote.initiator === myUserId;
  const progress = Math.min(1, vote.yes / vote.required);
  const isInitiator = vote.initiator === myUserId;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-160, 0] }) }],
          opacity: slide,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Ionicons
          name={vote.kind === "skip" ? "play-skip-forward" : "play-circle"}
          size={20}
          color={COLORS.brand}
        />
        <Text style={styles.title}>
          {vote.kind === "skip" ? "VOTE TO SKIP" : "VOTE — PLAY NEXT VIDEO"}
        </Text>
        <Text style={styles.timer}>{remaining}s</Text>
      </View>

      {vote.title && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {vote.title}
        </Text>
      )}

      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.statsRow}>
        <Text style={styles.stat}>
          <Text style={{ color: COLORS.brand, fontWeight: "900" }}>{vote.yes}</Text>
          {"  yes"}
        </Text>
        <Text style={styles.stat}>
          <Text style={{ color: COLORS.error, fontWeight: "900" }}>{vote.no}</Text>
          {"  no"}
        </Text>
        <Text style={styles.stat}>
          need <Text style={{ color: COLORS.textPrimary, fontWeight: "900" }}>{vote.required}</Text> / {vote.member_count}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => onCast(true)}
          disabled={myVote === true}
          style={[styles.btn, styles.btnYes, myVote === true && styles.btnCast]}
        >
          <Ionicons name="checkmark" size={18} color={COLORS.bg} />
          <Text style={styles.btnYesText}>YES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onCast(false)}
          disabled={myVote === false}
          style={[styles.btn, styles.btnNo, myVote === false && { opacity: 0.5 }]}
        >
          <Ionicons name="close" size={18} color={COLORS.error} />
          <Text style={styles.btnNoText}>NO</Text>
        </TouchableOpacity>
        {canCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
            <Ionicons name="trash-outline" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 8, left: 8, right: 8, zIndex: 100, padding: 12, gap: 8, backgroundColor: "rgba(20,20,31,0.96)", borderWidth: 1, borderColor: COLORS.brand, borderRadius: 16, shadowColor: COLORS.brand, shadowOpacity: 0.4, shadowRadius: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: COLORS.brand, fontWeight: "900", letterSpacing: 1, fontSize: 13, flex: 1 },
  timer: { color: COLORS.textPrimary, fontWeight: "900", fontSize: 13 },
  subtitle: { color: COLORS.textSecondary, fontSize: 12 },
  barBg: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, backgroundColor: COLORS.brand },
  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  stat: { color: COLORS.textSecondary, fontSize: 12 },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, gap: 6, flex: 1 },
  btnYes: { backgroundColor: COLORS.brand },
  btnYesText: { color: COLORS.bg, fontWeight: "900", letterSpacing: 1 },
  btnNo: { borderWidth: 1.5, borderColor: COLORS.error },
  btnNoText: { color: COLORS.error, fontWeight: "900", letterSpacing: 1 },
  btnCast: { opacity: 0.6 },
  cancelBtn: { width: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border, borderRadius: 10 },
});
