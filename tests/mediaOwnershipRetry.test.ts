import { describe, expect, it } from "vitest";
import { isMediaRenewRelease, mediaRenewRetryDelay } from "../src/components/ActiveCallOverlay/CallMediaOwner";

describe("media ownership retry", () => {
	it("backs off and caps retry spacing", () => {
		expect([0, 1, 2, 3, 4].map(mediaRenewRetryDelay)).toEqual([2000, 4000, 8000, 15000, 15000]);
	});

	it("revokes ownership only for the documented RELEASE response", () => {
		expect(isMediaRenewRelease(200, "RELEASE")).toBe(true);
		for (const status of [401, 403, 404]) expect(isMediaRenewRelease(status, "RELEASE")).toBe(false);
		expect(isMediaRenewRelease(200, "UNKNOWN")).toBe(false);
	});

	it("keeps rate limits and server errors transient", () => {
		for (const status of [429, 503]) expect(isMediaRenewRelease(status, "RELEASE")).toBe(false);
	});
});
