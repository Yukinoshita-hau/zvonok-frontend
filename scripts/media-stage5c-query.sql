\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE s5c_message (id bigint PRIMARY KEY, room_id bigint, sent_at timestamp, deleted_at timestamp);
CREATE TEMP TABLE s5c_attachment (id bigint PRIMARY KEY, message_id bigint, type text, original_file_name text);
INSERT INTO s5c_message SELECT n, CASE WHEN n <= 100000 THEN 1 ELSE 2 END,
  timestamp '2026-10-19' + (n / 10) * interval '1 second', NULL FROM generate_series(1,200000) n;
INSERT INTO s5c_attachment SELECT n, n*100, CASE WHEN n%3=0 THEN 'IMAGE' ELSE 'FILE' END,
  'Документ-'||n||'.pdf' FROM generate_series(1,2000) n;
ANALYZE s5c_message;
ANALYZE s5c_attachment;
\echo BASELINE_ROOM_1000_WITH_99000_EMPTY_MESSAGES
EXPLAIN (ANALYZE, BUFFERS) SELECT a.id,m.sent_at FROM s5c_attachment a JOIN s5c_message m ON m.id=a.message_id
WHERE m.room_id=1 AND m.deleted_at IS NULL AND position('документ' in lower(a.original_file_name))>0
ORDER BY m.sent_at DESC,a.id DESC LIMIT 41;
CREATE INDEX ON s5c_message(room_id,sent_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE INDEX ON s5c_attachment(message_id,id DESC);
ANALYZE s5c_message;
ANALYZE s5c_attachment;
\echo CANDIDATE_INDEXES_FIRST_PAGE
EXPLAIN (ANALYZE, BUFFERS) SELECT a.id,m.sent_at FROM s5c_attachment a JOIN s5c_message m ON m.id=a.message_id
WHERE m.room_id=1 AND m.deleted_at IS NULL AND position('документ' in lower(a.original_file_name))>0
ORDER BY m.sent_at DESC,a.id DESC LIMIT 41;
\echo DEEP_KEYSET_PAGE
EXPLAIN (ANALYZE, BUFFERS) SELECT a.id,m.sent_at FROM s5c_attachment a JOIN s5c_message m ON m.id=a.message_id
WHERE m.room_id=1 AND m.deleted_at IS NULL AND (m.sent_at < timestamp '2026-10-19 00:16:40' OR
(m.sent_at=timestamp '2026-10-19 00:16:40' AND a.id<100))
ORDER BY m.sent_at DESC,a.id DESC LIMIT 41;
DO $$
DECLARE n int; total int; seen bigint[]; page bigint[]; cursor_date timestamp; cursor_id bigint; expected int;
BEGIN
FOREACH n IN ARRAY ARRAY[20,100,1000] LOOP
  seen='{}'; cursor_date=NULL; cursor_id=NULL;
  LOOP
    SELECT array_agg(id ORDER BY sent_at DESC,id DESC) INTO page FROM (
      SELECT a.id,m.sent_at FROM s5c_attachment a JOIN s5c_message m ON m.id=a.message_id
      WHERE a.id<=n AND m.room_id=1 AND m.deleted_at IS NULL
      AND (cursor_date IS NULL OR (m.sent_at,a.id)<(cursor_date,cursor_id))
      ORDER BY m.sent_at DESC,a.id DESC LIMIT 17) q;
    EXIT WHEN page IS NULL;
    IF seen && page THEN RAISE EXCEPTION 'duplicate'; END IF;
    seen=seen||page; cursor_id=page[array_length(page,1)];
    SELECT m.sent_at INTO cursor_date FROM s5c_attachment a JOIN s5c_message m ON m.id=a.message_id WHERE a.id=cursor_id;
  END LOOP;
  IF cardinality(seen)<>n THEN RAISE EXCEPTION 'missing at scale %',n; END IF;
  RAISE NOTICE 'PASS pagination %',n;
END LOOP;
-- Multiple files per message and identical timestamps, including deletion between pages.
UPDATE s5c_attachment SET message_id=100 WHERE id<=20;
UPDATE s5c_message SET sent_at=timestamp '2026-10-19' WHERE id<=2000;
UPDATE s5c_message SET deleted_at=now() WHERE id=200;
SELECT count(*) INTO total FROM s5c_attachment a JOIN s5c_message m ON m.id=a.message_id WHERE a.id<=20 AND m.deleted_at IS NULL;
IF total<>20 THEN RAISE EXCEPTION 'multi attachment lost'; END IF;
RAISE NOTICE 'PASS multiple attachments and equal timestamps';
END $$;
ROLLBACK;
