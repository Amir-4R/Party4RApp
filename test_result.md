#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Phase 3 (Direct Messaging + Shared Time) of the Party4RApp Mega-Update.
  Goals for THIS iteration:
  1. Wire the Direct Messaging inbox icon into the Friends tab header (chat-bubble button
     with unread-count badge, routes to /dms).
  2. Track co-watching shared-time between friends and surface it in the DM chat header
     ("3h 12m shared"). Stored per-pair, NOT per session.
  3. Privacy-gate shared time via PrivacySettings.shared_time_visibility (everyone/friends/nobody).
  4. Keep all existing DM endpoints (history, send, edit, delete, read, typing, WS) working.

backend:
  - task: "DM REST endpoints (list, history, send, edit, delete, read, typing)"
    implemented: true
    working: true
    file: "/app/backend/dms.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Phase 3 DMs were implemented in the prior session. Routes are friend-only, block-aware. Read receipts and typing relay over WS. 60-day TTL. Needs end-to-end retesting now that we wired the frontend entry point."
      - working: true
        agent: "testing"
        comment: "Full DM REST flow verified end-to-end against prod URL. POST /dms returns 201 with id/from_id/to_id/text/created_at; GET /dms returns conversations with unread=0 for sender and unread=1 for receiver; GET /dms/{friend_id} returns history with the 'hello' text; POST /dms/{id}/read returns ok:true marked=1; POST /dms/{id}/typing returns ok:true; PATCH /dms/{message_id} sets edited:true and updates text; DELETE /dms/{message_id} returns ok:true. Block path returns 403 'You blocked this user'; after unblock the friend-only guard correctly returns 403 'Only friends can DM'."
  - task: "DM WebSocket /api/ws/dms?token= for realtime fanout"
    implemented: true
    working: true
    file: "/app/backend/dms.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Per-user single connection (newer displaces older). Pushes dm_new/dm_edit/dm_delete/dm_read/dm_typing/presence events. Should verify connect, send, receive."
      - working: true
        agent: "testing"
        comment: "WS /api/ws/dms?token= verified. Both testuser1 and peer WS connections received dm_new with the full message payload when REST POST /dms was invoked. Peer disconnect produced a presence event {user_id:peer_id, online:false} on testuser1's WS within ~2s. Presence-online event also observed on connect."
  - task: "Shared-time tracking on room WS disconnect"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added RoomManager.get_peer_overlaps and pair_time upsert in the WS finally{} block. Pair key = sorted user IDs joined by ':'. Tracks overlap seconds for everyone still in the room when this user leaves."
      - working: true
        agent: "testing"
        comment: "Both users connected to /api/ws/rooms/{room_id} concurrently for ~4s; peer disconnected first. pair_time collection has exactly 1 document with pair key = sorted(testuser1_id, peer_id) joined by ':' and seconds=4 (>=2 as required), user_ids array sorted, last_room_id set."
  - task: "GET /api/users/{user_id}/shared_time endpoint with privacy gate"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Returns {seconds, hidden}. Respects target user's shared_time_visibility privacy field (everyone/friends/nobody). Self-view always sees full value."
      - working: true
        agent: "testing"
        comment: "GET /api/users/{peer_id}/shared_time as testuser1 returned {seconds:4, hidden:false} after co-watch. After peer set shared_time_visibility='nobody', the same call returned {seconds:0, hidden:true}. Restoring to 'friends' worked. GET /api/users/privacy returned all four visibility fields as expected."
  - task: "Phase 4 — Vote start/cast/cancel WS flow + voting_mode policy"
    implemented: true
    working: true
    file: "/app/backend/rooms_voting.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Pre-existing module — Phase 4 frontend was just wired. Needs end-to-end retest with the new client behavior."
      - working: false
        agent: "testing"
        comment: |
          Voting WS flow verified end-to-end against the public URL — most of it works:
          PASS  vote_start (skip) by peer broadcasts vote_state to BOTH peers with
                kind=skip, initiator=<peer_id>, yes=1, no=0, required=2, member_count=2,
                expires_at present.
          PASS  vote_cast yes by host -> vote_result {passed:true, kind:"skip"} on both
                sides (also broadcasts intermediate vote_state).
          PASS  vote_start (next) by peer with video_url+title -> vote_state broadcast,
                host vote_cast yes -> vote_result {passed:true, kind:"next", video_url}
                AND db.rooms.video_url IS updated to the new URL.
          PASS  voting_mode=owner_only: peer vote_start is silently ignored (no
                vote_state broadcast), host vote_start works normally.
          PASS  vote_cancel by host -> vote_result {passed:false, kind:"skip",
                cancelled:true} broadcast.
          FAIL  CRITICAL: After a successful "skip" vote, the host's video_url is NOT
                cleared by the backend. Review spec required clearing it. server.py
                lines 750-752 only broadcast {type:"vote_result",passed:true,kind:"skip"}
                — there is NO db.rooms.update_one({...}, {$set:{video_url:None}}) and
                no playback "change_video" broadcast.  GET /api/rooms/{id} after the
                skip vote passed still returns the original video_url
                "https://youtube.com/watch?v=dQw4w9WgXcQ".  If the frontend depends on
                the backend clearing the video, the skip flow will not actually skip
                anything.
          Note on field names: rooms_voting.VoteState.public() emits keys named
          `initiator`, `yes`, `no` (NOT `initiator_id`, `yes_votes`, `no_votes` as the
          review brief described). Frontend must consume these keys.
      - working: true
        agent: "testing"
        comment: |
          Re-verified after main agent fix (server.py lines 750-761). Skip-vote now
          correctly:
          PASS  Both peers receive {type:"playback", event:"change_video",
                video_url:null, host_id:<host>} immediately after the skip vote passes.
          PASS  Both peers also receive {type:"vote_result", passed:true, kind:"skip"}.
          PASS  GET /api/rooms/{room_id} (called while WS still connected) returns
                video_url: null (db.rooms.update_one with $set:{video_url:None} fired).
          Reproduced via /app/backend_test_reverify.py against the public URL.
          Note: rooms are deleted from db when the last WS disconnects (server.py:849
          rooms.delete_one), so any HTTP verification of room.video_url must happen
          before all clients leave.
  - task: "Phase 4 — PATCH /api/rooms/{id}/settings voting_mode + GET /api/youtube/extract"
    implemented: true
    working: true
    file: "/app/backend/rooms_voting.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Host PATCH voting_mode to allowed/owner_only. YouTube extract used by /youtube-browser for video metadata."
      - working: false
        agent: "testing"
        comment: |
          PATCH /api/rooms/{id}/settings — ALL PASS:
            PASS host PATCH {voting_mode:"owner_only"} -> 200 with
                 {id, name, voting_mode:"owner_only"}.
            PASS peer PATCH -> 403 "Only the room owner can update settings".
            PASS host PATCH back to {voting_mode:"allowed"} -> 200.

          /api/youtube/extract — CRITICAL METHOD MISMATCH:
            FAIL GET /api/youtube/extract?url=... returns 405 Method Not Allowed for
                 every URL. POST works fine.
      - working: true
        agent: "testing"
        comment: |
          Re-verified after main agent added GET handler in rooms_voting.py:197-208.
          PASS  GET /api/youtube/extract?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ
                -> 200 with {video_id:"dQw4w9WgXcQ", video_url, embed_url, thumbnail
                "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"}.
          PASS  GET /api/youtube/extract?url=https://youtu.be/dQw4w9WgXcQ -> 200, same
                video_id "dQw4w9WgXcQ".
          PASS  GET /api/youtube/extract?url=not-a-valid-url -> 400
                "No YouTube video ID found in URL".
          PASS  POST /api/youtube/extract regression — still returns 200 with same
                payload shape.
          All four assertions green via /app/backend_test_reverify.py.
  - task: "Phase 5 — Word filter in room chat (moderation.py)"
    implemented: true
    working: true
    file: "/app/backend/moderation.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Soft-censor only, room chat only. Created /app/backend/moderation.py
          with global hardcoded BANNED_WORDS set (EN profanity + Arabic
          transliterations + spam terms like 'porn', 'xxx', 'nudes').
          Length-preserving regex replacement (e.g. 'fuck' becomes '****').
          Leet substitutions handled (f@ck, sh!t, n1gger).
          Repeated-char collapse handled (fuuuuck -> fuuck -> matched fuck).
          Hooked into the chat WS handler in server.py: text passes through
          censor_text() before broadcast; payload gets bot_flag=true when
          modified (front-end may surface this later but it's optional).
          DMs are intentionally NOT filtered (per user choice 2a).
      - working: false
        agent: "testing"
        comment: |
          Phase 5 word-filter verified against the public URL via WS chat
          (/api/ws/rooms/{room_id}). 4 of 7 brief cases PASS, 3 FAIL with
          real implementation bugs in moderation.py. Test script:
          /app/backend_test_phase5.py.

          PASS:
            • "hello world" -> "hello world", no bot_flag.
            • "fuck this shit" -> "**** this ****", bot_flag=True.
            • "you BITCH" -> "you *****" (length-preserving, case-insensitive),
              bot_flag=True.
            • "kos omak" -> "*** omak", bot_flag=True (Arabic translit).
            • Chat payload always includes user_id, nickname, avatar, timestamp.

          FAIL (3 brief cases — all are real bugs in moderation.py logic):

          1) "F@ck off" -> got "F@ck off" (UNCHANGED, bot_flag=False).
             Expected "**** off", bot_flag=True.
             ROOT CAUSE: moderation.py _LEET_MAP maps '@' -> 'a'. So
             "f@ck" normalises to "fack" (not "fuck"), which is not in
             BANNED_WORDS. The brief's expected behaviour treats '@'
             as 'u' in profanity contexts (a common leet variant).
             Suggested fix: either add a second leet pass that
             tries '@' -> 'u', or add literal "f@ck" / "fack" to the
             banned set, or expand the matching loop to try multiple
             leet substitutions per character.

          2) "fuuuuck this" -> got "fuuuuck this" (UNCHANGED, bot_flag=False).
             Expected first word censored to stars.
             ROOT CAUSE: _normalise() does
                 re.sub(r"(.)\1{2,}", r"\1\1", s)
             which collapses 3+ repeats to exactly 2 — so "fuuuuck"
             becomes "fuuck", and "fuuck" is NOT in BANNED_WORDS (only
             "fuck" is). The comment in the code claims this collapse
             then matches "fuck", but the math doesn't work.
             Suggested fix: collapse 2+ repeats to 1 (i.e.
             r"(.)\1+" -> r"\1") OR add a separate pass that also
             tries a single-char-collapse before matching.

          3) "porn xxx nudes" -> got "**** xxx*****s" (bot_flag=True but
             wrong replacement).
             Expected "**** *** *****" (all three censored, lengths
             preserved).
             ROOT CAUSE: _normalise() runs the repeated-char collapse
             BEFORE matching, which changes the string length ("xxx" -> "xx",
             a 1-char shrink). The matching code in censor_text() then
             lifts regex spans from the normalised string back onto the
             ORIGINAL string using the same indices, but those indices
             no longer line up because normalisation is NOT length-
             preserving when repeated-char collapse fires. So
             "xxx" disappears from the match list AND the "nudes" match's
             start/end are off-by-one when applied to the original,
             producing the garbled "xxx*****s".
             The docstring of censor_text() asserts "normalisation is
             length-preserving" but that assertion is broken by the
             re.sub collapse step in _normalise().
             Suggested fix: either (a) skip the repeated-char collapse in
             _normalise() and instead match a regex that allows internal
             repeats per char (e.g. compile each banned word as
             "f+u+c+k+" and use that to detect spans on the original
             string), or (b) collapse the ORIGINAL string before matching
             AND track a mapping from normalised index -> original index
             so spans can be lifted back correctly.

          Also noted (not a brief-listed failure, just informational):
          /api/auth/me does NOT include the push_token field (UserPublic
          model doesn't expose it). The brief allows either /me OR DB
          verification — DB verification was performed separately and
          confirms push_token is set after POST and unset after DELETE,
          so the persistence flow itself works. If main agent wants /me
          to expose push_token, add `push_token: Optional[str] = None`
          to UserPublic and pass it through user_to_public().
      - working: true
        agent: "testing"
        comment: |
          Re-verified after main agent rewrote moderation.py with per-letter
          LEET char-class + repeat-quantifier approach (no string
          normalisation). All 7 brief assertions PASS via
          /app/backend_test_modfilter.py against the public URL.

          Previously failing cases — now PASS:
            • "F@ck off"       -> "**** off"        bot_flag=True
            • "fuuuuck this"   -> "******* this"    bot_flag=True (7 stars)
            • "porn xxx nudes" -> "**** *** *****"  bot_flag=True

          Regression cases — still PASS:
            • "hello world"    -> "hello world"     bot_flag=False
            • "fuck this shit" -> "**** this ****"  bot_flag=True
            • "you BITCH"      -> "you *****"       bot_flag=True
            • "kos omak"       -> "*** omak"        bot_flag=True

          Chat payload still includes user_id, nickname, avatar, timestamp.
          No regressions observed.
  - task: "Phase 5 — Push notification token endpoints (notifications.py)"
    implemented: true
    working: true
    file: "/app/backend/notifications.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          New module exposing:
            POST   /api/push/token  { token }   -> validate ExponentPushToken[..]
                                                   / ExpoPushToken[..] format and
                                                   save it on the user doc.
            DELETE /api/push/token              -> $unset push_token on logout.
          Helper send_dm_push(db, sender, recipient_id, message_text) is wired
          into /app/backend/dms.py send_dm route via the new optional
          push_callback parameter on register_routes. Fires-and-forgets to
          https://exp.host/--/api/v2/push/send with title=sender.nickname,
          body=preview (max 120 chars), data={kind:'dm', from_id, from_nickname},
          channelId='dms', priority='high', badge=1. Image-only DMs get body
          '📷 Photo'. Network errors are swallowed (best-effort).
      - working: true
        agent: "testing"
        comment: |
          Push token endpoints + DM-with-push integration fully verified.
          Test script: /app/backend_test_phase5.py + a separate DB read
          to confirm persistence.

          POST /api/push/token:
            • ExponentPushToken[xxxx-yyyy-zzzz-aaaa] -> 200 {ok:true},
              db.users.{testuser1}.push_token == that token (verified via
              Motor query).
            • invalid-format-token -> 400 {detail:"Invalid Expo push token
              format"}.
            • ExpoPushToken[abc-def-ghi] -> 200 {ok:true} (both Exponent and
              Expo prefixes accepted, per _is_expo_token in notifications.py).

          DELETE /api/push/token:
            • -> 200 {ok:true}; subsequent db.users.find_one(...) shows
              push_token field is NOT present ($unset worked).

          DM send-with-push (dms.py + notifications.py):
            • Fresh peer signed up (avatar_cat), peer requested friend
              testuser1, testuser1 accepted.
            • Peer set push_token to ExponentPushToken[FAKE-FOR-TEST].
            • testuser1 POST /api/dms/{peer_id} {"text":"hi there"} -> 201
              with full message body. Backend logs show the Expo push
              endpoint actually returned 200 OK for the fake token
              (Expo accepts then fails later via receipts) — point is the
              DM endpoint did NOT raise.
            • testuser1 (no push token set on self) POST /api/dms/{peer_id}
              "no token test" with peer also having no token -> 201 (server
              correctly skips push when recipient.push_token is absent —
              notifications.py:115 early-return).
            • Image-only DM (1x1 PNG data URI) -> 201; push body would be
              '📷 Photo' per dms.py:248. Backend log confirms a second
              Expo POST fired for this case.
            • GET /api/auth/me after all the above -> 200, no regression.

          One note for the main agent: /api/auth/me does NOT expose the
          push_token field (UserPublic model has no such field). The brief
          allowed DB verification as an alternative, which passes, so this
          is not a failure. If the client UI ever needs to read its own
          push_token via /me, add `push_token: Optional[str] = None` to
          UserPublic and pass it through user_to_public() in server.py.
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          New module exposing:
            POST   /api/push/token  { token }   -> validate ExponentPushToken[..]
                                                   / ExpoPushToken[..] format and
                                                   save it on the user doc.
            DELETE /api/push/token              -> $unset push_token on logout.
          Helper send_dm_push(db, sender, recipient_id, message_text) is wired
          into /app/backend/dms.py send_dm route via the new optional
          push_callback parameter on register_routes. Fires-and-forgets to
          https://exp.host/--/api/v2/push/send with title=sender.nickname,
          body=preview (max 120 chars), data={kind:'dm', from_id, from_nickname},
          channelId='dms', priority='high', badge=1. Image-only DMs get body
          '📷 Photo'. Network errors are swallowed (best-effort).

frontend:
  - task: "Messages icon + unread badge in Friends tab header"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/friends.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Fixed missing useRouter() call (router was undefined), made header a flex row, added neon chat-bubble button (testID='open-dms') routing to /dms, and added a red unread-count badge fed from /api/dms.conversations[].unread."
  - task: "Shared-time line in DM chat header"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/dms/[friendId].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "DM chat subtitle now shows 'online/offline · Xh Ym shared' when the privacy gate allows it. Uses /api/users/{id}/shared_time. Empty/hidden values fall back to plain online/offline label."
  - task: "Phase 4 — Room voting overlay + Browse YT + Vote Skip + voting policy"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/room/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Wired Phase 4 into the room screen: imported VotingOverlay component, added vote_state/vote_result WS handlers, helper funcs startVote/castVote/cancelVote, host bar now has Browse YT (purple) + Vote Skip (amber) buttons in addition to the existing Change/Search YT (green) button (host only). Returning from /youtube-browser with addedVideo param: host triggers changeVideo immediately, non-host triggers a vote-next. Settings modal gained a host-only Voting Policy toggle (allowed vs owner_only) calling PATCH /api/rooms/{id}/settings. Vote-state events render VotingOverlay (yes/no progress bar, countdown, cancel by initiator/host). Vote-result events show a transient neon toast. Added i18n keys (EN + AR) for all new strings."

metadata:
  created_by: "main_agent"
  version: "3.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Phase 3 wrap-up changes for Party4RApp.

      Please test the backend pieces below. Credentials: testuser1 / pass1234 (from
      /app/memory/test_credentials.md). Backend base URL = process.env.EXPO_BACKEND_URL/api.

      FOCUS:
      1. DM REST flow:
         - Create a second user via POST /api/auth/signup, friend testuser1, accept.
         - As testuser1, POST /api/dms/{other_id}  { text:"hi" } → 201 + message obj
         - GET /api/dms → conversations array with last_message + unread fields
         - GET /api/dms/{other_id} → history array
         - POST /api/dms/{other_id}/read → ok + marked count
         - PATCH /api/dms/{message_id} body { text:"edited" }
         - DELETE /api/dms/{message_id}
         - POST /api/dms/{other_id}/typing
         - Block path: POST /api/users/block/{other_id} then verify DM is 403.
         - Friend gate: try DM-ing a non-friend → 403.

      2. DM WebSocket:
         - Connect wss://<host>/api/ws/dms?token=<jwt> as both users.
         - Send a DM REST and confirm both sides receive dm_new event.
         - Confirm presence events fire on connect / disconnect.

      3. Shared time:
         - Both users join the same room via WS /api/ws/rooms/{room_id}?token=<jwt>.
         - Stay ~3 seconds, then have one user disconnect.
         - GET /api/users/{other_id}/shared_time as the remaining user → seconds > 0.
         - Toggle privacy: PATCH /api/users/privacy {shared_time_visibility:"nobody"}
           then have the OTHER user GET /api/users/{me}/shared_time → hidden:true,
           seconds:0.

      Use the existing pre-seeded testuser1 plus one freshly-created test peer.
  - agent: "testing"
    message: |
      Phase 4 backend testing complete — 2 CRITICAL backend issues found, the rest passes.

      Test script: /app/backend_test.py (run against https://partyapp-sync.preview.emergentagent.com).

      WHAT PASSES (12 assertions):
      • PATCH /api/rooms/{id}/settings — host can set voting_mode to "owner_only" /
        "allowed", non-host gets 403. Response shape {id,name,voting_mode}.
      • Voting WS skip flow — peer's vote_start broadcasts vote_state {kind,
        initiator,yes:1,no:0,required:2,member_count:2,expires_at} to BOTH peers.
        Host vote_cast yes broadcasts vote_result {passed:true, kind:"skip"}.
      • Voting WS next flow — peer vote_start with video_url+title, host vote_cast
        yes -> vote_result {passed:true, kind:"next", video_url}. db.rooms.video_url
        DOES update to the new "https://youtu.be/jNQXAC9IVRw".
      • Voting policy owner_only — peer vote_start is silently dropped (no vote_state
        broadcast), host vote_start works.
  - agent: "testing"
    message: |
      Phase 5 backend testing complete. Test script: /app/backend_test_phase5.py
      (run against https://partyapp-sync.preview.emergentagent.com). Summary:
      18 / 22 assertions pass.

      WORD FILTER (moderation.py) — 3 REAL BUGS, working=false:
        PASS "hello world" clean.
        PASS "fuck this shit" -> "**** this ****", bot_flag=True.
        PASS "you BITCH" -> "you *****", bot_flag=True.
        PASS "kos omak" -> "*** omak", bot_flag=True.
        FAIL "F@ck off" -> got "F@ck off" UNCHANGED. _LEET_MAP maps
             '@' -> 'a', so "f@ck" -> "fack" which isn't in BANNED_WORDS.
             Fix: map '@' -> 'u' as well, or add multi-substitution pass,
             or add "f@ck"/"fack" literally to the banned set.
        FAIL "fuuuuck this" -> got "fuuuuck this" UNCHANGED.
             _normalise collapses 3+ repeats to 2 chars, so "fuuuuck" ->
             "fuuck", which doesn't match "fuck". Fix: collapse to 1 char
             (r"(.)\1+" -> r"\1") or add a separate single-collapse pass.
        FAIL "porn xxx nudes" -> got "**** xxx*****s". The repeated-char
             collapse in _normalise changes string LENGTH ("xxx"->"xx"),
             which breaks the "length-preserving" assumption used by
             censor_text to lift normalised regex spans onto the original
             text. Result: "xxx" not censored AND "nudes" replacement is
             off-by-one (shifted to "*****s" instead of "*****").
             Fix options: (a) ditch repeated-char collapse in _normalise
             and match each banned word as a regex like "f+u+c+k+" against
             the original directly; (b) build an index-mapping
             (normalised_idx -> original_idx) so spans can be lifted back
             correctly when collapse fires.

      PUSH TOKEN endpoints (notifications.py) — ALL PASS, working=true:
        PASS POST ExponentPushToken[...] -> 200, DB shows push_token set.
        PASS POST "invalid-format-token" -> 400.
        PASS POST ExpoPushToken[...] -> 200 (both prefixes accepted).
        PASS DELETE -> 200, DB shows push_token unset.

      DM WITH PUSH integration (dms.py + notifications.py) — ALL PASS:
        PASS DM with text to peer (peer has FAKE expo token) -> 201.
             DM endpoint did NOT raise — push errors swallowed. (Backend
             log shows Expo's HTTPS endpoint actually returned 200 for
             the fake token; receipts later would reject, which is fine.)
        PASS DM when recipient has no push_token -> 201 (server short-
             circuits, no Expo call).
        PASS Image-only DM -> 201; push body would be "📷 Photo".
        PASS GET /api/auth/me sanity after all changes.

      Heads-up: GET /api/auth/me does NOT expose push_token (UserPublic
      schema doesn't include it). Brief allowed DB verification as an
      alternative — DB shows the value persists correctly. If the client
      ever needs to read its own push_token via /me, add
      `push_token: Optional[str] = None` to UserPublic in server.py.

      Action for main agent:
        1. Fix the 3 moderation.py word-filter bugs above (most critical
           is the _normalise length-preserving regression — currently
           it produces objectively wrong/garbled output).
        2. Re-trigger testing for the word filter only; push + DM-push
           are working and no longer in current_focus.

      • vote_cancel by host -> vote_result {cancelled:true, passed:false}.

      CRITICAL ISSUES — needs main agent fix:

      1) /api/youtube/extract is POST, not GET.
         The route in rooms_voting.py:184 is @api.post(...) accepting a JSON body
         {url:str}. GET /api/youtube/extract?url=... returns 405 Method Not Allowed
         for valid and invalid URLs. POST with body works and returns
         {video_id,video_url,embed_url,thumbnail}. Add a GET handler (or convert)
         that accepts ?url= query string and reuses extract_video_id().

      2) Skip vote does NOT clear the room's video_url.
         server.py lines 750-752: when a "skip" vote passes, only
         {type:"vote_result",passed:true,kind:"skip"} is broadcast. There is NO
         db.rooms.update_one(...,{$set:{video_url:None}}) and no playback change_video
         broadcast. After a successful skip, GET /api/rooms/{id} still returns the
         original video_url. If the spec requires the backend to clear/advance the
         video, this needs to be added — otherwise the frontend must do it host-side.

      Heads-up on field naming: rooms_voting.VoteState.public() emits {initiator,yes,no}
      (not {initiator_id,yes_votes,no_votes} as written in the brief). Make sure the
      frontend reads `vote.initiator`, `vote.yes`, `vote.no`.

  - agent: "testing"
    message: |
      Phase 4 RE-VERIFICATION of the two previously flagged fixes — BOTH PASS now.

      Re-test script: /app/backend_test_reverify.py (ran against
      https://partyapp-sync.preview.emergentagent.com). All 11 assertions green.

      1) GET /api/youtube/extract (newly added in rooms_voting.py:197-208):
         • GET ?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ -> 200,
           {video_id:"dQw4w9WgXcQ", video_url, embed_url,
            thumbnail:"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"}.
         • GET ?url=https://youtu.be/dQw4w9WgXcQ -> 200, same video_id.
         • GET ?url=not-a-valid-url -> 400 "No YouTube video ID found in URL".
         • POST /api/youtube/extract regression -> still 200 with same payload.

      2) Skip-vote now clears video_url (server.py:750-761):
         • Created room with video_url=youtube URL, host = testuser1, peer = fresh
           friended account.
         • Peer vote_start kind=skip -> vote_state broadcast to both sides.
         • Host vote_cast yes -> BOTH sides receive:
             a) {type:"playback", event:"change_video", video_url:null,
                 host_id:<host>}
             b) {type:"vote_result", passed:true, kind:"skip"}
         • GET /api/rooms/{room_id} (while WS still open) returns video_url: null.
         • Note: when the last WS disconnects, the room is deleted (server.py:849
           rooms.delete_one); HTTP video_url verification must happen before that.

      No other regressions observed. Both Phase 4 tasks are now working:true and
      removed from current_focus. Main agent: please summarise and finish — no
      further backend re-test required for these items.

  - agent: "testing"
    message: |
      Phase 5 word-filter RE-VERIFICATION after main agent rewrote
      moderation.py with per-letter LEET char-class + repeat quantifier
      (no string normalisation). All 7 review-brief assertions PASS.

      Re-test script: /app/backend_test_modfilter.py (run against
      https://partyapp-sync.preview.emergentagent.com).

      Previously failing — now PASS:
        • "F@ck off"       -> "**** off"        bot_flag=True
        • "fuuuuck this"   -> "******* this"    bot_flag=True (7 stars)
        • "porn xxx nudes" -> "**** *** *****"  bot_flag=True

      Regression — still PASS:
        • "hello world"    -> "hello world"     bot_flag=False
        • "fuck this shit" -> "**** this ****"  bot_flag=True
        • "you BITCH"      -> "you *****"       bot_flag=True
        • "kos omak"       -> "*** omak"        bot_flag=True

      Push-token endpoints not re-tested (already green per previous run
      and per review request scope). Task marked working:true, no current
      focus left. Main agent: please summarise and finish.
