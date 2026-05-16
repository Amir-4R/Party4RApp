import { useEffect, useRef, useState, useCallback } from "react";
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
  useWindowDimensions,
  StatusBar as RNStatusBar,
} from "react-native";
import { TOKEN_KEY, getWsUrl } from "@/src/api/client";
import { COLORS, getAvatarUrl } from "@/src/constants/avatars";
import { useAuth } from "@/src/context/AuthContext";

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

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function buildEmbedHtml(videoId: string | null): string {
  if (!videoId) {
    return `<!DOCTYPE html><html><body style="background:#0B0B0F;color:#6C7A89;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px;"><div><div style="font-size:48px;margin-bottom:12px;">📺</div><div style="font-weight:700;color:#fff;">No video loaded</div><div style="margin-top:8px;font-size:14px;">Host needs to paste a YouTube link</div></div></body></html>`;
  }
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>html,body{margin:0;padding:0;background:#000;width:100%;height:100%;overflow:hidden}iframe{width:100%;height:100%;border:0}</style>
  </head>
  <body>
    <div id="player"></div>
    <script>
      var tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      var player;
      var suppressEvent = false;
      function onYouTubeIframeAPIReady() {
        player = new YT.Player('player', {
          videoId: '${videoId}',
          playerVars: { playsinline: 1, controls: 1, rel: 0, modestbranding: 1 },
          events: {
            'onReady': function(e){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'})); },
            'onStateChange': function(e){
              if (suppressEvent) return;
              var t = player.getCurrentTime();
              if (e.data === YT.PlayerState.PLAYING) {
                window.ReactNativeWebView.postMessage(JSON.stringify({type:'state', event:'play', time:t}));
              } else if (e.data === YT.PlayerState.PAUSED) {
                window.ReactNativeWebView.postMessage(JSON.stringify({type:'state', event:'pause', time:t}));
              }
            }
          }
        });
      }
      document.addEventListener('message', handleMessage);
      window.addEventListener('message', handleMessage);
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
    </script>
  </body>
</html>`;
}

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const wsRef = useRef<WebSocket | null>(null);
  const webRef = useRef<WebView>(null);
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [forceFullscreen, setForceFullscreen] = useState(false);
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [newVideo, setNewVideo] = useState("");

  const videoId = extractYouTubeId(videoUrl || "");
  const fullscreen = isLandscape || forceFullscreen;

  // Unlock orientation while in room
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // Connect WebSocket
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

  const handleServerEvent = useCallback((data: any) => {
    switch (data.type) {
      case "init":
        setIsHost(data.is_host);
        setHostId(data.host_id);
        setVideoUrl(data.video_url || null);
        setMembers(data.members || []);
        if (!data.is_host) {
          setTimeout(() => {
            wsRef.current?.send(JSON.stringify({ type: "state_request" }));
          }, 1500);
        }
        break;
      case "host_changed":
        setHostId(data.host_id);
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
            text: data.text,
            image: data.image,
            timestamp: data.timestamp,
          },
        ]);
        break;
      case "playback":
        if (data.event === "change_video" && data.video_url) {
          setVideoUrl(data.video_url);
        } else {
          // Forward to WebView
          webRef.current?.injectJavaScript(
            `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(
              JSON.stringify({ event: data.event, time: data.time, playing: data.playing })
            )} }));true;`
          );
        }
        break;
      case "state_request":
        if (isHost) {
          // Reply with current state
          webRef.current?.injectJavaScript(
            `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(
              JSON.stringify({ event: "get_state", to: data.from })
            )} }));true;`
          );
        }
        break;
    }
  }, [isHost, user?.id]);

  const onWebViewMessage = (e: any) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === "state" && isHost) {
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
    wsRef.current?.send(
      JSON.stringify({ type: "playback", event: "change_video", video_url: url })
    );
    setVideoUrl(url);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const pushWebToRoom = () => {
    const u = webDraftUrl.trim();
    if (!u) return;
    const final = u.startsWith("http") ? u : `https://${u}`;
    changeVideo(final);
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
          { text: "Open Settings", onPress: () => import("react-native").then((m) => m.Linking.openSettings()) },
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

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await apiGet<{ items: any[] }>(`/youtube/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.items || []);
    } catch (e: any) {
      Alert.alert("Search failed", e.message || "Try again");
    } finally {
      setSearching(false);
    }
  };

  const transferHost = (targetId: string) => {
    if (!isHost || targetId === user?.id) return;
    const target = members.find((m) => m.id === targetId);
    if (!target) return;
    Alert.alert(
      "Transfer Leadership",
      `Make ${target.nickname} the host?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          onPress: () =>
            wsRef.current?.send(JSON.stringify({ type: "transfer_host", to: targetId })),
        },
      ]
    );
  };

  const leaveRoom = () => {
    try {
      wsRef.current?.close();
    } catch {}
    router.replace("/(tabs)/home");
  };

  // Render
  return (
    <View style={[styles.root, fullscreen && styles.rootFs]}>
      {fullscreen && <RNStatusBar hidden />}
      <SafeAreaView
        style={{ flex: 1, backgroundColor: COLORS.bg }}
        edges={fullscreen ? [] : ["top"]}
      >
        {/* Header (hidden in fullscreen) */}
        {!fullscreen && (
          <View style={styles.header}>
            <TouchableOpacity testID="room-leave" onPress={leaveRoom} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {isHost ? "HOSTING" : "WATCHING"}
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: connected ? COLORS.success : COLORS.error },
                  ]}
                />
                <Text style={styles.statusText}>
                  {connected ? `${members.length} live` : "connecting..."}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              testID="room-fullscreen"
              onPress={() => setForceFullscreen(true)}
              style={styles.iconBtn}
            >
              <Ionicons name="expand" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Video area */}
        <View
          style={[
            styles.videoContainer,
            fullscreen ? styles.videoFs : styles.videoPortrait,
          ]}
        >
          {videoId ? (
            <WebView
              ref={webRef}
              originWhitelist={["*"]}
              source={{ html: buildEmbedHtml(videoId) }}
              style={{ flex: 1, backgroundColor: "#000" }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              onMessage={onWebViewMessage}
              testID="room-webview"
            />
          ) : (
            <View style={styles.noVideo}>
              <Ionicons name="play-circle-outline" size={56} color={COLORS.textDisabled} />
              <Text style={styles.noVideoText}>No video yet</Text>
              {isHost && (
                <Text style={styles.noVideoSub}>Tap "Set Video" below to start</Text>
              )}
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

        {/* Chat & controls (hidden in fullscreen) */}
        {!fullscreen && (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
            style={styles.chatPanel}
          >
            {isHost && (
              <View style={styles.hostBar}>
                <TouchableOpacity
                  testID="open-yt-search"
                  onPress={() => setShowSearch(true)}
                  style={styles.setVideoBtn}
                >
                  <Ionicons name="logo-youtube" size={18} color={COLORS.brand} />
                  <Text style={styles.setVideoText}>
                    {videoUrl ? "Change Video" : "Search YouTube"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <FlatList
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => {
                const mine = item.user_id === user?.id;
                return (
                  <View
                    style={[
                      styles.msgRow,
                      { flexDirection: mine ? "row-reverse" : "row" },
                    ]}
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
                              mine ? { color: COLORS.bg } : { color: COLORS.textPrimary },
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
                  <Text style={styles.chatEmptyText}>Say hi to the room 👋</Text>
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
                placeholder="Send a message..."
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

        {/* Members strip — tap to transfer if I am host */}
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
                  <Image source={{ uri: getAvatarUrl(m.avatar) }} style={styles.memberAv} />
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

        {/* YouTube Search Modal */}
        <Modal
          visible={showSearch}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowSearch(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
            {/* Hub Tabs */}
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
                        <Image source={{ uri: item.thumbnail }} style={styles.ytThumb} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.ytTitle} numberOfLines={2}>
                            {item.title}
                          </Text>
                          <Text style={styles.ytChan} numberOfLines={1}>
                            {item.channel}
                          </Text>
                          {styles && styles.addBadge ? (
                            <View style={styles.addBadge}>
                              <Ionicons name="add-circle" size={12} color={COLORS.brand} />
                              {styles.addBadgeText ? (
                                <Text style={styles.addBadgeText}>ADD TO ROOM</Text>
                              ) : null}
                            </View>
                          ) : null}
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
                    onSubmitEditing={() => setWebUrl(webDraftUrl.startsWith("http") ? webDraftUrl : `https://${webDraftUrl}`)}
                    placeholder="https://..."
                    placeholderTextColor={COLORS.textDisabled}
                    style={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="go"
                  />
                  <TouchableOpacity
                    testID="web-go"
                    onPress={() => setWebUrl(webDraftUrl.startsWith("http") ? webDraftUrl : `https://${webDraftUrl}`)}
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  rootFs: { backgroundColor: "#000" },
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
  videoContainer: { backgroundColor: "#000", position: "relative" },
  videoPortrait: { aspectRatio: 16 / 9 },
  videoFs: { flex: 1 },
  noVideo: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  noVideoText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 12 },
  noVideoSub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 6 },
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
  chatPanel: { flex: 1, backgroundColor: COLORS.bg },
  hostBar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
  },
  setVideoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.brandDim,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: COLORS.brand,
  },
  setVideoText: { color: COLORS.brand, fontWeight: "700", fontSize: 13, letterSpacing: 0.5 },
  videoInputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  videoInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  videoBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  msgRow: { gap: 8, marginBottom: 10, alignItems: "flex-end" },
  msgAvatar: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.surfaceElevated },
  msgNick: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 4, marginLeft: 4 },
  msgBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  msgBubbleMine: {
    backgroundColor: COLORS.brand,
    borderBottomRightRadius: 4,
  },
  msgBubbleOther: {
    backgroundColor: COLORS.surfaceElevated,
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 14, lineHeight: 20 },
  chatEmpty: { alignItems: "center", padding: 40 },
  chatEmptyText: { color: COLORS.textSecondary, fontSize: 14 },
  composer: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  composerInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
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
  searchHint: { color: COLORS.textSecondary, textAlign: "center", marginTop: 40, fontSize: 14 },
  ytRow: {
    flexDirection: "row",
    gap: 12,
    padding: 8,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  ytThumb: { width: 120, height: 68, borderRadius: 8, backgroundColor: COLORS.surfaceElevated },
  ytTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "600", lineHeight: 19 },
  ytChan: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
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
  hubTabText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  addBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  addBadgeText: {
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
  addToRoomText: { color: COLORS.bg, fontWeight: "800", letterSpacing: 1.5, fontSize: 14 },
  msgImage: {
    width: 200,
    height: 200,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceElevated,
    marginBottom: 4,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
