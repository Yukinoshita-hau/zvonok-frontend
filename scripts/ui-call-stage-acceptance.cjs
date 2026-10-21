// Uses the already bundled Playwright; no new dependency or production endpoint.
const { chromium } = require(
  process.env.STAGE10_PLAYWRIGHT ||
    "C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const BASE = process.env.UI_STAGE_BASE || "http://localhost:3001",
  API = process.env.UI_STAGE_API || BASE + "/api";
const out = process.env.UI_STAGE_EVIDENCE || (process.argv.includes('--settings') ? 'artifacts/stages/ui-redesign-stage4-evidence/browser' : "artifacts/stages/ui-redesign-stage3-evidence/browser");
fs.mkdirSync(out, { recursive: true });
const results = [],
  errors = [],
  serverUrls = [];
const participants = [];
const record = (scenario, details = {}) => {
  results.push({ scenario, status: "PASS", ...details });
  console.log("PASS", scenario);
};
async function until(fn, timeout = 15000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      const x = await fn();
      if (x) return x;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw last || Error("condition timeout");
}
async function http(u, path, method = "GET", body) {
  const r = await u.page.request.fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${u.token}` },
    data: body,
  });
  if (!r.ok()) throw Error(`${method} ${path.split("?")[0]}: ${r.status()}`);
  return r.status() === 204 ? null : r.json();
}
async function send(u, dest, payload) {
  await u.page.evaluate(
    ({ dest, payload }) => {
      const ws = window.__sockets.findLast(
        (s) => s.readyState === 1 && s.url.includes("/api/ws-raw"),
      );
      if (!ws) throw Error("no app WebSocket");
      const body = payload === undefined ? "" : JSON.stringify(payload);
      ws.send(
        `SEND\ndestination:${dest}\ncontent-type:application/json\ncontent-length:${new TextEncoder().encode(body).length}\n\n${body}\0`,
      );
    },
    { dest, payload },
  );
}
async function ready(u) {
  await u.page.waitForFunction(() =>
    window.__frames.some((f) => f.startsWith("CONNECTED")),
  );
  // Production disables Redux DevTools; inspect the existing React Provider for test assertions.
  await u.page.evaluate(() => {
    if (window.__callStore) return;
    const root = document.getElementById('root');
    const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
    const fiber = root[key];
    const stack = [fiber.stateNode?.current || fiber];
    while (stack.length) {
      const node = stack.pop();
      if (node.memoizedProps?.store?.getState) { window.__callStore = node.memoizedProps.store; return; }
      if (node.child) stack.push(node.child);
      if (node.sibling) stack.push(node.sibling);
    }
    throw Error('Redux Provider was not found');
  });
}
async function login(browser, name, reuseUser) {
  const context =
      reuseUser?.context ||
      (await browser.newContext({
        permissions: ["microphone", "camera"],
        viewport: { width: 1440, height: 1000 },
      })),
    page = await context.newPage();
  const u = { context, page, name, renewResponses: [] };
  participants.push(u);
  await page.addInitScript(() => {
    window.__sockets = [];
    window.__frames = [];
    window.__pcs = [];
    window.__mediaTracks = [];
    window.__displayTracks = [];
    window.__displayCaptures = 0;
    const getDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getDisplayMedia = async (...args) => {
      const stream = await getDisplayMedia(...args);
      window.__displayCaptures++;
      window.__displayTracks.push(...stream.getTracks());
      return stream;
    };
    window.__audioContexts = [];
    window.__timeline = [];
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ =
      () =>
      (...enhancers) =>
      (createStore) =>
      (reducer, ...args) => {
        const observed = (state, action) => {
          const next = reducer(state, action);
          if (
            action.type.startsWith("call/") ||
            action.type.startsWith("activeCall/")
          ) {
            const c = next.call;
            window.__timeline.push({
              time: Date.now(),
              action: action.type,
              event: action.payload?.type,
              reason: action.payload?.endReason,
              requestId: action.meta?.requestId,
              callId: c.callId,
              chatRoomId: c.chatRoomId,
              roomName: c.livekitRoomName,
              status: c.status,
              generation: c.mediaGeneration,
              hasToken: !!c.participantToken,
              tokenRequestId: c.tokenRequestId,
              restoreRequestId: c.restoreRequestId,
            });
          }
          return next;
        };
        const store = enhancers.reduceRight((f, e) => e(f), createStore)(
          observed,
          ...args,
        );
        window.__callStore = store;
        return store;
      };
    const Original = window.WebSocket;
    window.WebSocket = class extends Original {
      constructor(...a) {
        super(...a);
        window.__sockets.push(this);
        this.addEventListener("message", (e) =>
          window.__frames.push(String(e.data)),
        );
      }
    };
    const PC = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends PC {
      constructor(...a) {
        super(...a);
        window.__pcs.push(this);
      }
    };
    const gum = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (...a) => {
      const stream = await gum(...a);
      window.__mediaTracks.push(...stream.getTracks());
      return stream;
    };
    const AC = window.AudioContext;
    window.AudioContext = class extends AC {
      constructor(...a) {
        super(...a);
        window.__audioContexts.push(this);
      }
    };
  });
  page.on("request", (r) => {
    if (r.url().startsWith(API + "/calls/"))
      u.clientId = r.headers()["x-media-client-id"] || u.clientId;
  });
  page.on("response", async (r) => {
    if (r.url().includes("/media/renew"))
      u.renewResponses.push({
        at: Date.now(),
        status: r.status(),
        body: (await r.text()).replaceAll('"', "").trim(),
      });
  });
  page.on("requestfailed", (r) => {
    if (r.url().startsWith(API + "/calls/"))
      errors.push({
        user: name,
        path: new URL(r.url()).pathname,
        failure: r.failure(),
      });
  });
  page.on("response", async (r) => {
    if (r.url().startsWith(API + "/calls/") && r.ok()) {
      try {
        const d = await r.json();
        if (d.serverUrl) serverUrls.push(d.serverUrl);
      } catch {}
    }
  });
  page.on("pageerror", (e) =>
    errors.push({
      user: name,
      type: "pageerror",
      message: e.message.replace(/eyJ[\w.-]+/g, "[JWT]"),
    }),
  );
  page.on("console", (m) => {
    if (m.type() === "error")
      errors.push({
        user: name,
        type: "console",
        message: m.text().replace(/eyJ[\w.-]+/g, "[JWT]"),
      });
  });
  if (reuseUser) {
    u.token = reuseUser.token;
    await page.goto(BASE + "/dm");
    await ready(u);
    u.me = await http(u, "/users/my");
    return u;
  }
  const register =
      process.env.CALL_CHECK_ISOLATED === "1" &&
      !process.env.CALL_CHECK_DUP_LOGIN,
    action = register ? "register" : "login";
  await page.goto(BASE + "/auth/" + action);
  if (register) {
    await page.locator("[name=username]").fill(name);
    await page.locator("[name=email]").fill(name + "@test.invalid");
  } else await page.locator("[name=usernameOrEmail]").fill(name);
  await page
    .locator("[name=password]")
    .fill(process.env.LOCAL_CALL_TEST_PASSWORD);
  const response = page.waitForResponse(
    (r) => r.url() === API + "/auth/" + action,
  );
  await page.locator("form button").click();
  const r = await response;
  assert.equal(r.status(), register ? 201 : 200);
  u.token = (await r.json()).accessToken;
  await ready(u);
  u.me = await http(u, "/users/my");
  u.name = u.me.username;
  return u;
}
async function rtp(u) {
  return u.page.evaluate(async () => {
    const result = [];
    for (const pc of window.__pcs) {
      const rows = [...(await pc.getStats()).values()];
      result.push({
        state: pc.connectionState,
        ice: pc.iceConnectionState,
        gathering: pc.iceGatheringState,
        outbound: rows
          .filter((r) => r.type === "outbound-rtp")
          .map((r) => ({ kind: r.kind, bytes: r.bytesSent })),
        inbound: rows
          .filter((r) => r.type === "inbound-rtp")
          .map((r) => ({
            kind: r.kind,
            bytes: r.bytesReceived,
            frames: r.framesDecoded,
          })),
        pairs: rows
          .filter(
            (r) =>
              r.type === "candidate-pair" &&
              r.nominated &&
              r.state === "succeeded",
          )
          .map((r) => ({
            state: r.state,
            local: rows
              .filter((c) => c.id === r.localCandidateId)
              .map((c) => ({
                address: c.address,
                port: c.port,
                protocol: c.protocol,
                type: c.candidateType,
              })),
            remote: rows
              .filter((c) => c.id === r.remoteCandidateId)
              .map((c) => ({
                address: c.address,
                port: c.port,
                protocol: c.protocol,
                type: c.candidateType,
              })),
          })),
      });
    }
    return result;
  });
}
const bytes = (s, d) =>
  s
    .flatMap((p) => p[d])
    .filter((r) => r.kind === "audio")
    .reduce((n, r) => n + r.bytes, 0);

async function snapshot(u, label) {
  const details = await u.page.evaluate(() => ({
    timeline: window.__timeline,
    events: window.__frames
      .flatMap((f) => {
        try {
          return [
            JSON.parse(f.slice(f.indexOf("\n\n") + 2).replace(/\0$/, "")),
          ];
        } catch {
          return [];
        }
      })
      .filter((f) => f.type?.startsWith("CALL_")),
  }));
  fs.writeFileSync(
    out + "/" + label + "-" + u.name + ".json",
    JSON.stringify({ ...details, userId: u.me.id, rtp: await rtp(u) }, null, 2),
  );
  fs.writeFileSync(
    out + "/" + label + "-" + u.name + "-dom.txt",
    await u.page.locator("body").innerText(),
  );
}
async function livekitState(u) {
  return u.page.evaluate(() => {
    const root = document.getElementById("root"),
      key = Object.keys(root).find((k) => k.startsWith("__reactContainer$"));
    const fiber = root[key],
      stack = [fiber.stateNode?.current || fiber];
    while (stack.length) {
      const node = stack.pop(),
        room = node.memoizedProps?.value;
      if (room?.localParticipant && room.remoteParticipants instanceof Map)
        return {
          state: room.state,
          name: room.name,
          local: room.localParticipant.identity,
          remote: [...room.remoteParticipants.keys()],
        };
      if (node.child) stack.push(node.child);
      if (node.sibling) stack.push(node.sibling);
    }
    return null;
  });
}
async function connected(users) {
  for (const u of users)
    await until(async () => {
      const s = await rtp(u);
      return bytes(s, "inbound") > 0 && bytes(s, "outbound") > 0;
    }, 30000);
  const before = await Promise.all(users.map(rtp));
  await new Promise((r) => setTimeout(r, 2000));
  const after = await Promise.all(users.map(rtp));
  const rooms = await Promise.all(users.map(livekitState));
  for (let i = 0; i < users.length; i++) {
    assert.ok(bytes(after[i], "inbound") > bytes(before[i], "inbound"));
    assert.ok(bytes(after[i], "outbound") > bytes(before[i], "outbound"));
    assert.ok(
      after[i].some(
        (p) =>
          p.state === "connected" && ["connected", "completed"].includes(p.ice),
      ),
    );
    assert.equal(
      await users[i].page.evaluate(
        () => window.__callStore.getState().call.status,
      ),
      "in_call",
    );
    assert.equal(
      await users[i].page.locator('button[class*="participant-card"]').count(),
      users.length,
    );
    assert.equal(rooms[i]?.state, "connected");
    assert.equal(rooms[i].remote.length, users.length - 1);
    assert.equal(rooms[i].name, rooms[0].name);
  }
  return { before, after, rooms };
}
async function unmute(u) {
  await u.page
    .getByRole("button", { name: "Микрофон: выключен", exact: true })
    .click({ timeout: 10000 });
}
async function hangup(a, b) {
  await a.page.getByTitle("Завершить звонок", { exact: true }).click();
  for (const u of [a, b])
    await until(() =>
      u.page.evaluate(
        () =>
          window.__callStore.getState().call.callId === null &&
          window.__pcs.every((p) => p.connectionState === "closed") &&
          window.__mediaTracks.every((t) => t.readyState === "ended") &&
          window.__audioContexts.every((c) => c.state === "closed"),
      ),
    );
}

async function screenStats(u) {
  return u.page.evaluate(async () => {
    const video = document.querySelector(
      '[data-layout="screen"] [class*="main-screen"] video',
    );
    const id = video?.srcObject?.getVideoTracks()[0]?.id;
    const rows = (
      await Promise.all(
        window.__pcs.map(async (pc) => [...(await pc.getStats()).values()]),
      )
    ).flat();
    return rows
      .filter(
        (r) =>
          r.type === "inbound-rtp" &&
          r.kind === "video" &&
          r.trackIdentifier === id,
      )
      .map((r) => ({
        id: r.id,
        bytes: r.bytesReceived,
        frames: r.framesDecoded,
      }));
  });
}
async function shot(u, label) {
  await u.page.screenshot({
    path: out + "/" + label + ".png",
    animations: "disabled",
  });
}
async function state(u) {
  return u.page.evaluate(() => {
    const c = window.__callStore.getState().call;
    return {
      callId: c.callId,
      room: c.livekitRoomName,
      generation: c.mediaGeneration,
      ownership: c.mediaOwnership,
    };
  });
}
async function saveIdentity(u) {
  await u.page.evaluate(() => {
    window.__originalPcs = [...window.__pcs];
    window.__originalTracks = [...window.__mediaTracks];
    window.__captureCount = window.__mediaTracks.length;
    const root = document.getElementById("root"),
      key = Object.keys(root).find((k) => k.startsWith("__reactContainer$"));
    const fiber = root[key],
      stack = [fiber.stateNode?.current || fiber];
    while (stack.length) {
      const n = stack.pop(),
        r = n.memoizedProps?.value;
      if (r?.localParticipant && r.remoteParticipants instanceof Map) {
        window.__originalRoom = r;
        break;
      }
      if (n.child) stack.push(n.child);
      if (n.sibling) stack.push(n.sibling);
    }
  });
  u.identity = await state(u);
  u.client = u.clientId;
}
async function assertIdentity(u) {
  assert.deepEqual(await state(u), u.identity);
  assert.equal(u.clientId, u.client);
  assert.ok(
    await u.page.evaluate(() => {
      const root = document.getElementById("root"),
        key = Object.keys(root).find((k) => k.startsWith("__reactContainer$"));
      const fiber = root[key],
        stack = [fiber.stateNode?.current || fiber];
      let rooms = [];
      while (stack.length) {
        const n = stack.pop(),
          r = n.memoizedProps?.value;
        if (r?.localParticipant && r.remoteParticipants instanceof Map)
          rooms.push(r);
        if (n.child) stack.push(n.child);
        if (n.sibling) stack.push(n.sibling);
      }
      return (
        rooms.length === 1 &&
        rooms[0] === window.__originalRoom &&
        window.__originalRoom.state === "connected" &&
        window.__pcs.length === window.__originalPcs.length &&
        window.__pcs.every(
          (p, i) =>
            p === window.__originalPcs[i] && p.connectionState === "connected",
        ) &&
        window.__mediaTracks.length === window.__captureCount &&
        window.__originalTracks.every((t) => t.readyState === "live")
      );
    }),
  );
}
async function friend(a, b) {
  await send(a, "/app/friend/send/" + b.name);
  const r = await until(async () =>
    (await http(b, "/friends/requests/incoming")).find(
      (r) => r.senderUsername === a.name,
    ),
  );
  await send(b, "/app/friend/accept/" + r.requestId);
  return until(async () =>
    (await http(a, "/rooms/all")).find(
      (r) =>
        r.type === "PRIVATE" && r.members.some((m) => m.username === b.name),
    ),
  );
}
async function stage(u) {
  await u.page.locator("[data-call-stage]:visible").waitFor();
}
async function unmuteStage(u) {
  await until(() =>
    u.page
      .getByRole("button", { name: "Микрофон: выключен", exact: true })
      .first()
      .isEnabled(),
  );
  await u.page
    .getByRole("button", { name: "Микрофон: выключен", exact: true })
    .first()
    .click();
}
(async () => {
  process.env.CALL_CHECK_ISOLATED = "1";
  process.env.LOCAL_CALL_TEST_PASSWORD =
    require("node:crypto").randomUUID() + "aA1!";
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      "--enable-usermedia-screen-capturing",
      "--auto-select-desktop-capture-source=Entire screen",
    ],
  });
  let a, b, c, extra, edge;
  try {
    const suffix = Date.now();
    a = await login(browser, "stage3a" + suffix);
    b = await login(browser, "stage3b" + suffix);
    c = await login(browser, "stage3c" + suffix);
    const dm = await friend(a, b);
    await friend(a, c);
    const other = await until(async () =>
      (await http(a, "/rooms/all")).find(
        (r) =>
          r.type === "PRIVATE" && r.members.some((m) => m.username === c.name),
      ),
    );
    const group = await http(a, "/rooms/createGroup", "POST", {
      roomName: "Stage 3 · Команда",
      roomMemberUsernames: [b.name, c.name],
    });
    for (const u of [a, b]) {
      await u.page.goto(BASE + "/dm?roomId=" + dm.id);
      await ready(u);
    }
    await a.page
      .getByRole("button", { name: "Начать звонок", exact: true })
      .click();
    await b.page
      .getByRole("button", { name: "Принять", exact: true })
      .waitFor();
    await shot(a, "outgoing");
    await shot(b, "incoming");
    await b.page
      .getByRole("button", { name: "Устройства перед входом", exact: true })
      .click();
    await shot(b, "prejoin-devices");
    assert.equal(await b.page.evaluate(() => window.__mediaTracks.length), 0);
    await b.page.getByRole("button", { name: "Принять", exact: true }).click();
    for (const u of [a, b]) {
      await stage(u);
      await unmuteStage(u);
    }
    record("DM RTP and ICE", await connected([a, b]));
    if (process.argv.includes('--settings')) {
      await require('./ui-settings-acceptance.cjs').run({a,b,c,dm,group,out,record,until,http,send,shot,saveIdentity,assertIdentity,connected,hangup,rtp,bytes});
      return;
    }
    await shot(a, "dm-voice-grid");
    if (process.argv.includes("--screens")) {
      const share = async (u) => {
        await u.page
          .getByRole("button", { name: "Показать экран.", exact: false })
          .click();
        await u.page
          .getByRole("button", { name: "Начать показ", exact: true })
          .click();
      };
      await share(a);
      await until(async () => (await screenStats(b)).some((r) => r.frames > 0));
      await b.page
        .getByRole("button", { name: "Закрепить", exact: true })
        .click();
      const selected = await b.page.evaluate(
        () => window.__callStore.getState().call.selectedScreenTrackSid,
      );
      await share(b);
      await until(() => b.page.evaluate(() => window.__displayCaptures === 1));
      assert.equal(
        await b.page.evaluate(
          () => window.__callStore.getState().call.selectedScreenTrackSid,
        ),
        selected,
      );
      assert.equal(
        await b.page
          .getByRole("button", { name: "Открепить", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      record("explicit pin survives a second concurrent screen");
      await b.page
        .getByTitle("Открыть трансляцию " + b.name, { exact: true })
        .click();
      assert.notEqual(
        await b.page.evaluate(
          () => window.__callStore.getState().call.selectedScreenTrackSid,
        ),
        selected,
      );
      await shot(b, "multiple-screens-pin");
      await b.page
        .getByTitle("Открыть трансляцию " + a.name, { exact: true })
        .click();
      await saveIdentity(b);
      const before = await screenStats(b);
      await new Promise((r) => setTimeout(r, 2000));
      const after = await screenStats(b);
      assert.ok(
        after.some(
          (r) => r.frames > (before.find((x) => x.id === r.id)?.frames ?? 0),
        ),
      );
      await shot(b, "screen-focus");
      await b.page.getByRole("button", { name: "Кино", exact: true }).click();
      await new Promise((r) => setTimeout(r, 2800));
      await shot(b, "screen-cinema");
      await b.page.keyboard.press("Escape");
      await assertIdentity(b);
      await b.page.getByRole("button", { name: "Сетка", exact: true }).focus();
      await b.page.keyboard.press("Enter");
      await b.page
        .getByRole("button", { name: "Трансляция", exact: true })
        .focus();
      await b.page.keyboard.press("Enter");
      await assertIdentity(b);
      for (const u of [a, b])
        assert.equal(await u.page.evaluate(() => window.__displayCaptures), 1);
      record(
        "multiple real getDisplayMedia sources, selection, keyboard and Cinema",
        {
          before,
          after,
          captures: await Promise.all(
            [a, b].map((u) =>
              u.page.evaluate(() =>
                window.__displayTracks.map((t) => ({
                  kind: t.kind,
                  settings: t.getSettings(),
                  readyState: t.readyState,
                })),
              ),
            ),
          ),
        },
      );
      edge = await chromium.launch({
        channel: "msedge",
        headless: true,
        args: [
          "--use-fake-device-for-media-stream",
          "--use-fake-ui-for-media-stream",
        ],
      });
      process.env.CALL_CHECK_DUP_LOGIN = "1";
      extra = await login(edge, a.name);
      await until(() =>
        extra.page.evaluate(
          () => window.__callStore.getState().call.mediaOwnership === "PASSIVE",
        ),
      );
      await shot(extra, "edge-passive");
      assert.equal(await extra.page.evaluate(() => window.__pcs.length), 0);
      record("passive client has visible transfer and no local media");
      await saveIdentity(a);
      await a.page.getByRole('button',{name:'Свернуть звонок',exact:true}).first().click();
      assert.equal(await a.page.locator('video').count(),0);await shot(a,'compact-sidebar');
      await a.page.getByRole('button',{name:'Открыть звонок',exact:true}).click();await stage(a);await assertIdentity(a);
      record('final compact dock and restore preserve ongoing screen capture');

      await a.page
        .getByRole("button", {
          name: "Остановить демонстрацию экрана",
          exact: true,
        })
        .click();
      await b.page
        .getByRole("button", {
          name: "Остановить демонстрацию экрана",
          exact: true,
        })
        .click();
      await until(
        async () => (await b.page.locator('[data-layout="grid"]').count()) > 0,
      );
      await a.page.getByTitle("Завершить звонок", { exact: true }).click();
      for (const u of [a, b])
        await until(() =>
          u.page.evaluate(
            () =>
              window.__pcs.every((pc) => pc.connectionState === "closed") &&
              [...window.__mediaTracks, ...window.__displayTracks].every(
                (t) => t.readyState === "ended",
              ) &&
              window.__audioContexts.every((c) => c.state === "closed"),
          ),
        );
      record(
        "two-screen hangup cleans display, camera, audio and peer connections",
      );
      return;
    }
    await saveIdentity(a);
    await a.page
      .getByRole("button", { name: "Переписка звонка", exact: true })
      .click();
    const marker = "Stage3 real STOMP " + suffix;
    await a.page
      .getByRole("textbox", { name: "Сообщение", exact: true })
      .fill(marker);
    await a.page
      .getByRole("textbox", { name: "Сообщение", exact: true })
      .press("Enter");
    await b.page
      .getByRole("button", { name: "Переписка звонка", exact: true })
      .click();
    await b.page.getByText(marker, { exact: true }).last().waitFor();
    await shot(a, "call-chat");
    assert.equal(
      await a.page
        .getByRole("textbox", { name: "Сообщение", exact: true })
        .count(),
      1,
    );
    const row = a.page.locator("[data-id]").filter({ hasText: marker }).first();
    await row.hover();
    await row.getByRole("button", { name: "Ответить", exact: true }).click();
    await a.page
      .getByRole("textbox", { name: "Сообщение", exact: true })
      .fill(marker + " reply");
    await a.page
      .getByRole("textbox", { name: "Сообщение", exact: true })
      .press("Enter");
    await until(() =>
      b.page.evaluate(
        (text) =>
          window.__callStore
            .getState()
            .message.messages.some(
              (m) => m.content === text && m.replyToMessageId,
            ),
        marker + " reply",
      ),
    );
    await row.hover();
    await row
      .getByRole("button", { name: "Редактировать", exact: true })
      .click();
    await a.page
      .getByRole("textbox", { name: "Редактировать сообщение", exact: true })
      .fill(marker + " edited");
    await a.page
      .getByRole("textbox", { name: "Редактировать сообщение", exact: true })
      .press("Enter");
    await b.page
      .getByText(marker + " edited", { exact: true })
      .last()
      .waitFor();
    const edited = a.page
      .locator("[data-id]")
      .filter({ hasText: marker + " edited" })
      .first();
    await edited.hover();
    await edited.getByRole("button", { name: "Удалить", exact: true }).click();
    await until(() =>
      b.page.evaluate(
        (text) =>
          !window.__callStore
            .getState()
            .message.messages.some((m) => m.content === text),
        marker + " edited",
      ),
    );
    record("embedded DM send/reply/edit/delete through shared Redux/STOMP");
    await a.page
      .getByRole("button", { name: "Закрыть чат", exact: true })
      .click();
    assert.equal(
      await a.page
        .getByRole("textbox", { name: "Сообщение", exact: true })
        .count(),
      0,
    );
    await a.page
      .getByRole("button", { name: "Свернуть звонок", exact: true })
      .first()
      .click();
    await shot(a, "compact-sidebar");
    assert.equal(await a.page.locator("video").count(), 0);
    for (const [room, title] of [
      [other.id, c.name],
      [group.id, "Stage 3 · Команда"],
    ]) {
      await a.page
        .locator('aside[aria-label="Личные сообщения и группы"]')
        .getByRole("button")
        .filter({ has: a.page.getByText(title, { exact: true }) })
        .click();
      await until(() =>
        a.page.evaluate(
          (id) => window.__callStore.getState().message.activeRoomId === id,
          room,
        ),
      );
      await assertIdentity(a);
    }

    await a.page.getByRole("button", { name: "Друзья", exact: true }).click();
    await a.page
      .getByRole("button", { name: "Открыть звонок", exact: true })
      .click();
    await stage(a);
    await assertIdentity(a);
    record(
      "route and compact transitions retain Room, PCs, tracks, capture count and UUID",
    );
    for (const [width, height] of [
      [1920, 1080],
      [1366, 768],
      [1024, 768],
      [1024, 600],
    ]) {
      await a.page.setViewportSize({ width, height });
      await shot(a, `${width}x${height}`);
      assert.ok(
        await a.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const end = await a.page
        .getByTitle("Завершить звонок", { exact: true })
        .boundingBox();
      assert.ok(end && end.x >= 0 && end.y + end.height <= height);
    }
    await a.page.setViewportSize({ width: 1920, height: 1080 });
    await a.page.getByRole("button", { name: "Фокус", exact: true }).click();
    await shot(a, "voice-focus");
    await assertIdentity(a);
    await a.page.getByRole("button", { name: "Сетка", exact: true }).click();
    for (const u of [a, b])
      await u.page
        .getByRole("button", { name: "Камера выключена", exact: true })
        .click();
    await until(async () => (await a.page.locator("video").count()) === 2);
    await shot(a, "two-cameras");
    record("real synthetic cameras", {
      stats: await Promise.all([a, b].map(rtp)),
    });
    // Native getDisplayMedia; Chromium auto-selects desktop, no track replacement.
    try {
      await a.page
        .getByRole("button", { name: "Показать экран.", exact: false })
        .click();
      await a.page
        .getByRole("button", { name: "Начать показ", exact: true })
        .click({ timeout: 5000 });
      await until(
        async () =>
          (await b.page.locator('[data-layout="screen"]').count()) > 0,
        15000,
      );
      await until(async () => (await screenStats(b)).some((r) => r.frames > 0));
      const screenBefore = await screenStats(b);
      await new Promise((r) => setTimeout(r, 2000));
      const screenAfter = await screenStats(b);
      assert.ok(
        screenAfter.some(
          (r) =>
            r.frames > (screenBefore.find((x) => x.id === r.id)?.frames ?? 0),
        ),
      );
      await b.page
        .getByRole("button", { name: "Закрыть чат", exact: true })
        .click();
      await shot(b, "screen-focus");
      await saveIdentity(a);
      await saveIdentity(b);
      const sid = await b.page.evaluate(
        () => window.__callStore.getState().call.selectedScreenTrackSid,
      );
      await b.page.getByRole("button", { name: "Сетка", exact: true }).click();
      await assertIdentity(b);
      await b.page
        .getByRole("button", { name: "Трансляция", exact: true })
        .click();
      await a.page
        .getByRole("button", {
          name: "Остановить демонстрацию экрана",
          exact: true,
        })
        .waitFor();
      await b.page.getByRole("button", { name: "Кино", exact: true }).click();
      await new Promise((r) => setTimeout(r, 2800));
      assert.equal(
        await b.page
          .locator('[data-cinema="true"]')
          .getAttribute("data-controls-visible"),
        "false",
      );
      await shot(b, "screen-cinema");
      await b.page.keyboard.press("Escape");
      await assertIdentity(a);
      await assertIdentity(b);
      assert.equal(
        await b.page.evaluate(
          () => window.__callStore.getState().call.selectedScreenTrackSid,
        ),
        sid,
      );
      record("screen decoded frames grow and layouts retain capture", {
        screenBefore,
        screenAfter,
      });
      await a.page
        .getByRole("button", {
          name: "Остановить демонстрацию экрана",
          exact: true,
        })
        .click();
      await until(
        async () => (await b.page.locator('[data-layout="grid"]').count()) > 0,
      );
      record("screen stop returns to grid");
      record("screen share real getDisplayMedia", { rtp: await rtp(b) });
    } catch (e) {
      results.push({
        scenario: "physical desktop screen share",
        status: "BLOCKED",
        error: e.message,
      });
    }
    await a.page.getByRole("button", { name: "Сетка", exact: true }).click();
    await saveIdentity(a);
    await a.page.getByRole("button", { name: "Фокус", exact: true }).click();
    await a.page.getByRole("button", { name: "Кино", exact: true }).click();
    await a.page.keyboard.press("Escape");
    await assertIdentity(a);
    record("camera Focus/Cinema/Escape retains media");
    // Isolate HTTP/STOMP failure to diagnostic clients, never stop shared backend.
    await saveIdentity(a);
    let backendOffline = true;
    await a.page.route("**/api/**", (route) => route.abort());
    await a.page.routeWebSocket("**/api/ws-raw", (ws) => {
      if (backendOffline) ws.close();
      else ws.connectToServer();
    });
    await a.page.evaluate(() =>
      window.__sockets
        .filter((ws) => ws.url.includes("/api/ws-raw"))
        .forEach((ws) => ws.close()),
    );
    const before = await rtp(a),
      outageSamples = [];
    for (let sample = 0; sample < 6; sample++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const stats = await rtp(a);
      await assertIdentity(a);
      assert.ok(bytes(stats, "inbound") > bytes(before, "inbound"));
      outageSamples.push(stats);
    }
    const after = await rtp(a);
    await a.page.unroute("**/api/**");
    backendOffline = false;
    await until(
      () =>
        a.page.evaluate(
          () => window.__callStore.getState().websocket.status === "connected",
        ),
      30000,
    );
    await assertIdentity(a);
    record(
      "30s isolated backend HTTP/STOMP network outage retains RTP and Room",
      { before, after, outageSamples },
    );
    await a.page.getByTitle("Завершить звонок", { exact: true }).click();
    for (const u of [a, b])
      await until(() =>
        u.page.evaluate(
          () =>
            window.__callStore.getState().call.callId === null &&
            window.__pcs.every((p) => p.connectionState === "closed") &&
            window.__mediaTracks.every((t) => t.readyState === "ended") &&
            window.__audioContexts.every((c) => c.state === "closed"),
        ),
      );
    record("DM hangup cleanup");
    for (const u of [a, b, c]) {
      await u.page.goto(BASE + "/dm?roomId=" + group.id);
      await ready(u);
    }
    await a.page
      .getByRole("button", { name: "Начать звонок", exact: true })
      .click();
    for (const u of [b, c])
      await u.page
        .getByRole("button", { name: "Принять", exact: true })
        .click();
    for (const u of [a, b, c]) {
      await stage(u);
      await unmuteStage(u);
    }
    record("GROUP three clients RTP", await connected([a, b, c]));
    await shot(a, "group-grid");
    await a.page
      .getByRole("button", { name: "Переписка звонка", exact: true })
      .click();
    assert.equal(
      await a.page.evaluate(
        () => window.__callStore.getState().message.activeRoomId,
      ),
      group.id,
    );
    await a.page
      .getByRole("textbox", { name: "Сообщение", exact: true })
      .fill("GROUP " + marker);
    await a.page
      .getByRole("textbox", { name: "Сообщение", exact: true })
      .press("Enter");
    await b.page
      .getByRole("button", { name: "Переписка звонка", exact: true })
      .click();
    await b.page
      .getByText("GROUP " + marker, { exact: true })
      .last()
      .waitFor();
    await a.page
      .getByRole("button", { name: "Закрыть чат", exact: true })
      .click();
    await b.page
      .getByRole("button", { name: "Закрыть чат", exact: true })
      .click();
    record("embedded GROUP opens correct room");
    await a.page
      .getByRole("button", { name: "Микрофон: включён", exact: true })
      .first()
      .click();
    await a.page
      .getByRole("button", { name: "Микрофон: выключен", exact: true })
      .first()
      .click();
    record("GROUP mute/unmute shared owner");
    await saveIdentity(a);
    await a.page.getByRole("button", { name: "Фокус", exact: true }).click();
    await assertIdentity(a);
    await b.page.getByTitle("Завершить звонок", { exact: true }).click();
    await until(() =>
      b.page.evaluate(() => window.__callStore.getState().call.callId === null),
    );
    await b.page.getByRole("button", { name: "Войти", exact: true }).click();
    await stage(b);
    await unmuteStage(b);
    await a.page.getByRole("button", { name: "Сетка", exact: true }).click();
    record("GROUP rejoin", await connected([a, b, c]));
    await assertIdentity(a);
    edge = await chromium.launch({
      channel: "msedge",
      headless: true,
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    });
    process.env.CALL_CHECK_DUP_LOGIN = "1";
    extra = await login(edge, a.name);
    await until(
      () =>
        extra.page.evaluate(
          () => window.__callStore.getState().call.mediaOwnership === "PASSIVE",
        ),
      30000,
    );
    await shot(extra, "edge-passive");
    assert.equal(await extra.page.evaluate(() => window.__pcs.length), 0);
    await extra.page
      .getByRole("button", { name: "Перенести звонок сюда", exact: true })
      .click();
    await until(
      () =>
        extra.page.evaluate(
          () => window.__callStore.getState().call.mediaOwnership === "OWNED",
        ),
      30000,
    );
    await stage(extra);
    await unmuteStage(extra);
    await until(() =>
      a.page.evaluate(
        () => window.__callStore.getState().call.mediaOwnership === "PASSIVE",
      ),
    );
    record("Chrome Edge explicit transfer", await connected([extra, b, c]));
    await extra.page.getByTitle("Завершить звонок", { exact: true }).click();
    for (const u of [a, b, c, extra])
      await until(() =>
        u.page.evaluate(
          () =>
            window.__pcs.every((p) => p.connectionState === "closed") &&
            window.__mediaTracks.every((t) => t.readyState === "ended") &&
            window.__audioContexts.every((c) => c.state === "closed"),
        ),
      );
    record("GROUP/transfer cleanup");
  } catch (e) {
    results.push({ status: "FAIL", error: e.stack });
    process.exitCode = 1;
    for (const u of participants)
      if (!u.page.isClosed()) {
        await snapshot(u, "failure").catch(() => {});
        await shot(u, "failure-" + u.name).catch(() => {});
      }
    console.error(e.stack);
  } finally {
    // End only calls created in this run's diagnostic rooms.
    for (const u of participants)
      if (!u.page.isClosed()) {
        const call = await state(u).catch(() => null);
        if (call?.callId)
          await http(u, "/calls/end", "POST", { callId: call.callId }).catch(
            () => {},
          );
      }
    fs.writeFileSync(
      out +
        (process.argv.includes("--screens")
          ? "/screen-results.json"
          : "/results.json"),
      JSON.stringify({ results, errors }, null, 2),
    );
    await browser.close();
    if (edge) await edge.close();
  }
})();
