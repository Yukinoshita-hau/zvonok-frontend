import { describe, expect, it } from "vitest";
import { createMemoryRouter } from "react-router-dom";
import { fields } from "../../src/features/settingsV2/SettingsRegistry";
import {
  readSettingsTarget,
  settingsHash,
  settingsV2Enabled,
} from "../../src/features/settingsV2/settingsNavigation";
import inventory from "../../artifacts/stages/settings-s1b-evidence/preferences.json";
describe("Settings S1B integration contract", () => {
  it("defaults to Workspace, ignores old flags and only accepts explicit diagnostic rollback", () => {
    for (const oldFlag of [null, '0', '1', 'true']) {
      expect(settingsV2Enabled({getItem: key => key === 'zvonok.settingsV2' ? oldFlag : null})).toBe(true);
    }
    expect(settingsV2Enabled({getItem: key => key === 'zvonok.settingsUI' ? 'legacy' : null})).toBe(false);
    expect(settingsV2Enabled({getItem: () => {throw Error('Denied');}})).toBe(true);
  });
  it("round-trips all registered fields with category validation", () => {
    for (const field of fields)
      expect(
        readSettingsTarget(
          settingsHash({ category: field.category, field: field.id }),
        ),
      ).toEqual({ category: field.category, field: field.id });
    expect(readSettingsTarget("#settings-v2/media")).toEqual({
      category: "media",
    });
    for (const invalid of [
      "#settings-v2/unknown",
      "#settings-v2/account/noise",
      "#settings-v2/media/missing",
      "#settings-v2/media/%3Cscript%3E",
      "#settings-v2/media/noise/extra",
    ])
      expect(readSettingsTarget(invalid)).toBeUndefined();
  });
  it("preserves path/search across push, replace, back and forward", async () => {
    const router = createMemoryRouter([{ path: "*", element: null }], {
      initialEntries: ["/dm?roomId=42"],
    });
    await router.navigate(
      {
        pathname: router.state.location.pathname,
        search: router.state.location.search,
        hash: settingsHash({ category: "account" }),
      },
      { state: { settingsV2Entry: true } },
    );
    await router.navigate(
      {
        pathname: router.state.location.pathname,
        search: router.state.location.search,
        hash: settingsHash({ category: "media", field: "noise" }),
      },
      { replace: true, state: router.state.location.state },
    );
    expect(router.state.location.pathname + router.state.location.search).toBe(
      "/dm?roomId=42",
    );
    await router.navigate(-1);
    expect(router.state.location.hash).toBe("");
    await router.navigate(1);
    expect(router.state.location.hash).toBe("#settings-v2/media/noise");
    router.dispose();
  });
  it("maps every audited preference once without inventing runtime success", () => {
    expect(inventory).toHaveLength(37);
    expect(new Set(inventory.map((row) => row.auditId)).size).toBe(37);
    for (const row of inventory) {
      if (row.registryGroup)
        expect(fields.some((field) => field.id === row.registryGroup)).toBe(
          true,
        );
      for (const key of [
        "statePath",
        "owner",
        "storage",
        "apply",
        "confirmation",
        "backend",
        "nextSlice",
      ])
        expect(row[key as keyof typeof row]).toBeTruthy();
    }
  });
});
