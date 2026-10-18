# Zvonok Core Stabilization — Stage 7: Frontend Type Safety & Runtime Reliability

Дата: 2026-10-18, Asia/Yekaterinburg.

## Результат и границы

Исходные 66 diagnostics воспроизведены актуальной полной проверкой. Исправлены 54; остаются ровно 12 в legacy Server/Channel. В действующем ядре известных TypeScript diagnostics нет. Полный `tsc -b` **НЕ SUCCESS**, exit code 2: legacy не исключался из config и не переписывался. Web и Electron собираются. Frontend: 79/79 (исходные 58 сохранены, добавлен 21 regression scenario).

Перед изменениями изучены git status/diff, отчёты Stage 2/3/5/6 и backend AGENTS.md. Все незакоммиченные изменения Stage 1–6 оставлены на месте. Backend использовался только для чтения Java DTO/service mapping. Коммитов, миграций, production операций, изменений `.factorypath`, CSS/дизайна, Canvas/Code Sessions, Hub или Stage 8 нет. package.json/package-lock и electron-dist уже были dirty до этапа; зависимости Stage 7 не добавлялись. Existing call architecture сохранена.

## 1. Классификация исходных diagnostics

Полные исходные сообщения: `stage7-ts-baseline.txt`; координаты в таблице относятся к исходному состоянию. Итоговые сообщения: `stage7-ts-final.txt`. Основная категория назначена каждой диагностике ровно один раз; cross-cutting области описаны ниже. Friends action-only reducers отнесены к Redux; screen preset helpers — к LiveKit; camera preview — к UI.

| Категория | Исходных diagnostics |
|---|---:|
| Auth/JWT | 0 |
| Redux/state management | 21 |
| WebSocket/STOMP | 2 |
| DM/GROUP Messages | 7 |
| LiveKit/CallUi | 6 |
| Audio/RNNoise | 12 |
| Screen Sharing | 0 |
| Profiles/Friends | 0 |
| UI components | 6 |
| Legacy Server/Channel | 12 |
| Прочее | 0 |
| **Всего** | **66** |

