import { deviceActions } from "../../../store/slices/device.slice";
import type { AppDispatch } from "../../../store/store";
import type {
	ScreenShareQualitySetting,
} from "../../../utils/callQuality";
import type { ScreenShareRuntimeInfo } from "../../../store/slices/device.slice";
import { ScreenShareQualityGrid } from "../ScreenShareQualityGrid/ScreenShareQualityGrid";
import styles from "../VoiceVideoSetting.module.css";

interface ScreenShareSettingsSectionProps {
	dispatch: AppDispatch;
	screenShareQuality: ScreenShareQualitySetting;
	showExperimentalScreenModes: boolean;
	onShowExperimentalScreenModesChange: (value: boolean) => void;
	screenShareRuntime: ScreenShareRuntimeInfo;
}

export function ScreenShareSettingsSection({
	dispatch,
	screenShareQuality,
	showExperimentalScreenModes,
	onShowExperimentalScreenModesChange,
	screenShareRuntime,
}: ScreenShareSettingsSectionProps) {
	return (
		<section className={styles["settings-card"]}>
			<div className={styles["section-header"]}>
				<div>
					<h3 className={styles["section-title"]}>Демонстрация экрана</h3>
					<p className={styles["section-subtitle"]}>
						Качество трансляции экрана и runtime-информация.
					</p>
				</div>
			</div>

			<div className={styles["form-group"]}>
				<label className={styles["label"]}>Качество трансляции экрана</label>

				<ScreenShareQualityGrid
					value={screenShareQuality}
					onChange={(value) =>
						dispatch(
							deviceActions.setScreenShareQuality(
								value as ScreenShareQualitySetting
							)
						)
					}
					showExperimental={showExperimentalScreenModes}
					onShowExperimentalChange={onShowExperimentalScreenModesChange}
					runtimeInfo={screenShareRuntime}
				/>
			</div>
		</section>
	);
}
