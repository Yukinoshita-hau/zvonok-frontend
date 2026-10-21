// Drafts survive auth-route unmounts in this renderer, scoped to account and room.
const drafts = new Map<string, string>();
export const readMessageDraft = (key: string) => drafts.get(key) ?? '';
export function writeMessageDraft(key: string, text: string) {
  if (text) drafts.set(key, text); else drafts.delete(key);
}
