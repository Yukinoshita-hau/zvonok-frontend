import { expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

it("production routes, navigation and API clients have no legacy server/channel references", () => {
  const sourceRoot = join(import.meta.dirname, "../src");
  const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(ts|tsx)$/.test(entry.name));
  const sources = files.map(entry => readFileSync(join(entry.parentPath, entry.name), "utf8"));
  for (const source of sources) {
    expect(source).not.toMatch(/(?:serverApi|channelApi|fetchMyServers|channelMessageActions|ServerLayout|ChannelChat|MyServers)/);
    expect(source).not.toMatch(/(?:["'`])\/?(?:my-servers|servers?|channels?|channel-folders)(?:[/:"'`])/);
    expect(source).not.toContain("/topic/channel.");
    expect(source).not.toContain("/app/chat/channel");
  }
  const app = readFileSync(join(sourceRoot, "App.tsx"), "utf8");
  for (const route of ['"dm"', '"conference/:code"', '"invite/:token"', '"notifications"']) {
    expect(app).toContain(route);
  }
});
