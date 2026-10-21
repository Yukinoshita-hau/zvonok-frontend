import { useConnectionState, useTrackToggle } from "@livekit/components-react";
import { useState } from "react";
import { Hourglass, Mic, MicOff, TriangleAlert } from "lucide-react";
import styles from "./MicrophoneToggleButton.module.css";
import { ConnectionState, Track } from "livekit-client";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { getMicrophonePublishOptions } from "../../utils/microphoneQuality";
import { useMicrophoneCaptureOptions } from "./useMicrophoneCaptureOptions";
import { useCallMicrophoneOwner } from "./CallMicrophoneProvider";

interface MicrophoneToggleButtonProps {
  className: string;
  enabledLabel?: string;
  disabledLabel?: string;
  showIcon?: boolean;
  titlePrefix?: string;
  labelClassName?: string;
  iconSize?: number;
}

export function MicrophoneToggleButton({
  className,
  enabledLabel = "Микрофон",
  disabledLabel = "Без звука",
  showIcon = false,
  titlePrefix = "Микрофон",
  labelClassName,
  iconSize = 16,
}: MicrophoneToggleButtonProps) {
  const captureOptions = useMicrophoneCaptureOptions();
  const connectionState = useConnectionState();
  const microphoneOwner = useCallMicrophoneOwner();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<"unavailable" | "error" | null>(null);

  const micQualitySetting = useSelector(
    (s: RootState) => s.device.micQualitySetting,
  );

  const publishOptions = getMicrophonePublishOptions(micQualitySetting);

  const { enabled } = useTrackToggle({
    source: Track.Source.Microphone,
    className,
    captureOptions,
    type: "button",
    publishOptions,
  });

  const stateTitle = enabled
    ? `${titlePrefix}: включён`
    : `${titlePrefix}: выключен`;
  const state = pending ? "pending" : errorKind || (enabled ? "enabled" : "muted");
  const title = pending ? "Переключаем микрофон…" : error || `${stateTitle}. ${enabled ? "Выключить" : "Включить"} микрофон`;
  const handleClick = () => {
    const nextEnabled = !enabled;
    if (nextEnabled && connectionState !== ConnectionState.Connected) return;
    setPending(true);
    setError("");
    setErrorKind(null);
    void microphoneOwner
      .setEnabled(nextEnabled, captureOptions, publishOptions)
      .catch((error) => {
        console.error("Failed to toggle microphone", error);
        const unavailable = ["NotFoundError", "DevicesNotFoundError", "NotReadableError", "NotAllowedError", "SecurityError"].includes(error?.name);
        setErrorKind(unavailable ? "unavailable" : "error");
        setError(
          unavailable ? "Микрофон недоступен. Проверьте устройство и разрешения; нажмите, чтобы повторить." : "Не удалось переключить микрофон. Нажмите, чтобы повторить.",
        );
      })
      .finally(() => setPending(false));
  };

  return (
    <button
      type="button"
      className={`${className} ${styles.button}`}
      disabled={
        pending || (!enabled && connectionState !== ConnectionState.Connected)
      }
      onClick={handleClick}
      aria-pressed={enabled}
      aria-busy={pending}
      data-mic-state={state}
      data-tooltip={title}
      data-lk-source={Track.Source.Microphone}
      data-lk-enabled={enabled}
      title={error || title}
      aria-label={title}
      aria-invalid={Boolean(error)}
      data-active={enabled}
    >
      {showIcon &&
        (pending ? <Hourglass size={iconSize} /> : errorKind ? <TriangleAlert size={iconSize} /> : enabled ? <Mic size={iconSize} /> : <MicOff size={iconSize} />)}
      <span className={styles.announcement} role="status">{pending ? "Переключаем микрофон…" : error || ""}</span>
      {(enabled ? enabledLabel : disabledLabel) && (
        <span className={labelClassName}>
          {enabled ? enabledLabel : disabledLabel}
        </span>
      )}
    </button>
  );
}