| Файл:строка:колонка | TS | Исходное описание | Корневая причина | Связь с функционалом | Runtime-риск | Исправление/решение |
|---|---|---|---|---|---|---|
| `src/audio/AudioEngine.ts:1:10` | TS2300 | Duplicate identifier 'loadRnnoise'. | Дублирован импорт loadRnnoise | Audio/RNNoise | Не подключён; скрытый риск лишнего context/undefined node при активации | Используется переданный context; узлы созданы в constructor; init single-flight, teardown guarded; лишние bindings убраны |
| `src/audio/AudioEngine.ts:2:10` | TS2300 | Duplicate identifier 'loadRnnoise'. | Дублирован импорт loadRnnoise | Audio/RNNoise | Не подключён; скрытый риск лишнего context/undefined node при активации | Используется переданный context; узлы созданы в constructor; init single-flight, teardown guarded; лишние bindings убраны |
| `src/audio/AudioEngine.ts:2:23` | TS6133 | 'RnnoiseWorkletNode' is declared but its value is never read. | Неиспользуемый import/wasmBinary или аргумент конструктора | Audio/RNNoise | Не подключён; скрытый риск лишнего context/undefined node при активации | Используется переданный context; узлы созданы в constructor; init single-flight, teardown guarded; лишние bindings убраны |
| `src/audio/AudioEngine.ts:8:10` | TS2564 | Property 'ctx' has no initializer and is not definitely assigned in the constructor. | Конструктор игнорировал переданный AudioContext | Audio/RNNoise | Не подключён; скрытый риск лишнего context/undefined node при активации | Используется переданный context; узлы созданы в constructor; init single-flight, teardown guarded; лишние bindings убраны |
| `src/audio/AudioEngine.ts:9:10` | TS6133 | 'wasmBinary' is declared but its value is never read. | Неиспользуемый import/wasmBinary или аргумент конструктора | Audio/RNNoise | Не подключён; скрытый риск лишнего context/undefined node при активации | Используется переданный context; узлы созданы в constructor; init single-flight, teardown guarded; лишние bindings убраны |
| `src/audio/AudioEngine.ts:31:14` | TS6133 | 'ctx' is declared but its value is never read. | Неиспользуемый import/wasmBinary или аргумент конструктора | Audio/RNNoise | Не подключён; скрытый риск лишнего context/undefined node при активации | Используется переданный context; узлы созданы в constructor; init single-flight, teardown guarded; лишние bindings убраны |
| `src/audio/AudioEngine.ts:111:23` | TS2769 | No overload matches this call. | inputGain объявлен optional, хотя нужен после init | Audio/RNNoise | Не подключён; скрытый риск лишнего context/undefined node при активации | Используется переданный context; узлы созданы в constructor; init single-flight, teardown guarded; лишние bindings убраны |
| `src/audio/AudioEngine.ts:126:23` | TS2769 | No overload matches this call. | inputGain объявлен optional, хотя нужен после init | Audio/RNNoise | Не подключён; скрытый риск лишнего context/undefined node при активации | Используется переданный context; узлы созданы в constructor; init single-flight, teardown guarded; лишние bindings убраны |
| `src/audio/AudioEngine.ts:135:23` | TS2769 | No overload matches this call. | inputGain объявлен optional, хотя нужен после init | Audio/RNNoise | Не подключён; скрытый риск лишнего context/undefined node при активации | Используется переданный context; узлы созданы в constructor; init single-flight, teardown guarded; лишние bindings убраны |
| `src/audio/AudioEngine.ts:139:8` | TS2339 | Property 'currentDeviceId' does not exist on type 'AudioEngine'. | Присваивание несуществующему currentDeviceId | Audio/RNNoise | Не подключён; скрытый риск лишнего context/undefined node при активации | Используется переданный context; узлы созданы в constructor; init single-flight, teardown guarded; лишние bindings убраны |
| `src/audio/AudioEngine.ts:159:3` | TS2532 | Object is possibly 'undefined'. | Доступ к optional inputGain без readiness-модели | Audio/RNNoise | Не подключён; скрытый риск лишнего context/undefined node при активации | Используется переданный context; узлы созданы в constructor; init single-flight, teardown guarded; лишние bindings убраны |
| `src/components/CallUi/CallQualityController.tsx:311:77` | TS2345 | Argument of type 'CallQualityPreset / ScreenShareQualityPreset' is not assignable to parameter of type 'CallQualityPreset'. | Общий helper требовал camera-specific value вместо используемых числовых полей | LiveKit/CallUi | Типовая ошибка; controller не подключён, общие preset helpers активны | Pick только фактически используемых width/height/frameRate/maxBitrate |
| `src/components/CallUi/CallQualityController.tsx:350:2` | TS6133 | 'quality' is declared but its value is never read. | Аргумент намеренно не используется | LiveKit/CallUi | Типовая ошибка; controller не подключён, общие preset helpers активны | Явный underscore аргумент с сохранением API |
| `src/components/CallUi/CallQualityController.tsx:419:6` | TS2367 | This comparison appears to be unintentional because the types '"low" / "high" / "mediumPlus" / "highPlus" / "game60" / "game120" / "g1080p144" / "g1080p180" / "g1080p200" / "g1080p220" / "g1080p300" / "c1440p30" / "c4k30" / "c4k60" / "c4k120" / "g8k30" / "g8k60"' and '"medium"' have no overlap. | Дублированная проверка medium после уже выполненного narrowing | LiveKit/CallUi | Типовая ошибка; controller не подключён, общие preset helpers активны | Удалена дублированная ветка |
| `src/components/CallUi/CallQualityController.tsx:430:2` | TS2322 | Type 'ScreenShareManualQuality' is not assignable to type 'ManualCallQuality'. | Array.includes не сужает union screen-профилей до camera quality | LiveKit/CallUi | Типовая ошибка; controller не подключён, общие preset helpers активны | Явные literal checks low/medium/high |
| `src/components/ChannelChat/ChannelChat.tsx:19:61` | TS7006 | Parameter 'c' implicitly has an 'any' type. | Отсутствующий channelFoldier порождает implicit-any downstream | Legacy Server/Channel | Только legacy: потенциальный сбой списка/перехода | Отложено без изменения legacy |
| `src/components/ChannelFolder/ChannelFolder.props.ts:1:36` | TS2307 | Cannot find module '../../entities/channelFoldier' or its corresponding type declarations. | Отсутствующий channelFoldier порождает implicit-any downstream | Legacy Server/Channel | Только legacy: потенциальный сбой списка/перехода | Отложено без изменения legacy |
| `src/components/ChannelFolder/ChannelFolder.tsx:26:27` | TS7006 | Parameter 'channel' implicitly has an 'any' type. | Отсутствующий channelFoldier порождает implicit-any downstream | Legacy Server/Channel | Только legacy: потенциальный сбой списка/перехода | Отложено без изменения legacy |
| `src/components/ChannelItemsList/ChannelItemList.tsx:22:9` | TS6133 | 'contextMenu' is declared but its value is never read. | Неиспользуемые legacy bindings | Legacy Server/Channel | Нет прямого runtime-эффекта | Отложено без изменения legacy |
| `src/components/DmItemsList/DmItemsList.tsx:100:21` | TS18048 | 'currentRoom.unreadCount' is possibly 'undefined'. | optional chaining оставляет undefined в числовом сравнении | DM/GROUP Messages | Отсутствующая комната не должна запускать markRead | (unreadCount ?? 0) > 0 |
| `src/components/MessagesSkeleton/MessagesSkeleton.tsx:10:25` | TS6133 | 'el' is declared but its value is never read. | Неиспользуемый map element | UI components | Нет runtime-эффекта | Intentional-unused _el |
| `src/components/NavigateBar/NavigateBar.tsx:32:33` | TS2345 | Argument of type 'string / undefined' is not assignable to parameter of type 'string'. | Профиль ещё не загружен: username undefined | UI components | StringToColor читал length у undefined | Пустая строка для детерминированного fallback |
| `src/components/RoomsList/RoomsList.tsx:38:28` | TS2551 | Property 'members' does not exist on type 'Room'. Did you mean 'memberIds'? | Комнаты уже normalized, но UI читает прежний members[] | DM/GROUP Messages | Потеря имени PRIVATE room с null name | memberIds разрешаются через users.byId |
| `src/components/RoomsList/RoomsList.tsx:38:42` | TS7006 | Parameter 'member' implicitly has an 'any' type. | Комнаты уже normalized, но UI читает прежний members[] | DM/GROUP Messages | Потеря имени PRIVATE room с null name | memberIds разрешаются через users.byId |
| `src/components/VoiceVideoSetting/CameraPreview/CameraPreviewCard.tsx:3:42` | TS2307 | Cannot find module './useCameraPreview' or its corresponding type declarations. | Импорт отсутствующего hook для status type | UI components | Только type import | Выделен status type без выдуманного hook |
| `src/components/VoiceVideoSetting/CameraPreview/CameraPreviewState.tsx:2:42` | TS2307 | Cannot find module './useCameraPreview' or its corresponding type declarations. | Импорт отсутствующего hook для status type | UI components | Только type import | Выделен status type без выдуманного hook |
| `src/components/VoiceVideoSetting/CameraPreview/CameraView.tsx:38:32` | TS2339 | Property 'getTracks' does not exist on type 'MediaProvider'. | HTMLVideoElement.srcObject имеет широкий MediaProvider union | UI components | Реальная утечка камеры: cleanup DOM ref не владел pending stream | Эффект владеет stream через cancellable capture; поздний stream останавливается |
| `src/components/VoiceVideoSetting/CameraPreview/CameraView.tsx:38:52` | TS7006 | Parameter 'track' implicitly has an 'any' type. | HTMLVideoElement.srcObject имеет широкий MediaProvider union | UI components | Реальная утечка камеры: cleanup DOM ref не владел pending stream | Эффект владеет stream через cancellable capture; поздний stream останавливается |
| `src/entities/server.ts:1:36` | TS2307 | Cannot find module './channelFoldier' or its corresponding type declarations. | Отсутствующий channelFoldier порождает implicit-any downstream | Legacy Server/Channel | Только legacy: потенциальный сбой списка/перехода | Отложено без изменения legacy |
| `src/entities/shortMessage.ts:2:15` | TS2305 | Module '"./user"' has no exported member 'UserMini'. | UserMini импортирован из неправильного модуля | DM/GROUP Messages | Типовой import defect | Правильный импорт; Room avatarUrl nullable; дополнительно name nullable по RoomService |
| `src/livekit/audio/ZvonokLiveKitAudioProcessor.ts:14:14` | TS1294 | This syntax is not allowed when 'erasableSyntaxOnly' is enabled. | Parameter property запрещён erasableSyntaxOnly | Audio/RNNoise | Только несовместимый TS-синтаксис; Stage 5 lifecycle guard сохраняется | Обычное private поле и явное присваивание constructor |
| `src/pages/DmChat/DmChat.tsx:306:5` | TS2322 | Type 'Room / null' is not assignable to type 'Room'. | RoomSettingModal требует Room, currentRoom nullable | DM/GROUP Messages | Открытый modal мог разыменовать отсутствующую комнату | Modal монтируется только при currentRoom |
| `src/pages/MyServers/MyServers.tsx:19:10` | TS18047 | 'servers' is possibly 'null'. | Nullable servers не сужен | Legacy Server/Channel | Только legacy: потенциальный сбой списка/перехода | Отложено без изменения legacy |
| `src/pages/ServerLayout/ServerLayout.tsx:21:78` | TS7006 | Parameter 'c' implicitly has an 'any' type. | Отсутствующий channelFoldier порождает implicit-any downstream | Legacy Server/Channel | Только legacy: потенциальный сбой списка/перехода | Отложено без изменения legacy |
| `src/pages/ServerLayout/ServerLayout.tsx:22:8` | TS6133 | 'voiceChannels' is declared but its value is never read. | Неиспользуемые legacy bindings | Legacy Server/Channel | Нет прямого runtime-эффекта | Отложено без изменения legacy |
| `src/pages/ServerLayout/ServerLayout.tsx:22:79` | TS7006 | Parameter 'c' implicitly has an 'any' type. | Отсутствующий channelFoldier порождает implicit-any downstream | Legacy Server/Channel | Только legacy: потенциальный сбой списка/перехода | Отложено без изменения legacy |
| `src/pages/ServerLayout/ServerLayout.tsx:23:8` | TS6133 | 'activeTextChannel' is declared but its value is never read. | Неиспользуемые legacy bindings | Legacy Server/Channel | Нет прямого runtime-эффекта | Отложено без изменения legacy |
| `src/store/middlewares/websocket/subscriptions.ts:191:42` | TS2322 | Type 'string / undefined' is not assignable to type 'string'. | Nullable friend payload давал optional username в обязательном notification target | WebSocket/STOMP | Неправильный/пустой target; дополнительно вскрылись отсутствующие notification IDs | Payload validation/narrowing; уникальный id; CREATED открывает sender, ACCEPTED receiver |
| `src/store/middlewares/websocket/subscriptions.ts:227:42` | TS2322 | Type 'string / undefined' is not assignable to type 'string'. | Nullable friend payload давал optional username в обязательном notification target | WebSocket/STOMP | Неправильный/пустой target; дополнительно вскрылись отсутствующие notification IDs | Payload validation/narrowing; уникальный id; CREATED открывает sender, ACCEPTED receiver |
| `src/store/slices/channelMessage.slice.ts:96:4` | TS6133 | 'currentState' is declared but its value is never read. | Неиспользуемые legacy bindings | Legacy Server/Channel | Нет прямого runtime-эффекта | Отложено без изменения legacy |
| `src/store/slices/channelMessage.slice.ts:97:4` | TS6133 | 'action' is declared but its value is never read. | Неиспользуемые legacy bindings | Legacy Server/Channel | Нет прямого runtime-эффекта | Отложено без изменения legacy |
| `src/store/slices/friend.slice.ts:1:41` | TS6133 | 'current' is declared but its value is never read. | Неиспользуемый import current | Redux/state management | Нет прямого runtime-эффекта | PayloadAction сохранён; intentional-unused параметры отмечены underscore, import удалён |
| `src/store/slices/friend.slice.ts:98:23` | TS6133 | 'currentState' is declared but its value is never read. | Action-only reducer потребляется STOMP middleware, state/action здесь не читаются | Redux/state management | Нет прямого runtime-эффекта | PayloadAction сохранён; intentional-unused параметры отмечены underscore, import удалён |
| `src/store/slices/friend.slice.ts:98:37` | TS6133 | 'action' is declared but its value is never read. | Action-only reducer потребляется STOMP middleware, state/action здесь не читаются | Redux/state management | Нет прямого runtime-эффекта | PayloadAction сохранён; intentional-unused параметры отмечены underscore, import удалён |
| `src/store/slices/friend.slice.ts:101:25` | TS6133 | 'currentState' is declared but its value is never read. | Action-only reducer потребляется STOMP middleware, state/action здесь не читаются | Redux/state management | Нет прямого runtime-эффекта | PayloadAction сохранён; intentional-unused параметры отмечены underscore, import удалён |
| `src/store/slices/friend.slice.ts:101:39` | TS6133 | 'action' is declared but its value is never read. | Action-only reducer потребляется STOMP middleware, state/action здесь не читаются | Redux/state management | Нет прямого runtime-эффекта | PayloadAction сохранён; intentional-unused параметры отмечены underscore, import удалён |
| `src/store/slices/friend.slice.ts:104:25` | TS6133 | 'currentState' is declared but its value is never read. | Action-only reducer потребляется STOMP middleware, state/action здесь не читаются | Redux/state management | Нет прямого runtime-эффекта | PayloadAction сохранён; intentional-unused параметры отмечены underscore, import удалён |
| `src/store/slices/friend.slice.ts:104:39` | TS6133 | 'action' is declared but its value is never read. | Action-only reducer потребляется STOMP middleware, state/action здесь не читаются | Redux/state management | Нет прямого runtime-эффекта | PayloadAction сохранён; intentional-unused параметры отмечены underscore, import удалён |
| `src/store/slices/friend.slice.ts:107:25` | TS6133 | 'currentState' is declared but its value is never read. | Action-only reducer потребляется STOMP middleware, state/action здесь не читаются | Redux/state management | Нет прямого runtime-эффекта | PayloadAction сохранён; intentional-unused параметры отмечены underscore, import удалён |
| `src/store/slices/friend.slice.ts:107:39` | TS6133 | 'action' is declared but its value is never read. | Action-only reducer потребляется STOMP middleware, state/action здесь не читаются | Redux/state management | Нет прямого runtime-эффекта | PayloadAction сохранён; intentional-unused параметры отмечены underscore, import удалён |
| `src/store/slices/friend.slice.ts:110:18` | TS6133 | 'currentState' is declared but its value is never read. | Action-only reducer потребляется STOMP middleware, state/action здесь не читаются | Redux/state management | Нет прямого runtime-эффекта | PayloadAction сохранён; intentional-unused параметры отмечены underscore, import удалён |
| `src/store/slices/friend.slice.ts:110:32` | TS6133 | 'action' is declared but its value is never read. | Action-only reducer потребляется STOMP middleware, state/action здесь не читаются | Redux/state management | Нет прямого runtime-эффекта | PayloadAction сохранён; intentional-unused параметры отмечены underscore, import удалён |
| `src/store/slices/message.slice.ts:247:4` | TS6133 | 'state' is declared but its value is never read. | Action-only reducer потребляется middleware; параметры не читаются | Redux/state management | Нет прямого runtime-эффекта | Intentional-unused параметры отмечены underscore; payload типов не ослаблен |
| `src/store/slices/message.slice.ts:248:4` | TS6133 | 'action' is declared but its value is never read. | Action-only reducer потребляется middleware; параметры не читаются | Redux/state management | Нет прямого runtime-эффекта | Intentional-unused параметры отмечены underscore; payload типов не ослаблен |
| `src/store/slices/message.slice.ts:274:4` | TS6133 | 'state' is declared but its value is never read. | Action-only reducer потребляется middleware; параметры не читаются | Redux/state management | Нет прямого runtime-эффекта | Intentional-unused параметры отмечены underscore; payload типов не ослаблен |
| `src/store/slices/message.slice.ts:275:4` | TS6133 | 'action' is declared but its value is never read. | Action-only reducer потребляется middleware; параметры не читаются | Redux/state management | Нет прямого runtime-эффекта | Intentional-unused параметры отмечены underscore; payload типов не ослаблен |
| `src/store/slices/message.slice.ts:282:4` | TS6133 | 'state' is declared but its value is never read. | Action-only reducer потребляется middleware; параметры не читаются | Redux/state management | Нет прямого runtime-эффекта | Intentional-unused параметры отмечены underscore; payload типов не ослаблен |
| `src/store/slices/message.slice.ts:283:4` | TS6133 | 'action' is declared but its value is never read. | Action-only reducer потребляется middleware; параметры не читаются | Redux/state management | Нет прямого runtime-эффекта | Intentional-unused параметры отмечены underscore; payload типов не ослаблен |
| `src/store/slices/message.slice.ts:290:4` | TS6133 | 'state' is declared but its value is never read. | Action-only reducer потребляется middleware; параметры не читаются | Redux/state management | Нет прямого runtime-эффекта | Intentional-unused параметры отмечены underscore; payload типов не ослаблен |
| `src/store/slices/message.slice.ts:291:4` | TS6133 | 'action' is declared but its value is never read. | Action-only reducer потребляется middleware; параметры не читаются | Redux/state management | Нет прямого runtime-эффекта | Intentional-unused параметры отмечены underscore; payload типов не ослаблен |
| `src/store/slices/message.slice.ts:297:4` | TS6133 | 'state' is declared but its value is never read. | Action-only reducer потребляется middleware; параметры не читаются | Redux/state management | Нет прямого runtime-эффекта | Intentional-unused параметры отмечены underscore; payload типов не ослаблен |
| `src/store/slices/message.slice.ts:298:4` | TS6133 | 'action' is declared but its value is never read. | Action-only reducer потребляется middleware; параметры не читаются | Redux/state management | Нет прямого runtime-эффекта | Intentional-unused параметры отмечены underscore; payload типов не ослаблен |
| `src/utils/callQuality.ts:377:2` | TS6133 | 'kind' is declared but its value is never read. | Аргумент намеренно не используется | LiveKit/CallUi | Типовая ошибка; controller не подключён, общие preset helpers активны | Явный underscore аргумент с сохранением API |
| `src/utils/callQuality.ts:438:41` | TS2345 | Argument of type 'ScreenShareQualityPreset' is not assignable to parameter of type 'CallQualityPreset'. | Общий helper требовал camera-specific value вместо используемых числовых полей | LiveKit/CallUi | Типовая ошибка; controller не подключён, общие preset helpers активны | Pick только фактически используемых width/height/frameRate/maxBitrate |
| `src/utils/normalizeRoom.ts:2:15` | TS2305 | Module '"../entities/user"' has no exported member 'UserMini'. | UserMini импортирован из неправильного модуля | DM/GROUP Messages | Типовой import defect | Правильный импорт; Room avatarUrl nullable; дополнительно name nullable по RoomService |
| `src/utils/normalizeRoom.ts:13:4` | TS2322 | Type 'string / null' is not assignable to type 'string'. | Nullable DTO avatarUrl расходился с Redux Room | DM/GROUP Messages | Несоответствие runtime-state контракту | Правильный импорт; Room avatarUrl nullable; дополнительно name nullable по RoomService |

