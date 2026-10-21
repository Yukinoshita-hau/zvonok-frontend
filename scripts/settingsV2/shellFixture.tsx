import { AuthInitializator } from "../../src/helpers/AppInitializer";
import { callActions } from "../../src/store/slices/call.slice";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { AppLayout } from "../../src/layouts/AppLayouts/AppLayout";
import { InboxLayout } from "../../src/pages/InboxLayout/InboxLayout";
import { DmChat } from "../../src/pages/DmChat/DmChat";
import { store } from "../../src/store/store";
import { userActions } from "../../src/store/slices/user.slice";
import { fetchMyRooms } from "../../src/store/slices/room.slice";
import { fetchMyFriends } from "../../src/store/slices/friend.slice";
import { SETTINGS_FLAG_KEY } from "../../src/features/settingsV2/settingsNavigation";
import "../../src/index.css";
import "./shellFixture.css";
store.dispatch(userActions.setAuthChecked(true));
(window as any).settingsFixture = { view: () => store.getState(), dispatch: store.dispatch };
store.dispatch(
  userActions.addUser({
    id: 1,
    username: "fixture",
    displayName: "Fixture User",
    aboutMe: "Тестовый профиль. Данные не отправляются.",
    email: "fixture@example.invalid",
    isEmailVerified: false,
    status: "ONLINE",
    lastSeenAt: null,
    avatarUrl: null,
    updatedAt: "",
    createdAt: "",
  }),
);
store.dispatch(fetchMyRooms.pending("settings-fixture", undefined));
if (!new URLSearchParams(location.search).has("real-chat"))
  store.dispatch(fetchMyRooms.fulfilled([], "settings-fixture", undefined));
store.dispatch(fetchMyFriends.fulfilled([], "fixture", undefined));
function ChatFixture() {
  const navigate = useNavigate();
  const location = useLocation();
  const [draft, setDraft] = useState("Сохранённый черновик fixture");
  const [mount] = useState(() => crypto.randomUUID());
  return (
    <div className="fixture-chat" data-mount={mount}>
      <header>Настоящий AppLayout + InboxLayout · тестовый контент</header>
      <p>{location.pathname + location.search}</p>
      <h1>
        {location.pathname.endsWith("notifications")
          ? "Уведомления fixture"
          : "Чат fixture"}
      </h1>
      <label>
        Черновик{" "}
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <button onClick={() => navigate("/dm?roomId=42")}>Чат 42</button>
      <button onClick={() => navigate("/notifications")}>
        Центр уведомлений
      </button>
    </div>
  );
}
function Fixture() {
  const [enabled, setEnabled] = useState(
    localStorage.getItem(SETTINGS_FLAG_KEY) === "1",
  );
  const [size, setSize] = useState("По области");
  const [width, height] = size.split("×").map(Number);
  const hashRouter = new URLSearchParams(location.search).has("hash-router");
  const [router] = useState(() =>
    (hashRouter ? createHashRouter : createBrowserRouter)([
      {
        element: <AppLayout />,
        children: [
          {path: 'conference/:code', element: <ChatFixture />},
          {path: 'invite/:token', element: <ChatFixture />},
          {
            element: <InboxLayout />,
            children: [{ path: "*", element: new URLSearchParams(location.search).has("real-chat") ? <DmChat /> : <ChatFixture /> }],
          },
        ],
      },
    ]),
  );
  useEffect(() => () => router.dispose(), [router]);
  return (
    <>
      <div className="fixture-tools">
        <label>
          Модель звонка{" "}
          <select
            aria-label="Модель звонка"
            defaultValue="idle"
            onChange={(event) => {
              if (event.target.value === "idle")
                store.dispatch(callActions.endCallLocally());
              else {
                store.dispatch(
                  callActions.prepareJoinedCall({
                    callId: 77,
                    chatRoomId: 42,
                    roomType: "PRIVATE",
                    livekitRoomName: "fixture-only",
                    callerUsername: "fixture",
                    hostUsername: "fixture",
                  }),
                );
                store.dispatch(
                  callActions.setPresentationMode(
                    event.target.value === "expanded"
                      ? "expanded"
                      : "minimized",
                  ),
                );
              }
            }}
          >
            <option value="idle">Нет звонка</option>
            <option value="compact">Compact fixture</option>
            <option value="expanded">Expanded fixture</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              localStorage.setItem(
                SETTINGS_FLAG_KEY,
                event.target.checked ? "1" : "0",
              );
              setEnabled(event.target.checked);
            }}
          />{" "}
          Developer Settings V2
        </label>
        <label>
          Размер shell{" "}
          <select
            value={size}
            onChange={(event) => setSize(event.target.value)}
          >
            <option>По области</option>
            {["1440×900", "1366×768", "1024×768", "1000×700"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <span>
          Fixture: media/network disabled ·{" "}
          {hashRouter ? "HashRouter" : "BrowserRouter"}
        </span>
      </div>
      <div className="fixture-stage">
        <div
          className="fixture-size"
          style={{ width: width || "100%", height: height || "100%" }}
        >
          <Provider store={store}>
            <AuthInitializator><RouterProvider router={router} /></AuthInitializator>
          </Provider>
        </div>
      </div>
    </>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<Fixture />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
