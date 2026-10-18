# Zvonok Stage 10.3 — Media Capture Ownership & Safe Hangup

Дата проверки: 2026-10-18. Проверялась только локальная Stage 10 acceptance-инфраструктура; production, пользовательские PostgreSQL/S3 данные и S3 не использовались.

## Итог

**FIXED с явной границей ответственности браузера.** При hangup/unmount завершённый CallSession больше не может опубликовать поздний microphone capture. Уже доступный принадлежащий этой сессии track останавливается при teardown; если браузер ещё не разрешил `getUserMedia`, запрос нельзя отменить средствами Web API, но его поздний результат немедленно останавливается до publish. Повторный dispose идемпотентен, старый owner ограничен своим callId/mediaGeneration/Room и не затрагивает следующий вызов.

Исправлено также закрытие LiveKit AudioContext при disconnect. Без явного `webAudioMix` установленный SDK оставлял свой AudioContext открытым; конфигурация `webAudioMix: false` сохраняет прежний режим воспроизведения и включает предусмотренное SDK закрытие контекста. Настоящий logout E2E подтвердил закрытие контекста через 119 мс после начального снимка cleanup. Это время относится к завершению асинхронного LiveKit disconnect; микрофонный track закрывался раньше.

## Ownership map и порядок teardown

| Ресурс / операция | Владелец | Завершение и защита |
|---|---|---|
| `getUserMedia` до возврата `MediaStream` | Браузерный capture operation | `getUserMedia` не принимает `AbortSignal`. Пока Promise ожидает permission/device, приложение не может гарантировать его немедленную отмену. Поздний результат принадлежит старому owner и немедленно останавливается. |
| Track после возврата SDK `createTracks` | `MicrophoneCaptureOwner` текущих callId/generation/Room | Сразу регистрируется; перед каждым publish проверяется lifecycle, callId, generation и Connected state. При dispose или смене options/device pending track останавливается. |
| Pending `publishTrack` / `setMicrophoneEnabled` | `MicrophoneCaptureOwner` сериализует желаемое состояние; LiveKit исполняет signaling | Invalidation блокирует дальнейшие действия старой операции. Завершившийся поздно publish вызывает stop/unpublish; он не может публиковать в новую Room. SDK signaling сам по себе не отменяется приложением. |
| Уже опубликованный `LocalAudioTrack` | LiveKit publication/Room и owner для lifecycle управления приложением | При terminal teardown приложение останавливает известный принадлежащий owner track без ожидания SDK publish timeout; Room disconnect дополнительно очищает публикации и PeerConnection. |
| Capture options / смена микрофона | `MicrophoneSettingsSync`, координация через owner | Изменение параметров инвалидирует прежний capture; старые tracks очищаются, новая операция использует актуальные options. Существующая настройка не переводится на параллельный mic manager. |
| RNNoise processor | `MicrophoneProcessorSync` / Zvonok processor; processor владеет своими узлами и teardown | Deferred init после unmount закрывается существующим processor cleanup; тест требует остановки поздно инициализированного processor. Не закрываем AudioGraph глобально. |
| Room AudioContext | LiveKit Room | `webAudioMix: false` сохраняет audio-element playback и включает закрытие SDK контекста при `Room.disconnect()`. SDK disconnect асинхронен, поэтому контекст может пережить React unmount на время закрытия signaling/PC. |
| AudioGraph / AudioContext Zvonok processor | `GlobalAudioGraph` | Отдельное владение от Room; terminal teardown конкретного звонка не закрывает общий граф чужой сессии. |

Типичный путь: UI end/leave или logout меняет Redux call lifecycle → `CallMicrophoneProvider` layout cleanup синхронно делает owner dispose → известные tracks останавливаются и listeners/timers owner отменяются → React размонтирует `LiveKitRoom`, который вызывает SDK `Room.disconnect()` → SDK завершает signaling/PeerConnection и закрывает Room AudioContext → любой поздний capture completion проходит guard и stop до publish. Обычный STOMP reconnect не размонтирует owner и не запускает terminal cleanup; краткий LiveKit `Reconnecting` не принимается за terminal call end.

## Evidence до исправления

- Stage 10.2 calls 23/24: настоящие browser capture и LiveKit, но передача результата из instrumented capture была искусственно задержана на 500 мс. Call 23 зафиксировал live track в раннем cleanup; call 24 остановил его лишь после существующего SDK pending-publish timeout около 15 секунд. Это не было зависшим системным permission prompt.
- Повтор до изменений, call 100 (`stage10-2-evidence`): React unmount на 2926.51 ms; SDK createTracks разрешился на 3053.485 ms с live track; stop произошёл на 18059.56 ms. От terminal unmount до stop получилось около 15.13 s. PeerConnections/AudioContexts на раннем снимке уже были закрыты. Причина задержки — возврат микрофонного track ожидал SDK путь/timeout перед доступом owner к нему.
- Предварительная версия исправления, logout call 124: настоящий `logoutUser` завершился, `react.unmount` на 1317.015 ms; браузерный capture был получен в 1309.485 ms, но результат удерживался harness на 1500 ms; LocalTrack вернулся из SDK в 2817.435 ms. Owner остановил track в 2817.535 ms, он стал `ended` к 2817.975 ms, публикации после unmount не было. При этом один LiveKit AudioContext был ещё `running` в первом снимке cleanup. Это выявило недостающую настройку teardown.

