# Party4RApp — Build an Android APK with EAS

This guide shows the exact commands to generate a **standalone Android APK**
of Party4RApp using Expo's free EAS Build cloud (no Android Studio needed).

Estimated time: **15–20 minutes** for the first build (Gradle dependencies are
cached after the first run, subsequent builds are ~5–7 min).

---

## 0 — Prerequisites (one-time, ~5 min)

1. **Download the project code** to your local machine (Save to GitHub → clone,
   or download the workspace files).
2. **Install Node.js 18+** if you don't have it: <https://nodejs.org>
3. **Create a free Expo account** at <https://expo.dev/signup> (no credit card).
4. **Install the EAS CLI** globally:
   ```bash
   npm install -g eas-cli
   ```
5. **Log in** to your Expo account:
   ```bash
   eas login
   ```

---

## 1 — Link the project to your Expo account (one-time)

From the **frontend** folder of the cloned project:

```bash
cd party4r-app/frontend
eas init
```

The CLI prompts:
> ? Would you like to create a project for @yourname/party4r-app? **Yes**

EAS automatically writes the generated `projectId` into `app.json` under
`extra.eas.projectId` (replacing the placeholder).

---

## 2 — Trigger the APK build

Run this single command:

```bash
eas build --platform android --profile preview
```

The CLI uploads your code (without `node_modules`) to Expo's build farm. You
can close your terminal — the build runs in the cloud.

The `preview` profile in `eas.json` is preconfigured to produce a **release APK**
(not an AAB) so you can install it directly via ADB or sideload.

The build env defaults to the Emergent preview backend:
```
EXPO_PUBLIC_BACKEND_URL=https://partyapp-sync.preview.emergentagent.com
```
For a build that points at your own Render deployment, edit `eas.json` →
`build.preview.env.EXPO_PUBLIC_BACKEND_URL` first.

---

## 3 — Download the APK

When the build finishes you'll see something like:

```
✔ Build finished
🎉 Android app built successfully!
🔗 https://expo.dev/accounts/yourname/projects/party4r-app/builds/abc-123
```

Open that URL → click **"Install"** (gives you a QR for direct phone install)
or **"Download"** to grab the `.apk` file (~30–60 MB).

You can also list/download from the CLI:

```bash
eas build:list --platform android --limit 5
```

---

## 4 — Install on an Android phone

### Option A — Direct download (easiest)
1. Open the build's QR code on your phone (camera app).
2. Allow "Install from unknown sources" when prompted.
3. Tap the downloaded APK to install.

### Option B — ADB sideload
```bash
adb install ~/Downloads/party4r-app.apk
```

---

## 5 — Updating the APK later

Every code change requires a fresh build:

```bash
# Bump the version
# edit app.json → expo.version  e.g. "1.0.1"
# edit app.json → expo.android.versionCode  e.g. 2

eas build --platform android --profile preview
```

---

## Switching to Google Play production builds

When you're ready to publish on the Play Store, use the **production** profile
(builds an `.aab` Android App Bundle which Play Store requires):

```bash
eas build --platform android --profile production
```

Then submit:
```bash
eas submit --platform android
```
(requires Google Play Console + service account JSON — Expo docs walk you
through it: <https://docs.expo.dev/submit/android/>)

---

## Common gotchas

| Problem | Fix |
|---|---|
| `EAS_BUILD_USERNAME_REQUIRED` | Run `eas login` first |
| `projectId` invalid | Run `eas init` — it auto-fills the placeholder |
| Build fails on `expo-image-picker` permissions | Already configured in `app.json` |
| App crashes on launch with "Cannot connect" | Check `EXPO_PUBLIC_BACKEND_URL` in `eas.json` matches a live backend |
| Want to test before APK | Run `npx expo start --tunnel` and scan with Expo Go |

---

## Free-tier limits

- **Free Expo plan**: 30 builds / month, builds queue ~5 min during peak hours.
- **EAS Production plan ($19/mo)**: priority queue, longer build timeouts.
- Free tier is plenty for personal / beta testing.

---

## TL;DR — the 3 commands that matter

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

Then click the link in the terminal to download your `.apk`. 🎉
