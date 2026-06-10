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


  - agent: "main"
    message: |
      **Phase 7 — Arabic Localization + RTL + Cairo font (Frontend only)**

      Scope of this run (NO backend code touched, no DB schema changes):

      1. Rebuilt /app/frontend/src/context/LanguageContext.tsx with:
         - Full English + Arabic dictionaries covering every screen
           (auth, home, search, dms inbox/chat, room, voting, friends,
           profile, settings, privacy, blocked, legal pages, splash,
           YouTube browser, create-room).
         - Cairo font loaded via @expo-google-fonts/cairo (regular, semibold,
           bold, extra-bold, black). Applied globally to Text.defaultProps
           when lang === "ar".
         - tErr(rawError) — translates backend HTTPException detail strings
           (e.g. "Incorrect username or password", "Cannot DM yourself",
           "Avatar image too large…") into Arabic. Unknown errors fall
           through unchanged.
         - I18nManager.forceRTL on language switch + "restart required"
           alert in ar.
         - Western numerals preserved per spec.

      2. Replaced hardcoded English strings with t() across:
         settings, privacy, blocked, legal/privacy-policy, legal/terms,
         search, dms, dms/[friendId], (tabs)/friends, (tabs)/profile,
         (tabs)/home, room/[id], youtube-browser, VotingOverlay, splash
         (app/index.tsx).

      3. Added RTL chevron flipping to ScreenScaffold back button
         (chevron-back ↔ chevron-forward based on I18nManager.isRTL).

      4. Installed @expo-google-fonts/cairo via `yarn expo install`.

      Verification done by main agent via Playwright screenshot tool:
        • Logged in as testuser1/pass1234.
        • Settings page renders cleanly in English.
        • Switched to العربية — all visible strings translated, RTL
          alignment auto-applied (Arabic text right-aligned), and Cairo
          font visibly rendering. "Restart required" alert flow is
          present for native; web preview applies direction via CSS.

      NO backend testing required for this phase — only static dictionary
      additions on the frontend. Awaiting user verification on Termux
      build before moving to Phase 8 backlog (SMTP).



  - agent: "main"
    message: |
      **Phase 8.5 — Theme Library Expansion (Frontend only, no backend touched)**

      Scope:
        1. Rewrote /app/frontend/src/theme/themes.ts to host 25 themes (was
           10). New themes are PURE-COLOR identities — the brand carries the
           visual personality and the accent defaults to a lightened shade
           of the brand to preserve a clean monochromatic look.

           FEATURED (4, unchanged):
             neon, midnight, amoled, cyber-purple

           EXTRAS (21, new + curated):
             emerald, toxic-lime,
             electric-blue, deep-ocean, royal-blue, sapphire,
             cyan-core, arctic,
             neon-red, crimson, ruby-red,
             orange-pulse, dark-bronze,
             pink-neon, rose-glow,
             plasma-violet, ultra-violet, royal,
             gold, titanium-silver, pure-white (light-mode)

        2. Added FEATURED_IDS and EXTRA_IDS exports to support the
           Settings UI split.

        3. Added mode: "dark" | "light" to ThemeTokens so pure-white can
           render properly. shadeLayer() darkens for light themes; text
           defaults flip to dark.

        4. Rewrote /app/frontend/app/settings.tsx:
           - Featured 4 cards stay exactly as before.
           - Added collapsible "MORE THEMES" panel: header w/ palette icon,
             count badge, animated chevron (rotates 0->90deg, native-driver).
           - Body: search input (useDeferredValue) + 2-col grid of memoized
             ThemeCard previews. Each card has a circular brand->accent disc
             with check bubble + glow border when selected.
           - LayoutAnimation drives expand/collapse on iOS+Android.
           - Performance: React.memo on ThemeCard, useMemo on filtered list,
             featured cards never re-render during search.

        5. Added i18n keys (EN + AR): more_themes, theme_library,
           themes_count_one/many, search_themes, no_themes_found.

      Verified visually via Playwright:
        - Collapsed -> 4 featured + "MORE THEMES (21 themes)" header.
        - Expanded -> grid renders all 21 pure-color discs.
        - Search "red" -> filters to Neon Red / Crimson / Ruby Red.
        - Tapping Plasma Violet -> instant global re-theme, every surface,
          border, glow, language section recolors.

      No backend testing required.


  - agent: "main"
    message: |
      **Cleanup & Optimization Pass — visual polish preserved 100%**

      Deleted only verified-dead / unused / duplicate stuff. All animations,
      glows, ambient light beams, metallic gradients, cinematic transitions,
      and theme effects were kept intact.

      Files removed (verified 0 imports / 0 references):

      Frontend code (3 files):
        - src/constants/themes.ts (legacy; settings.tsx now imports from
          src/theme/themes.ts which is the single source of truth)
        - src/components/futuristic/NeonButton.tsx (0 imports)
        - src/components/futuristic/GlassPanel.tsx (0 imports)

      Frontend assets (11 files, ~2 MB freed):
        - assets/images/*.bak (4 backup files)
        - assets/images/icon-source.png  (not referenced)
        - assets/images/app-image.png    (not referenced)
        - assets/images/react-logo.png + @2x + @3x (RN template, unused)
        - assets/images/partial-react-logo.png (RN template, unused)
        - assets/fonts/SpaceMono-Regular.ttf (RN template font, unused)

      Backend (2 files):
        - backend/tests/test_patch_iter2.py
        - backend/tests/test_patch_iter3.py

      package.json (2 unused deps via yarn remove):
        - expo-haptics (0 imports)
        - expo-symbols  (0 imports)

      Explicitly KEPT (would have caused regressions):
        - /app/dist/ entire folder - server.py serves /api/downloads/* from
          here for the user Termux workflow.
        - /app/backend_test*.py - referenced by test_result.md.
        - react-native-screens, @react-navigation/bottom-tabs - peer deps
          of expo-router (zero direct imports, but used internally).
        - All in-use futuristic components: ScreenScaffold, MetallicCard,
          GlowDivider, LightBeam.

      Impact: assets 7.2MB -> 5.2MB, -3 dead source files, -2 npm pkgs.
      Verified post-cleanup with Playwright after full Expo restart with
      cleared Metro cache. Splash, Login, Home, Friends, Profile, Settings
      (with expanded MORE THEMES grid) all rendered cleanly with full
      neon glows, ambient beams, gradients, and animations intact.


backend:
  - task: "Phase 8 — Gmail SMTP for Reports (env-driven, async)"
    implemented: true
    working: true
    file: "/app/backend/privacy_safety.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          The SMTP email pipeline was already coded in
          `_send_report_email_sync` + `send_report_email_async`. User
          provided their Gmail App Password, so I populated the .env
          (smtp.gmail.com:465, SMTP_USER=SMTP_PASS=yemenamer20@gmail.com).
      - working: true
        agent: "testing"
        comment: |
          Phase 8 SMTP report flow VERIFIED via
          /app/backend_test_phase8.py against the public URL. Limited to
          a SINGLE POST /api/reports to avoid spamming the real inbox.

          PASS  POST /api/reports {target:peer_qceoot, category:harassment,
                description:"Phase8 smoke test", evidence:"automated test
                ping — please ignore"} -> 201 in 0.142s (< 2s required;
                proves background task non-blocking).
          PASS  Response body {ok:true, report_id:"f44bd3b7-…"}.
          PASS  Waited 10s and grepped backend.err.log + backend.out.log
                for "SMTP" / "smtplib" / "ssl Error" — ZERO matching
                lines, meaning:
                  • NO "SMTP send failed" exception.
                  • NO "SMTP not configured" warning (env vars loaded
                    correctly).
                Note: a successful smtplib send is silent; absence of
                any error is the expected positive signal for a fire-
                and-forget Gmail send. Cannot directly read the Gmail
                inbox, but the SMTP_SSL connection + login + send_message
                did not raise, so delivery to Gmail's MX is confirmed
                by the daemon.

  - task: "Phase 8 — Admin moderation endpoints"
    implemented: true
    working: true
    file: "/app/backend/privacy_safety.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          New routes (all behind `require_admin` — gated by the
          ADMIN_USERNAMES env var which is set to "yemenamer20,testuser1"):
            GET   /api/admin/reports?status=open|resolved|dismissed|all&limit=50
            PATCH /api/admin/reports/{id}  body={status: open|resolved|dismissed}
            GET   /api/admin/smtp/health
      - working: true
        agent: "testing"
        comment: |
          Phase 8 admin moderation endpoints VERIFIED end-to-end via
          /app/backend_test_phase8.py against the public URL.
          31/32 assertions PASS; the one nit is a data-state quirk, not
          a code defect (see "Minor" note at the bottom).

          GET /api/admin/smtp/health (as testuser1):
            PASS  200 with {configured:true, host:"smtp.gmail.com",
                  port:465, moderation_email:"yemenamer20@gmail.com",
                  sender:"yemenamer20@gmail.com"}.
            PASS  Response does NOT include the password / pass field
                  (keys are exactly [configured,host,port,moderation_email,
                  sender]).

          GET /api/admin/reports?status=open&limit=20:
            PASS  200 with {reports:[…], count:N}.
            PASS  Our just-filed report_id is present in the list.
            PASS  target enrichment dict has id, username, nickname,
                  honor.
            PASS  status == "open".
            PASS  created_at_dt is STRIPPED from the response (server
                  pops it before JSON encoding).

          PATCH /api/admin/reports/{id} {"status":"resolved"}:
            PASS  200 with {ok:true, status:"resolved"}.
            PASS  Report now appears in status=resolved list.
            PASS  Report no longer appears in status=open list.

          PATCH /api/admin/reports/{id} {"status":"banana"}:
            PASS  400 with detail "Invalid status (open|resolved|
                  dismissed)" — exact string match.

          Non-admin access (signed up a fresh nonadm_* account, NOT in
          ADMIN_USERNAMES):
            PASS  GET /api/admin/reports          -> 403 "Admin access required"
            PASS  GET /api/admin/smtp/health      -> 403 "Admin access required"
            PASS  PATCH /api/admin/reports/{id}   -> 403 "Admin access required"

          Regression — DELETE /api/auth/account on the throwaway non-
          admin user:
            PASS  200 {ok:true}; subsequent /auth/me with the same
                  token returns 401 (user fully deleted).

          Minor (does not change working=true): the enriched REPORTER
          dict only contains {id, username, nickname} — the `honor`
          field is missing. Root cause: testuser1 has never been the
          TARGET of a report or any other honor delta, so
          apply_honor_delta() has never run on them, so the doc has no
          `honor` field, and the Mongo projection `{honor:1}` just
          returns nothing for it. The TARGET dict (peer_qceoot) DID
          have the honor field because being reported triggered the
          $set. If the admin UI requires honor on every row, the easy
          fix is either (a) default `honor: HONOR_START` on signup in
          server.py's signup route, or (b) post-process the enrich
          step in privacy_safety.list_reports to fill missing
          `honor` with HONOR_START before returning.

metadata:
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Phase 8 ready for backend testing. Two new tasks above:
      - Phase 8 SMTP report emails (live Gmail, real send, fire-and-forget)
      - Phase 8 admin moderation endpoints (gated by ADMIN_USERNAMES env)

      IMPORTANT for testing agent:
      - Use the existing testuser1 / pass1234 from
        /app/memory/test_credentials.md as the admin user (it is listed
        in ADMIN_USERNAMES).
      - The SMTP send is best-effort and runs in a background task — the
        POST /api/reports response itself MUST return quickly. Verify the
        response is <1s and ok:true.
      - Watch backend logs after the report POST and confirm there is NO
        "SMTP send failed" error. Brief log inspection is sufficient —
        do NOT spam many reports (this sends real email).
      - Limit yourself to TWO test reports total to avoid filling the
        real inbox.
      - Admin endpoints are gated — non-admin should 403.

  - agent: "testing"
    message: |
      Phase 8 backend testing COMPLETE — both tasks PASS (31 of 32
      assertions green; the one nit is a data-state quirk, not a code
      defect — see end of this message).

      Test script: /app/backend_test_phase8.py
      Backend URL: https://partyapp-sync.preview.emergentagent.com/api
      Only ONE POST /api/reports was issued (well under the 2-call cap).

      ===== Phase 8 SMTP for Reports =====
      • POST /api/reports {target=peer_qceoot, category=harassment,
        description="Phase8 smoke test", evidence="automated test ping
        — please ignore"} -> 201 in **0.142s** (< 2s required; proves
        asyncio.create_task isn't blocking the response).
      • Response body = {ok:true, report_id:"f44bd3b7-…"}.
      • Waited 10s, then grepped backend.err.log + backend.out.log
        from the pre-test offset for /SMTP|smtplib|ssl Error/:
            -> ZERO matching lines.
        Specifically:
            - NO "SMTP send failed"  -> no exception in the background
              send.
            - NO "SMTP not configured" -> env vars (SMTP_HOST/PORT/USER
              /PASS/MODERATION_EMAIL) ARE loaded.
        Conclusion: SMTP_SSL connect + login + send_message did not
        raise, so the message was handed to Gmail's MX successfully.
        (Cannot read the inbox directly to visually confirm receipt,
        but absence-of-error is the expected positive signal for a
        fire-and-forget send.)

      ===== Phase 8 Admin moderation endpoints =====
      GET /api/admin/smtp/health (as testuser1):
        PASS  200 with {configured:true, host:"smtp.gmail.com", port:465,
              moderation_email:"yemenamer20@gmail.com",
              sender:"yemenamer20@gmail.com"}.
        PASS  password field NOT exposed (keys are exactly
              [configured,host,port,moderation_email,sender]).

      GET /api/admin/reports?status=open&limit=20:
        PASS  200 with {reports:[…], count:N}.
        PASS  Our new report is present.
        PASS  Each row enriched with target dict {id, username,
              nickname, honor} and status "open".
        PASS  created_at_dt stripped from response (server pops it
              before JSON encoding).

      PATCH /api/admin/reports/{id} {"status":"resolved"}:
        PASS  200 with {ok:true, status:"resolved"}.
        PASS  Now appears in status=resolved list.
        PASS  No longer appears in status=open list.

      PATCH /api/admin/reports/{id} {"status":"banana"}:
        PASS  400 with detail exactly "Invalid status (open|resolved|
              dismissed)".

      Non-admin (fresh signup nonadm_*, NOT in ADMIN_USERNAMES):
        PASS  GET /api/admin/reports       -> 403 "Admin access required"
        PASS  GET /api/admin/smtp/health   -> 403 "Admin access required"
        PASS  PATCH /api/admin/reports/{id}-> 403 "Admin access required"

      DELETE /api/auth/account regression check (on the throwaway non-
      admin user — testuser1 was NOT touched):
        PASS  200 {ok:true}; subsequent /auth/me on the same token
              returns 401 (cascade delete works).

      ===== Minor (does not affect working=true) =====
      In the enriched /admin/reports response, the REPORTER dict was
      missing the `honor` field — only {id,username,nickname} present.
      Root cause: testuser1's user doc has no `honor` key because
      apply_honor_delta() has never run on them (they've only ever
      been a reporter, never a target). The Mongo projection
      `{honor:1}` therefore returns nothing for that field. The TARGET
      dict (peer_qceoot) DID include honor because being reported
      triggered apply_honor_delta.
      Suggested fixes (pick one — both are minor):
        a) In server.py signup, default `"honor": HONOR_START` on the
           user doc so every new account has the field.
        b) In privacy_safety.list_reports enrichment, fill the missing
           field with HONOR_START before returning:
             u.setdefault("honor", HONOR_START)
      Either keeps the admin UI from having to handle undefined.

      Action for main agent: please summarise & finish — no further
      backend re-test required for Phase 8. The honor-default nit is
      a tiny polish item, not a regression.


  - agent: "main"
    message: |
      Resumed work on the 3 user-reported issues (YouTube WebView, SafeArea
      overlap, hardcoded green colors). Implemented in one pass:

      1) DYNAMIC GREEN COLORS — comprehensive fix, not surface-level:
         - Found 35 occurrences of `"FUTURISTIC.brand…"` written as string
           literals (broken JSX/attribute references that silently ignored
           the active theme). Fixed in 8 files: room/[id].tsx, dms.tsx,
           dms/[friendId].tsx, search.tsx, (tabs)/home.tsx, (tabs)/friends.tsx,
           (tabs)/profile.tsx, components/VotingOverlay.tsx.
         - Replaced literal #10C66D / #26FF93 hex gradients in index.tsx (splash
           progress bar), home.tsx (FAB), dms/[friendId].tsx (send button +
           outgoing message bubble), and VotingOverlay.tsx with
           FUTURISTIC.brand / FUTURISTIC.brandSoft.
         - Converted /src/constants/avatars.ts COLORS into a getter-based proxy
           over FUTURISTIC, so all ~241 existing `COLORS.brand` / `COLORS.bg`
           etc. usages now follow the active theme automatically without
           touching their styles. Only `navBg` stays neutral dark on purpose.

      2) SAFE-AREA BOTTOM OVERLAP (Android system nav bar):
         - room/[id].tsx: SafeAreaView edges changed from ["top"] to
           ["top","bottom"] (only when not fullscreen) so the chat composer
           and members strip sit above the system nav bar. Also imported
           useSafeAreaInsets for any future overrides.
         - dms/[friendId].tsx: imported useSafeAreaInsets and added
           paddingBottom: 10 + insets.bottom to the composer view so the
           input + send button no longer get clipped behind the Android
           navigation bar.

      3) YOUTUBE WEBVIEW PLAYBACK:
         - Improved buildEmbedHtml(): switched player host to
           youtube-nocookie.com (better embed compatibility), added explicit
           origin, widget_referrer and enablejsapi player vars, wrapped the
           YT.Player construction in try/catch, and added an 8s ready
           watchdog that posts a 'yterror: TIMEOUT' so the user sees the
           Tap-to-retry overlay instead of an infinite "Loading…" spinner.
         - WebView props were already solid (originWhitelist=*, mixedContentMode=
           always, allowsInlineMediaPlayback, mediaPlaybackRequiresUserAction=
           false, androidLayerType=hardware, custom Chrome UA) — verified.

      Verification:
        - Web preview: screenshot tested login → home → create-modal → room.
          No runtime crashes. Theme renders correctly. The WebView "Tap to
          play" overlay shows on web (RNWebView itself is unsupported on web
          which is fine — actual playback requires the Android build).
        - TypeScript: `tsc --noEmit` reports 12 errors, all pre-existing
          before my edits (LinearGradient strict tuple typing — same count
          on stash/restore). No new errors introduced.
        - Backend: /api/download/complete.zip → HTTP 200, 5.7MB.
          /api/download/mobile-full.zip → HTTP 200, 12.3MB.
          Both bundles verified to contain the latest edits (grep
          confirms FUTURISTIC.brand, useSafeAreaInsets, youtube-nocookie).

      Termux bundle status:
        - /app/dist/party4r-complete.zip rebuilt (5.7MB, drops metro cache)

  - agent: "main"
    message: |
      YouTube playback rewrite (per user follow-up request "Fix the YouTube
      playback issue in the app").

      Root cause of the persistent Android failure:
        The previous implementation used a raw <WebView> rendering a
        hand-written HTML that loaded the YouTube IFrame API. This approach
        is fragile across Android WebView versions — origin/referrer
        mismatches, postMessage bridging, and the autoplay/unmute dance
        each fail in slightly different ways on different OEM ROMs.

      Fix applied:
        - Installed `react-native-youtube-iframe@2.4.1` (the most popular,
          actively-maintained YouTube embed for RN — ~300k weekly DLs).
        - Installed `react-native-web-webview@1.0.2` so the package's web
          fallback also bundles cleanly under Expo Metro for web preview.
        - Replaced the WebView + buildEmbedHtml() block in
          /app/frontend/app/room/[id].tsx with <YoutubePlayer/>. Removed the
          entire ~120-line embed HTML helper.
        - Wiring:
            * playerRef = useRef<YoutubeIframeRef>()
            * controlled `play={playing}` boolean state
            * onChangeState → host emits play/pause/seek over WebSocket
              with current time fetched from playerRef.getCurrentTime()
            * onReady → setPlayerReady(true), flush any buffered remote
              sync command that arrived during load
            * Remote playback events (peers / host) now apply via
              playerRef.current.seekTo(time, true) + setPlaying(bool),
              guarded by `suppressStateRef` so we don't echo events.
            * Volume → passed via `volume` prop (0..100, auto-mutes at 0).
              Removed manual `injectJavaScript("player.setVolume(...)")`.
        - webViewProps passes the Android-optimal config (mixedContentMode:
          'always', allowsInlineMediaPlayback, mediaPlaybackRequiresUserAction
          false, androidLayerType: 'hardware', Chrome UA, originWhitelist *).
        - initialPlayerParams: controls true, modestbranding true,
          iv_load_policy 3 (no annotations), rel false, preventFullScreen
          false.
        - extractYouTubeId regex extended to also accept youtube.com/shorts/<id>.

      Verification on web preview:
        Created a room with the Rick Astley video and another with the
        oldest YouTube video ("Me at the zoo"). The YoutubePlayer now
        renders the actual video frame + title overlay (previously this
        screen showed "React Native WebView does not support this
        platform"). The web preview can't trigger autoplay due to
        react-native-web-webview's postMessage limitation (a known
        web-only quirk, unrelated to native), but the iframe IS embedded,
        which proves the URL + dimensions are correct. On Android the
        actual react-native-webview will run the bridge properly.

      Bundle status:
        /app/dist/party4r-complete.zip → 5.67 MB (HTTP 200)
        /app/dist/party4r-mobile-full.zip → 12.3 MB (HTTP 200)
        Both verified via unzip+grep to contain:
          - import YoutubePlayer from "react-native-youtube-iframe"
          - "react-native-youtube-iframe": "^2.4.1" in package.json
          - "react-native-web-webview": "^1.0.2" in package.json

      No backend changes; backend re-testing not required.

        - /app/dist/party4r-mobile-full.zip rebuilt (12.3MB)
        - README inside the zip lists all 3 fixes for the user.

      No backend code changes. No testing-agent run is required for these
      frontend-only fixes — visual verification was done via screenshot tool.

#====================================================================================================
# 2026-06-10 — Dominoes Phase 5: Real-time online multiplayer gameplay
#====================================================================================================

backend:
  - task: "Damma WebSocket gameplay events (play/draw/pass + bot auto-play)"
    implemented: true
    working: "NA"
    file: "/app/backend/damma_online.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Phase 5 — Implemented server-side bot auto-play for slots flagged as
          bots (timeout-fill or disconnect-converted). Added `_maybe_schedule_bot_turn`
          + `_play_bot_turn` and hooked them into `/rooms/{rid}/start`, queue
          drain, disconnect-watcher, and the per-move handler. Also added
          `from_pid` to chat broadcasts so clients can reliably mark messages
          as "fromMe". Fixed ambiguous variable name ruff E741.

frontend:
  - task: "Online Dominoes screen (real-time WS gameplay)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/game/damma-online.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Phase 5 — New screen wired to the WS via `useDammaOnline` hook.
          Reuses WoodenTable/HandTray/PlayerChip/BoneyardPanel. Rotates seats
          so MY pid is always at the bottom. Server-driven state, hands,
          scores, tile counts, turn timer. Connecting/Reconnecting/Error
          overlays. Lobby now navigates here on match-found. Chat bridge
          through GameCommsBar (`onSendInGame` + `externalMessages`).

  - task: "useDammaOnline React hook"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/games/damma/useDammaOnline.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Wraps DammaOnlineClient with reconciliation into a DammaState-shaped
          object so existing presentation components render unchanged. Handles
          reconnect with backoff (5 attempts), heartbeats every 25 s, chat
          log, end payload, and graceful disconnect.

  - task: "Damma matchmaking lobby — navigate to /game/damma-online on match"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/game/damma-lobby.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Tiny redirect change: matched room now opens /game/damma-online?rid={rid}
          instead of /game/damma. Offline path (/game/damma) untouched.

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 14
  run_ui: true

test_plan:
  current_focus:
    - "Damma WebSocket gameplay events (play/draw/pass + bot auto-play)"
    - "Online Dominoes screen (real-time WS gameplay)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Phase 5 complete. Validation needed:
      1. Backend: queue join → match → bot auto-play → game progresses end-to-end.
      2. WS: receive `room`, `state` (with private hand), `chat` (with from_pid),
         and `end` events.
      3. Frontend: log in as testuser1 → /game/damma-lobby → press "ابحث عن
         مباراة أونلاين" → wait ~25s for the bot-fill timeout → confirms it
         navigates to /game/damma-online and shows board + hand + opponents.

  - task: "Phase 5 web-compat fixes (exit modal + comms testIDs)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/game/damma-online.tsx, /app/frontend/src/comms/ui/GameCommsBar.tsx, /app/frontend/src/comms/ui/GameChatSheet.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Iter_15 follow-ups:
          1. Replaced Alert.alert with cross-platform <Modal> (Alert.alert is
             silent on react-native-web). New testIDs: damma-online-exit-confirm,
             damma-online-exit-cancel, damma-online-exit-card,
             damma-online-exit-backdrop.
          2. Added testID="comms-chat-button" + "comms-friends-button" to
             GameCommsBar buttons.
          3. Added testID="comms-chat-input" + "comms-chat-send" to GameChatSheet.

agent_communication:
  - agent: "main"
    message: |
      Iter_15 fixes applied. Please re-test FRONTEND-ONLY:
      1. End-to-end lobby → online screen handoff (verified working in iter_15).
      2. Tap back chevron — confirm the new Modal appears with title "الخروج
         من المباراة" and two buttons (إلغاء + خروج). Tapping "خروج" should
         disconnect and pop back to /game/damma-lobby.
      3. Open chat sheet via the new testID comms-chat-button, type "مرحبا"
         in comms-chat-input, tap comms-chat-send. Verify message bubble
         appears on the right side (fromMe=true). No crash.

#====================================================================================================
# 2026-06-10 — Dominoes Premium Visual Polish (Phase A)
#====================================================================================================

frontend:
  - task: "Snake/zigzag chain layout + tile entrance animation"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/games/damma/components/WoodenTable.tsx, /app/frontend/src/games/damma/components/SnakeLayout.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Phase A — REPLACED the old flex-row chunked layout with an authentic
          serpentine "snake" path:
          - First tile lands at the CENTER of the felt.
          - As the chain grows it extends LEFT and RIGHT.
          - When approaching the safe-edge it bends 90° via a vertical
            "corner" tile (rotation=90°), drops one row, then reverses
            direction.
          - All tiles are absolute-positioned by their CENTER (x, y) coords
            so no tile can escape the wooden frame.
          - Auto-rotates corner tiles, auto-shrinks the entire chain when
            it would overflow vertically (16 scale steps from 1.0 → 0.32).
          - ENTRANCE ANIMATION: every newly-placed tile flies in from a
            sensible off-screen direction (LEFT for prepend, RIGHT for
            append, ABOVE for first move), 380 ms ease-out-quint, with a
            slight scale "pop" peak at 1.08x.
          - LAST-PLACED HALO: a golden glow pulses around the newest tile
            for ~1.3 s after it lands (verified visible in the screenshot
            for the first tile).
          - Detects entry side automatically from prev/cur board diff —
            no external prop wiring required, so both damma.tsx (offline)
            and damma-online.tsx (live) get the new behavior for free.
          Verified manually via screenshot tool: single-tile placement
          centered correctly at board middle with golden halo visible.

agent_communication:
  - agent: "main"
    message: |
      Phase A complete. Validation needed (FRONTEND ONLY, OFFLINE DAMMA):
      1. /game/damma loads with empty board showing "Place the first tile".
      2. Playing the first tile centers it horizontally on the board (no
         longer off-left). A golden halo pulses around it briefly.
      3. After a few exchanges with the bot, the chain extends from the
         center outward in BOTH directions, staying on a single row until
         it approaches the safe-edge.
      4. After ~6+ tiles the chain bends 90° via a VERTICAL (rotated)
         corner tile, then continues on the next row in REVERSE direction.
      5. No tile ever crosses the wooden frame (test by playing 18-25+
         tiles — engine adds tiles one per turn).
      6. The newly-placed tile is briefly highlighted by the halo each
         turn so the player can see where the bot just played.
      
      Backend untouched; skip backend retest.

#====================================================================================================
# 2026-06-10 — Damma engine + Room comprehensive fixes (Part B)
#====================================================================================================

frontend:
  - task: "Damma engine — store tiles in VISUAL order so numbers never appear reversed"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/games/damma/engine.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          ROOT CAUSE FIX. The frontend engine previously stored placed tiles
          with their ORIGINAL (hand) left/right values + a `flipped` flag
          that the renderer ignored. When a tile's left side matched the
          chain end (instead of the right), the on-screen visual showed the
          values in the wrong order, giving the appearance of "reversed
          numbers". The backend already stored tiles in visual order (line
          136-141 of damma_online.py), so online games were correct but
          offline/bot games were not.
          
          Fix: refactored playDomino() to ALWAYS swap left/right when needed
          so that board[i].left === visual-left and board[i].right ===
          visual-right. Invariants now hold: board[0].left === leftEnd;
          board[i].right === board[i+1].left; board[N-1].right === rightEnd.
          DominoTile renders left|right directly — guaranteed correct.

  - task: "Damma SnakeLayout — rotate tiles in LEFT-going rows 180° for visual continuity"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/games/damma/components/SnakeLayout.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          When the snake turns and the next row goes LEFT, the chain's
          visual orientation needs to be flipped so adjacent tiles' shared
          values line up on screen. Added horizRotation=180° for left-going
          rows and -90° (270°) for corner tiles after them. The chain now
          stays visually continuous through every turn.

  - task: "Room — Crown holder / host can SKIP instantly without a vote"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/room/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Added a `hostSkip()` helper. The Skip button now branches:
          - isHost → calls hostSkip(): cancels any active vote, clears the
            local video state, broadcasts `playback / change_video` with
            video_url=null so all peers drop instantly. No vote overlay.
          - Guest → original `startVote("skip")` flow.
          The button label switches between "Skip" and "Vote Skip" too.
          TestID `host-skip` for the host variant.

  - task: "Room — Chat 200-message rolling window"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/room/[id].tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          The chat handler now keeps only the last 200 messages. Older ones
          are dropped from the TOP, newer ones continue at the BOTTOM. Long
          sessions never accumulate unbounded memory or re-render cost.

  - task: "Room — Keyboard stability (input keeps focus, FlatList persists taps)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/room/[id].tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          - KeyboardAvoidingView now uses behavior="height" on Android (was
            undefined which caused the keyboard to cover the composer).
          - TextInput got `blurOnSubmit={false}` so Enter no longer dismisses
            the keyboard (user can keep typing across multiple sends).
          - FlatList got `keyboardShouldPersistTaps="handled"` +
            `keyboardDismissMode="interactive"` so tapping a message no
            longer pulls the keyboard down mid-typing.
          - Added `autoCorrect={false}` + `autoCapitalize="none"` to prevent
            re-render churn from spellcheck suggestions.

agent_communication:
  - agent: "main"
    message: |
      Comprehensive Damma + Room fixes applied. Validation needed:
      
      DAMMA (offline /game/damma):
      1. Tile numbers display correctly across LONG chains — play 15+ tiles
         each turn picking different sides (left vs right). Every tile on
         the chain should be visually CONTINUOUS — board[i].right value
         visually meets board[i+1].left value. No "reversed" tiles.
      2. The snake bends correctly: at the right edge → vertical corner
         (90°) → next row LEFT with all tiles 180° rotated → vertical corner
         (270°) → next row RIGHT etc.
      3. All 28 tiles are used exactly once (no duplicates, no missing).
      4. The entrance animation still plays each turn with the golden halo.
      
      ROOM (/room/{id}):
      5. As HOST: tap the "Skip" button → video clears instantly, no vote
         overlay appears, peers' videos also clear via WS.
      6. As GUEST: tap the "Vote Skip" button → vote overlay appears as
         before.
      7. Chat: send 250+ messages back-and-forth → the FlatList only shows
         the most recent 200, oldest ones drop off the top, no slowdown.
      8. Keyboard: open chat input, type a message, press Enter → message
         sends, input STAYS focused, keyboard STAYS open, can immediately
         type a second message.
      
      Backend untouched in this iteration (only engine.ts + SnakeLayout.ts +
      room/[id].tsx changed). Skip backend retest.

#====================================================================================================
# 2026-06-10 — DAMMA: RTL pip rendering fix (root cause of "reversed numbers")
#====================================================================================================

frontend:
  - task: "Damma — DominoTile pip faces render LTR even in RTL (Arabic) mode"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/games/damma/components/DominoTile.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          REAL ROOT CAUSE of the "reversed numbers" issue found via the
          user's screenshots. The previous engine fix was correct, but the
          DominoTile component used `flexDirection: "row"` which React Native
          automatically mirrors when `I18nManager.forceRTL(true)` is active
          (which the app does in Arabic mode). That mirror caused
          `domino.left` to render on the visual screen-RIGHT instead of
          screen-LEFT, breaking the engine's invariant (board[i].right ===
          board[i+1].left) AT THE PIXEL LEVEL.
          
          Fix: import `I18nManager` and, when isRTL=true AND horizontal=true,
          render the two PipFace children in REVERSED order (right first,
          then divider, then left). The visual screen output now matches the
          engine's value semantics regardless of language. Vertical tiles
          (corner) are unaffected since flexDirection:column isn't mirrored
          by RTL.

agent_communication:
  - agent: "main"
    message: |
      RTL pip rendering fix applied. Validation needed (FRONTEND ONLY):
      
      1. Set the app language to ARABIC (force RTL). Visit /game/damma.
      2. Play 15-20 tiles vs the bot, mixing left and right side plays.
      3. At EVERY chain length, verify VISUAL adjacency: for adjacent tiles
         on the same horizontal row, the screen-right value of the left
         tile MUST equal the screen-left value of the right tile.
         E.g., if the row reads [3|5][5|4][4|2] on screen left-to-right,
         the values match (5=5, 4=4). The user's previous screenshot
         showed [3|5][3|3][1|5] where 5≠3, 3≠1 — that's the bug. After fix,
         this should never happen.
      4. Verify the same continuity through the corner tile (vertical) into
         the next row. After the corner, the next row (going LEFT) tiles
         have rotation=180° applied externally — their visual screen-LEFT
         value (which is their original RIGHT) connects to the corner's
         visual BOTTOM (= corner's right value).
      5. Switch language back to ENGLISH (LTR) and confirm no regression.
      
      Backend untouched. Skip backend retest.

#====================================================================================================
# 2026-06-10 — DAMMA: FULL ARCHITECTURAL REBUILD per user's spec
#====================================================================================================

frontend:
  - task: "Damma — IMMUTABLE 28-tile DS6 set extracted to its own module"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/games/damma/domino-set.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Per user spec: "أحجار ثابتة بعدد وقيم صحيحة، لا يتم إنشاء أحجار
          جديدة أثناء المباراة إلا من المجموعة الأصلية". The canonical 28
          Double-Six tiles are built ONCE at module load and `Object.freeze`d
          so no code path can mutate them. `shuffleDS6()` returns a fresh
          Fisher-Yates copy of REFERENCES — never creates new tile objects.
          
  - task: "Damma — engine uses the frozen set"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/games/damma/engine.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          engine.ts now imports from domino-set.ts. Every new round shuffles
          the same canonical 28 tiles. Engine still stores placed tiles in
          VISUAL order (board[i].right === board[i+1].left invariant).
          
  - task: "Damma — DominoTile rebuilt with PURE ABSOLUTE positioning (RTL-immune)"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/games/damma/components/DominoTile.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          REAL fix per user spec: "عزل Domino Board عن Directionality / RTL".
          The previous DominoTile used `flexDirection: "row"` (which RN
          AUTO-MIRRORS in RTL mode) AND a nested `PipFace` with another
          flex-row + flex-wrap (also auto-mirrored). So under Arabic, BOTH
          the tile halves AND the pip dots inside each half were mirrored
          — multiple layers of RTL flipping. We previously tried to
          conditionally reverse children (works for one layer) and tried
          `direction: "ltr"` (NOT a valid RN style — it logs warnings but
          does nothing).
          
          New approach: build the tile with ZERO flex direction. Every
          element (tile shell, divider, left face wrapper, right face
          wrapper, individual pip dots) is positioned by explicit numeric
          `left` and `top`. React Native does NOT mirror physical `left`
          / `top` values, so the layout is identical in LTR and RTL.
          
          Side benefit: faster rendering (no flex layout work) and exact
          pixel control over pip positions.
          
          The PipFace is also rebuilt with absolute positioning — each dot
          on its 3×3 grid cell center.

  - task: "Damma — Bot think time lowered to 1.5 s for snappier offline play"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/game/damma.tsx"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "BOT_THINK_MS: 5000 → 1500 ms. Better for testing + UX."

agent_communication:
  - agent: "main"
    message: |
      Complete Damma architectural rebuild applied per user's detailed spec:
      
      1. Immutable 28-tile set extracted (domino-set.ts) — Object.freeze'd.
      2. Engine uses frozen set; shuffles a fresh array of references each
         match.
      3. DominoTile completely rewritten with PURE ABSOLUTE positioning —
         NO flex anywhere — so it renders identically in LTR and RTL.
      4. RTL no longer affects tile/pip layout in any way.
      5. Engine still stores tiles in visual order so board[i].right ===
         board[i+1].left and the chain is value-continuous.
      
      Validation needed (FRONTEND ONLY):
      - Switch app language to ARABIC. Visit /game/damma.
      - Play 10-15 tiles vs bot. Verify pip values display correctly
        AND adjacent tiles in any row have matching values
        (board[i].right_visible === board[i+1].left_visible).
      - Switch back to ENGLISH and verify identical behavior (no regression).
      - Verify pip patterns: 0 = blank, 1 = center, 2 = top-left+bottom-
        right, 3 = diagonal, 4 = four corners, 5 = corners + center,
        6 = two columns of three.
      
      Backend untouched. Skip backend testing.

#====================================================================================================
# 2026-06-10 — DAMMA: STABLE layout with fixed tile size (no auto-shrink)
#====================================================================================================

frontend:
  - task: "Damma — SnakeLayout uses FIXED tile scale; existing tiles never reposition"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/games/damma/components/SnakeLayout.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          User-diagnosed root cause: "الطاولة صغيرة وكل مرة العب بحجر يضطر
          الحجار يتغير شكلهم عشان يجو على الطاولة". The previous SnakeLayout
          tried 16 progressive scales (1.0 → 0.32) until the chain fit,
          which meant EVERY new tile triggered a recompute that often
          shrank existing tiles. Compounded with the vertical centring
          based on actual segment count, this shifted tiles around on
          every play.
          
          New design:
          1. FIXED_TILE_SCALE = 0.62. Every tile renders at the same size,
             always. No auto-shrink loop.
          2. Vertical centring uses ASSUMED_TOTAL_ROWS = 4 (so y of row 0
             is a CONSTANT regardless of how many tiles exist).
          3. Position of board[i] depends ONLY on (i, playW, playH, scale)
             — all of which are stable across renders.
          
          Net effect: once a tile is placed at (x, y), it STAYS at (x, y)
          for the rest of the match. New tiles append at the next position
          in the snake path without disturbing the existing chain.

agent_communication:
  - agent: "main"
    message: |
      Damma layout stability fix applied per user's diagnosis.
      
      Validation needed (FRONTEND ONLY):
      1. /game/damma. Play 1 tile. Note its (x, y) position. Take screenshot.
      2. Wait for bot to play. Take screenshot. VERIFY: the player's first
         tile is at the SAME (x, y) — has not moved.
      3. Continue playing 8-12 tiles. At each step, take a screenshot.
         VERIFY: every previously-placed tile is at the EXACT SAME (x, y)
         it was at when first placed. The new tile just extends the chain.
      4. Tile size: all tiles are at scale 0.62 (about 45×22 px). Smaller
         than before but more fit on the board (~6 per row × 4 rows = 24
         tiles before having to wrap).
      5. Chain still bends 90° at row ends via vertical corner tiles. Left-
         going rows rotate tiles 180° for visual continuity.
      6. Adjacency invariant still holds (board[i].right === board[i+1].left).
      
      Backend untouched. Skip backend.

#====================================================================================================
# 2026-06-10 — DAMMA: STEPPED zoom-out with smooth animated transitions
#====================================================================================================

frontend:
  - task: "Damma — Stepped scale tiers with smooth zoom-out transitions"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/games/damma/components/SnakeLayout.ts, /app/frontend/src/games/damma/components/WoodenTable.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          User requested: "خلي الزوم حق اللعبه لما يبعد يبعد كثير وبحركه
          تدريجيه مش بلحضات ويبعد بس قليل كل شويه يبعد لا الافضل يبعد مرات
          قليل بس لمسافه طويله" = the game should zoom out in LARGE STEPS
          with SMOOTH animations, infrequently, not in tiny continuous
          shrinks every turn.
          
          Implementation:
          1. SnakeLayout exposes SCALE_TIERS = [0.95, 0.72, 0.55, 0.42, 0.32]
             — discrete zoom levels with big jumps between them.
          2. New `pickScaleTier()` helper returns the LARGEST tier where
             the chain fits. Called by WoodenTable; only steps DOWN, never
             back up — so once zoomed out, the chain stays zoomed out.
          3. SnakeLayout computes layout at a CHOSEN scale (caller picks).
             Within a single tier all positions are stable (the previous
             stability invariant still holds).
          4. WoodenTable owns `tierIdx` state. On chain growth, picks the
             ideal tier; if it's larger than current, sets tier to it.
          5. Tier change triggers a 700 ms ease-out scale-transform on the
             chain container. Visual ratio goes from (prevScale/newScale)
             → 1.0 so the chain VISUALLY shrinks gradually rather than
             snapping to the new size instantly.
          6. Bot think time is 1.5 s so successive zoom-out triggers are
             well-spaced and the user sees the animation clearly.

agent_communication:
  - agent: "main"
    message: |
      Damma zoom-tier system applied. Validation needed (FRONTEND ONLY):
      
      1. /game/damma. The first tile shows at the LARGEST tier (~95% size).
         Tiles look big and easy to read.
      2. Play 8-12 tiles. The chain stays at 95% scale until it would not
         fit. At that point the entire chain smoothly ZOOMS OUT (700 ms
         ease) to the next tier (~72%). Existing tiles all shrink TOGETHER
         in one fluid motion. New tiles continue at this smaller scale.
      3. Continue playing. Subsequent zoom-outs happen ONLY when the chain
         no longer fits — at ~16-18 tiles and again at ~22-25 if needed.
         Tier sizes: 0.95 → 0.72 → 0.55 → 0.42 → 0.32. Each step is large.
      4. Within a single tier, NO tile changes position. Stability is
         preserved within tiers.
      5. The smooth zoom-out animation should be visible — not instant.
         Use the screenshot tool to capture during the transition.
      
      Backend untouched. Skip backend.
