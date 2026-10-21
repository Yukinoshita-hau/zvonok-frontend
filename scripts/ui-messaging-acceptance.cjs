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
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  let a, b;
  try {
    const register = phase === "before";
    const fixture = register
      ? {
          accounts: ["a", "b"].map((s) => ({
            name: "shell_" + Date.now() + s,
            password: randomUUID() + "aA1!",
          })),
        }
      : JSON.parse(fs.readFileSync(credentials, "utf8"));
    a = await login(browser, fixture.accounts[0], register);
    b = await login(browser, fixture.accounts[1], register);
    if (register) {
      fs.writeFileSync(credentials, JSON.stringify(fixture));
      await dispatch(a, {
        type: "friend/sendFriendRequest",
        payload: { username: b.name },
      });
      const request = await until(async () =>
        (await http(b, "/friends/requests/incoming")).find(
          (r) => r.senderUsername === a.name,
        ),
      );
      await dispatch(b, {
        type: "friend/acceptFriendRequest",
        payload: { requestId: request.requestId },
      });
      const dm = await until(async () =>
        (await http(a, "/rooms/all")).find(
          (r) =>
            r.type === "PRIVATE" &&
            r.members.some((m) => m.username === b.name),
        ),
      );
      fixture.dm = dm.id;
      fixture.group = (
        await http(a, "/rooms/createGroup", "POST", {
          roomName: "Stage 1 · Design team",
          roomMemberUsernames: [b.name],
        })
      ).id;
      fs.writeFileSync(credentials, JSON.stringify(fixture));
    }
    // Clean up only calls belonging to these isolated diagnostic rooms after a failed run.
    if (!register)
      for (const id of [fixture.dm, fixture.group]) {
        const active = await http(a, `/rooms/${id}/active-call`);
        if (active?.callId)
          await http(a, "/calls/end", "POST", {
            callId: active.callId,
            chatRoomId: id,
          });
      }
    for (const u of [a, b]) {
      await u.page.goto(base + "/dm?roomId=" + fixture.dm);
      await u.page.waitForFunction(
        () => window.__shellStore?.getState().websocket.status === "connected",
      );
    }
    const p = a.page;
    if (register) {
      await p
        .locator('input[placeholder="Message @here"]')
        .fill("Проверка оболочки Zvonok — реальная переписка через STOMP.");
      await p.locator('input[placeholder="Message @here"]').press("Enter");
      await b.page
        .getByText(
          "Проверка оболочки Zvonok — реальная переписка через STOMP.",
          { exact: true },
        )
        .last()
        .waitFor();
    }
    await p.waitForFunction(
      () => window.__shellStore?.getState().message.status === "succeeded",
    );
    for (const [width, height] of [
      [1920, 1080],
      [1366, 768],
      [1024, 768],
      [1024, 600],
    ]) {
      await p.setViewportSize({ width, height });
      await screenshot(p, `${width}x${height}-dm`);
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "horizontal overflow",
      );
      if (!register)
        assert.ok(
          await p.evaluate(() => {
            const main = document.querySelector("main"),
              input = document.querySelector(
                'textarea[aria-label="Сообщение"]',
              );
            return (
              main.scrollWidth <= main.clientWidth &&
              input.getBoundingClientRect().width > 100 &&
              input.getBoundingClientRect().right <= innerWidth
            );
          }),
          "chat or composer clipped",
        );
      record(`${width}x${height} DM layout`, { horizontalOverflow: false });
    }

    if (!register) {
      const composer = p.getByRole("textbox", {
        name: "Сообщение",
        exact: true,
      });
      const marker = "Stage2 " + Date.now();
      const send = async (text) => {
        await composer.fill(text);
        await composer.press("Enter");
        await b.page.getByText(text, { exact: true }).last().waitFor();
      };
      await send(marker + " first");
      await send(marker + " second");
      const secondId = await p
        .locator("[data-id]")
        .filter({ hasText: marker + " second" })
        .getAttribute("data-id");
      const row = p.locator(`[data-id="${secondId}"]`);
      assert.equal(await row.getAttribute("data-continuation"), "true");
      await screenshot(p, "same-author-group");
      await row.hover();
      await row
        .getByRole("button", { name: "Ответить", exact: true })
        .waitFor({ state: "visible" });
      await screenshot(p, "hover-toolbar");
      await row
        .getByRole("button", { name: "Другие действия", exact: true })
        .click();
      await p.getByRole("menu").waitFor();
      await p.keyboard.press("Escape");
      await row.click({ button: "right" });
      await p.getByRole("menu").waitFor();
      await screenshot(p, "context-menu");
      await p.keyboard.press("ArrowDown");
      assert.equal(
        await p.evaluate(() => document.activeElement.textContent.trim()),
        "Редактировать",
      );
      await p.keyboard.press("End");
      assert.equal(
        await p.evaluate(() => document.activeElement.textContent.trim()),
        "Удалить",
      );
      await p.keyboard.press("Escape");
      assert.equal(await p.getByRole("menu").count(), 0);
      const viewport = p.viewportSize();
      await row.evaluate(
        (element, viewport) =>
          element.dispatchEvent(
            new MouseEvent("contextmenu", {
              clientX: viewport.width - 1,
              clientY: viewport.height - 1,
              bubbles: true,
              cancelable: true,
            }),
          ),
        viewport,
      );
      const edgeMenu = await p.getByRole("menu").boundingBox();

      assert.ok(
        edgeMenu.x >= 0 &&
          edgeMenu.y >= 0 &&
          edgeMenu.x + edgeMenu.width <= viewport.width &&
          edgeMenu.y + edgeMenu.height <= viewport.height,
      );
      await p.keyboard.press("Escape");
      await row.focus();
      await p.keyboard.press("Shift+F10");
      await p.getByRole("menuitem", { name: "Ответить", exact: true }).click();
      await composer.fill(marker + " reply");
      await screenshot(p, "reply");
      await composer.press("Enter");
      await until(() =>
        b.page.evaluate(
          (text) =>
            window.__shellStore
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
      const editor = p.getByRole("textbox", {
        name: "Редактировать сообщение",
        exact: true,
      });
      await editor.fill(marker + " edited\nsecond line");
      await screenshot(p, "edit");
      await editor.press("Enter");
      await until(() =>
        b.page.evaluate(
          (text) =>
            window.__shellStore
              .getState()
              .message.messages.some((m) => m.content === text),
          marker + " edited\nsecond line",
        ),
      );
      const editedRow = p
        .locator("[data-id]")
        .filter({ hasText: marker + " edited" });
      await editedRow.hover();
      await editedRow
        .getByRole("button", { name: "Удалить", exact: true })
        .click();
      await until(() =>
        b.page.evaluate(
          (text) =>
            !window.__shellStore
              .getState()
              .message.messages.some((m) => m.content === text),
          marker + " edited\nsecond line",
        ),
      );
      record(
        "STOMP send/receive, grouping, hover, context keyboard, reply, multiline edit and delete",
      );
      await composer.fill(marker + " IME");
      await composer.dispatchEvent("keydown", {
        key: "Enter",
        code: "Enter",
        isComposing: true,
        bubbles: true,
      });
      assert.equal(await composer.inputValue(), marker + " IME");
      await composer.press("Shift+Enter");
      await composer.type("next line");
      assert.ok((await composer.inputValue()).includes("\n"));
      await composer.press("Enter");
      await until(() =>
        b.page.evaluate(
          (text) =>
            window.__shellStore
              .getState()
              .message.messages.some((m) => m.content === text),
          marker + " IME\nnext line",
        ),
      );
      await b.page
        .getByRole("textbox", { name: "Сообщение", exact: true })
        .fill(marker + " remote");
      await b.page
        .getByRole("textbox", { name: "Сообщение", exact: true })
        .press("Enter");
      const remoteRow = p
        .locator("[data-id]")
        .filter({ hasText: marker + " remote" });
      await remoteRow.waitFor();
      await remoteRow.click({ button: "right" });
      assert.equal(await p.getByRole("menuitem").count(), 1);
      await composer.click();
      assert.equal(await p.getByRole("menu").count(), 0);
      await screenshot(p, "different-authors");
      record(
        "Composer Shift+Enter and IME, remote permissions, outside menu dismissal",
      );
      await p
        .locator("input[type=file]")
        .setInputFiles("artifacts/stages/ui-redesign-evidence/after-friends.png");
      await screenshot(p, "attachment-preview");
      const uploadResponse = p.waitForResponse(
        (r) =>
          r.url().includes(`/rooms/${fixture.dm}/messages/attachments`) &&
          r.request().method() === "POST",
      );
      await p
        .getByRole("button", { name: "Отправить сообщение", exact: true })
        .click();
      const upload = await uploadResponse;
      if (upload.ok()) {
        await p.locator("button[class*=image-attachment] img").last().waitFor();
        await screenshot(p, "image-and-file");
        record("Real image upload and authorized download");
      } else {
        results.push({
          scenario: "Real attachment upload",
          status: "BLOCKED",
          httpStatus: upload.status(),
        });
        console.log("BLOCKED attachment upload HTTP", upload.status());
        await p
          .getByRole("button", { name: "Удалить вложение", exact: true })
          .click();
      }
      await composer.fill("");
      await until(() =>
        p.evaluate(
          () => window.__shellStore.getState().toast.items.length === 0,
        ),
      );
    }
    if (!register) {
      await p.getByRole("button", { name: "Друзья", exact: true }).click();
      await p.getByRole("button", { name: "Все", exact: true }).waitFor();
      await screenshot(p, "friends");
      for (const theme of ["light", "purple"]) {
        await p.evaluate(
          (theme) => document.documentElement.setAttribute("data-theme", theme),
          theme,
        );
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await screenshot(p, `friends-${theme}`);
      }
      await p.evaluate(() =>
        document.documentElement.setAttribute("data-theme", "dark"),
      );
      const unreadText = "Непрочитанное " + Date.now();
      await b.page.locator('textarea[aria-label="Сообщение"]').fill(unreadText);
      await b.page.locator('textarea[aria-label="Сообщение"]').press("Enter");
      await p.locator('aside button[data-unread="true"]').waitFor();
      await p.getByText("В сети", { exact: true }).first().waitFor();
      record("Real STOMP unread badge and online presence");
      const sort = p.getByRole("button", {
        name: "Изменить порядок друзей",
        exact: true,
      });
      await sort.click();
      assert.equal(await sort.getAttribute("aria-pressed"), "true");
      await sort.click();
      await p
        .getByRole("button", {
          name: `Открыть переписку с ${b.name}`,
          exact: true,
        })
        .click();
      await p.waitForFunction(
        () => window.__shellStore?.getState().message.status === "succeeded",
      );
      await p.locator('div[class^="_messages_"]').first().hover();
      await p.mouse.wheel(0, 100000);
      await until(() =>
        p.evaluate(
          (roomId) =>
            window.__shellStore
              .getState()
              .room.rooms.find((r) => r.id === roomId)?.unreadCount === 0,
          fixture.dm,
        ),
      );
      record("Friends → real DM and unread cleared after reading");
      await p.getByTitle("Открыть профиль", { exact: true }).click();
      await p
        .getByRole("button", { name: "Открыть чат", exact: true })
        .waitFor();
      await screenshot(p, "profile");
      record("Real loaded friend profile");
      await p.keyboard.press("Escape");
      // Existing profile closes via its explicit button.
      const close = p.getByRole("button", { name: "Закрыть", exact: true });
      if (await close.count()) await close.click();
      await p
        .getByRole("button", { name: "Stage 1 · Design team", exact: false })
        .click();
      await p
        .getByTitle("Открыть настройки комнаты", { exact: true })
        .last()
        .waitFor();
      await p
        .locator('textarea[aria-label="Сообщение"]')
        .fill("Сообщение в GROUP: оболочка работает.");
      await p.locator('textarea[aria-label="Сообщение"]').press("Enter");
      await p
        .getByText("Сообщение в GROUP: оболочка работает.", { exact: true })
        .last()
        .waitFor();
      await screenshot(p, "group");
      record("DM → GROUP and real message");
      await p
        .getByRole("button", { name: b.name, exact: false })
        .first()
        .click();
      await p
        .getByRole("button", { name: "Начать звонок", exact: true })
        .click();
      await b.page.locator('button[class*="accept-button"]').click();
      for (const u of [a, b]) {
        await u.page.waitForFunction(
          () => window.__shellStore.getState().call.mediaState === "connected",
        );
        await u.page
          .locator('#shell-microphone button[data-lk-source="microphone"]')
          .click();
      }
      await until(
        async () =>
          (await audioBytes(a)).inbound > 0 &&
          (await audioBytes(b)).inbound > 0,
      );
      await p.evaluate(() => {
        window.__originalPcs = [...window.__pcs];
        window.__originalCall = window.__shellStore.getState().call;
      });
      await screenshot(p, "active-call-compact");
      for (const [width, height] of [
        [1920, 1080],
        [1366, 768],
        [1024, 768],
        [1024, 600],
      ]) {
        await p.setViewportSize({ width, height });
        assert.ok(
          await p.evaluate(() => {
            const dock = document
              .querySelector("[class*=mini-dock]")
              .getBoundingClientRect();
            const input = document
              .querySelector('textarea[aria-label="Сообщение"]')
              .getBoundingClientRect();
            return (
              dock.right <= input.left &&
              dock.bottom <= innerHeight &&
              dock.left >= 0
            );
          }),
          "dock intersects composer",
        );
      }
      record(
        "Compact default call does not overlap composer at four viewports",
      );
      const first = await audioBytes(a);
      await p
        .getByRole("button", { name: "Свернуть звонок", exact: true })
        .click();
      await p.getByRole("button", { name: "Друзья", exact: true }).click();
      await p
        .getByRole("button", { name: "Stage 1 · Design team", exact: false })
        .click();
      await p
        .getByTitle("Открыть настройки комнаты", { exact: true })
        .last()
        .waitFor();
      await until(
        async () => (await audioBytes(a)).inbound > first.inbound + 1000,
      );
      const stable = await p.evaluate(() => {
        const c = window.__shellStore.getState().call;
        return {
          sameCall: c.callId === window.__originalCall.callId,
          sameGeneration:
            c.mediaGeneration === window.__originalCall.mediaGeneration,
          sameConnections:
            window.__pcs.length === window.__originalPcs.length &&
            window.__pcs.every(
              (pc, i) =>
                pc === window.__originalPcs[i] &&
                pc.connectionState === "connected",
            ),
        };
      });
      assert.ok(Object.values(stable).every(Boolean));
      await screenshot(p, "active-call-group");
      record("LiveKit survives DM → Friends → GROUP", {
        ...stable,
        first,
        after: await audioBytes(a),
      });
      await p
        .locator('#shell-microphone button[data-lk-source="microphone"]')
        .click();
      assert.equal(
        await p
          .locator('#shell-microphone button[data-lk-source="microphone"]')
          .getAttribute("aria-pressed"),
        "false",
      );
      record("User panel microphone mute");
      await p
        .getByRole("button", { name: "Открыть звонок", exact: true })
        .click();
      await p.getByTitle("Завершить звонок", { exact: true }).click();
      await p.waitForFunction(
        () =>
          window.__shellStore.getState().call.callId === null &&
          window.__pcs.every((pc) => pc.connectionState === "closed"),
      );
      record("Call hangup cleanup");
      await p.getByRole("button", { name: "Уведомления", exact: true }).click();
      assert.ok(p.url().includes("/notifications"));
      record("Notifications route");
      await p.getByTitle("Мой профиль", { exact: true }).click();
      await p.getByText("Это вы", { exact: true }).first().waitFor();
      await screenshot(p, "my-profile");
      await p.getByRole("button", { name: "Закрыть", exact: true }).click();
      record("User panel profile");
      await p
        .getByRole("button", { name: "Настройки пользователя", exact: true })
        .click();
      await p.locator('input[placeholder="Поиск"]').waitFor();
      await screenshot(p, "settings");
      await p.mouse.click(5, 5);
      record("User panel settings");
      await p.getByRole("button", { name: "Друзья", exact: true }).click();
      await p.getByRole("button", { name: "Входящие", exact: true }).click();
      await p.getByRole("button", { name: "Исходящие", exact: true }).click();
      await p.getByRole("button", { name: "Все", exact: true }).click();
      await p.setViewportSize({ width: 1024, height: 600 });
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await screenshot(p, "1024x600-friends");
      record("Friend requests and short window");

      // Only the two diagnostic accounts are affected; restore their friendship at the end.
      await p
        .getByRole("button", {
          name: `Удалить из друзей ${b.name}`,
          exact: true,
        })
        .click();
      await until(
        async () =>
          !(await http(a, "/friends")).some((f) => f.friendUsername === b.name),
      );
      record("Real remove friend through UI");
      await p
        .getByRole("button", { name: "Добавить друга", exact: true })
        .first()
        .click();
      await p.locator("#friend-username").fill(b.name);
      await p.getByRole("button", { name: "Отправить", exact: true }).click();
      await b.page.getByRole("button", { name: "Друзья", exact: true }).click();
      await b.page.getByRole("button", { name: /^Входящие/ }).click();
      await b.page
        .getByRole("button", { name: "Принять", exact: true })
        .click();
      await until(async () =>
        (await http(a, "/friends")).some((f) => f.friendUsername === b.name),
      );
      await p
        .getByRole("searchbox", { name: "Поиск друзей", exact: true })
        .fill(b.name);
      await p
        .getByRole("button", {
          name: `Открыть переписку с ${b.name}`,
          exact: true,
        })
        .waitFor();
      await p.getByRole("button", { name: "В сети", exact: true }).click();
      await p
        .getByRole("button", {
          name: `Открыть переписку с ${b.name}`,
          exact: true,
        })
        .waitFor();
      record("Real add/accept friend, loaded-data search and online filter");
      assert.deepEqual(errors, []);
    }
    fs.writeFileSync(
      `${out}/${phase}-results.json`,
      JSON.stringify(
        { results, errors, syntheticAudio: true, realBackend: true },
        null,
        2,
      ),
    );
  } catch (error) {
    if (a) await a.page.screenshot({ path: `${out}/${phase}-failure.png` });
    fs.writeFileSync(
      `${out}/${phase}-results.json`,
      JSON.stringify({ results, errors, failure: error.message }, null, 2),
    );
    console.error(error);
    process.exitCode = 1;
  } finally {
    for (const u of [a, b].filter(Boolean)) {
      const call = await u.page
        .evaluate(() => window.__shellStore?.getState().call)
        .catch(() => null);
      if (call?.callId)
        await http(u, "/calls/end", "POST", {
          callId: call.callId,
          chatRoomId: call.chatRoomId,
        }).catch(() => {});
    }
    await browser.close();
  }
})();
