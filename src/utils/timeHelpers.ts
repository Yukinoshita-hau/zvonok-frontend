const MSK_TIME_ZONE = "Europe/Moscow";

const mskDateFormatter = new Intl.DateTimeFormat("ru-RU", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	timeZone: MSK_TIME_ZONE,
});

const mskDayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	timeZone: MSK_TIME_ZONE,
});

export function parseBackendDateMs(value?: string | null): number | null {
	if (!value) return null;
	const normalizedValue = hasExplicitTimeZone(value) ? value : `${value}Z`;
	const timestamp = Date.parse(normalizedValue);
	return Number.isFinite(timestamp) ? timestamp : null;
}

export function formatTime(dateValue: string | number | Date | null) {
	if (dateValue == null) return "";
	const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
	return date.toLocaleTimeString("ru-RU", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: MSK_TIME_ZONE,
	});
}

export function formatDate(dateValue: string | number | Date | null) {
	if (dateValue == null) return "";
	const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
	return mskDateFormatter.format(date);
}

export function formatDateTime(dateValue: string | number | Date | null) {
	if (dateValue == null) return "";
	const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
	return date.toLocaleString("ru-RU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: MSK_TIME_ZONE,
	});
}

export function isSameDay(firstDate: string | Date, secondDate: string | Date): boolean {
	const d1 = firstDate instanceof Date ? firstDate : new Date(firstDate);
	const d2 = secondDate instanceof Date ? secondDate : new Date(secondDate);

	return mskDayKeyFormatter.format(d1) === mskDayKeyFormatter.format(d2);
}

function hasExplicitTimeZone(value: string): boolean {
	return /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
}