Следствие для приватности: во время незавершённого браузерного permission/device capture нельзя гарантировать, что системный запрос мгновенно остановлен кнопкой «Завершить». До возврата Promise приложение ещё не имеет track, который могло бы остановить. В стенде применялись синтетические устройства и управляемая задержка 500/1000/1500 ms после фактического получения stream, до передачи результата SDK; задержка была задана тестом, а не измерена как естественная задержка браузера. После разрешения Promise track остановлен менее чем за 1 ms после возврата SDK `createTracks`; он оставался только локальным capture и не был опубликован удалённому участнику. Для системного permission prompt максимальную естественную задержку стенд не измерял, и браузер не предоставляет приложению API отмены.

## Исправление

1. `MicrophoneCaptureOwner` владеет известными capture tracks в границах callId/mediaGeneration. Любой async completion повторно проверяет owner, call identity и состояние Room; stale capture немедленно stop, publish запрещён. Dispose и поздние completion безопасны при повторном вызове.
2. `CallMicrophoneProvider` создаёт owner на Room/session и вызывает idempotent dispose в layout cleanup. Проверка Redux state закрывает короткое окно между terminal action и React cleanup.
3. Toggle, hotkey и `MicrophoneSettingsSync` используют того же owner. Сохранены early-unmute/Connected guards Stage 10.2, reconnect mute, смена input device и текущий RNNoise pipeline.
4. `ActiveCallOverlay` явно задаёт `webAudioMix: false`. Это соответствует существующему playback mode и включает штатный LiveKit Room AudioContext close во время disconnect.
5. Browser diagnostics сохраняет callId/generation при late stop и пишет отдельные request/completed события. Harness дополнен pending capture/logout сценариями и отдельной папкой evidence; групповой сценарий принимает свой output directory.

SDK-предел остаётся: само обещание браузера `getUserMedia` не отменяется. `Room.disconnect()` также async и ожидает SDK signaling/engine close; код не вызывает приватные SDK методы и не обещает синхронное закрытие всей комнаты. Приложение гарантирует stop трека сразу после того, как получает к нему доступ, и не допускает поздний publish завершённой сессии.

## Проверки и статусы

### Детерминированные functional tests

`PASS` — deferred capture после hangup; capture после смены сессии; late publish; repeated dispose; cancel до старта capture; обновление options/device во время pending capture; processor init после unmount; pending SettingsSync publish cleanup; reconnect не запускает terminal cleanup; сохранены ранний unmute/hotkey guards. Всего `npm test -- --run`: **120/120**, 17 test files. Эти проверки не считаются настоящим браузерным E2E.

### Настоящие локальные browser + backend + PostgreSQL + LiveKit E2E

| Сценарий | Статус | Результат |
|---|---|---|
| Hangup во время управляемого late capture после браузерного gUM resolve | `PASS` | Три Playwright DM вызова 133–135, с 500/1000/1500 ms заданной задержкой передачи в SDK. Все поздние tracks остановлены, late publish отсутствует, конечные tracks/PC/AudioContexts очищены. Наблюдение cleanup составило 110/122/224 ms; это время до чистого снимка после terminal teardown, а не задержка системного permission prompt. |
| Logout во время late capture | `PASS` | Call 126; logout успешен; late track `ended`, publish отсутствует; первый cleanup snapshot содержал 1 открытый Room AudioContext, последующий чистый snapshot достигнут через 119 ms. |
| Обычный DM, одновременное включение микрофонов, unmute после Connected | `PASS` | Вызовы 130–132; оба клиента имели фактический двусторонний рост RTP bytes; Room cleanup без orphan track/context. |
| Быстрый повторный DM в той же тестовой серии | `PASS` | Один browser context повторно использовался для вызовов 130→131→132 после hangup каждого предыдущего вызова; нет блокировки старой сессией. |
| GROUP, 3 браузерных клиента, RNNoise, STOMP disconnect/reconnect | `PASS` | Call 136; по два удалённых inbound RTP потока на участника; рост RTP продолжался после STOMP reconnect; в финале tracks/PC/AudioContexts очищены. |
| PostgreSQL/LiveKit final consistency | `PASS` | Read-only audit: `activeCalls=0`, `activeParticipantsInEndedCalls=0`, `previewMismatches=0`, `sfuRooms=0`; Stage 10 test DB содержала 124 DM и 5 GROUP CallSession записей. |
| Естественно зависший системный permission prompt и его отмена | `BLOCKED` | Web API не предоставляет cancel для уже начатого `getUserMedia`; prompt не симулировался/не объявляется проверенным. |
| Реальное переключение физических микрофонов и акустическое качество | `NOT RUN` | Синтетические устройства подтверждают жизненный цикл, но не физическую смену девайса или качество звука. |
| NAT/Wi-Fi/IP смена и нестабильная внешняя сеть | `NOT RUN` | Browser offline и localhost SFU не являются такой проверкой. |

