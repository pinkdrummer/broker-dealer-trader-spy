# Premium Alerts — signed Mac app

This is the shipping path for a real `.dmg` other people can drag into Applications.

Your current `Premium Alerts.app` inside the source folder is a **launcher**. It hunts for `electron/main.mjs`, starts Vite, and keeps working on your Apple Silicon Mac. That is fine for you. It is **not** what Gatekeeper will bless for strangers.

Until a signed, notarized build exists:

- Slack / friends get the GitHub repo (they clone their own) or the published web app
- Do not zip your Downloads folder
- Do not ship your tasty keys, a backup JSON, or a pre-filled Settings pane

Each user pastes **their own** tasty client secret + refresh token.

---

## What you are buying

**Apple Developer Program — Individual — $99 / year.**

- No D-U-N-S number
- Your legal name is the seller name if you later put anything on the App Store
- Same membership covers Mac **and** iOS. We only ship Mac first
- Identity check is usually 24–48 hours. Do not use a nickname or a company name in the first / last name fields. No P.O. box

Enroll in the **Apple Developer** app on your iPhone (cleanest identity check) or at [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/).

Use an Apple Account that already has two-factor authentication on.

When the welcome email lands, write down your **Team ID**. It is a 10-character string on [developer.apple.com/account](https://developer.apple.com/account). We need it for notarization.

---

## After you are approved — certificates

You want **Developer ID Application**, not “Apple Development” and not “Apple Distribution”.

- **Apple Development** = run on *your* Mac while coding
- **Apple Distribution** = Mac App Store
- **Developer ID Application** = a `.dmg` / `.zip` that lives outside the store and can be notarized. This is us.

### Create the certificate

1. Open **Keychain Access** on the Mac
2. Menu: **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority**
3. Your email, Common Name something like `Jonathan Hawken Developer ID`, “Saved to disk”. Leave CA Email blank
4. That writes a `.certSigningRequest`
5. In a browser: [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list) → **+**
6. Under Software pick **Developer ID Application** → Continue → upload the CSR → Download the `.cer`
7. Double-click the `.cer` so it lands in **login** keychain under My Certificates
8. Confirm you see a private key triangle under it. If the key is missing, the CSR was made on a different Mac — start over on this one

Check:

```bash
security find-identity -v -p codesigning
```

You want a line that starts with `Developer ID Application: <your name> (<TEAMID>)`.

### App-specific password (notarization)

1. [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords
2. Make one named `Premium Alerts notary`
3. Save it in a password manager. It is not your Apple ID password and it is not a tasty key

Optional later: an **App Store Connect API key** (`AuthKey_XXXX.p8`) instead of the Apple ID + app-specific password. Either works.

---

## What we will build (not done yet)

`electron-builder` produces:

| File | Who uses it |
| --- | --- |
| `Premium Alerts-1.x.x-arm64.dmg` | Humans. Drag to Applications |
| `Premium Alerts-1.x.x-arm64.zip` + `latest-mac.yml` | The app itself, for auto-update |

Bundle id stays `com.premiumalerts.desk` (already in the launcher Info.plist).

The packaged app must be **self-contained**. It cannot search Downloads for source, cannot call `npm install`, and cannot start Vite. Electron loads a production build and talks to tasty from that process. Settings still hold *the user’s* keys, never ours.

Hardened Runtime + the entitlements in `build/entitlements.mac.plist` are required for notarization.

### Commands you will run on the Mac — after enrollment

Secrets live in the environment or in `~/.premium-alerts-signing`, **never in git**.

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
# optional if the cert is not in the login keychain:
# export CSC_LINK="$HOME/.premium-alerts-signing/DeveloperID.p12"
# export CSC_KEY_PASSWORD="the-p12-password"

npm install-scripts approve electron fsevents   # npm 12 landmine — do this, not audit --force
npm install
npm run dist:mac
```

`electron-builder` will: pack → sign with Developer ID → notarize → staple → write the `.dmg` under `dist/`.

Then check Gatekeeper:

```bash
spctl --assess --verbose dist/mac-arm64/Premium\ Alerts.app
```

You want `accepted` / `source=Notarized Developer ID`.

---

## Updates after v1

Channel: **GitHub Releases** on `pinkdrummer/broker-dealer-trader-spy`.

Flow:

1. Bump `"version"` in `package.json` (semver: `1.0.0` → `1.0.1` for a fix, `1.1.0` for a desk feature)
2. `npm run dist:mac` on this Mac with the certs in keychain
3. Create a **published** (not draft, not pre-release) GitHub Release tagged `v1.0.1`
4. Attach the `.dmg`, the `.zip`, and `latest-mac.yml`
5. Installed copies check that feed on launch via `electron-updater`

Draft releases are invisible to the updater. Unsigned builds cannot auto-update on macOS. That is an Apple rule, not ours.

People who still run the folder launcher are unaffected. They keep double-clicking `Premium Alerts.app` next to the source.

---

## iOS (later, not this pass)

Same $99 already covers iOS. The Mac app does **not** become an iPhone app. Electron does not run on iOS.

Phone coverage today is **ntfy** from Watch. A real iOS app is a separate Swift / TestFlight project that would need its own tasty read-only grant and Keychain. We do that after the Mac `.dmg` is boring.

Mac App Store is also later. Store apps cannot just spawn a local Node server the way our launcher does, and review is a different fight. Developer ID + notarized `.dmg` is the right first storefront.

---

## Landmines — do not repeat

- npm 12 blocks Electron postinstall until `npm install-scripts approve electron` (and `fsevents`)
- Vite / rolldown needs `@rolldown/binding-darwin-arm64` on this Mac, not the x64 binding
- Electron must stay on arm64 (`arch -arm64`). A Rosetta Node gives a dead desk
- Nested `.app` next to source gets translocated — that is why the *launcher* searches Downloads / Documents / Desktop. The **notarized** app must not do that
- Do not `npm audit fix --force`
- Do not zip `~/Downloads` for Slack
- Do not commit screenshots, Word docs, `.grok/project_memory.md`, `.p12`, `.p8`, app-specific passwords, tasty secrets, or a backup JSON

---

## Your checklist this week

- [ ] Enroll Individual $99 in the Apple Developer app
- [ ] Wait for the welcome email / Team ID
- [ ] Create Developer ID Application cert on *this* Mac
- [ ] Create an app-specific password named `Premium Alerts notary`
- [ ] Tell me the Team ID (not the password, not the cert) when it is live
- [ ] We then land the self-contained Electron pack and run the first notarized `.dmg` on your machine

Keep using the folder app until that `.dmg` exists. Nothing about tasty, Watch, or the 20/50 credit rungs changes while Apple reviews the account.