## 2. Исправления Redux/API/WebSocket

- Старый `store/interfaces/rootState.interface.ts` больше не поддерживает отдельный неполный список reducers: он реэкспортирует RootState/AppDispatch из реального store. Канонический RootState выводится из appReducer; AppDispatch сохраняет типизированную thunk/dispatch сигнатуру существующего middleware. В history thunk добавлен `state: RootState`, убраны hand-written state assertions. Action-only reducers сохранены как команды middleware, а не превращены в фиктивные state mutations.
- Room DTO и normalized Room допускают null name/avatarUrl. Это реальный контракт: RoomService создаёт PRIVATE room с `name=null`; RoomResponse содержит nullable avatar. RoomsList разрешает имена по memberIds/users.byId. Не выдумывается members в normalized state. Nullable currentRoom проверяется перед RoomSettingModal; unread и username безопасно обрабатывают отсутствие данных.
- `SenderDto` содержит только id/username/displayName/avatarUrl/status. Введён MessageSender как точная проекция этих полей. UserSummary в normalized cache допускает отсутствие timestamp-полей, которые сообщение не содержит; полноценный UserMini для RoomMemberShortDto остаётся полным. Это разделение разных контрактов, а не ослабление UserMini. Общие member components используют только реально нужный summary.
- `UserProfileUpdatedEvent.user` — UserShortResponse, содержащий id/username/displayName/avatarUrl/aboutMe, без status/lastSeenAt/timestamps. Он теперь явно типизирован. Отдельный cache patch сохраняет ранее загруженные status/timestamps и не создаёт фиктивно полного пользователя из короткого profile event. patchMyUser получил PayloadAction<UserProfileUpdate>. User.aboutMe/lastSeenAt отражают nullable данные.
- RestoreCallSessionResponse.empty() Java создаёт NONE с null roomType/callStatus/hostUsername/participantStatus. Frontend отражает это; существующие NONE/ACTIVE/INCOMING branches Stage 5 сохранены.
- FriendRequest avatars nullable. Incoming friend notification получает UUID и sender profile target; ACCEPTED остаётся target receiver. До этапа обе записи не имели ID, что ломало индивидуальное read/remove и React identity.
- WebSocket JSON декодируется как unknown/object. До normalizeMessage проверяются sender/room/IDs/eventType/messageType/reply/attachments, до call reducers — известный event type и consumed optional fields/enums. Java BaseCallEvent сериализует null optional fields: на границе они нормализуются в отсутствующие поля, endReason=null сохраняется. Unknown event types ничего не меняют. Profile/error/read/friend/room handlers проверяют используемые данные. Sparse room-members event по-прежнему запускает REST resync, если полного room/members нет. Невалидный JSON не прерывает обработку следующего корректного события.
- Auth transport/refresh rotation, session epoch, STOMP reconnect generation, stale callback guards, call closed IDs/requestId и Stage 6 message ordering/tombstones/history reconciliation не ослаблялись. Исходные auth/session/reconnect/message tests проходят.

