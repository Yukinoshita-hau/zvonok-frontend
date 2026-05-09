# Rhythm Beatmap JSON Format (MVP)

```json
{
  "id": "demo-4k",
  "title": "Demo 4K Pattern",
  "artist": "Local Audio",
  "bpm": 140,
  "offsetMs": 0,
  "lanes": 4,
  "audioUrl": "optional-string",
  "notes": [
    {
      "id": "n-0001",
      "timeMs": 2000,
      "lane": 0,
      "type": "tap",
      "durationMs": 0
    }
  ]
}
```

## Fields
- `id`: map identifier.
- `title`: map title.
- `artist`: artist/track source label.
- `bpm`: informational BPM.
- `offsetMs`: global map timing offset in milliseconds.
- `lanes`: currently fixed to `4` for MVP.
- `audioUrl`: optional URL for prebound audio asset.
- `notes`: array of note objects.

## Note fields
- `note.id`: unique note id within map.
- `note.timeMs`: note time in milliseconds from audio start.
- `note.lane`: lane index (`0..3`).
- `note.type`: `tap` or `hold`.
- `note.durationMs`: optional duration for future hold-note support.

## Hold note future support
- MVP gameplay currently treats notes as tap logic.
- `type: "hold"` + `durationMs` are reserved for future engine expansion.
