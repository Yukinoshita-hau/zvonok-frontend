## Рекомендации по написанию кода

### Главный принцип

Пиши код так, чтобы он продолжал уже существующий стиль проекта, а не создавал новый параллельный стиль.

Перед изменениями всегда проверь ближайшие похожие файлы:

* похожий компонент в `src/components/*`;
* похожую страницу в `src/pages/*`;
* похожий slice в `src/store/slices/*`;
* похожий API-wrapper в `src/api/*`;
* похожие интерфейсы в `src/api/interfaces/*` или `src/store/interfaces/*`.

Если в проекте уже есть паттерн, используй его. Если паттерн не найден, выбирай минимальное и типизированное решение.

---

## Компоненты

### Структура файлов компонента

Для обычного reusable-компонента используй co-location:

```txt
ComponentName/
  ComponentName.tsx
  ComponentName.module.css
  ComponentName.props.ts
```

`ComponentName.props.ts` нужен, если:

* компонент принимает props;
* props используются в нескольких местах;
* props не являются совсем простыми;
* компонент экспортируется и используется вне текущей папки.

Для маленького локального компонента допустимо держать props внутри `.tsx`, если компонент не переиспользуется:

```tsx
interface EmptyStateProps {
  title: string;
  description?: string;
}

function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  );
}
```

Для основного компонента предпочтительнее отдельный файл props:

```tsx
// UserAvatar.props.ts
export interface UserAvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: "small" | "medium" | "large";
}
```

```tsx
// UserAvatar.tsx
import styles from "./UserAvatar.module.css";
import type { UserAvatarProps } from "./UserAvatar.props";

export function UserAvatar({ username, avatarUrl, size = "medium" }: UserAvatarProps) {
  return (
    <div className={styles[size]}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={username} />
      ) : (
        <span>{username[0]?.toUpperCase()}</span>
      )}
    </div>
  );
}
```

---

## Правила для React-компонентов

### Компонент должен быть читаемым сверху вниз

Рекомендуемый порядок внутри `.tsx`:

```tsx
import { useMemo, useState } from "react";
import cn from "classnames";

import styles from "./ComponentName.module.css";
import type { ComponentNameProps } from "./ComponentName.props";

export function ComponentName({ value, onChange }: ComponentNameProps) {
  const [isOpen, setIsOpen] = useState(false);

  const normalizedValue = useMemo(() => {
    return value.trim();
  }, [value]);

  const handleClick = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={styles.wrapper}>
      <button onClick={handleClick}>{normalizedValue}</button>
    </div>
  );
}
```

Порядок:

1. imports;
2. styles;
3. type imports;
4. component function;
5. hooks/state/selectors;
6. derived values через `useMemo`, если вычисление не примитивное;
7. handlers;
8. early returns;
9. JSX.

---

## Props

### Не передавай в компонент лишнее

Плохо:

```tsx
<UserCard user={user} room={room} messages={messages} />
```

Хорошо:

```tsx
<UserCard
  username={user.username}
  avatarUrl={user.avatarUrl}
  isOnline={user.status === "ONLINE"}
/>
```

Компонент должен получать только те данные, которые реально нужны для отображения или действия.

---

### Callback props называй через `on...`

```tsx
interface MessageItemProps {
  messageId: number;
  text: string;
  onReply: (messageId: number) => void;
  onDelete: (messageId: number) => void;
}
```

Внутренние обработчики называй через `handle...`:

```tsx
function MessageItem({ messageId, text, onReply }: MessageItemProps) {
  const handleReplyClick = () => {
    onReply(messageId);
  };

  return (
    <button onClick={handleReplyClick}>
      Reply
    </button>
  );
}
```

---

### Не используй `any`

Плохо:

```tsx
function MessageItem({ message }: any) {
  return <div>{message.text}</div>;
}
```

Хорошо:

```tsx
import type { Message } from "../../entities/Message";

interface MessageItemProps {
  message: Message;
}

function MessageItem({ message }: MessageItemProps) {
  return <div>{message.text}</div>;
}
```

Если тип неизвестен, сначала найди похожий DTO/interface в проекте. Новый тип создавай только если подходящего нет.

---

## TypeScript

### Используй `type` imports для типов

```tsx
import type { RootState } from "../../store/store";
import type { MessageDto } from "../../api/interfaces/MessageDto";
```

Обычные imports используй только для runtime-значений:

```tsx
import { useSelector } from "react-redux";
import { messageActions } from "../../store/slices/message.slice";
```

