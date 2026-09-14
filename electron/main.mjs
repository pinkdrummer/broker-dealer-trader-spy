import { app, BrowserWindow, dialog } from "electron";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = 8080;
const URL = `http://${HOST}:${PORT}`;
const logPath = path.join(root, "premium-alerts.log");

app.setName("Premium Alerts");

let server = null;
let startedByUs = false;

function nodeArch(bin) {
  try {
    return execFileSync(bin, ["-p", "process.arch"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function findNode() {
  const nvmDir = path.join(os.homedir(), ".nvm", "versions", "node");
  const nvmNodes = [];
  try {
    for (const ver of fs.readdirSync(nvmDir)) {
      const p = path.join(nvmDir, ver, "bin", "node");
      if (fs.existsSync(p)) nvmNodes.push(p);
    }
  } catch {
    /* no nvm */
  }
  const candidates = [
    "/opt/homebrew/bin/node",
    ...nvmNodes,
    "/usr/local/bin/node",
    "node",
  ];
  const existing = candidates.filter((p) => p === "node" || fs.existsSync(p));
  const arm = existing.find((p) => nodeArch(p === "node" ? "node" : p) === "arm64");
  if (arm) return arm === "node" ? "node" : arm;
  return existing[0] ?? "node";
}

function childEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key === "ELECTRON_RUN_AS_NODE" || key.startsWith("ELECTRON_")) delete env[key];
  }
  env.PATH = [
    path.join(root, "node_modules/.bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    process.env.PATH ?? "",
  ].join(":");
  return env;
}

function ping() {
  return new Promise((resolve) => {
    const req = http.get(URL, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function logTail() {
  try {
    const text = fs.readFileSync(logPath, "utf8").trim();
    return text.slice(-1200) || "(empty log)";
  } catch {
    return "(no log yet)";
  }
}

async function ensureServer() {
  if (await ping()) return false;

  const node = findNode();
  const viteJs = path.join(root, "node_modules/vite/bin/vite.js");
  const wrapper = path.join(root, "scripts/with-app-env.mjs");
  if (!fs.existsSync(viteJs)) {
    throw new Error(
      "Vite is missing. In Terminal:\n\ncd " +
        root +
        "\nnpm install\n\nThen open Premium Alerts again.",
    );
  }

  fs.writeFileSync(
    logPath,
    `\n--- ${new Date().toISOString()} node=${node} arch=${nodeArch(node)} ---\n`,
    { flag: "a" },
  );
  const logFd = fs.openSync(logPath, "a");

  server = spawn(node, [wrapper, node, viteJs, "dev", "--host", HOST, "--port", String(PORT)], {
    cwd: root,
    env: childEnv(),
    stdio: ["ignore", logFd, logFd],
  });
  server.on("error", (err) => {
    fs.appendFileSync(logPath, `spawn error: ${err}\n`);
  });
  server.on("exit", (code, signal) => {
    fs.appendFileSync(logPath, `server exit code=${code} signal=${signal}\n`);
  });

  for (let i = 0; i < 120; i++) {
    if (await ping()) return true;
    if (server.exitCode != null) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  throw new Error("Premium Alerts could not start the desk.\n\n" + logTail());
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
