import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SettingsWorkspace } from "../../src/features/settingsV2/SettingsWorkspace";
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import user from '../../src/store/slices/user.slice';
import device from '../../src/store/slices/device.slice';
const renderWorkspace = (props = {}) => renderToStaticMarkup(createElement(Provider, {store:configureStore({reducer:{user,device,call:()=>({status:'idle'})}}), children:createElement(MemoryRouter,{},createElement(SettingsWorkspace,props))}));
import { SettingsStatus } from "../../src/features/settingsV2/SettingsStatus";
import type { SettingState } from "../../src/features/settingsV2/SettingsRegistry";
describe("Settings foundation components", () => {
  it.each(['microphone','headphones','camera','screen','noise'])('mounts only the %s media panel', field => {
    const html = renderWorkspace({target:{category:'media',field}});
    expect(html.match(/data-media-panel=/g)).toHaveLength(1);
    expect(html).toContain(`id="setting-${field}"`);
    for (const other of ['microphone','headphones','camera','screen','noise'].filter(id=>id!==field)) expect(html).not.toContain(`id="setting-${other}"`);
  });
  it("renders an Advanced deep-link target expanded on initial mount", () => {
    const html = renderWorkspace({
        target: { category: "media", field: "noise" },
      });
    expect(html).toContain('<details open=""');
    expect(html).toContain('id="setting-noise"');
    expect(html).toContain('aria-current="page"');
  });
  it("renders accessible navigation, labelled search and unsupported fields without save controls", () => {
    const html = renderWorkspace();
    expect(html).toContain('aria-label="Разделы настроек"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-label="Поиск по настройкам"');
    expect(html).toContain('placeholder="Поиск по настройкам..."');
    expect(html).not.toMatch(/SETTINGS 2\.0|Экспериментальная версия|Открыть действующие настройки/);
    expect(html).toContain("Серверные настройки видимости онлайн");
    expect(html).toContain("Выйти везде");
    expect(html).not.toContain("<main");
    expect(html).toContain("Сохранить");
    for (const label of [
      "Аккаунт",
      "Голос и видео",
      "Уведомления",
      "Внешний вид",
      "Горячие клавиши",
      "Приложение",
    ])
      expect(html).toContain(label);
  });
  it.each<SettingState>([
    "idle",
    "applying",
    "success",
    "error",
    "unsupported",
  ])("renders state %s with live semantics", (state) => {
    const html = renderToStaticMarkup(createElement(SettingsStatus, { state }));
    expect(html).toContain(
      state === "error" ? 'role="alert"' : 'role="status"',
    );
    expect(html).not.toContain("undefined");
  });
});
