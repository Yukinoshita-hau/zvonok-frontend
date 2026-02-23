export function formatTime(dataString: string | null) {
	if (!dataString) return "";
	const data = new Date(dataString);
	return data.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function isSameDay(firstDate: string | Date, secondDate: string | Date): boolean {
	const d1 = firstDate instanceof Date ? firstDate : new Date(firstDate);
	const d2 = secondDate instanceof Date ? secondDate : new Date(secondDate);

	return d1.getDate() === d2.getDate() &&
		d1.getMonth() === d2.getMonth() &&
		d1.getFullYear() === d2.getFullYear()
}
