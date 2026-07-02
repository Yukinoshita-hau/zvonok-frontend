import { api } from "../api/api";

export function resolveMediaUrl(url?: string | null): string {
	if (!url) return "";
	if (/^(https?:|blob:|data:)/i.test(url)) return url;

	const normalizedPath = url.startsWith("/") ? url : `/${url}`;
	const baseURL = typeof api.defaults.baseURL === "string" ? api.defaults.baseURL : "";

	if (!/^https?:\/\//i.test(baseURL)) return normalizedPath;

	try {
		const apiUrl = new URL(baseURL);
		if (normalizedPath.startsWith("/api/")) return `${apiUrl.origin}${normalizedPath}`;

		const normalizedBasePath = apiUrl.pathname.endsWith("/")
			? apiUrl.pathname.slice(0, -1)
			: apiUrl.pathname;

		return `${apiUrl.origin}${normalizedBasePath}${normalizedPath}`;
	} catch {
		return normalizedPath;
	}
}