### Проверенные backend источники

`controller/dto/RoomResponse.java`, `RoomMemberShortDto.java`, `SenderDto.java`, `ShortMessageWrapped.java`, `RoomShortDto.java`, `MessageAttachmentDto.java`, `FriendRequestResponse.java`, `RestoreCallSessionResponse.java`, `service/dto/response/UserShortResponse.java`, `service/dto/UserProfileUpdatedEvent.java`, `BaseCallEvent.java`, `RoomEvents.java`; RoomService/FriendService/MessageService mappings и CallEventPublisher. MessageType и CallParticipantStatus сверены с Java enum. Call token/restore URLs сверены с существующим callApi/Stage 5 flow. Backend source не менялся, backend tests в Stage 7 не перезапускались; прошлые результаты не выдаются за новые.

### Где interface недостаточен

| Граница | Реальная проверка |
|---|---|
| STOMP body | Safe JSON/object parse; malformed/null/array отбрасываются |
| Message sender/room/attachments/reply | Проверки формы, enum, безопасных IDs, nullable полей до normalization |
| Call events | Whitelist types, enum/ID/string checks; Java null normalization |
| Profile updates | Собственный short DTO guard, patch existing cache вместо полного upsert |
| Friend/room/read/error events | Проверяется consumed payload; неизвестные типы не имеют побочных эффектов |
| Attachment waveform | JSON.parse + массив finite numbers; неверные данные дают existing waveform fallback |
| REST | DTO проверены по Java; тотальные runtime schemas каждого REST endpoint не добавлялись. При развитии versioned API полезен единый декодер restore/history/rooms с contract fixtures. Текущий этап не объявляет TypeScript interface валидатором сети. |

