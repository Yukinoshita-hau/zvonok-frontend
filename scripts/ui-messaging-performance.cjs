// Real local API/STOMP/LiveKit acceptance; isolated accounts, synthetic audio only.
const { chromium } = require(
  process.env.STAGE10_PLAYWRIGHT ||
    "C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const base = process.env.UI_SHELL_BASE || "http://localhost:3001",
  api = "http://localhost:8080/api";
const phase = process.argv[2] || "after",
  out = "artifacts/stages/ui-redesign-stage2-evidence";
const credentials = path.join(os.tmpdir(), "zvonok-ui-shell-acceptance.json");
fs.mkdirSync(out, { recursive: true });
const results = [],
  errors = [];
const record = (scenario, details = {}) => {
  results.push({ scenario, ...details });
  console.log("PASS", scenario);
};
async function until(fn, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw Error("Acceptance condition timeout");
}
async function http(u, endpoint, method = "GET", data) {
  const r = await u.page.request.fetch(api + endpoint, {
    method,
    data,
    headers: { Authorization: `Bearer ${u.token}` },
  });
  assert.ok(r.ok(), `${method} ${endpoint}: ${r.status()}`);
  return r.status() === 204 ? null : r.json();
}
async function login(browser, account, register) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    permissions: ["microphone"],
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__pcs = [];
    const PC = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends PC {
      constructor(...args) {
        super(...args);
        window.__pcs.push(this);
      }
    };
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ =
      () =>
      (...enhancers) =>
      (createStore) =>
      (...args) => {
        const store = enhancers.reduceRight(
          (f, e) => e(f),
          createStore,
        )(...args);
        window.__shellStore = store;
        return store;
      };
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/auth/" + (register ? "register" : "login"));
  if (register) {
    await page.locator("[name=username]").fill(account.name);
    await page.locator("[name=email]").fill(account.name + "@test.invalid");
  } else await page.locator("[name=usernameOrEmail]").fill(account.name);
  await page.locator("[name=password]").fill(account.password);
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname ===
      "/api/auth/" + (register ? "register" : "login"),
  );
  await page.locator("form button").click();
  const r = await response;
  assert.ok(r.ok(), `authentication: ${r.status()}`);
  const u = {
    context,
    page,
    token: (await r.json()).accessToken,
    name: account.name,
  };
  await page.waitForFunction(
    () => window.__shellStore?.getState().websocket.status === "connected",
  );
  u.me = await http(u, "/users/my");
  return u;
}
async function dispatch(u, action) {
  await u.page.evaluate((a) => window.__shellStore.dispatch(a), action);
}
async function screenshot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `${out}/${phase}-${name}.png`,
    animations: "disabled",
  });
}
async function audioBytes(u) {
  return u.page.evaluate(async () => {
    const rows = (
      await Promise.all(
        window.__pcs.map(async (pc) => [...(await pc.getStats()).values()]),
      )
    ).flat();
    return {
      inbound: rows
        .filter((r) => r.type === "inbound-rtp" && r.kind === "audio")
        .reduce((n, r) => n + r.bytesReceived, 0),
      outbound: rows
        .filter((r) => r.type === "outbound-rtp" && r.kind === "audio")
        .reduce((n, r) => n + r.bytesSent, 0),
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let a;
  try {
    const fixture = JSON.parse(fs.readFileSync(credentials, "utf8"));
    a = await login(browser, fixture.accounts[0], false);
    const reuse = process.argv.includes("--reuse");
    const group = reuse
      ? {
          id: Number(
            process.env.UI_STAGE2_HISTORY_ROOM ||
              JSON.parse(
                fs.readFileSync(`${out}/performance-results.json`, "utf8"),
              ).results[0]?.roomId,
          ),
        }
      : await http(a, "/rooms/createGroup", "POST", {
          roomName: "Stage 2 · History " + Date.now(),
          roomMemberUsernames: [fixture.accounts[1].name],
        });
    const p = a.page;
    await p.goto(base + "/dm?roomId=" + group.id);
    await p.waitForFunction(
      () => window.__shellStore?.getState().websocket.status === "connected",
    );
    const start = Date.now();
    for (let batch = 0; batch < (reuse ? 0 : 26); batch++) {
      await p.evaluate(
        ({ roomId, batch }) => {
          for (let i = 0; i < 20; i++)
            window.__shellStore.dispatch({
              type: "message/sendMessage",
              payload: {
                roomId,
                content: {
                  content: `History ${batch * 20 + i}: compact messages and stable anchors`,
                  replyToMessageId: null,
                },
              },
            });
        },
        { roomId: group.id, batch },
      );
      await until(() =>
        p.evaluate(
          (count) =>
            window.__shellStore.getState().message.messages.length >= count,
          (batch + 1) * 20,
        ),
      );
    }
    if (reuse) {
      let cursor;
      for (let i = 0; i < 6; i++)
        cursor = await p.evaluate(
          async ({ roomId, beforeMessageId }) => {
            const { fetchRoomMessages } =
              await import("/src/store/slices/message.slice.ts");
            await window.__shellStore.dispatch(
              fetchRoomMessages({ roomId, beforeMessageId, limit: 100 }),
            );
            return window.__shellStore.getState().message.oldestMessageId;
          },
          { roomId: group.id, beforeMessageId: cursor },
        );
    }
    const root = p.locator('div[class^="_messages_"]').first();
    const rendered = await p.locator("[data-id]").count();
    assert.ok(rendered < 100, `rendered ${rendered} of 520`);
    assert.ok((await p.locator("[data-virtual-key]").count()) > 0);
    record("520 real STOMP messages retain virtualization", {
      roomId: group.id,
      rendered,
      elapsedMs: Date.now() - start,
      source: reuse ? "existing real STOMP history" : "live STOMP burst",
    });
    for (const [width, height] of [
      [1920, 1080],
      [1366, 768],
      [1024, 768],
      [1024, 600],
    ]) {
      await p.setViewportSize({ width, height });
      await root.evaluate((el) => (el.scrollTop = el.scrollHeight / 2));
      await p.waitForTimeout(200);
      assert.ok((await p.locator("[data-id]").count()) < 150);
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    await screenshot(p, "virtual-history");
    record("Virtual scrolling and resize at four viewports");
    // Load real paginated history again; the Redux thunk performs its usual HTTP requests.
    await p.goto(base + "/dm?roomId=" + group.id);
    await p.waitForFunction(
      () => window.__shellStore?.getState().message.status === "succeeded",
    );
    let oldest;
    for (let page = 0; page < 5; page++) {
      oldest = await p.evaluate(
        async ({ roomId, beforeMessageId }) => {
          const { fetchRoomMessages } =
            await import("/src/store/slices/message.slice.ts");
          await window.__shellStore.dispatch(
            fetchRoomMessages({ roomId, beforeMessageId, limit: 100 }),
          );
          return window.__shellStore.getState().message.oldestMessageId;
        },
        { roomId: group.id, beforeMessageId: oldest },
      );
    }
    assert.ok(
      await p.evaluate(
        () => window.__shellStore.getState().message.messages.length >= 500,
      ),
    );
    const beforeCount = await p.evaluate(
      () => window.__shellStore.getState().message.messages.length,
    );
    await root.evaluate((el) => {
      el.scrollTop = 300;
    });
    await p.waitForTimeout(300);
    const anchor = await root.evaluate((el) => {
      const top = el.getBoundingClientRect().top;
      const row = [...el.querySelectorAll("[data-id]")].find(
        (row) => row.getBoundingClientRect().top >= top,
      );
      return {
        id: row.dataset.id,
        offset: row.getBoundingClientRect().top - top,
      };
    });
    await p.evaluate(
      async ({ roomId, beforeMessageId }) => {
        const { fetchRoomMessages } =
          await import("/src/store/slices/message.slice.ts");
        await window.__shellStore.dispatch(
          fetchRoomMessages({ roomId, beforeMessageId, limit: 100 }),
        );
      },
      { roomId: group.id, beforeMessageId: oldest },
    );
    await until(() =>
      p.evaluate(
        (count) =>
          window.__shellStore.getState().message.messages.length > count,
        beforeCount,
      ),
    );
    await p.waitForTimeout(300);
    const anchorAfter = await root.evaluate((el, id) => {
      const row = el.querySelector(`[data-id="${id}"]`);
      return row?.getBoundingClientRect().top - el.getBoundingClientRect().top;
    }, anchor.id);
    assert.ok(
      Math.abs(anchorAfter - anchor.offset) < 3,
      `anchor drift ${anchorAfter - anchor.offset}`,
    );
    const grouping = await p.evaluate(() => {
      const m = window.__shellStore.getState().message.messages;
      return {
        loaded: m.length,
        unique: new Set(m.map((x) => x.id)).size,
        rows: document.querySelectorAll("[data-id]").length,
      };
    });
    assert.equal(grouping.loaded, grouping.unique);
    assert.ok(grouping.rows < 150);
    record(
      "Real history page prepend retains unique keys, grouping and scroll anchor",
      { ...grouping, anchorDriftPx: anchorAfter - anchor.offset },
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      `${out}/performance-results.json`,
      JSON.stringify({ results, errors, realBackend: true }, null, 2),
    );
  } catch (error) {
    if (a) await a.page.screenshot({ path: `${out}/performance-failure.png` });
    fs.writeFileSync(
      `${out}/performance-results.json`,
      JSON.stringify({ results, errors, failure: error.message }, null, 2),
    );
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
