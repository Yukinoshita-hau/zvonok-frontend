import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { clients } = vi.hoisted(() => ({ clients: [] as any[] }));
vi.mock("@stomp/stompjs", () => ({ Client: class {
	active = false; connected = false; connectHeaders: any = {}; brokerURL = "";
	beforeConnect = async () => {}; onConnect = () => {}; onWebSocketClose = () => {};
	subs: Array<{ path: string; callback: (message: any) => void; unsubscribe: () => void }> = [];
	constructor(options: any) { Object.assign(this, options); clients.push(this); }
	activate = vi.fn(() => { this.active = true; void this.beforeConnect().then(() => { if (this.active) { this.connected = true; this.onConnect(); } }); });
	deactivate = vi.fn(async () => { this.active = false; this.connected = false; this.onWebSocketClose(); });
	subscribe = vi.fn((path, callback) => { const sub = { path, callback, unsubscribe: vi.fn() }; this.subs.push(sub); return sub; });
	publish = vi.fn();
} }));
vi.mock("../src/utils/soundPlayer", () => ({ soundPlayer: { playMessage: vi.fn(), stopCallRingtone: vi.fn(), startCallRingtone: vi.fn() } }));
import { store } from "../src/store/store";
import { api, authTransport, session } from "../src/api/api";
import { websocketActions } from "../src/store/slices/websocket.slice";
import { userActions, logoutUser } from "../src/store/slices/user.slice";
import { messageActions } from "../src/store/slices/message.slice";
import { callActions, restoreCallSession } from "../src/store/slices/call.slice";
import { activeCallActions } from "../src/store/slices/activeCall.slice";

const jwt = (token = "token-one", expiresIn = 600000) => ({ accessToken: token, tokenType: "Bearer", expiresIn });
const dto = (id: number) => ({ id, type: "DEFAULT", editedAt: null, replyToMessageId: null, replyPreview: null, content: String(id), eventType: "MESSAGE", sentAt: "2026-10-17T00:00:00", sender: { id: 1, username: "me", displayName: "Me", status: "ONLINE", avatarUrl: null }, room: { id: 1, type: "GROUP" } });
const response = (config: any, data: any) => ({ config, data, headers: {}, status: 200, statusText: "OK" });
let history: any[];
let restoredCall: any;
let requests: string[];

beforeEach(async () => {
	vi.stubGlobal("window", { addEventListener: vi.fn() });
	vi.stubGlobal("document", { hasFocus: () => true });
	const storage = new Map<string, string>();
	vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k), setItem: (k: string, v: string) => storage.set(k, v) });
	session.invalidate(false);
	await new Promise(resolve => setTimeout(resolve, 0));
	clients.length = 0; history = []; requests = []; restoredCall = { callRestoreType: "NONE" };
	await session.authenticate(async () => null);
	api.defaults.adapter = async config => {
		requests.push(config.url ?? "");
		if (config.url === "/rooms/all") return response(config, [{ id: 1, type: "GROUP", members: [] }]);
		if (config.url === "/rooms/1/messages") return response(config, history);
		if (config.url === "/calls/restore") return response(config, restoredCall);
		return response(config, []);
	};
	authTransport.defaults.adapter = async config => response(config, jwt("token-two"));
	store.dispatch(userActions.addJwt(jwt()));
	store.dispatch(userActions.addUser({ id: 1, username: "me" } as any));
});
afterEach(() => { session.invalidate(false); vi.useRealTimers(); });
const connect = async () => {
	store.dispatch(websocketActions.connectStart());
	await vi.waitFor(() => expect(store.getState().websocket.isConnected).toBe(true));
	await vi.waitFor(() => expect(clients[0].subs).toHaveLength(8));
	return clients[0];
};
const deliver = (client: any, id: number) => client.subs.filter((sub: any) => sub.path === "/user/queue/messages").at(-1).callback({ body: JSON.stringify(dto(id)) });