## 3. LiveKit/CallUi и lifecycle

Проверены ActiveCallOverlay, CallUi, CallLifecycle, callRecovery, callRoomLifecycle, call/activeCall slices, CallAudioLayer, MicrophoneSettingsSync/ProcessorSync и ScreenSharePicker. Room остаётся в существующем overlay с memoized options и прежним ключом roomName/mediaGeneration. STOMP reconnect/JWT refresh не создают новую LiveKit Room. Lifecycle Connected/Reconnecting/Reconnected/Disconnected handlers снимаются прежним bind/unbind; recovery timers остаются bounded/cancellable. Их прежние regression tests проходят.

CallQualityController нигде не импортируется/не монтируется. Его не активировали. Локально исправлены narrowing screen→camera quality, дублированная medium-ветка и helper signatures: encoding helper требует maxBitrate/frameRate, capture helper — width/height/frameRate, без ненужного camera-specific value. Экранные presets не превращаются в camera DTO. SDK/dependencies не менялись. Будущая судьба controller: отдельным решением удалить неиспользуемую реализацию или принять и отдельно проверить её async policy; не включать одновременно с другой quality policy. Новая QoE-система не внедрялась.

Подтверждены и исправлены активные microphone lifecycle дефекты:

1. Settings sync хранил только serialized pending settings, но async loop использовал capture/publish options старого closure. Очередь теперь хранит сами options. Владение очередью ограничено Room effect; переход в другую Room/cleanup не даёт старой операции публиковать новый track. Late-created tracks останавливаются, publish failure освобождает новые tracks, late successful publish снимается и останавливается. Applied key фиксируется после успешного publish.
2. Processor sync пересоздавал effect при config update: старый disposed loop блокировал новый через общий syncing ref и мог потерять pending config. Room effect теперь один на Room, текущая config передаётся той же очереди; callbacks публикации читают свежую config. Очередь не отбрасывает обновление во время pending setProcessor/updateConfig. При failed SDK setup processor.destroy вызывается явно; pending completion после cleanup снимает processor. Listeners снимаются при cleanup.

