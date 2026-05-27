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
    working: false
    file: "/app/backend/rooms_voting.py"
    stuck_count: 1
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
  - task: "Phase 4 — PATCH /api/rooms/{id}/settings voting_mode + GET /api/youtube/extract"
    implemented: true
    working: false
    file: "/app/backend/rooms_voting.py"
    stuck_count: 1
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
                 every URL (valid YouTube URL, youtu.be short URL, AND invalid URL).
            rooms_voting.py line 184 declares the route as @api.post("/youtube/extract")
            with a JSON body model (YouTubeExtract.url), NOT a GET with query string.
            The review brief and (per the task title) the frontend expect GET ?url=.
            POST /api/youtube/extract  with body {"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
            DOES return 200 with {video_id:"dQw4w9WgXcQ", video_url, embed_url,
            thumbnail:"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"} — so the
            extraction logic itself works, only the HTTP method/signature is wrong.
            Fix: add a GET overload (or change to GET) that accepts ?url= as a query
            parameter and reuses extract_video_id().

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
  current_focus:
    - "Phase 4 — Vote start/cast/cancel WS flow + voting_mode policy"
    - "Phase 4 — PATCH /api/rooms/{id}/settings voting_mode + GET /api/youtube/extract"
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