describe("managed STOMP lifecycle", () => {
 it("a call restore failure during reconnect does not mark the live STOMP transport disconnected", async () => {
  const adapter = api.defaults.adapter as any;
  api.defaults.adapter = async config => {
   if (config.url === "/calls/restore") throw new Error("call ended during restore");
   return adapter(config);
  };
  const client = await connect();
  await vi.waitFor(() => expect(store.getState().websocket.error).toContain("синхронизировать"));
  expect(store.getState().websocket.isConnected).toBe(true);
  expect(store.getState().websocket.status).toBe("connected");
  store.dispatch({ type: "message/sendMessage", payload: { roomId: 1, content: "still connected" } });
  expect(client.publish).toHaveBeenCalled();
 });
 it("explicit group rejoin reopens the local call and waits for my committed join before token", async () => {
  const client = await connect();
  store.dispatch(callActions.applyCallEvent({ type: "CALL_INVITE", callId: 223, chatRoomId: 1, roomType: "GROUP" } as any));
  store.dispatch(callActions.endCallLocally());
  store.dispatch(activeCallActions.setActiveCallForRoom({ callId: 223, chatRoomId: 1, roomId: 1, roomType: "GROUP", liveKitRoomName: "group-223", hostUsername: "host", callerUsername: "host", participants: [], status: "ACTIVE" } as any));
  store.dispatch({ type: "call/sendJoin", payload: { callId: 223, chatRoomId: 1 } });
  expect(store.getState().call.callId).toBe(223);
  expect(store.getState().call.closedCallIds).not.toContain(223);
  expect(requests).not.toContain("/calls/223/token");
  const sub = client.subs.find((s: any) => s.path === "/user/queue/call");
  sub.callback({ body: JSON.stringify({ type: "CALL_PARTICIPANT_JOINED", callId: 223, chatRoomId: 1, roomType: "GROUP", participantUsername: "me", participantStatus: "JOINED" }) });
  await vi.waitFor(() => expect(requests).toContain("/calls/223/token"));
 });
 it.each(["CALL_ACCEPT", "CALL_ACCEPTED", "CALL_PARTICIPANT_JOINED"])("another group participant's %s preserves my unanswered invitation", async type => {
  const client = await connect();
  const sub = client.subs.find((s: any) => s.path === "/user/queue/call");
  const event = { callId: 222, chatRoomId: 1, roomType: "GROUP", liveKitRoomName: "group-222", callerUsername: "host", hostUsername: "host" };
  sub.callback({ body: JSON.stringify({ ...event, type: "CALL_INVITE", eventId: "invite" }) });
  expect(store.getState().call.status).toBe("incoming_ringing");
  sub.callback({ body: JSON.stringify({ ...event, type, eventId: "other-accepted", participantUsername: "other", participantStatus: "ACCEPTED" }) });
  expect(store.getState().call.status).toBe("incoming_ringing");
  expect(store.getState().call.tokenRequestId).toBeNull();
  expect(requests).not.toContain("/calls/222/token");
 });
	it("retired server/channel actions cannot publish or subscribe, including after reconnect", async () => {
		const client = await connect();
		store.dispatch({ type: "channelMessage/sendChannelMessage", payload: { channelId: "20", content: "retired" } });
		await session.refresh();
		await vi.waitFor(() => expect(client.subs).toHaveLength(16));
		store.dispatch({ type: "channelMessage/sendChannelMessage", payload: { channelId: "20", content: "retired" } });
		expect(client.publish).not.toHaveBeenCalled();
		expect(client.subs.every((sub: { path: string }) => sub.path.startsWith("/user/queue/"))).toBe(true);
		expect(requests.some(url => /server|channel/i.test(url))).toBe(false);
		expect(store.getState()).not.toHaveProperty("server");
		expect(store.getState()).not.toHaveProperty("channelMessage");
	});
	it("CONNECT and repeated connect use one client and exactly one set of personal subscriptions", async () => {
		const client = await connect();
		store.dispatch(websocketActions.connectStart());
		expect(clients).toHaveLength(1);
		expect(client.subs).toHaveLength(8);
		expect(client.connectHeaders.Authorization).toBe("Bearer token-one");
	});
	it("refresh reconnects the same client with the new JWT and restores subscriptions once", async () => {
		const client = await connect();
		await session.refresh();
		await vi.waitFor(() => expect(client.subs).toHaveLength(16));
		expect(clients).toHaveLength(1);
		expect(client.connectHeaders.Authorization).toBe("Bearer token-two");
		expect(client.brokerURL).toContain("token-two");
		for (const path of new Set(client.subs.map((sub: any) => sub.path))) expect(client.subs.filter((sub: any) => sub.path === path)).toHaveLength(2);
	});
	it("logout intent closes WebSocket, clears user data and blocks old callbacks even if HTTP logout fails", async () => {
		store.dispatch(messageActions.setActiveRoom(1));
		const client = await connect();
		authTransport.defaults.adapter = async () => { throw new Error("offline"); };
		await store.dispatch(logoutUser({ allDevices: false }));
		await vi.waitFor(() => expect(client.deactivate).toHaveBeenCalled());
		await deliver(client, 1);
		expect(store.getState().user.accessToken).toBeNull();
		expect(store.getState().message.messages).toEqual([]);
		expect(client.active).toBe(false);
	});
	it("account change rejects old-session messages and creates the next client only after deactivation", async () => {
		const old = await connect();
		session.invalidate();
		await session.authenticate(async () => null);
		store.dispatch(userActions.addJwt(jwt("other-user")));
		store.dispatch(messageActions.setActiveRoom(1));
		store.dispatch(websocketActions.connectStart());
		await vi.waitFor(() => expect(clients).toHaveLength(2));
		await vi.waitFor(() => expect(clients[1].connected).toBe(true));
		await deliver(old, 99);
		expect(store.getState().message.messages).toEqual([]);
		expect(old.active).toBe(false);
		expect(clients[1].connectHeaders.Authorization).toBe("Bearer other-user");
	});
    it("nested clear event resyncs history and retains messages sent after clearing", async () => {
        store.dispatch(messageActions.setActiveRoom(1));
        const client = await connect();
        await vi.waitFor(() => expect(store.getState().message.status).toBe("succeeded"));
        history = [dto(2)];
        client.subs.filter((sub: any) => sub.path === "/user/queue/room-events").at(-1).callback({
            body: JSON.stringify({ type: "ROOM_MESSAGES_CLEARED", payload: { roomId: 1 } }),
        });
        await vi.waitFor(() => expect(store.getState().message.messages.map(m => m.id)).toEqual([2]));
    });
	it("transport reconnect resynchronizes missed room messages and accepts subsequent live messages", async () => {
		store.dispatch(messageActions.setActiveRoom(1));
		const client = await connect();
		await vi.waitFor(() => expect(store.getState().message.status).toBe("succeeded"));
		history = [dto(1), dto(2)];
		client.connected = false; client.onWebSocketClose();
		expect(store.getState().websocket.isConnected).toBe(false);
		await client.beforeConnect(); client.connected = true; client.onConnect();
		await vi.waitFor(() => expect(store.getState().message.messages.map(m => m.id)).toEqual([1, 2]));
		await deliver(client, 3);
		expect(store.getState().message.messages.map(m => m.id)).toEqual([1, 2, 3]);
		// The old physical connection's handler cannot deliver again.
		await client.subs[0].callback({ body: JSON.stringify(dto(99)) });
		expect(store.getState().message.messages.map(m => m.id)).toEqual([1, 2, 3]);
	});
	it("temporary signaling loss and reconnect retain the current LiveKit token and call state", async () => {
		const client = await connect();
		restoredCall = { callRestoreType: "ACTIVE_CALL", callId: 9, participantToken: "live-media", serverUrl: "wss://media.test", liveKitRoomName: "call-9" };
		await store.dispatch(restoreCallSession());
		client.connected = false; client.onWebSocketClose();
		expect(store.getState().call.participantToken).toBe("live-media");
		expect(store.getState().call.status).toBe("in_call");
		await client.beforeConnect(); client.connected = true; client.onConnect();
		await vi.waitFor(() => expect(store.getState().websocket.isConnected).toBe(true));
		expect(store.getState().call.participantToken).toBe("live-media");
	});
	it("reconnect reconciles CALL_ENDED missed offline", async () => {
		const client = await connect();
		restoredCall = { callRestoreType: "ACTIVE_CALL", callId: 9, participantToken: "live-media", serverUrl: "wss://media.test", liveKitRoomName: "call-9" };
		await store.dispatch(restoreCallSession());
		client.connected = false; client.onWebSocketClose();
		restoredCall = { callRestoreType: "NONE" };
		await client.beforeConnect(); client.connected = true; client.onConnect();
		await vi.waitFor(() => expect(store.getState().call.participantToken).toBeNull());
	});
	it("an idle open socket refreshes before JWT expiry", async () => {
		await connect();
		vi.useFakeTimers();
		store.dispatch(userActions.addJwt(jwt("short", 120000)));
		await vi.advanceTimersByTimeAsync(60001);
		expect(store.getState().user.accessToken).toBe("token-two");
		expect(clients).toHaveLength(1);
	});
	it("Canvas and Code Session endpoints and subscriptions are absent after reconnect", async () => {
		const client = await connect();
		await session.refresh();
		await vi.waitFor(() => expect(client.subs).toHaveLength(16));
		expect(client.subs.some((sub: any) => /canvas|whiteboard|code-session/i.test(sub.path))).toBe(false);
		expect(requests.some(url => /canvas|whiteboard|code-session|code-run/i.test(url))).toBe(false);
	});
});