В процессе один запуск DM harness без прав доступа к Docker завершился на read-only SQL oracle (call 127–129). Это была инфраструктурная ошибка тестового harness, а не зафиксированный продуктовый FAIL; после запуска того же набора с доступом к label-verified тестовой БД вызовы 130–132 прошли. Промежуточный вызов 125 воспроизвёл AudioContext cleanup failure до адаптации harness к ожиданию асинхронного SDK disconnect; call 126 после изменения конфигурации и ожидания lifecycle прошёл.

`stage10-3-evidence/` содержит браузерные сырые snapshots, `dm-results-*.json`, group evidence и logout/pending-exit trails. Логи не включают JWT/API ключи; учётные данные тестовых пользователей редактируются harness.

## Сохранённая регрессия Stage 10.2

- Early user unmute и hotkey guards сохранены в существующих race tests.
- Одновременное включение микрофонов и connected unmute дали двусторонний RTP в вызовах 131/132.
- Connected → STOMP disconnect/reconnect проверен на GROUP call 136: RTP продолжал расти; Room/media lifecycle не был терминально закрыт.
- 30-секундное ожидание RTP не менялось.
- GROUP/RNNoise E2E повторно прошёл после `webAudioMix: false`.

## Регрессия сборок

- Frontend tests: **120/120 PASS**.
- TypeScript: `npx tsc -b` — **PASS, 0 errors**.
- Web build: `npm run build` — **SUCCESS**. Осталось существующее предупреждение о JS chunk >500 kB.
- Electron compile: `npm run build:electron` — **SUCCESS**.
- Backend код не менялся; backend build/test suite повторно не запускались. Stage 10.2 backend baseline не переобъявляется новым результатом.
- `git diff --check` прошёл; выводил только стандартные предупреждения Git о будущей нормализации CRLF.

## Изменённые файлы Stage 10.3

- `src/components/CallUi/MicrophoneCaptureOwner.ts` — ownership/cancellation guard для capture и publish.
- `src/components/CallUi/CallMicrophoneProvider.tsx` — owner на Room/call generation и синхронный idempotent cleanup.
- `src/components/ActiveCallOverlay/ActiveCallOverlay.tsx` — room options, включая закрытие Room AudioContext, и provider lifecycle.
- `src/components/ActiveCallOverlay/CallHotkeys.tsx`, `src/components/CallUi/MicrophoneToggleButton.tsx`, `src/components/CallUi/MicrophoneSettingsSync.tsx` — существующие UI/settings пути координируются через owner.
- `src/components/CallUi/MediaDiagnostics.tsx`, `scripts/stage10-2/browser-diagnostics.cjs`, `scripts/stage10-2/dm-investigation.cjs`, `scripts/stage10-2/group-regression.cjs` — диагностические события и воспроизводимые E2E варианты/output path.
- `tests/microphoneCaptureOwner.test.ts`, `tests/microphoneConnectionRace.test.ts`, `tests/microphoneHotkeyRace.test.ts`, `tests/microphoneSync.test.ts` — owner и race cleanup regression tests.
- `CORE-MEDIA-RELIABILITY-STAGE10-3.md` — этот отчёт.

Другие существующие изменения Stage 1–10.2 сохранены; их широкий diff не включён в список изменений данного этапа.

## Необходимая аппаратная приёмка

1. На двух физических компьютерах войти двумя изолированными тестовыми аккаунтами, разрешить настоящий микрофон и начать DM audio call.
2. Во время реального разрешённого/ожидающего системного permission prompt завершить звонок; проверить, что поздно выданный доступ не публикуется, а локальный индикатор микрофона выключается сразу после получения track. Отдельно зафиксировать задержку UI terminal action → `getUserMedia` resolve → `track.stop`.
3. Повторить с быстрым end→new DM, сменой USB/Bluetooth input во время capture, RNNoise on/off и Android/iOS/browser разрешениями, если эти клиенты поддерживаются.
4. Проверить, что в новой сессии старый track не остановил новый микрофон; в удалённой вкладке проверить RTP прекращение/исчезновение публикации.
5. Повторить в GROUP из трёх физических клиентов и проверить mute/unmute, один participant leave, повторный join и общий hangup.
6. Сохранить обезличенные browser console/LiveKit stats: callId/generation, `readyState`, PeerConnection state, AudioContext state и sender/receiver RTP bytes. Не записывать токены.

## Остановка стенда и остаточные риски

После финального audit тестовый backend и Vite остановлены; остановлены только контейнеры, проверенные по Stage 10 labels (`zvonok-stage10-pg`, `zvonok-stage10-1-livekit`). Контейнеры и данные не удалялись. Stage evidence сохранён локально. S3 не запускался и не изменялся.

Остаются ограничения браузерного системного permission prompt, реального оборудования, физических сетей/NAT и задержки LiveKit signaling на внешней сети. Они не опровергают гарантию: после появления track у приложения stale session не публикует его, а доступный owner track останавливается сразу; успешные синтетические DM/GROUP вызовы сохранили двусторонний RTP.
