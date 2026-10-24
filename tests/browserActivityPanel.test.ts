import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BrowserActivityPanel } from '../src/components/CallUi/BrowserActivity/BrowserActivityPanel';
import type { BrowserActivityState } from '../src/components/CallUi/BrowserActivity/useBrowserActivity';

vi.mock('../src/components/CallUi/BrowserActivity/BrowserVideo', () => ({
  BrowserVideo: ({ canControl }: { canControl: boolean }) => createElement('div', { 'data-video': 'mounted', 'data-control': canControl }),
}));
const browser = {
  activity: { activityId: 'one', owner: true, joined: true, session: { sessionId: 'session', status: 'active', currentUrl: 'https://example.com' } },
  connected: true, canControl: true, busy: false, perform: vi.fn(), input: vi.fn(), setShow: vi.fn(), media: vi.fn(),
} as unknown as BrowserActivityState;

describe('Browser Activity tile', () => {
  it('keeps video mounted across expanded, collapsed and hidden call views', () => {
    for (const compact of [true, false]) for (const visible of [true, false]) {
      const html = renderToStaticMarkup(createElement(BrowserActivityPanel, { browser, compact, visible }));
      expect(html).toContain('data-video="mounted"');
      expect(html).toContain(`data-control="${!compact && visible}"`);
    }
  });
  it('offers a single join action without opening media before authorization', () => {
    const guest = { ...browser, activity: { ...browser.activity!, joined: false, owner: false, session: null } };
    const html = renderToStaticMarkup(createElement(BrowserActivityPanel, { browser: guest, compact: true, visible: true }));
    expect(html).toContain('Открыть и присоединиться');
    expect(html).not.toContain('data-video');
  });
  it('keeps service errors dismissible without replacing the live browser view', () => {
    const withError = { ...browser, error: 'Сервис браузера временно недоступен.' };
    const html = renderToStaticMarkup(createElement(BrowserActivityPanel, { browser: withError, compact: false, visible: true }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-label="Скрыть сообщение"');
    expect(html).toContain('data-testid="browser-media-preview"');
  });
  it('renders synchronized real tabs and keeps tab controls out of the compact call tile', () => {
    const withTabs = { ...browser, activity: { ...browser.activity!, session: { ...browser.activity!.session!, media: { profile: '720p30' }, activeTabId: 'tab-a', tabs: [{ id: 'tab-a', url: 'https://example.com', title: 'Example' }, { id: 'tab-b', url: 'https://google.com', title: 'Google' }] } } };
    const expanded = renderToStaticMarkup(createElement(BrowserActivityPanel, { browser: withTabs, compact: false, visible: true }));
    expect(expanded).toContain('role="tablist"');
    expect(expanded).toContain('Example'); expect(expanded).toContain('Google');
    expect(expanded).toContain('aria-selected="true"'); expect(expanded).toContain('aria-selected="false"');
    expect(expanded).toContain('Закрыть вкладку Example'); expect(expanded).toContain('Закрыть вкладку Google');
    expect(expanded).toContain('Новая вкладка');
    expect(expanded).toContain('aria-label="Качество видео"');
    expect(expanded).toContain('Плавно · 720p · 60 кадров/с');
    expect(expanded).toContain('Вы управляете · Сбалансированно');
    const compact = renderToStaticMarkup(createElement(BrowserActivityPanel, { browser: withTabs, compact: true, visible: true }));
    expect(compact).not.toContain('role="tablist"');
    expect(compact).toContain('aria-label="Открыть совместный браузер"');
    expect(compact).toContain('data-testid="browser-media-preview"');
    expect(compact).not.toContain('data-testid="browser-media-preview" hidden=""');
  });
});