describe("Stage 7 event boundary and notification regressions", () => {
 it("incoming friend requests have distinct notification IDs and open the sender profile", async () => {
  const client = await connect();
  const sub = client.subs.find((sub: any) => sub.path === "/user/queue/friend-requests");
  expect(sub).toBeDefined();
  const payload = { senderUsername: "alice", receiverUsername: "me", senderId: 2, receiverId: 1, senderDisplayName: "Alice", receiverDisplayName: "Me" };
  sub.callback({ body: JSON.stringify({ type: "FRIEND_REQUEST_CREATED", payload }) });
  sub.callback({ body: JSON.stringify({ type: "FRIEND_REQUEST_CREATED", payload }) });
  const notifications = store.getState().notification.notifications;
  expect(notifications).toHaveLength(2);
  expect(notifications[0].id).toBeTruthy(); expect(notifications[0].id).not.toBe(notifications[1].id);
  expect(notifications[0].target).toEqual({ type: "FRIEND_PROFILE", username: "alice" });
 });
 it("malformed and future events do not mutate messages or calls, and the next valid message works", async () => {
  const client = await connect();
  const messages = client.subs.find((sub: any) => sub.path === "/user/queue/messages");
  const calls = client.subs.find((sub: any) => sub.path === "/user/queue/call");
  const before = store.getState().call;
  await messages.callback({ body: "{" });
  await messages.callback({ body: JSON.stringify({ id: 1, sender: null }) });
  expect(calls).toBeDefined();
  calls.callback({ body: JSON.stringify({ type: "FUTURE_CALL_EVENT", callId: 999 }) });
  expect(store.getState().call).toBe(before);
  store.dispatch(messageActions.setActiveRoom(1));
  await deliver(client, 77);
  expect(store.getState().message.messages.some(message => message.id === 77)).toBe(true);
 });
});


