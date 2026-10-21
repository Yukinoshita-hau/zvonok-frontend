import { it, expect } from 'vitest';
import { readMessageDraft, writeMessageDraft } from '../src/components/DmItemsList/messageDrafts';
it('preserves text across auth unmounts while isolating accounts/rooms and deleting sent drafts', () => {
  writeMessageDraft('1:42', 'черновик');
  expect(readMessageDraft('1:42')).toBe('черновик');
  expect(readMessageDraft('2:42')).toBe(''); expect(readMessageDraft('1:43')).toBe('');
  writeMessageDraft('1:42', ''); expect(readMessageDraft('1:42')).toBe('');
});