---

### Явно типизируй публичные контракты

API DTO, props, slice state и websocket events должны иметь явные интерфейсы:

```ts
export interface CreateRoomRequest {
  name: string;
  participantUsernames: string[];
}
```

```ts
export interface CreateRoomResponse {
  roomId: number;
  name: string;
  type: "PRIVATE" | "GROUP";
}
```

---

### Не смешивай DTO и UI-state

DTO описывает данные от backend:

```ts
export interface MessageDto {
  id: number;
  text: string;
  senderUsername: string;
  createdAt: string;
}
```

UI-state описывает состояние интерфейса:

```ts
export interface MessageUiState {
  selectedMessageId: number | null;
  isReplyPanelOpen: boolean;
  editingMessageId: number | null;
}
```

Не добавляй UI-поля прямо в backend DTO, если это не подтверждено архитектурой проекта.

---

## API layer

### Не делай axios-запросы напрямую из компонентов

Плохо:

```tsx
await axios.get("/api/rooms");
```

Хорошо:

```ts
// src/api/roomApi.ts
import { api } from "./api";
import type { RoomDto } from "./interfaces/RoomDto";

export const roomApi = {
  getRooms: async (): Promise<RoomDto[]> => {
    const response = await api.get<RoomDto[]>("/rooms");
    return response.data;
  },
};
```

```tsx
const rooms = await roomApi.getRooms();
```

Все authenticated-запросы должны идти через общий `api` instance из `src/api/api.ts`.

---

### API wrapper должен быть тонким

API-файл отвечает за:

* URL;
* HTTP method;
* request/response types;
* возврат `response.data`.

Он не должен содержать UI-логику, Redux-логику или сложную бизнес-логику.

Плохо:

```ts
export async function getRoomsAndSelectFirst(dispatch: AppDispatch) {
  const response = await api.get("/rooms");
  dispatch(roomActions.setCurrentRoom(response.data[0]));
}
```

Хорошо:

```ts
export const roomApi = {
  getRooms: async (): Promise<RoomDto[]> => {
    const response = await api.get<RoomDto[]>("/rooms");
    return response.data;
  },
};
```

---

## Redux Toolkit

### Slice отвечает за состояние своей feature

Храни состояние рядом с feature:

```ts
interface MessageState {
  items: MessageDto[];
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
}
```

Не смешивай в одном slice несвязанные части приложения.

---

### Async thunk используй для HTTP-запросов

```ts
export const fetchRoomMessages = createAsyncThunk(
  "message/fetchRoomMessages",
  async (roomId: number) => {
    return await messageApi.getRoomMessages(roomId);
  }
);
```

В component не нужно вручную делать API-запрос, если для этого уже есть thunk.

---

### Realtime command actions должны совпадать с websocket middleware

Если action обрабатывается в `websocket.middleware.ts`, не меняй его type string без синхронного изменения middleware.

```ts
sendMessage: {
  reducer: () => {},
  prepare: (payload: SendMessagePayload) => ({ payload }),
}
```

Middleware должен иметь соответствующий case:

```ts
case messageActions.sendMessage.type:
  // publish to websocket
  break;
```

Не создавай ad-hoc строки:

```ts
dispatch({ type: "SEND_MESSAGE_WS", payload });
```

Используй actions из slice.

---

## WebSocket / STOMP

### Пути должны быть централизованы

Не пиши STOMP paths прямо в компонентах или middleware, если для них есть `wsPathes.ts`.

Плохо:

```ts
client.publish({
  destination: `/app/chat/${roomId}/send`,
  body: JSON.stringify(payload),
});
```

Хорошо:

```ts
client.publish({
  destination: wsPathes.sendMessage(roomId),
  body: JSON.stringify(payload),
});
```

---

### WebSocket-событие должно иметь типизированный contract

```ts
export interface MessageCreatedEvent {
  type: "MESSAGE_CREATED";
  roomId: number;
  message: MessageDto;
}
```

Не обрабатывай события как `any`.

---

## LiveKit / Calls

### UI-state не должен подменять реальное media-state

Если пользователь нажал mute, нужно менять реальный published track, а не только Redux-флаг.

Плохо:

```ts
dispatch(callActions.setMuted(true));
```

Хорошо:

```ts
await localParticipant.setMicrophoneEnabled(false);
dispatch(callActions.setMuted(true));
```

Redux может хранить отражение состояния, но источником правды для медиа остаётся LiveKit track/participant state.

