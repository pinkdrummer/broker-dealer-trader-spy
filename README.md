# Premium Alerts

A tape-only options desk. Each contract is its own line. Shorts are percent of credit collected; longs are percent of debit paid. Alerts fire when a rung is crossed. **It does not place orders.**

## What you get

- Pull from tastytrade (read-only OAuth)
- 45 DTE premium desk and a same-day SPX/SPXW desk
- Default profit rungs 20–100% and loss rungs 50–600%, all on
- Per-rung alert buffer so a name chopping around −50% does not spam
- Watch: on-screen toast, sound, optional [ntfy](https://ntfy.sh) on your phone
- Backup / restore in Settings so the book survives a browser reset

## Run it

Node 22+.

```bash
npm install
npm run dev
```

Open the app, Settings, paste **your** tastytrade OAuth client secret and refresh token, then pull. Keys stay in the browser. They are not in this repo.

## tastytrade

Create your own personal OAuth2 app in tastytrade (read-only). Everyone who uses this needs their own app and grant. Do not share secrets in Slack.

Keep your Close-at-20% / 50% working orders in tastytrade. This desk only watches.

## Phone alerts

Install ntfy, make a private topic, paste the topic in Settings, turn Watch on.

## License

Use it, fork it, make it yours. No warranty — it is a watch, not a broker.