describe("Stage 7 Java DTO compatibility", () => {
 it("accepts null optional fields in Java call events", async () => {
  const client = await connect();
  const sub = client.subs.find((sub: any) => sub.path === "/user/queue/call");
  sub.callback({ body: JSON.stringify({ type: "CALL_INVITE", callId: 22, chatRoomId: 1, roomType: "PRIVATE", liveKitRoomName: "call22", callerUsername: "alice", hostUsername: "alice", participantUsername: null, participantStatus: null, participantsCount: null, endReason: null }) });
  expect(store.getState().call.callId).toBe(22);
 });
 it("applies short profile updates without erasing sender status or requiring missing timestamps", async () => {
  const client = await connect(); store.dispatch(messageActions.setActiveRoom(1)); await deliver(client, 2);
  const sub = client.subs.find((sub: any) => sub.path === "/user/queue/users");
  sub.callback({ body: JSON.stringify({ eventType: "USER_PROFILE_UPDATED", user: { id: 1, username: "me", displayName: "Renamed", avatarUrl: null, aboutMe: null } }) });
  expect(store.getState().users.byId[1]).toMatchObject({ displayName: "Renamed", status: "ONLINE" });
  expect(store.getState().user.myUser?.displayName).toBe("Renamed");
 });
});

it("Stage 8 counts HTTP refreshes for a burst of 100 inactive-room messages", async () => {
 const client=await connect();
 await vi.waitFor(()=>expect(store.getState().room.status).toBe("succeeded"));
 requests.length=0;
 let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 api.defaults.adapter=async config=>{
  requests.push(config.url ?? "");
  if(config.url==="/rooms/all") { await gate; return response(config,[{id:1,type:"GROUP",members:[]}]); }
  return response(config,[]);
 };
 const events=Array.from({length:100},(_,i)=>deliver(client,i+1));
 await vi.waitFor(()=>expect(requests.filter(x=>x==="/rooms/all").length).toBeGreaterThan(0));
 release(); await Promise.all(events);
 process.stdout.write("STAGE8,ws-burst-100,room-http="+requests.filter(x=>x==="/rooms/all").length+"\n");
 expect(requests.filter(x=>x==="/rooms/all")).toHaveLength(1);
});



it("complete profile event patches normalized users without a room HTTP refresh",async()=>{
 const client=await connect();
 await vi.waitFor(()=>expect(store.getState().room.status).toBe("succeeded")); requests.length=0;
 const profile={id:1,username:"me",displayName:"Changed",avatarUrl:null,aboutMe:null};
 client.subs.find((sub:any)=>sub.path==="/user/queue/users").callback({body:JSON.stringify({type:"USER_PROFILE_UPDATED",user:profile})});
 await Promise.resolve();
 expect(store.getState().user.myUser?.displayName).toBe("Changed");
 expect(requests.filter(url=>url==="/rooms/all")).toHaveLength(0);
});
