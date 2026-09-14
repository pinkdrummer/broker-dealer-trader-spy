import { app, BrowserWindow, dialog } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = 8080;
const URL = `http://${HOST}:${PORT}`;

app.setName("Premium Alerts");

let server = null;
let startedByUs = false;

function findNode() {
  for (const p of ["/usr/local/bin/node", "/opt/homebrew/bin/node"]) {
    if (fs.existsSync(p)) return p;
  }
  return "node";
}

function ping() {
  return new Promise((resolve) => {
    const req = http.get(URL, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(600, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer() {
  if (await ping()) return false;
  const env = {
    ...process.env,
    PATH: [
      path.join(root, "node_modules/.bin"),
      "/usr/local/bin",
      "/opt/homebrew/bin",
      process.env.PATH ?? "",
    ].join(":"),
  };
  server = spawn(
    findNode(),
    [
      path.join(root, "scripts/with-app-env.mjs"),
      "vite",
      "dev",
      "--host",
      HOST,
      "--port",
      String(PORT),
    ],
    { cwd: root, env, stdio: "ignore" },
  );
  server.on("error", () => {
    /* ensureServer timeout reports this */
  });
  for (let i = 0; i < 90; i++) {
    if (await ping()) return true;
    if (server.exitCode != null) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    "Premium Alerts could not start. Install Node from nodejs.org, then open Terminal, drag this folder, and run:\n\nnpm install",
  );
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: "Premium Alerts",
    backgroundColor: "#0e1014",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.loadURL(URL);
}

app.whenReady().then(async () => {
  try {
    startedByUs = await ensureServer();
    createWindow();
  } catch (err) {
    dialog.showErrorBox("Premium Alerts", err instanceof Error ? err.message : String(err));
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());

app.on("before-quit", () => {
  if (startedByUs && server && !server.killed) server.kill("SIGTERM");
});
