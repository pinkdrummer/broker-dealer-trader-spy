# Premium Alerts

A tape-only options desk. Each contract is its own line. Shorts are percent of credit collected; longs are percent of debit paid. Alerts fire when a rung is crossed. **It does not place orders.** Keep your Close-at-20% / 50% working orders in tastytrade.

## What you get

- Pull from tastytrade (read-only OAuth)
- 45 DTE premium desk and a same-day SPX/SPXW desk
- Default profit rungs 20–100% and loss rungs 50–600%, all on
- Per-rung alert buffer so a name chopping around −50% does not spam
- Watch: on-screen toast, sound, optional [ntfy](https://ntfy.sh) on your phone
- Backup / restore in Settings so the book survives a browser reset

## 1. Install Node

You need **Node 22** (LTS is fine if it is 22+).

- Mac: [nodejs.org](https://nodejs.org) → LTS installer, or `brew install node`
- Windows: [nodejs.org](https://nodejs.org) → LTS installer
- Confirm in Terminal / PowerShell:

```bash
node -v
```

You want `v22` or higher.

## 2. Get the code

```bash
git clone https://github.com/pinkdrummer/broker-dealer-trader-spy.git
cd broker-dealer-trader-spy
npm install
npm run dev
```

Leave that window open. In the browser go to **http://localhost:8080**.

If `git` is missing on a Mac: install [Xcode Command Line Tools](https://developer.apple.com/xcode/) (`xcode-select --install`) or [Git](https://git-scm.com).

## 3. Your own tastytrade keys (required)

Everyone uses **their own** OAuth app. Do not paste anyone else’s secret or refresh token. Do not drop keys in Slack.

1. Log into tastytrade on the web.
2. **Manage → API**.
3. Create a **personal OAuth2 app**, read-only.
4. Copy the **client secret**.
5. Complete the grant so you get a **refresh token**.
6. In Premium Alerts, click **Settings**.
7. Paste:
   - **Client secret**
   - **Refresh token**
   - **Account number** (optional — leave blank if you only have one)
8. Save / pull. You should see your option lines, one row per contract.

Keys stay in **this browser only**. They are not in GitHub.

If the pull fails, the token is usually expired or the app is not read-only. Make a new grant; do not debug by posting the secret.

## 4. Turn on Watch

Click **Watch**. Allow notifications if the browser asks. Click once so sound can play (Safari and Chrome both block audio until you click).

Alerts are on by default at 20 / 30 / 40 / … / 100% profit and 50 / 100 / … / 600% loss. Change rungs in Settings or on a single row. The **alert buffer** (default 15 minutes) means a given rung on a given contract can only fire once in that window.

## 5. Phone alerts (optional)

1. Install [ntfy](https://ntfy.sh) on your phone.
2. Create a **private** topic name only you know.
3. Paste that topic in Settings.
4. Leave Watch on.

This is not SMS. Anyone who knows the topic name can see the pushes, so do not use `alerts` or your name.

## 6. Backup

Settings → **Download backup**. Keep that file on your machine. If the browser ever clears site data, restore it. The backup includes keys and the book — treat it like a password.

## What it will not do

- Place, cancel, or replace orders
- Flatten a trade
- Share your positions with GitHub or Slack

## License

Use it, fork it, make it yours. No warranty — it is a watch, not a broker.
