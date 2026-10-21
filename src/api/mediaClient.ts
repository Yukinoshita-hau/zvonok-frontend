// Per document: duplicated tabs must not inherit the media owner's identifier.
export let mediaHeaders = { "X-Media-Client-Id": crypto.randomUUID() };
// A delayed release from a previous join must not release this join's media.
export function rotateMediaClient() { mediaHeaders = { "X-Media-Client-Id": crypto.randomUUID() }; }
