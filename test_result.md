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
  Add a clean package of UX features to the existing Party4RApp:
  1. In-Room Volume Control Center: overlay panel inside the room with a slider for YouTube video volume.
  2. In-Room Friends Shortcut: button inside the room to quickly view the Friends Hub (list, search, requests) without leaving.
  3. Exit Confirmation Dialog: when "Leave Room" is pressed, show a center popup "Are you sure you want to leave?" with Yes/No choices.
  4. Arabic language support: a Settings gear icon at the top-right of the Profile screen that opens a dedicated Settings menu containing a working English/Arabic toggle (room for future settings).
  5. (CANCELLED by user) — Voice chat / microphone push-to-talk is dropped entirely.

frontend:
  - task: "Settings gear icon on Profile -> Settings screen with Language toggle (EN/AR)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/profile.tsx, /app/frontend/app/settings.tsx, /app/frontend/src/context/LanguageContext.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added floating gear icon (testID profile-settings-gear) at top-right of profile screen that navigates to /settings. Settings screen has an EN/AR language toggle; on switch persists choice and triggers I18nManager.forceRTL with a 'restart required' alert when needed."
  - task: "In-room header — Settings + Friends shortcut buttons"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/room/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added two new header buttons (testIDs room-settings-open, room-friends-open) next to fullscreen. The gear icon switches to volume-mute (red) when video volume is 0. Mic/voice UI completely removed."
  - task: "Video Volume control (YouTube IFrame postMessage)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/room/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Settings modal exposes a 0/20/40/60/80/100 stepper. Each change injects player.setVolume + player.mute/unMute via injectJavaScript. Voice volume section was removed per user cancellation."
  - task: "In-Room Friends Modal"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/room/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Header people icon opens a pageSheet modal that fetches /api/friends and lists incoming + friend rows without leaving the room."
  - task: "Leave Room confirmation alert"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/room/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Leaving the room now opens a translated Alert with Stay/Leave buttons. Closes the WS only after confirm."
  - task: "App-wide English/Arabic translations across tabs, home, profile, room"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/context/LanguageContext.tsx + screens"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Tabs labels, home greeting/title/empty state, profile section labels, room header/status/composer/empty state and exit alert are all driven through t()."

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "Settings gear icon on Profile -> Settings screen with Language toggle (EN/AR)"
    - "In-room header — Settings + Friends shortcut buttons"
    - "Video Volume control (YouTube IFrame postMessage)"
    - "In-Room Friends Modal"
    - "Leave Room confirmation alert"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Implemented the new UX package WITHOUT voice/mic (cancelled by user). Highlights:
      • Profile screen gains a floating gear icon (top-right) → /settings.
      • Settings screen has a clean EN/AR language toggle with a restart-required alert when RTL flips.
      • Room header now exposes Settings (gear) + Friends (people) buttons + existing fullscreen + back.
      • Settings modal in room: 0–100 video volume stepper that drives the YouTube iframe via postMessage.
      • Friends modal in room reuses /api/friends (no new endpoints required).
      • Leave confirmation uses a translated Stay/Leave Alert before disconnecting the WS.
      • New i18n keys added; LanguageContext now persists choice and toggles I18nManager.forceRTL.
      Test credentials: testuser1 / pass1234. No backend changes were made in this iteration.
