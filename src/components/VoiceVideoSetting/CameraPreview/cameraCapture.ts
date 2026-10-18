export function startCameraCapture(
	constraints: MediaStreamConstraints,
	ready: (stream: MediaStream) => void,
	failed: (error: unknown) => void,
) {
	let cancelled = false;
	let stream: MediaStream | undefined;
	void (async () => {
		try {
			const acquired = await navigator.mediaDevices.getUserMedia(constraints);
			if (cancelled) {
				acquired.getTracks().forEach((track) => track.stop());
				return;
			}
			stream = acquired;
			ready(acquired);
		} catch (error) {
			if (!cancelled) failed(error);
		}
	})();
	return () => {
		if (cancelled) return;
		cancelled = true;
		stream?.getTracks().forEach((track) => track.stop());
	};
}
