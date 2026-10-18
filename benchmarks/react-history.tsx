import { messageApi } from "../src/api/messageApi";
import { messageAttachmentsApi } from "../src/api/messageAttachmentsApi";
import { Profiler } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import { DmItemsList } from "../src/components/DmItemsList/DmItemsList";
import messagesReducer, {
  messageActions,
  fetchRoomMessages,
} from "../src/store/slices/message.slice";
import roomsReducer from "../src/store/slices/room.slice";
import usersReducer, { usersActions } from "../src/store/slices/users.slice";
import type { ShortMessage } from "../src/entities/shortMessage";
messageApi.getMessageReaders=async()=>({data:[]}) as any;
const blobUrls = new Set<string>();
const createUrl = URL.createObjectURL.bind(URL),
  revokeUrl = URL.revokeObjectURL.bind(URL);
URL.createObjectURL = (blob) => {
  const url = createUrl(blob);
  blobUrls.add(url);
  return url;
};
URL.revokeObjectURL = (url) => {
  blobUrls.delete(url);
  revokeUrl(url);
};
messageAttachmentsApi.downloadAttachmentBlob = async () =>
  new Blob(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="220"><rect width="300" height="220" fill="blue"/></svg>',
    ],
    { type: "image/svg+xml" },
  );
const observations = new Map<object, Set<Element>>();
const NativeResizeObserver = window.ResizeObserver;
window.ResizeObserver = class extends NativeResizeObserver {
  observe(target: Element, options?: ResizeObserverOptions) {
    if (!observations.has(this)) observations.set(this, new Set());
    observations.get(this)!.add(target);
    super.observe(target, options);
  }
  unobserve(target: Element) {
    observations.get(this)?.delete(target);
    super.unobserve(target);
  }
  disconnect() {
    observations.delete(this);
    super.disconnect();
  }
};
const NativeIntersectionObserver = window.IntersectionObserver;
window.IntersectionObserver = class extends NativeIntersectionObserver {
  observe(target: Element) {
    if (!observations.has(this)) observations.set(this, new Set());
    observations.get(this)!.add(target);
    super.observe(target);
  }
  unobserve(target: Element) {
    observations.get(this)?.delete(target);
    super.unobserve(target);
  }
  disconnect() {
    observations.delete(this);
    super.disconnect();
  }
};
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const rows: object[] = [];
const acceptanceMode = new URLSearchParams(location.search).has("acceptance");
for (const count of new URLSearchParams(location.search).has("threshold")
  ? [480]
  : [1000, 5000, 10000]) {
  const messages = Array.from({ length: count }, (_, i) => ({
    id: i + 1001,
    content: "Synthetic message " + i,
    type: "DEFAULT",
    eventType: "MESSAGE",
    sentAt: "2026-10-18T00:00:00",
    senderId: acceptanceMode && i === count - 1 ? 1 : 2,
    room: { id: 1, type: "GROUP" },
    editedAt: null,
    replyToMessageId: acceptanceMode ? 1 : null,
    replyPreview: acceptanceMode
      ? {
          id: 1,
          authorId: 2,
          authorUsername: "author",
          authorDisplayName: "Author",
          snippet: "older reply",
          type: "DEFAULT",
          deleted: false,
        }
      : null,
    attachments: [],
    readBy: ["me"],
  })) as ShortMessage[];
  const author = {
    id: 2,
    username: "author",
    displayName: "Author",
    status: "ONLINE",
    avatarUrl: null,
  };
  const store = configureStore({
    reducer: {
      message: messagesReducer,
      room: roomsReducer,
      users: usersReducer,
      user: () => ({ myUser: { id: 1, username: "me" } }),
    },
    preloadedState: {
      message: {
        requests: {},
        live: {},
        messages,
        status: "succeeded",
        error: null,
        hasMore: false,
        oldestMessageId: 1001,
        activeRoomId: 1,
        isAtBottom: true,
        newDividerMessageId: null,
        replyTarget: null,
      },
      room: { rooms: [], status: "succeeded", error: null },
      users: { byId: { 2: author, 1: { ...author, id: 1, username: "me" } } },
    } as any,
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false, immutableCheck: false }),
  });
  let commits = 0;
  let renderMs = 0;
  const root = createRoot(document.getElementById("root")!);
  const start = performance.now();
  root.render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/?roomId=1"]}>
        <Profiler
          id="history"
          onRender={(_, __, duration) => {
            commits++;
            renderMs += duration;
          }}
        >
          <DmItemsList />
        </Profiler>
      </MemoryRouter>
    </Provider>,
  );
  await frame();
  const mountMs = performance.now() - start;
  const mountedCommits = commits;
  const mountRenderMs = renderMs;
  const elements = document
    .getElementById("root")!
    .querySelectorAll("*").length;
  const updateStart = performance.now();
  store.dispatch(
    usersActions.patchUser({ id: 2, displayName: "Updated author" } as any),
  );
  await frame();
  const updateMs = performance.now() - updateStart;

  const acceptance: Record<string, unknown> = {};
  if (new URLSearchParams(location.search).has("acceptance")) {
    const settle = async () => {
      for (let i = 0; i < 12; i++) await frame();
    };
    const box = document.getElementById("root")!
      .firstElementChild as HTMLDivElement;
    store.dispatch(messageActions.setIsAtBottom(false));
    await settle();
    box.scrollTop = box.scrollHeight / 2;
    box.dispatchEvent(new Event("scroll"));
    await settle();
    const visible = () =>
      Array.from(box.querySelectorAll<HTMLElement>("[data-id]")).find(
        (row) =>
          row.getBoundingClientRect().top >=
          box.getBoundingClientRect().top + 18,
      );
    const target = visible()!,
      targetId = Number(target.dataset.id),
      before = target.getBoundingClientRect().top;
    const older = messages
      .slice(0, 30)
      .map((message, index) => ({ ...message, id: index + 1 }));
    store.dispatch(
      fetchRoomMessages.pending("older", { roomId: 1, beforeMessageId: 1001 }),
    );
    store.dispatch(
      fetchRoomMessages.fulfilled(
        { messages: older, beforeMessageId: 1001 },
        "older",
        { roomId: 1, beforeMessageId: 1001 },
      ),
    );
    await settle();
    acceptance.prependAnchorDelta =
      (
        box.querySelector(`[data-id="${targetId}"]`) as HTMLElement
      )?.getBoundingClientRect().top - before;
    const above = messages.find((message) => message.id === targetId - 3)!;
    if (above) {
      store.dispatch(
        messageActions.execEventMessage({
          ...above,
          eventType: "MESSAGE_EDIT",
          editedAt: "2026-10-18T01:00:00",
          content: "expanded\n".repeat(30),
        }),
      );
      await settle();
      acceptance.expandedAnchorDelta =
        (
          box.querySelector(`[data-id="${targetId}"]`) as HTMLElement
        )?.getBoundingClientRect().top - before;
    }
    if (above) {
      const image = "/synthetic-attachment";
      store.dispatch(
        messageActions.execEventMessage({
          ...above,
          eventType: "MESSAGE_EDIT",
          editedAt: "2026-10-18T02:00:00",
          attachments: [
            {
              id: 1,
              type: "IMAGE",
              downloadUrl: image,
              originalFileName: "synthetic.svg",
              contentType: "image/svg+xml",
              sizeBytes: 100,
            },
          ],
        }),
      );
      await settle();
      acceptance.imageAnchorDelta =
        (
          box.querySelector(`[data-id="${targetId}"]`) as HTMLElement
        )?.getBoundingClientRect().top - before;
    }
    const reply = messages.find((message) => message.id === targetId)!;
    store.dispatch(
      messageActions.execEventMessage({
        ...reply,
        eventType: "MESSAGE_EDIT",
        editedAt: "2026-10-18T01:00:00",
        replyToMessageId: 1,
        replyPreview: {
          id: 1,
          authorId: 2,
          authorUsername: "author",
          authorDisplayName: "Author",
          snippet: "older reply",
          type: "DEFAULT",
          deleted: false,
        },
      }),
    );
    await settle();
    (
      box.querySelector(`[data-id="${targetId}"] button`) as HTMLButtonElement
    )?.click();
    await settle();
    acceptance.replyTargetMounted = !!box.querySelector('[data-id="1"]');
    acceptance.retained = store.getState().message.messages.length;
    store.dispatch(messageActions.setIsAtBottom(true));
    await settle();
    store.dispatch(
      messageActions.execEventMessage({
        ...messages[messages.length - 1],
        id: count + 2000,
        content: "new tail",
        replyToMessageId: null,
        replyPreview: null,
      }),
    );
    await settle();
    acceptance.bottomGap = box.scrollHeight - box.scrollTop - box.clientHeight;
    store.dispatch(messageActions.setIsAtBottom(false));
    await settle();
    box.scrollTop = box.scrollHeight;
    box.dispatchEvent(new Event("scroll"));
    await settle();
    const own = box.querySelector('[data-sender="me"]') as HTMLElement;
    acceptance.editRowFound = !!own;
    if (own) {
      own.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          clientX: 20,
          clientY: 20,
        }),
      );
      await frame();
      Array.from(box.querySelectorAll("button"))
        .find((button) => button.textContent === "Edit")
        ?.click();
      await settle();
      const input = box.querySelector("input") as HTMLInputElement;
      const draft = input?.value;
      box.scrollTop = 0;
      box.dispatchEvent(new Event("scroll"));
      await settle();
      acceptance.editPinned =
        !!draft &&
        (box.querySelector("input") as HTMLInputElement)?.value === draft;
    }
    acceptance.passed =
      Math.abs(Number(acceptance.prependAnchorDelta)) < 2 &&
      Math.abs(Number(acceptance.expandedAnchorDelta)) < 2 &&
      Math.abs(Number(acceptance.imageAnchorDelta)) < 2 &&
      acceptance.replyTargetMounted === true &&
      acceptance.editPinned === true &&
      Number(acceptance.bottomGap) < 2;
    if (!acceptance.passed)
      throw new Error(
        "Scroll acceptance failed: " + JSON.stringify(acceptance),
      );
  }
  root.unmount();
  await frame();
  store.dispatch(messageActions.setActiveRoom(2));
  rows.push({
    activeObserversAfterUnmount: observations.size,
    activeBlobUrlsAfterUnmount: blobUrls.size,
    acceptance,
    count,
    mountedCommits,
    mountRenderMs,
    mountMs,
    elements,
    updateCommits: commits - mountedCommits,
    updateRenderMs: renderMs - mountRenderMs,
    updateMs,
    afterUnmountElements: document.getElementById("root")!.childElementCount,
    afterSwitchMessages: store.getState().message.messages.length,
  });
  document.getElementById("results")!.textContent = JSON.stringify(
    rows,
    null,
    2,
  );
}
document.getElementById("results")!.setAttribute("data-complete", "true");
