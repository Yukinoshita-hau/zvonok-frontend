/** The attachment DTO carries JSON text; never trust its decoded shape. */
export function parseWaveform(serialized?: string | null): number[] | null {
	if (!serialized) return null;
	try {
		const value: unknown = JSON.parse(serialized);
		return Array.isArray(value) &&
			value.length > 0 &&
			value.every((item) => typeof item === "number" && Number.isFinite(item))
			? value
			: null;
	} catch {
		return null;
	}
}