---

### Перед изменением call-логики проверь весь flow

Перед изменением звонков всегда проверь:

* где создаётся LiveKit room;
* где backend выдаёт token;
* где создаётся локальный audio/video track;
* где track публикуется;
* где происходит subscribe на remote tracks;
* где состояние синхронизируется с Redux;
* какие websocket events приходят при accept/decline/leave/end.

В call/media части предпочтительны маленькие надёжные фиксы вместо больших переписываний.

---

## CSS Modules

### Используй CSS Modules рядом с компонентом

```tsx
import styles from "./MessageItem.module.css";

export function MessageItem() {
  return <div className={styles.wrapper}>Message</div>;
}
```

Не добавляй глобальные CSS-классы без необходимости.

---

### Для условных классов используй `classnames`

```tsx
import cn from "classnames";

<div
  className={cn(styles.message, {
    [styles.own]: isOwn,
    [styles.selected]: isSelected,
  })}
/>
```

---

### Theme values бери из CSS variables

Если цвет/фон/граница уже есть в `src/index.css`, используй переменную, а не hardcoded value.

Плохо:

```css
.wrapper {
  background: #111827;
}
```

Хорошо:

```css
.wrapper {
  background: var(--color-bg-primary);
}
```

Название переменной нужно сверять с существующими переменными проекта.

---

## Разделение ответственности

### Page

`src/pages/*` — route-level экран.

Страница может:

* читать route params;
* собирать layout;
* вызывать крупные feature-компоненты;
* запускать initial fetch.

Страница не должна содержать слишком много низкоуровневой UI-логики.

---

### Layout

`src/layouts/*` — общий каркас приложения.

Layout может:

* держать sidebar/header;
* запускать глобальные процессы приложения;
* подключать websocket lifecycle, если такой паттерн уже используется.

---

### Component

`src/components/*` — переиспользуемый UI-блок.

Компонент должен быть максимально тупым:

* принимает props;
* отображает UI;
* вызывает callbacks;
* не знает лишнего про backend и глобальную архитектуру.

---

### Hook

Выноси логику в hook, если:

* в компоненте стало слишком много `useEffect`;
* логика повторяется;
* есть работа с browser API;
* есть сложная media/audio/video логика;
* есть lifecycle cleanup.

Пример:

```ts
export function useMicrophonePreview(isEnabled: boolean) {
  // media lifecycle here
}
```

---

## Ошибки и loading-состояния

Для async-функций учитывай минимум три состояния:

* loading;
* success;
* error.

Плохо:

```tsx
return <MessageList messages={messages} />;
```

Хорошо:

```tsx
if (status === "loading") {
  return <Loader />;
}

if (status === "failed") {
  return <ErrorState message={error ?? "Failed to load messages"} />;
}

return <MessageList messages={messages} />;
```

---

## Рефакторинг

### Не делай большой rewrite без необходимости

Для Codex/AI-сессий предпочтительный порядок:

1. минимальный фикс;
2. локальный рефакторинг;
3. архитектурное улучшение только если оно реально нужно;
4. большой rewrite только после явного запроса.

---

### Перед удалением кода проверь usage

Перед удалением функции, типа, action или компонента проверь:

* imports;
* dispatch usage;
* websocket middleware usage;
* route usage;
* backend contract usage;
* CSS module references.

---

## Нейминг

### Компоненты

```txt
PascalCase.tsx
PascalCase.props.ts
PascalCase.module.css
```

Пример:

```txt
RoomActiveCallBanner.tsx
RoomActiveCallBanner.props.ts
RoomActiveCallBanner.module.css
```

---

### Hooks

```txt
useSomething.ts
```

Пример:

```ts
useModalAnimation.ts
useMicrophonePreview.ts
```

---

### API

```txt
domainApi.ts
```

Пример:

```txt
messageApi.ts
roomApi.ts
callApi.ts
livekitApi.ts
```

---

### Redux slices

```txt
domain.slice.ts
```

Пример:

```txt
message.slice.ts
activeCall.slice.ts
user.slice.ts
```

---

## Что делать перед финальным ответом

Перед завершением задачи проверь:

```txt
npm run build
npm run lint
```

Если команда не запускается из-за отсутствующей конфигурации или внешней проблемы, явно укажи это в ответе.

Финальный ответ должен содержать:

* что изменено;
* какие файлы затронуты;
* какие проверки выполнены;
* какие проверки не удалось выполнить и почему;
* какие места являются рискованными.