ScreenSharePicker сохраняет существующую защиту isMounted для асинхронного списка источников, desktop IPC и presets. Устройства/переключение/показ экрана функционально не удалены. CallAudioLayer по-прежнему использует SDK AudioTrack и remote audio volume/subscription flow. Дизайн не менялся.

## 4. Аудиоподсистема и камера

- ZvonokLiveKitAudioProcessor parameter property заменено обычным private полем для erasableSyntaxOnly. Stage 5 lifecycle counter, previous graph destroy, failed init destroy и late init destroy сохранены и проверены прежними тестами.
- GlobalAudioGraph при перестройке/отключении RNNoise вызывал только disconnect, но не `RnnoiseWorkletNode.destroy()` из установленного SDK. Теперь WASM processor уничтожается, ссылка очищается. Generation guard предотвращает подключение worklet, завершившего создание после нового graph rebuild/disable/destroy. После await AudioContext.resume проверяется destroyed. Сам исходный microphone track графом не останавливается: им владеет LiveKit. Output track/context освобождаются graph destroy.
- RnnoiseResources хранит pending WASM Promise и отдельный pending addModule Promise на AudioContext. Одновременные callers не дублируют загрузку; rejected promises удаляются для повторной попытки. WeakMap не удерживает завершённые contexts. Это cache ресурсов, новые AudioContext в cache не создаются.
- Старый AudioEngine не импортируется приложением. Дублированный импорт и лишние bindings устранены; переданный context используется, узлы создаются синхронно в constructor, init single-flight, late capture отбрасывается по generation, destroy идемпотентен. Он не активирован. Его старые enableRnnoise/disableRnnoise не реализуют полноценную active RNNoise pipeline; рекомендация — отдельно решить судьбу этого неиспользуемого черновика, а не подключать его. Работающее шумоподавление остаётся в ZvonokAudioGraph.
- CameraView прежде останавливал srcObject через DOM ref, теряя поток при pending permission/device request после unmount. Cancellable capture владеет именно acquired stream, останавливает late stream и не обновляет ошибку после cleanup. Смена камеры очищает старый stream. Status type вынесен в самостоятельный файл; несуществующий useCameraPreview не выдумывался.
- MessageAttachmentDto.waveform в Java — String с сериализованной JSON waveform; старый frontend объявлял number[] и мог вызвать array operations у строки. Теперь контракт string|null и безопасный decoder. Неверный JSON/нечисловые/неfinite значения сохраняют прежний fallback, без падения renderer.

