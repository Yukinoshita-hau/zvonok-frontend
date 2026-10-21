import { useSelector } from "react-redux";
import type { RootState } from "../../src/store/store";
import { useEffect, useState } from "react";
import { Room, ConnectionState } from "livekit-client";
import { CallHotkeys } from '../../src/components/ActiveCallOverlay/CallHotkeys';
import { ScreenSharePickerModal } from '../../src/components/ScreenSharePicker/ScreenSharePickerModal';
import { RoomContext } from "@livekit/components-react";
import { MiniCallDock } from "../../src/components/ActiveCallOverlay/MiniCallDock";
import { CallMicrophoneProvider } from "../../src/components/CallUi/CallMicrophoneProvider";
import { useDispatch } from "react-redux";
import { callActions } from "../../src/store/slices/call.slice";
const fixtureRoom = new Room();
if (new URLSearchParams(location.search).has('functional')) {
  const control = {fail: false, calls: [] as {kind: string; id: string}[], cameraToggles: 0};
  (window as any).functionalMedia = control;
  fixtureRoom.switchActiveDevice = async (kind, id) => {
    control.calls.push({kind, id});
    await new Promise(resolve => setTimeout(resolve, 100));
    if (control.fail) throw new Error('Synthetic SDK device failure');
    return true;
  };
  fixtureRoom.state = ConnectionState.Connected;
  fixtureRoom.localParticipant.setCameraEnabled = async () => {control.cameraToggles++; return undefined;};
}
let mounts = 0;
export function ActiveCallOverlay() {
  const dispatch = useDispatch();
  const call = useSelector((state: RootState) => state.call);
  const [instance] = useState(() => ++mounts);
  const [picker, setPicker] = useState(false);
  const functional = new URLSearchParams(location.search).has('functional');
  useEffect(() => {
    const node = document.getElementById("fixture-media-sentinel");
    node?.setAttribute("data-mounted", "true");
    return () => node?.setAttribute("data-mounted", "false");
  }, []);
  return (
    <><output
      id="fixture-media-sentinel"
      data-instance={instance}
      data-presentation={call.presentationMode}
      data-status={call.status}
      data-generation={call.mediaGeneration}
    >
      Fixture media sentinel #{instance} · NOT LIVE MEDIA
    </output>
    <RoomContext.Provider value={fixtureRoom}>
      <CallMicrophoneProvider callId="settings-fixture" generation={0}>
        {functional && <><button data-testid="functional-picker" onClick={() => setPicker(true)}>Fixture: открыть picker</button>
          <ScreenSharePickerModal isOpen={picker} onClose={() => setPicker(false)} onConfirm={result => {(window as any).functionalPickerResult = result; setPicker(false);}}/>
          {['connecting', 'in_call'].includes(call.status) && <CallHotkeys/>}</>}
        <MiniCallDock visible={["connecting", "in_call"].includes(call.status) && call.presentationMode === "minimized"} hasChat
          onOpenChat={() => {}} onEnd={() => {}}
          onExpand={() => dispatch(callActions.setPresentationMode("expanded"))} />
      </CallMicrophoneProvider>
    </RoomContext.Provider></>
  );
}
export function CallOverlay() {
  return null;
}
export function CallRestoreBootstrap() {
  return null;
}
export function DesktopNotificationBridge() {
  return null;
}

