import { execSync, spawn } from "node:child_process"
import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const nextBin = require.resolve("next/dist/bin/next")

const killPorts = () => {
  try {
    execSync(
      `powershell -NoProfile -Command "3000..3010 | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue | ForEach-Object { if ($_.OwningProcess -gt 0) { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } }"`,
      { stdio: "ignore" },
    )
  } catch {
    /* ports may already be free */
  }
}

killPorts()

const nextDir = path.join(root, ".next")
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true })
  console.log("Removed .next cache")
}

console.log("Starting Next.js dev server on http://localhost:3000 …")

const child = spawn(process.execPath, [nextBin, "dev"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
})

child.on("exit", (code) => process.exit(code ?? 0))

process.on("SIGINT", () => child.kill("SIGINT"))
process.on("SIGTERM", () => child.kill("SIGTERM"))
