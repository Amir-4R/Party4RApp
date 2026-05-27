// =============================================================================
// /app/frontend/app/room/[id].tsx
// Party4RApp — Room screen (clean rewrite)
//
// Architecture:
//   1. Imports (top)
//   2. Helpers (extractYouTubeId, buildEmbedHtml)
//   3. RoomScreen component (all hooks, state, JSX inside)
//   4. styles (StyleSheet.create, at the very bottom, outside the component)
// =============================================================================

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Modal,
  Linking,
  useWindowDimensions,
  StatusBar as RNStatusBar,
} from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import * as ImagePicker from "expo-image-picker";
import { storage } from "@/src/utils/storage";
import { apiGet, apiPatch, TOKEN_KEY, getWsUrl } from "@/src/api/client";
import { COLORS, getAvatarUrl } from "@/src/constants/avatars";
import { useAuth } from "@/src/context/AuthContext";
import { useT } from "@/src/context/LanguageContext";
import VotingOverlay, { ActiveVote } from "@/src/components/VotingOverlay";
import { FUTURISTIC, GRADIENTS } from "@/src/theme/futuristic";
import LightBeam from "@/src/components/futuristic/LightBeam";
import GlowDivider from "@/src/components/futuristic/GlowDivider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ChatMsg {
  id: string;
  user_id: string;
  nickname: string;
  avatar: string;
  text: string;
  image?: string;
  timestamp: string;
}

