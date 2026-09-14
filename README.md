# Premium Alerts

A tape-only options desk. Each contract is its own line. Shorts are percent of credit collected; longs are percent of debit paid. Alerts fire when a rung is crossed. **It does not place orders.** Keep your Close-at-20% / 50% working orders in tastytrade.

This GitHub page is the **source**. You download it, run it on your computer, and connect **your** tastytrade account. You are not using someone else’s desk.

## Words

- **GitHub / repo** — this website. It is just a shared folder of the app.
- **Node** — a small program you install once, like Chrome. It is what actually runs the app on your Mac or PC. Version **22** or newer.
- **Terminal** — the text window where you paste a few commands. On a Mac: Spotlight → type `Terminal`. On Windows: Start → `PowerShell`.

## What you get

- Pull from tastytrade (read-only OAuth)
- 45 DTE premium desk and a same-day SPX/SPXW desk
- Default profit rungs 20–100% and loss rungs 50–600%, all on
- Per-rung alert buffer so a name chopping around −50% does not spam
- Watch: on-screen toast, sound, optional [ntfy](https://ntfy.sh) on your phone
- Backup / restore in Settings so the book survives a browser reset

## 1. Install Node (once)

1. Open [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** button (it should say 22 or higher)
3. Run the installer. Next / Next / Finish
4. **Quit Terminal if it was already open, then open it again**
5. Paste this and press Return:

```bash
node -v
```

You want something like `v22.x.x`. If it says “command not found”, Node did not install — run the installer again and reopen Terminal.

## 2. Download this app

### Option A — easiest if you have never used git

1. On this GitHub page, click the green **Code** button
2. **Download ZIP**
3. Unzip it. You get a folder named `broker-dealer-trader-spy-main`
4. In Terminal:

**Mac**

```bash
cd ~/Downloads/broker-dealer-trader-spy-main
npm install
npm run dev
```

**Windows (PowerShell)**

```bash
cd $HOME\Downloads\broker-dealer-trader-spy-main
npm install
npm run dev
```

If the folder is not in Downloads, drag the folder onto the Terminal window after typing `cd ` (with a space) and press Return, then run `npm install` and `npm run dev`.

### Option B — if you already have git

```bash
git clone https://github.com/pinkdrummer/broker-dealer-trader-spy.git
cd broker-dealer-trader-spy
npm install
npm run dev
```

`npm install` takes a minute the first time. `npm run dev` starts the app. **Leave that window open.**

## 3. Open it

In Chrome, Safari, or Brave go to:

**http://localhost:8080**

That is your copy, on your machine. Nobody else can see it.

## 4. Your own tastytrade keys

Everyone makes **their own** OAuth app. Do not paste anyone else’s secret.

1. Log into tastytrade in a browser
2. **Manage → API**
3. Create a personal **OAuth2** app, **read-only**
4. Copy the **client secret**
5. Finish the grant so you get a **refresh token**
6. In Premium Alerts click **Settings**
7. Paste client secret + refresh token (account number optional)
8. Pull. You should see one row per option contract

Keys stay in **this browser**. They are not on GitHub.

If the pull fails, make a new grant. Do not debug by posting the secret.

## 5. Watch

Click **Watch**. Allow notifications. Click once so sound can play.

Alerts default on: 20–100% profit, 50–600% loss. Settings has a buffer (15 min default) so a name chopping around −50% does not spam.

## 6. Phone (optional)

Install [ntfy](https://ntfy.sh), make a private topic only you know, paste it in Settings, leave Watch on.

## 7. Backup

Settings → **Download backup**. Keep that file on your computer. If the browser clears data, restore it. Treat it like a password.

## What it will not do

- Place, cancel, or replace orders
- Flatten a trade
- Put your positions on GitHub

## License

Use it, fork it, make it yours. No warranty — it is a watch, not a broker.
