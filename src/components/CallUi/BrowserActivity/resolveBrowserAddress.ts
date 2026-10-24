export function resolveBrowserAddress(value: string) {
	const input = value.trim();
	if (!input) return 'about:blank';
	if (/^[a-z][a-z\d+.-]*:/i.test(input)) return input;
	if (/^(localhost|(?:\d{1,3}\.){3}\d{1,3}|[^\s.]+(?:\.[^\s.]+)+)(:\d+)?(?:\/|$)/i.test(input)) return `https://${input}`;
	return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
}