interface Member {
  id: string;
  nickname: string;
  avatar: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function buildEmbedHtml(videoId: string | null): string {
  if (!videoId) {
    return `<!DOCTYPE html><html><body style="background:#0B0B0F;color:#6C7A89;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px;"><div><div style="font-size:48px;margin-bottom:12px;">📺</div><div style="font-weight:700;color:#fff;">No video loaded</div><div style="margin-top:8px;font-size:14px;">Host needs to pick a YouTube video</div></div></body></html>`;
  }
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>html,body{margin:0;padding:0;background:#000;width:100%;height:100%;overflow:hidden}iframe{width:100%;height:100%;border:0}</style>
</head><body>
<div id="player"></div>
<script>
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);
var player; var suppressEvent = false;
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    videoId: '${videoId}',
    playerVars: { playsinline: 1, controls: 1, rel: 0, modestbranding: 1, autoplay: 1, mute: 1 },
    events: {
      'onReady': function(){
        try { player.mute(); } catch(e){}
        try { player.playVideo(); } catch(e){}
        // Try to unmute once playback has actually started (mobile WebViews
        // allow muted autoplay; unmute usually succeeds once play is running).
        setTimeout(function(){ try { player.unMute(); player.setVolume(100); } catch(e){} }, 400);
        setTimeout(function(){ try { player.unMute(); player.setVolume(100); } catch(e){} }, 1200);
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
      },
      'onStateChange': function(e){
        if (suppressEvent) return;
        var t = player.getCurrentTime();
        if (e.data === YT.PlayerState.PLAYING) {
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'state', event:'play', time:t}));
        } else if (e.data === YT.PlayerState.PAUSED) {
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'state', event:'pause', time:t}));
        }
      },
      'onError': function(e){
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'yterror', code: e.data}));
      }
    }
  });
}
function handleMessage(ev){
  try {
    var data = JSON.parse(ev.data);
    if (!player || !player.seekTo) return;
    suppressEvent = true;
    if (data.event === 'play') { if (typeof data.time === 'number') player.seekTo(data.time, true); player.playVideo(); }
    else if (data.event === 'pause') { if (typeof data.time === 'number') player.seekTo(data.time, true); player.pauseVideo(); }
    else if (data.event === 'seek' || data.event === 'seek_sync') { if (typeof data.time === 'number') player.seekTo(data.time, true); if (data.playing) player.playVideo(); else player.pauseVideo(); }
    else if (data.event === 'get_state') {
      var s = { type: 'state_response', time: player.getCurrentTime(), playing: player.getPlayerState() === 1, to: data.to };
      window.ReactNativeWebView.postMessage(JSON.stringify(s));
    }
    setTimeout(function(){ suppressEvent = false; }, 300);
  } catch(e){}
}
document.addEventListener('message', handleMessage);
window.addEventListener('message', handleMessage);
</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// RoomScreen Component
// ---------------------------------------------------------------------------
export default function RoomScreen() {
  const params = useLocalSearchParams<{ id: string; addedVideo?: string; addedVideoId?: string }>();
  const { id } = params;
  const router = useRouter();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const webRef = useRef<WebView>(null);
  const pendingChangeVideoRef = useRef<string | null>(null);

  // State
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [forceFullscreen, setForceFullscreen] = useState(false);

  // Hub modal
  const [showSearch, setShowSearch] = useState(false);
  const [hubTab, setHubTab] = useState<"youtube" | "web">("youtube");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [webUrl, setWebUrl] = useState("https://www.google.com");
  const [webDraftUrl, setWebDraftUrl] = useState("https://www.google.com");

  // Player runtime state
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // In-room control center
  const [showSettings, setShowSettings] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [videoVolume, setVideoVolume] = useState(100); // 0..100
  // Phase 4 — Voting state
  const [activeVote, setActiveVote] = useState<ActiveVote | null>(null);
  const [myVote, setMyVote] = useState<boolean | null>(null);
  const [votingMode, setVotingMode] = useState<"allowed" | "owner_only">("allowed");
  const [voteToast, setVoteToast] = useState<string | null>(null);
  const consumedAddedVideoRef = useRef<string | null>(null);
  const { t } = useT();

  const videoId = extractYouTubeId(videoUrl || "");
  const fullscreen = isLandscape || forceFullscreen;

  // -------------------------------------------------------------------------
  // Orientation unlock while in room
  // -------------------------------------------------------------------------
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(
        () => {}
      );
    };
  }, []);

  // -------------------------------------------------------------------------
  // WebSocket events
  // -------------------------------------------------------------------------
  const handleServerEvent = useCallback(
    (data: any) => {
      switch (data.type) {
        case "init":
          setIsHost(!!data.is_host);
          setHostId(data.host_id || null);
          if (data.video_url) {
            setVideoUrl(data.video_url);
            setSessionId(
              `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            );
          }
          setMembers(data.members || []);
          if (!data.is_host) {
            setTimeout(() => {
              wsRef.current?.send(JSON.stringify({ type: "state_request" }));
            }, 1500);
          }
          break;
        case "host_changed":
          setHostId(data.host_id || null);
          setIsHost(data.host_id === user?.id);
          break;
        case "user_joined":
        case "user_left":
          setMembers(data.members || []);
          if (data.new_host_id) {
            setHostId(data.new_host_id);
            setIsHost(data.new_host_id === user?.id);
          }
          break;
        case "chat":
          setMessages((prev) => [
            ...prev,
            {
              id: `${data.user_id}-${data.timestamp}-${Math.random()}`,
              user_id: data.user_id,
              nickname: data.nickname,
              avatar: data.avatar,
              text: data.text || "",
              image: data.image,
              timestamp: data.timestamp,
            },
          ]);
          break;
        case "playback":
          if (data.event === "change_video" && data.video_url) {
            // Peer-side: ALWAYS init a fresh session for the new video so the
            // WebView remounts cleanly (no "Loading…" stuck on stale player).
            setVideoUrl(data.video_url);
            setSessionId(
              `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            );
          } else {
            webRef.current?.injectJavaScript(
              `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(
                JSON.stringify({
                  event: data.event,
                  time: data.time,
                  playing: data.playing,
                })
              )} }));true;`
            );
          }
          break;
        case "state_request":
          if (isHost) {
            webRef.current?.injectJavaScript(
              `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(
                JSON.stringify({ event: "get_state", to: data.from })
              )} }));true;`
            );
          }
          break;
        case "vote_state":
          if (data.vote) {
            setActiveVote(data.vote as ActiveVote);
          }
          break;
        case "vote_result":
          setActiveVote(null);
          setMyVote(null);
          if (data.cancelled) {
            setVoteToast(t("vote_cancelled") || "Vote cancelled");
          } else if (data.passed) {
            if (data.kind === "skip") {
              setVoteToast(t("vote_skipped") || "Skipped!");
            } else if (data.kind === "next") {
              setVoteToast(t("vote_next_passed") || "Playing next…");
            }
          } else {
            setVoteToast(t("vote_failed") || "Vote did not pass");
          }
          setTimeout(() => setVoteToast(null), 2500);
          break;
      }
    },
    [isHost, user?.id, t]
  );

  // -------------------------------------------------------------------------
  // Connect WebSocket
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      if (!token) {
        router.replace("/login");
        return;
      }
      const ws = new WebSocket(getWsUrl(id, token));
      wsRef.current = ws;
      ws.onopen = () => {
        if (!cancelled) setConnected(true);
        // Flush any queued change_video that fired before WS was ready
        const pending = pendingChangeVideoRef.current;
        if (pending) {
          pendingChangeVideoRef.current = null;
          try {
            ws.send(
              JSON.stringify({
                type: "playback",
                event: "change_video",
                video_url: pending,
              })
            );
          } catch {}
        }
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          handleServerEvent(data);
        } catch {}
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        if (!cancelled) setConnected(false);
      };
    })();
    return () => {
      cancelled = true;
      try {
        wsRef.current?.close();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Reset player state every time the active session changes
  useEffect(() => {
    setPlayerReady(false);
    setPlayerError(null);
  }, [sessionId]);

  // -------------------------------------------------------------------------
  // WebView -> RN bridge
  // -------------------------------------------------------------------------
  const onWebViewMessage = (e: any) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === "ready") {
        setPlayerReady(true);
        setPlayerError(null);
      } else if (data.type === "yterror") {
        setPlayerError(`YouTube error ${data.code}`);
      } else if (data.type === "state" && isHost) {
        wsRef.current?.send(
          JSON.stringify({ type: "playback", event: data.event, time: data.time })
        );
      } else if (data.type === "state_response" && isHost) {
        wsRef.current?.send(
          JSON.stringify({
            type: "state_response",
            to: data.to,
            time: data.time,
            playing: data.playing,
            video_url: videoUrl,
          })
        );
      }
    } catch {}
  };

  // Manual play trigger (for environments where autoplay is blocked)
  const tapToPlay = () => {
    webRef.current?.injectJavaScript(
      `try{player.unMute();player.setVolume(100);player.playVideo();}catch(e){}true;`
    );
  };

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const sendChat = () => {
    const text = draft.trim();
    if (!text || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "chat", text }));
    setDraft("");
  };

  const changeVideo = (videoIdOrUrl: string) => {
    const url = videoIdOrUrl.startsWith("http")
      ? videoIdOrUrl
      : `https://www.youtube.com/watch?v=${videoIdOrUrl}`;

    // 1) ALWAYS initialize/replace the local active session immediately so the
    //    host's WebView mounts the new video without waiting for the round-trip.
    //    The `sessionId` change forces a fresh player session even if URL is reused.
    setVideoUrl(url);
    setSessionId(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    // 2) Push to room via WS. If socket isn't ready yet, queue and let the
    //    onopen handler fire it once connected — no silent drops.
    const ws = wsRef.current;
    const payload = JSON.stringify({
      type: "playback",
      event: "change_video",
      video_url: url,
    });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    } else {
      pendingChangeVideoRef.current = url;
    }

    // 3) Close the hub modal & reset its state
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const pushWebToRoom = () => {
    const u = webDraftUrl.trim();
    if (!u) return;
    changeVideo(u.startsWith("http") ? u : `https://${u}`);
  };

  // -------------------------------------------------------------------------
  // Phase 4 — Voting helpers
  // -------------------------------------------------------------------------
  const startVote = useCallback(
    (kind: "skip" | "next", video_url?: string, title?: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (activeVote) {
        Alert.alert(t("vote_in_progress") || "Vote already running", "Wait for it to finish first.");
        return;
      }
      const payload: any = { type: "vote_start", kind };
      if (video_url) payload.video_url = video_url;
      if (title) payload.title = title;
      ws.send(JSON.stringify(payload));
      setMyVote(true); // initiator auto-yes
    },
    [activeVote, t]
  );

  const castVote = useCallback(
    (yes: boolean) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !activeVote) return;
      ws.send(JSON.stringify({ type: "vote_cast", yes }));
      setMyVote(yes);
    },
    [activeVote]
  );

  const cancelVote = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "vote_cancel" }));
  }, []);

  // -------------------------------------------------------------------------
  // Phase 4 — Consume `addedVideo` returned from /youtube-browser
  // Host => apply immediately. Non-host => start a "vote-next" vote.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const av = params.addedVideo;
    if (!av) return;
    if (consumedAddedVideoRef.current === av) return;
    consumedAddedVideoRef.current = av;
    if (isHost) {
      changeVideo(av);
    } else {
      startVote("next", av);
    }
    // Clear the params so we don't re-trigger on focus
    try {
      router.setParams({ addedVideo: undefined, addedVideoId: undefined } as any);
    } catch {}
  }, [params.addedVideo, isHost, startVote, router]);

  // -------------------------------------------------------------------------
  // Phase 4 — Fetch current room voting_mode (host needs it to toggle settings)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!id) return;
    apiGet<any>(`/rooms/${id}`).then((r) => {
      if (r && r.voting_mode) setVotingMode(r.voting_mode);
    }).catch(() => {});
  }, [id]);

  const toggleVotingMode = async () => {
    if (!isHost) return;
    const next = votingMode === "allowed" ? "owner_only" : "allowed";
    try {
      await apiPatch(`/rooms/${id}/settings`, { voting_mode: next });
      setVotingMode(next);
    } catch (e: any) {
      Alert.alert("Failed", e.message || "Could not update setting");
    }
  };

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await apiGet<{ items: any[] }>(
        `/youtube/search?q=${encodeURIComponent(q)}`
      );
      setSearchResults(res.items || []);
    } catch (e: any) {
      Alert.alert("Search failed", e.message || "Try again");
    } finally {
      setSearching(false);
    }
  };

  const sendImage = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let granted = perm.granted;
    if (!granted && perm.canAskAgain) {
      const ask = await ImagePicker.requestMediaLibraryPermissionsAsync();
      granted = ask.granted;
    }
    if (!granted) {
      Alert.alert(
        "Gallery access needed",
        "Share photos in chat by allowing access in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5,
      allowsEditing: false,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const a = res.assets[0];
    const dataUri = `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`;
    if (dataUri.length > 700_000) {
      Alert.alert("Image too large", "Pick an image under ~500KB.");
      return;
    }
    wsRef.current?.send(JSON.stringify({ type: "chat", text: "", image: dataUri }));
  };

  const transferHost = (targetId: string) => {
    if (!isHost || targetId === user?.id) return;
    const target = members.find((m) => m.id === targetId);
    if (!target) return;
    Alert.alert("Transfer Leadership", `Make ${target.nickname} the host?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Transfer",
        onPress: () =>
          wsRef.current?.send(JSON.stringify({ type: "transfer_host", to: targetId })),
      },
    ]);
  };

  const leaveRoom = () => {
    Alert.alert(
      t("leave_confirm_title"),
      t("leave_confirm_msg"),
      [
        { text: t("stay"), style: "cancel" },
        {
          text: t("leave"),
          style: "destructive",
          onPress: () => {
            try {
              wsRef.current?.close();
            } catch {}
            router.replace("/(tabs)/home");
          },
        },
      ]
    );
  };

  // Apply video volume to YouTube IFrame whenever it changes
  useEffect(() => {
    if (playerReady) {
      webRef.current?.injectJavaScript(
        `try{player.setVolume(${videoVolume});if(${videoVolume}>0)player.unMute();else player.mute();}catch(e){}true;`
      );
    }
  }, [videoVolume, playerReady]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <View style={[styles.container, fullscreen && styles.containerFs]}>
      {fullscreen && <RNStatusBar hidden />}
      <SafeAreaView
        style={{ flex: 1, backgroundColor: COLORS.bg }}
        edges={fullscreen ? [] : ["top"]}
      >
        {/* Phase 6 — ambient cyber-metallic lighting (subtle, only when not fullscreen) */}
        {!fullscreen && (
          <>
            <LightBeam
              angle={-22}
              color="rgba(34,255,136,0.10)"
              speed={11000}
              delay={0}
              thickness={180}
              intensity={0.45}
            />
            <LightBeam
              angle={20}
              color="rgba(168,85,247,0.10)"
              speed={13000}
              delay={2500}
              thickness={160}
              intensity={0.40}
            />
          </>
        )}
        {/* Phase 4 — Active vote overlay (floats over everything) */}
        {activeVote && user?.id && (
          <VotingOverlay
            vote={activeVote}
            myUserId={user.id}
            myVote={myVote}
            isHost={isHost}
            onCast={castVote}
            onCancel={cancelVote}
          />
        )}
        {/* Header */}
        {!fullscreen && (
          <View style={styles.header}>
            <TouchableOpacity testID="room-leave" onPress={leaveRoom} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{isHost ? t("hosting") : t("watching")}</Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: connected ? COLORS.success : COLORS.error },
                  ]}
                />
                <Text style={styles.statusText}>
                  {connected ? `${members.length} ${t("live")}` : t("connecting")}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              testID="room-friends-open"
              onPress={() => setShowFriends(true)}
              style={styles.iconBtn}
            >
              <Ionicons name="people" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="room-settings-open"
              onPress={() => setShowSettings(true)}
              style={styles.iconBtn}
            >
              <Ionicons
                name={videoVolume === 0 ? "volume-mute" : "settings-sharp"}
                size={22}
                color={videoVolume === 0 ? COLORS.error : COLORS.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              testID="room-fullscreen"
              onPress={() => setForceFullscreen(true)}
              style={styles.iconBtn}
            >
              <Ionicons name="expand" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Video */}
        <View style={[styles.videoBox, fullscreen ? styles.videoFs : styles.videoPortrait]}>
          {videoId ? (
            <View style={{ flex: 1, position: "relative" }}>
              <WebView
                key={`${sessionId || videoId}`}
                ref={webRef}
                originWhitelist={["*"]}
                source={{ html: buildEmbedHtml(videoId) }}
                style={{ flex: 1, backgroundColor: "#000" }}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
                onMessage={onWebViewMessage}
                testID="room-webview"
              />
              {(!playerReady || playerError) && (
                <TouchableOpacity
                  testID="tap-to-play"
                  activeOpacity={0.85}
                  onPress={tapToPlay}
                  style={styles.playOverlay}
                >
                  {playerError ? (
                    <>
                      <Ionicons name="alert-circle" size={56} color={COLORS.error} />
                      <Text style={styles.overlayTitle}>Playback issue</Text>
                      <Text style={styles.overlaySub}>{playerError}</Text>
                      <Text style={[styles.overlaySub, { marginTop: 12 }]}>
                        Tap to retry
                      </Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.playCircle}>
                        <Ionicons name="play" size={36} color={COLORS.bg} />
                      </View>
                      <Text style={styles.overlayTitle}>{t("tap_to_play")}</Text>
                      <Text style={styles.overlaySub}>
                        {isHost ? t("tap_starts_session") : t("tap_join_sync")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.noVideo}>
              <Ionicons name="play-circle-outline" size={56} color={COLORS.textDisabled} />
              <Text style={styles.noVideoText}>{t("no_video")}</Text>
              {isHost ? (
                <Text style={styles.bText}>{t("open_yt_hub")}</Text>
              ) : null}
            </View>
          )}

          {fullscreen && (
            <TouchableOpacity
              testID="room-exit-fullscreen"
              onPress={() => setForceFullscreen(false)}
              style={styles.exitFsBtn}
            >
              <Ionicons name="contract" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Chat panel + composer */}
        {!fullscreen && (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.chatPanel}
          >
            {/* Action bar: visible to everyone (host vs guest buttons differ) */}
            <View style={styles.hostBar}>
              {isHost && (
                <TouchableOpacity
                  testID="open-yt-search"
                  onPress={() => setShowSearch(true)}
                  style={styles.setVideoBtn}
                >
                  <Ionicons name="logo-youtube" size={18} color={COLORS.brand} />
                  <Text style={styles.setVideoText} numberOfLines={1}>
                    {videoUrl ? t("change_video") || "Change" : t("search_youtube") || "Search YT"}
                  </Text>
                </TouchableOpacity>
              )}
              {/* Anyone (host or guest, when guests allowed) can browse YT */}
              {(isHost || votingMode === "allowed") && (
                <TouchableOpacity
                  testID="open-yt-browser"
                  onPress={() => router.push({ pathname: "/youtube-browser", params: { roomId: id } })}
                  style={styles.browseBtn}
                >
                  <Ionicons name="globe-outline" size={18} color={COLORS.accent} />
                  <Text style={styles.browseBtnText} numberOfLines={1}>
                    {isHost ? (t("browse_yt") || "Browse YT") : (t("suggest_video") || "Suggest")}
                  </Text>
                </TouchableOpacity>
              )}
              {/* Vote-skip — anyone when video is playing, no active vote */}
              {!!videoId && !activeVote && (isHost || votingMode === "allowed") && (
                <TouchableOpacity
                  testID="vote-skip"
                  onPress={() => startVote("skip")}
                  style={styles.skipBtn}
                >
                  <Ionicons name="play-skip-forward" size={18} color={COLORS.warning} />
                  <Text style={styles.skipBtnText} numberOfLines={1}>
                    {t("vote_skip") || "Vote Skip"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Animated shimmer divider under the action bar */}
            <GlowDivider
              color={activeVote ? FUTURISTIC.brand : "rgba(255,255,255,0.10)"}
              speed={activeVote ? 2800 : 6500}
              shimmerWidthPct={20}
            />

            {/* Vote toast (transient feedback after a vote resolves) */}
            {voteToast && (
              <View style={styles.voteToast}>
                <Ionicons name="megaphone-outline" size={16} color={COLORS.brand} />
                <Text style={styles.voteToastText}>{voteToast}</Text>
              </View>
            )}

            <FlatList
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => {
                const mine = item.user_id === user?.id;
                return (
                  <View
                    style={[styles.msgRow, { flexDirection: mine ? "row-reverse" : "row" }]}
                  >
                    {!mine && (
                      <Image
                        source={{ uri: getAvatarUrl(item.avatar) }}
                        style={styles.msgAvatar}
                      />
                    )}
                    <View style={{ maxWidth: "75%" }}>
                      {!mine && <Text style={styles.msgNick}>{item.nickname}</Text>}
                      {item.image ? (
                        <Image
                          source={{ uri: item.image }}
                          style={styles.msgImage}
                          resizeMode="cover"
                        />
                      ) : null}
                      {item.text ? (
                        <View
                          style={[
                            styles.msgBubble,
                            mine ? styles.msgBubbleMine : styles.msgBubbleOther,
                          ]}
                        >
                          <Text
                            style={[
                              styles.msgText,
                              mine
                                ? { color: COLORS.bg }
                                : { color: COLORS.textPrimary },
                            ]}
                          >
                            {item.text}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              }}
              contentContainerStyle={{ padding: 12, paddingBottom: 4 }}
              ListEmptyComponent={
                <View style={styles.chatEmpty}>
                  <Text style={styles.chatEmptyText}>{t("say_hi")} 👋</Text>
                </View>
              }
            />

            <View style={styles.composer}>
              <TouchableOpacity
                testID="chat-attach"
                onPress={sendImage}
                style={styles.attachBtn}
              >
                <Ionicons name="image-outline" size={20} color={COLORS.brand} />
              </TouchableOpacity>
              <TextInput
                testID="chat-input"
                value={draft}
                onChangeText={setDraft}
                placeholder={t("send_message")}
                placeholderTextColor={COLORS.textDisabled}
                style={styles.composerInput}
                onSubmitEditing={sendChat}
                returnKeyType="send"
              />
              <TouchableOpacity
                testID="chat-send"
                onPress={sendChat}
                style={styles.sendBtn}
                disabled={!draft.trim()}
              >
                <Ionicons name="send" size={18} color={COLORS.bg} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

        {!connected && !fullscreen && (
          <View style={styles.connecting}>
            <ActivityIndicator size="small" color={COLORS.brand} />
          </View>
        )}

        {/* Members strip (with crown) */}
        {!fullscreen && members.length > 0 && (
          <View style={styles.membersStrip}>
            {members.map((m) => {
              const isThisHost = m.id === hostId;
              return (
                <TouchableOpacity
                  key={m.id}
                  testID={`member-${m.id}`}
                  onPress={() => transferHost(m.id)}
                  disabled={!isHost || m.id === user?.id}
                  style={styles.memberPill}
                >
                  <Image
                    source={{ uri: getAvatarUrl(m.avatar) }}
                    style={styles.memberAv}
                  />
                  {isThisHost && (
                    <View style={styles.crown} testID={`crown-${m.id}`}>
                      <Ionicons name="trophy" size={10} color={COLORS.bg} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Hub Modal */}
        <Modal
          visible={showSearch}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowSearch(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <View style={styles.hubTabs}>
              <TouchableOpacity
                testID="hub-tab-youtube"
                onPress={() => setHubTab("youtube")}
                style={[styles.hubTab, hubTab === "youtube" && styles.hubTabActive]}
              >
                <Ionicons
                  name="logo-youtube"
                  size={16}
                  color={hubTab === "youtube" ? COLORS.brand : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.hubTabText,
                    hubTab === "youtube" && { color: COLORS.brand },
                  ]}
                >
                  YouTube
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="hub-tab-web"
                onPress={() => setHubTab("web")}
                style={[styles.hubTab, hubTab === "web" && styles.hubTabActive]}
              >
                <Ionicons
                  name="globe-outline"
                  size={16}
                  color={hubTab === "web" ? COLORS.brand : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.hubTabText,
                    hubTab === "web" && { color: COLORS.brand },
                  ]}
                >
                  Web
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="hub-close"
                onPress={() => setShowSearch(false)}
                style={[styles.hubTab, { flex: 0, paddingHorizontal: 14 }]}
              >
                <Ionicons name="close" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            {hubTab === "youtube" ? (
              <>
                <View style={styles.searchHeader}>
                  <TextInput
                    testID="yt-search-input"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={runSearch}
                    placeholder="Search YouTube privately..."
                    placeholderTextColor={COLORS.textDisabled}
                    style={styles.searchInput}
                    autoFocus
                    returnKeyType="search"
                  />
                  <TouchableOpacity
                    testID="yt-search-go"
                    onPress={runSearch}
                    style={styles.searchGo}
                  >
                    <Ionicons name="search" size={18} color={COLORS.bg} />
                  </TouchableOpacity>
                </View>
                {searching ? (
                  <ActivityIndicator color={COLORS.brand} style={{ marginTop: 24 }} />
                ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(i) => i.video_id}
                    contentContainerStyle={{ padding: 12 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        testID={`yt-result-${item.video_id}`}
                        onPress={() => changeVideo(item.video_id)}
                        style={styles.ytRow}
                      >
                        <Image
                          source={{ uri: item.thumbnail }}
                          style={styles.ytThumb}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.ytTitle} numberOfLines={2}>
                            {item.title}
                          </Text>
                          <Text style={styles.ytChan} numberOfLines={1}>
                            {item.channel}
                          </Text>
                          <View style={styles.addBadge}>
                            <Ionicons
                              name="add-circle"
                              size={12}
                              color={COLORS.brand}
                            />
                            <Text style={styles.bText}>ADD TO ROOM</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <Text style={styles.searchHint}>
                        Search privately — only what you "Add to Room" gets shared.
                      </Text>
                    }
                  />
                )}
              </>
            ) : (
              <>
                <View style={styles.searchHeader}>
                  <TextInput
                    testID="web-url-input"
                    value={webDraftUrl}
                    onChangeText={setWebDraftUrl}
                    onSubmitEditing={() =>
                      setWebUrl(
                        webDraftUrl.startsWith("http")
                          ? webDraftUrl
                          : `https://${webDraftUrl}`
                      )
                    }
                    placeholder="https://..."
                    placeholderTextColor={COLORS.textDisabled}
                    style={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="go"
                  />
                  <TouchableOpacity
                    testID="web-go"
                    onPress={() =>
                      setWebUrl(
                        webDraftUrl.startsWith("http")
                          ? webDraftUrl
                          : `https://${webDraftUrl}`
                      )
                    }
                    style={styles.searchGo}
                  >
                    <Ionicons name="arrow-forward" size={18} color={COLORS.bg} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
                  <WebView
                    testID="private-webview"
                    source={{ uri: webUrl }}
                    style={{ flex: 1 }}
                    onNavigationStateChange={(s) => setWebDraftUrl(s.url)}
                  />
                </View>
                <TouchableOpacity
                  testID="web-add-to-room"
                  onPress={pushWebToRoom}
                  style={styles.addToRoomBtn}
                >
                  <Ionicons name="rocket" size={18} color={COLORS.bg} />
                  <Text style={styles.addToRoomText}>ADD TO ROOM</Text>
                </TouchableOpacity>
              </>
            )}
          </SafeAreaView>
        </Modal>

        {/* Settings Modal — video volume + voice volume placeholder + mic info */}
        <Modal
          visible={showSettings}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowSettings(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{t("settings")}</Text>
              <TouchableOpacity testID="settings-close" onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 24 }}>
              {/* Video volume stepper */}
              <View>
                <View style={styles.sliderHead}>
                  <Ionicons name="videocam" size={18} color={COLORS.brand} />
                  <Text style={styles.sliderLabel}>{t("video_volume")}</Text>
                  <Text style={styles.sliderVal}>{videoVolume}%</Text>
                </View>
                <View style={styles.stepper}>
                  {[0, 20, 40, 60, 80, 100].map((v) => (
                    <TouchableOpacity
                      key={v}
                      testID={`vol-video-${v}`}
                      onPress={() => setVideoVolume(v)}
                      style={[
                        styles.stepBtn,
                        videoVolume >= v && v > 0 && { backgroundColor: COLORS.brand },
                        v === 0 && videoVolume === 0 && { backgroundColor: COLORS.error },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepText,
                          videoVolume >= v && v > 0 && { color: COLORS.bg },
                          v === 0 && videoVolume === 0 && { color: "#fff" },
                        ]}
                      >
                        {v}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.hintLine}>
                  {videoVolume === 0
                    ? t("muted_hint") || "Muted"
                    : t("video_volume_hint") || "Controls the YouTube playback volume in this room."}
                </Text>
              </View>

              {/* Phase 4 — Voting policy (host only) */}
              {isHost && (
                <View>
                  <View style={styles.sliderHead}>
                    <Ionicons name="megaphone" size={18} color={COLORS.accent} />
                    <Text style={styles.sliderLabel}>{t("voting_policy") || "Voting Policy"}</Text>
                  </View>
                  <View style={styles.modeRow}>
                    <TouchableOpacity
                      testID="voting-mode-allowed"
                      onPress={() => votingMode !== "allowed" && toggleVotingMode()}
                      style={[
                        styles.modeBtn,
                        votingMode === "allowed" && { borderColor: COLORS.brand, backgroundColor: COLORS.brandDim },
                      ]}
                    >
                      <Ionicons name="people-outline" size={16} color={votingMode === "allowed" ? COLORS.brand : COLORS.textSecondary} />
                      <Text style={[styles.modeBtnText, votingMode === "allowed" && { color: COLORS.brand }]}>
                        {t("everyone_can_vote") || "Anyone can vote"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="voting-mode-owner_only"
                      onPress={() => votingMode !== "owner_only" && toggleVotingMode()}
                      style={[
                        styles.modeBtn,
                        votingMode === "owner_only" && { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
                      ]}
                    >
                      <Ionicons name="lock-closed-outline" size={16} color={votingMode === "owner_only" ? COLORS.accent : COLORS.textSecondary} />
                      <Text style={[styles.modeBtnText, votingMode === "owner_only" && { color: COLORS.accent }]}>
                        {t("host_only_votes") || "Host only"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.hintLine}>
                    {votingMode === "allowed"
                      ? (t("voting_allowed_hint") || "Guests can start skip/next votes (majority wins).")
                      : (t("voting_owner_only_hint") || "Only you (the host) can start votes.")}
                  </Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </Modal>

        {/* Friends shortcut Modal — quick view without exiting room */}
        <Modal
          visible={showFriends}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowFriends(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{t("friends_label")}</Text>
              <TouchableOpacity testID="room-friends-close" onPress={() => setShowFriends(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <RoomFriendsList />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

// ===========================================================================
// Reusable inline Friends list component used inside the room friends modal
// ===========================================================================
function RoomFriendsList() {
  const { t } = useT();
  const [data, setData] = useState<{ friends: any[]; incoming: any[]; outgoing: any[] }>({
    friends: [],
    incoming: [],
    outgoing: [],
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiGet<any>("/friends")
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (loading)
    return <ActivityIndicator color={COLORS.brand} style={{ marginTop: 24 }} />;
  const items = [
    ...data.incoming.map((f: any) => ({ ...f, _kind: "incoming" })),
    ...data.friends.map((f: any) => ({ ...f, _kind: "friend" })),
  ];
  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => (
        <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image
            source={{ uri: item.avatar_image || getAvatarUrl(item.avatar) }}
            style={{ width: 40, height: 40, borderRadius: 12 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: COLORS.textPrimary, fontWeight: "700" }}>
              {item.nickname}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
              {item._kind === "incoming"
                ? t("wants_friend")
                : item.online
                ? t("online")
                : t("offline")}
            </Text>
          </View>
        </View>
      )}
      ListEmptyComponent={
        <Text
          style={{
            color: COLORS.textSecondary,
            textAlign: "center",
            marginTop: 24,
          }}
        >
          {t("no_friends_show")}
        </Text>
      }
    />
  );
}

// ===========================================================================
const styles = StyleSheet.create({
  // Layout
  container: { flex: 1, backgroundColor: COLORS.bg },
  containerFs: { backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    color: COLORS.brand,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: COLORS.textSecondary, fontSize: 12 },

  // Video area
  videoBox: { backgroundColor: "#000", position: "relative" },
  videoPortrait: { aspectRatio: 16 / 9 },
  videoFs: { flex: 1 },
  noVideo: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  noVideoText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  exitFsBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Chat
  chatPanel: { flex: 1, backgroundColor: COLORS.bg },
  hostBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  setVideoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.brandDim,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.brand,
  },
  setVideoText: {
    color: COLORS.brand,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.5,
    maxWidth: 110,
  },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.accentDim,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  browseBtnText: {
    color: COLORS.accent,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.5,
    maxWidth: 110,
  },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.warning,
    backgroundColor: "rgba(255, 184, 0, 0.12)",
  },
  skipBtnText: {
    color: COLORS.warning,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.5,
    maxWidth: 110,
  },
  voteToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.brandDim,
    borderWidth: 1,
    borderColor: COLORS.brand,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  voteToastText: { color: COLORS.brand, fontWeight: "800", fontSize: 12, letterSpacing: 0.5 },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  modeBtnText: { color: COLORS.textSecondary, fontWeight: "800", fontSize: 12, letterSpacing: 0.5 },
  msgRow: { gap: 8, marginBottom: 10, alignItems: "flex-end" },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
  },
  msgNick: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginBottom: 4,
    marginLeft: 4,
  },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  msgBubbleMine: {
    backgroundColor: FUTURISTIC.brand,
    borderBottomRightRadius: 4,
    borderColor: FUTURISTIC.brandEdge,
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  msgBubbleOther: {
    backgroundColor: FUTURISTIC.surface1,
    borderBottomLeftRadius: 4,
    borderColor: FUTURISTIC.borderSoft,
  },
  msgText: { fontSize: 14, lineHeight: 20, letterSpacing: 0.15 },
  msgImage: {
    width: 200,
    height: 200,
    borderRadius: 14,
    backgroundColor: FUTURISTIC.surface1,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderSoft,
  },
  chatEmpty: { alignItems: "center", padding: 40 },
  chatEmptyText: {
    color: FUTURISTIC.textMuted,
    fontSize: 13,
    letterSpacing: 0.4,
    fontWeight: "500",
  },
  composer: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: FUTURISTIC.borderSoft,
    backgroundColor: "rgba(8, 9, 18, 0.85)",
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  composerInput: {
    flex: 1,
    backgroundColor: FUTURISTIC.surface1,
    borderWidth: 1,
    borderColor: FUTURISTIC.borderStrong,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    color: FUTURISTIC.textPrimary,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: FUTURISTIC.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: FUTURISTIC.brand,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  connecting: {
    position: "absolute",
    top: 70,
    alignSelf: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },

  // Members strip + crown
  membersStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  memberPill: { position: "relative" },
  memberAv: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
  },
  crown: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.brand,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },

  // Hub modal
  hubTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  hubTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  hubTabActive: { borderBottomColor: COLORS.brand },
  hubTabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  searchGo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  searchHint: {
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
  ytRow: {
    flexDirection: "row",
    gap: 12,
    padding: 8,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  ytThumb: {
    width: 120,
    height: 68,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
  },
  ytTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  ytChan: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,11,15,0.85)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  playCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.brand,
    shadowOpacity: 0.7,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
    marginBottom: 8,
  },
  overlayTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  overlaySub: { color: COLORS.textSecondary, fontSize: 12 },
  addBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  // bText — reusable badge / hint text style (used by ADD TO ROOM badge & noVideo hint)
  bText: {
    color: COLORS.brand,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  addToRoomBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.brand,
    paddingVertical: 16,
    margin: 12,
    borderRadius: 12,
  },
  addToRoomText: {
    color: COLORS.bg,
    fontWeight: "800",
    letterSpacing: 1.5,
    fontSize: 14,
  },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
  sliderHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sliderLabel: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700", flex: 1 },
  sliderVal: { color: COLORS.brand, fontWeight: "800", fontSize: 14 },
  stepper: { flexDirection: "row", gap: 6 },
  stepBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },
  comingSoon: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 8,
  },
  hintLine: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
});