## 5. Реальные runtime defects и типовые diagnostics

| Дефект | Эффект до исправления | Regression evidence |
|---|---|---|
| Камера завершает запрос после cleanup | Камера продолжает работать без владельца | Late capture + idempotent cleanup |
| Settings меняются во время capture | Публикуются stale device/options | Queue test first→second options |
| Microphone capture/publish после teardown или failure | Осиротевший новый microphone track | Late capture, rejected publish |
| Config во время pending setProcessor | Обновление теряется, старый loop disposed | Pending config + listener teardown |
| RNNoise disable/rebuild во время init | Поздний processor возвращается в graph | Pending destroy/disable generation tests |
| RNNoise только disconnect | Не освобождается WASM processor при rebuild | Installed processor destroy exactly once |
| Short sender/profile трактуется как полный UserMini | Cache обещает отсутствующие поля; обновление могло затирать/неверно описывать данные | Exact short Java payload tests |
| Notification без ID/не тот target | Read/remove/identity и переход к чужому профилю работают неверно | Два разных IDs + sender target |
| Waveform строка вместо массива | Ошибка array processing/неверное отображение voice waveform | JSON array validation cases |
| Username undefined / members вместо memberIds / nullable modal | TypeError, Unknown room title, dereference null | Narrowing/model corrections; полная compilation ядра |

TS6133 у action-only reducers, duplicate comparison, неверные type imports, parameter-property syntax и helper nominal value mismatch сами по себе не доказывают runtime bug. Их причины исправлены локально, без any/ignore/config исключений. Не каждый type-only fix обложен тестом, повторяющим реализацию.

## 6. Результаты и сравнение со Stage 6

| Проверка | Stage 6 baseline | Stage 7 |
|---|---|---|
| `npm test` | 58/58, 7 файлов | **79/79, 10 файлов, SUCCESS**, exit 0 |
| Исходные тесты | 58 | Все сохранены и проходят; WebSocket fixtures уточнены под настоящий SenderDto |
| Новые regression scenarios | — | **21**: 8 media/contracts + 6 microphone queues + 3 RNNoise/AudioEngine + 4 WebSocket contracts/notifications |
| `npx tsc -b --pretty false` | 66 diagnostics | **12 исключительно legacy**, exit 2, НЕ SUCCESS |
| Действующее ядро TS | Ошибки присутствовали | **0 известных diagnostics** в полной проверке |
| `npm run build:web` | SUCCESS | **SUCCESS**, exit 0; прежний >500 kB bundle warning |
| `npm run build:electron` | SUCCESS | **SUCCESS**, exit 0 |
| `git diff --check` | SUCCESS | **SUCCESS**, exit 0; только Git LF/CRLF notices |
| Backend targeted | 206/206 | Не запускался: backend не менялся |
| Backend full | 247, 3 legacy Channel failures | Не запускался: baseline не объявляется новым SUCCESS |
| PostgreSQL integration | 33/33 | Не запускался; БД/миграции не трогались |

Vitest сохраняет исходные auth refresh, session epoch, STOMP reconnect, DM/GROUP consistency, call recovery/listener/timer и processor cleanup suites. Новые hook queue tests используют лёгкий детерминированный effect harness и deferred SDK mocks; это проверка JS ownership/очередей, а не полноценный React DOM/browser/WebRTC integration. Реальный SDK event emitter из прежнего callLifecycle suite сохранён. Тяжёлый framework не добавлялся. Runtime дефекты дополнительно покрыты regression tests; сборки не подменяют typecheck.

## 7. Оставшиеся legacy diagnostics

Все 12 совпадают с исходными по path/code/description; legacy файлы в Stage 7 не редактировались:

| Файл | Остаток |
|---|---|
| src/components/ChannelChat/ChannelChat.tsx:19 | TS7006 c |
| src/components/ChannelFolder/ChannelFolder.props.ts:1 | TS2307 channelFoldier |
| src/components/ChannelFolder/ChannelFolder.tsx:26 | TS7006 channel |
| src/components/ChannelItemsList/ChannelItemList.tsx:22 | TS6133 contextMenu |
| src/entities/server.ts:1 | TS2307 channelFoldier |
| src/pages/MyServers/MyServers.tsx:19 | TS18047 nullable servers |
| src/pages/ServerLayout/ServerLayout.tsx:21 | TS7006 c |
| src/pages/ServerLayout/ServerLayout.tsx:22 | TS6133 voiceChannels + TS7006 c |
| src/pages/ServerLayout/ServerLayout.tsx:23 | TS6133 activeTextChannel |
| src/store/slices/channelMessage.slice.ts:96–97 | 2 × TS6133 currentState/action |

