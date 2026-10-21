import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { deviceActions } from "../../store/slices/device.slice";
import styles from "./CallOverlay.module.css";

export function CallJoinDevices() {
  const dispatch = useDispatch<AppDispatch>();
  const device = useSelector((s: RootState) => s.device);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((list) => {
        if (active) setDevices(list);
      })
      .catch(() => {
        if (active) setError("Список устройств недоступен");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className={styles.setup}>
      <p>
        Микрофон и камера выключены. Включите их в сцене после принятия звонка.
      </p>
      {(["audioinput", "videoinput"] as const).map((kind) => (
        <label key={kind}>
          {kind === "audioinput" ? "Микрофон" : "Камера"}
          <select
            aria-label={
              kind === "audioinput"
                ? "Микрофон перед входом"
                : "Камера перед входом"
            }
            value={
              kind === "audioinput"
                ? device.selectedMicrophoneId
                : device.selectedCameraId
            }
            onChange={(e) =>
              dispatch(
                kind === "audioinput"
                  ? deviceActions.setMicrophone(e.target.value)
                  : deviceActions.setCamera(e.target.value),
              )
            }
          >
            <option value="default">По умолчанию</option>
            {devices
              .filter(
                (d) =>
                  d.kind === kind && d.deviceId && d.deviceId !== "default",
              )
              .map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Устройство ${i + 1}`}
                </option>
              ))}
          </select>
        </label>
      ))}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
