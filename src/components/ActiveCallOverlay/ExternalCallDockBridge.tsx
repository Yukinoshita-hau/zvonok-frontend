import { useEffect, useRef } from 'react';
import { useConnectionState, useLocalParticipant, useSpeakingParticipants } from '@livekit/components-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import type { DockState } from '../../../electron/desktopTypes';
import { useCallMicrophoneOwner } from '../CallUi/CallMicrophoneProvider';
import { useMicrophoneCaptureOptions } from '../CallUi/useMicrophoneCaptureOptions';
import { getMicrophonePublishOptions } from '../../utils/microphoneQuality';

/** Presentation adapter under the existing Room/provider; never creates media or another Room. */
export function ExternalCallDockBridge({ title, onEnd }: { title: string; onEnd: () => void }) {
  const { callId, mediaGeneration } = useSelector((s: RootState) => s.call);
  const quality = useSelector((s: RootState) => s.device.micQualitySetting);
  const microphone = useCallMicrophoneOwner();
  const capture = useMicrophoneCaptureOptions();
  const connection = useConnectionState();
  const { isMicrophoneEnabled } = useLocalParticipant();
  const speakers = useSpeakingParticipants();
  const state: DockState = {
    callKey: `${callId}:${mediaGeneration}`, title: title.slice(0, 240), connection: connection === 'signalReconnecting' ? 'reconnecting' : connection,
    microphoneEnabled: isMicrophoneEnabled,
    speaking: (speakers.length ? speakers.some(p => p.isLocal) ? 'Вы говорите' : `Говорит ${speakers.slice(0, 3).map(p => p.name || p.identity).join(', ')}` : 'Никто не говорит').slice(0, 500),
  };
  const latest = useRef({ state, capture, quality, onEnd });
  latest.current = { state, capture, quality, onEnd };
  const bridge = window.zvonokDesktop?.dock;
  useEffect(() => {
    if (!bridge || !callId) return;
    const unsubscribe = bridge.onCommand(command => {
      const run = async () => {
        const current = latest.current;
        if (command.callKey !== current.state.callKey || Date.now() > command.expiresAt) return false;
        if (command.action === 'microphone' && typeof command.enabled === 'boolean') {
          if (command.enabled && current.state.connection !== 'connected') return false;
          await microphone.setEnabled(command.enabled, current.capture, getMicrophonePublishOptions(current.quality));
          return latest.current.state.callKey === command.callKey && Date.now() <= command.expiresAt;
        }
        if (command.action === 'end') { current.onEnd(); return true; }
        return false;
      };
      void run().catch(() => false).then(ok => bridge.ack({ id: command.id, callKey: command.callKey, ok })).catch(() => {});
    });
    const heartbeat = window.setInterval(() => { void bridge.publish(latest.current.state).catch(() => {}); }, 5000);
    return () => { unsubscribe(); clearInterval(heartbeat); void bridge.publish(null).catch(() => {}); };
  }, [bridge, callId, mediaGeneration, microphone]);
  const serialized = JSON.stringify(state);
  useEffect(() => { if (callId) void bridge?.publish(JSON.parse(serialized)).catch(() => {}); }, [bridge, callId, serialized]);
  return null;
}