B01, новые channel DTO, роли/каналы и удаление legacy не выполнялись. Config не скрывает эти файлы.

## 8. Изменённые файлы именно Stage 7

Ниже только добавления/правки этого этапа, а не все dirty файлы Stage 1–6.

- API/entities: `src/api/interfaces/FriendRequest.ts`, `MessageAttachmentDtos.ts`, `RestoreCallSessionResponse.ts`, `UserProfileUpdatedEvent.ts`; `src/entities/UserMini.ts`, `room.ts`, `shortMessage.ts`, `user.ts`.
- Redux/WS: `src/store/interfaces/rootState.interface.ts`; `src/store/slices/friend.slice.ts`, `message.slice.ts`, `user.slice.ts`, `users.slice.ts`; `src/store/middlewares/websocket/subscriptions.ts`, новый `payloadValidation.ts`.
- Call/audio: `src/audio/AudioEngine.ts`; `src/components/CallUi/CallQualityController.tsx`, `MicrophoneSettingsSync.tsx`, `MicrophoneProcessorSync.tsx`; `src/livekit/audio/GlobalAudioGraph.ts`, `RnnoiseResources.ts`, `ZvonokLiveKitAudioProcessor.ts`; `src/utils/callQuality.ts`.
- Shared UI: `src/components/DmItemsList/DmItemsList.tsx`, `MessageAttachments/MessageAttachments.tsx`, `MessagesSkeleton/MessagesSkeleton.tsx`, `NavigateBar/NavigateBar.tsx`, `RoomsList/RoomsList.tsx`, `RoomMemberRow/RoomMemberRow.props.ts`, `RoomMembersPanel/RoomMembersPanel.props.ts`, `RoomMembersPanel/RoomMembersPanel.tsx`, `RoomSettingModal/RoomSettingModal.tsx`; `src/pages/DmChat/DmChat.tsx`.
- Camera: `src/components/VoiceVideoSetting/CameraPreview/CameraPreviewCard.tsx`, `CameraPreviewState.tsx`, `CameraView.tsx`; новые `CameraPreview.types.ts`, `cameraCapture.ts`.
- Mapping: `src/utils/normalizeRoom.ts`, `normalizeMessage.ts`; новый `parseWaveform.ts`.
- Tests: дополнен `tests/websocket.test.ts`; новые `tests/stage7Reliability.test.ts`, `microphoneSync.test.ts`, `rnnoiseResources.test.ts`.
- Отчёт/сырой вывод: `CORE-STABILIZATION-STAGE7.md`, `stage7-ts-baseline.txt`, `stage7-ts-final.txt`.

ActiveCallOverlay/CallUi/call lifecycle исходники, package scripts, TypeScript config и backend не правились этим этапом. Electron build повторно выполнил существующую компиляцию; electron-dist был dirty до начала, его не сбрасывали.

## 9. Реальная LiveKit/устройства: что остаётся проверить

Автоматические результаты не являются media acceptance. Нужны два реальных клиента (browser и Electron) с настоящим LiveKit/TURN:

1. DM/GROUP start/accept/join/leave/end, короткий outage и 90-секундное recovery Stage 5; JWT/STOMP reconnect при живой media Room без пересоздания Room.
2. Быстрая смена микрофонов и нескольких quality settings во время permission/capture/publish, mute/unmute, выход во время pending setup, повторный вход. Проверить звук, нет ли активных orphan tracks/contexts/processors.
3. RNNoise on/off и processing settings во время загрузки WASM, отказ network/worklet load с повторной попыткой, длительный звонок и teardown. Mock tests не измеряют слышимые артефакты и CPU/GPU.
4. Камера: отказ permission → повторная попытка, смена устройства, закрытие settings во время permission prompt, отсутствие работающей камеры после закрытия.
5. Screen/window/tab sharing, desktop source picker, system audio, смена устройств, выбранный remote screen audio, ручные quality presets и high-FPS fallback без включения неиспользуемого CallQualityController.
6. Настоящие backend STOMP frames: message create/edit/delete/attachments, profile update, friend events, room-members/clear и call events с nullable fields; reconnect/resync и сохранение history/previews.

## 10. Рекомендации для следующего согласованного этапа

- Выполнить описанную browser/Electron/LiveKit hardware/network приёмку и собрать метрики ресурсов до/после teardown.
- Отдельно решить судьбу неиспользуемых AudioEngine и CallQualityController, без автоматической активации и новой QoE в этом этапе.
- Согласованно удалить legacy Server/Channel; до этого сохранить явный список 12 diagnostics, не выключая strict/config checks.
- Для дальнейшего contract evolution добавить общие REST decoders и versioned Java-payload fixtures; при необходимости — DOM/StrictMode acceptance поверх существующего Vitest.
- Bundle splitting и остальные эксплуатационные ограничения Stage 5/6 (delivery/outbox, multi-instance broker, реальные S3 permissions) остаются отдельными задачами. Stage 8 не начат.
