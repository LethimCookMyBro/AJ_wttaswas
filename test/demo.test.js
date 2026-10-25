const { spawn } = require("child_process");
const path = require("path");
const { startFakeServer, json } = require("./helpers");

test("classroom demo retries twice before fallback using its actual startup configuration", async () => {
  const upstream = await startFakeServer((req, res) => json(res, 503, { message: "temporary outage" }));
  const child = spawn(process.execPath, ["tools/demo.js"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: "0", USE_REAL_DB: "", EXTERNAL_API_BASE_URL: upstream.url },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "", errors = "";
  child.stderr.on("data", (chunk) => { errors += chunk; });
  const stopped = new Promise((resolve) => child.once("exit", resolve));
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Demo did not start: ${errors}`)), 5000);
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const match = /Recipe demo (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
      child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Demo exited ${code}: ${errors}`)); });
    });
    const response = await fetch(`${base}/api/v1/external/meal-ideas?ingredient=chicken`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ source: "fallback", degraded: true, attempts: 3, reason: "UPSTREAM_5XX" });
    expect(upstream.state.hits).toBe(3);
    expect(output).not.toContain(process.env.JWT_SECRET);
    expect(output).not.toContain(process.env.DEMO_PASSWORD);
  } finally {
    child.kill("SIGTERM");
    await stopped;
    await upstream.close();
  }
}, 10000);
