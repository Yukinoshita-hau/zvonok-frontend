export const categories = [
  {
    id: "account",
    title: "Аккаунт",
    sections: ["Профиль", "Безопасность и конфиденциальность"],
  },
  {
    id: "media",
    title: "Голос и видео",
    sections: [
      "Микрофон",
      "Наушники",
      "Камера",
      "Демонстрация экрана",
      "Расширенная обработка",
    ],
  },
  {
    id: "notifications",
    title: "Уведомления",
    sections: [
      "Сообщения",
      "Входящие звонки",
      "Звуки",
      "Не беспокоить",
      "Исключения",
    ],
  },
  {
    id: "appearance",
    title: "Внешний вид",
    sections: ["Тема", "Цвета", "Отображение интерфейса"],
  },
  {
    id: "shortcuts",
    title: "Горячие клавиши",
    sections: ["Список комбинаций", "Конфликты", "Подсказки"],
  },
  {
    id: "application",
    title: "Приложение",
    sections: ["Поведение окна", "Информация"],
  },
] as const;
export type CategoryId = (typeof categories)[number]["id"];
export type SettingState =
  | "idle"
  | "applying"
  | "success"
  | "error"
  | "unsupported";
type FieldFor<C extends (typeof categories)[number]> =
  C extends (typeof categories)[number]
    ? {
        id: string;
        category: C["id"];
        section: C["sections"][number];
        title: string;
        description: string;
        synonyms: readonly string[];
        advanced?: boolean;
        targetOnly?: boolean;
        control?: string;
      }
    : never;
export type SettingDefinition = FieldFor<(typeof categories)[number]>;
export const fields = [
  {
    id: "profile",
    category: "account",
    section: "Профиль",
    title: "Имя и аватар",
    description: "Как вас видят другие участники Zvonok.",
    synonyms: ["профиль", "фото", "ник"],
  },
  {
    id: "privacy",
    category: "account",
    section: "Безопасность и конфиденциальность",
    title: "Конфиденциальность аккаунта",
    description: "Управление доступом к данным профиля.",
    synonyms: ["пароль", "безопасность"],
  },
  {
    id: "microphone",
    category: "media",
    section: "Микрофон",
    title: "Устройство ввода",
    description: "Микрофон для передачи голоса.",
    synonyms: ["меня плохо слышно", "микрофон", "тихий голос"],
  },
  {
    id: "headphones",
    category: "media",
    section: "Наушники",
    title: "Устройство вывода",
    description: "Наушники и динамики для звука звонка.",
    synonyms: ["не слышу", "громкость", "звук"],
  },
  {
    id: "echo", category: "media", section: "Микрофон", title: "Эхоподавление",
    description: "Уменьшение эха при разговоре через динамики.", synonyms: ["echo cancellation"],
    targetOnly: true, control: '[aria-label="Эхоподавление"]',
  },
  {
    id: "agc", category: "media", section: "Микрофон", title: "Автоматическая регулировка усиления (AGC)",
    description: "Автоматический уровень микрофона.", synonyms: ["усиление", "agc"],
    targetOnly: true, control: '[aria-label="Автоматическая регулировка усиления (AGC)"]',
  },
  {
    id: "browser-noise", category: "media", section: "Микрофон", title: "Браузерное шумоподавление",
    description: "Подавление фонового шума при захвате.", synonyms: ["browser ns"],
    targetOnly: true, control: '[aria-label="Браузерное шумоподавление"]',
  },
  {
    id: "filters", category: "media", section: "Расширенная обработка", title: "Фильтры, компрессор и лимитер",
    description: "Эквалайзер и расширенная цепочка обработки.", synonyms: ["high-pass", "presence", "compressor", "limiter", "эквалайзер"],
    targetOnly: true, advanced: true, control: '[aria-label="High-pass filter"]',
  },
  {
    id: "camera",
    category: "media",
    section: "Камера",
    title: "Источник видео",
    description: "Камера для видеозвонков.",
    synonyms: ["вебкамера", "изображение"],
  },
  {
    id: "screen",
    category: "media",
    section: "Демонстрация экрана",
    title: "Параметры демонстрации",
    description: "Качество передачи экрана.",
    synonyms: ["экран", "стрим", "показать окно"],
  },
  {
    id: "noise",
    category: "media",
    section: "Расширенная обработка",
    title: "Шумоподавление",
    description: "Обработка фонового шума микрофона.",
    synonyms: ["шум", "эхо", "меня плохо слышно", "rnnoise", "пресет", "усиление"],
    advanced: true,
  },
  {
    id: "messages",
    category: "notifications",
    section: "Сообщения",
    title: "Уведомления о сообщениях",
    description: "Оповещения о новых сообщениях.",
    synonyms: ["уведомления", "чат"],
  },
  {
    id: "incoming",
    category: "notifications",
    section: "Входящие звонки",
    title: "Оповещения о звонках",
    description: "Уведомления о входящих вызовах.",
    synonyms: ["звонок"],
  },
  {
    id: "sounds",
    category: "notifications",
    section: "Звуки",
    title: "Звуки уведомлений",
    description: "Звуковые сигналы событий.",
    synonyms: ["сигнал"],
  },
  {
    id: "dnd",
    category: "notifications",
    section: "Не беспокоить",
    title: "Режим тишины",
    description: "Пауза для уведомлений.",
    synonyms: ["не беспокоить", "ночь"],
  },
  {
    id: "exceptions",
    category: "notifications",
    section: "Исключения",
    title: "Исключения уведомлений",
    description: "Индивидуальные правила оповещений.",
    synonyms: ["исключения"],
  },
  {
    id: "theme",
    category: "appearance",
    section: "Тема",
    title: "Тема оформления",
    description: "Цветовая тема интерфейса Zvonok.",
    synonyms: ["тема", "темная", "светлая"],
  },
  {
    id: "colors",
    category: "appearance",
    section: "Цвета",
    title: "Пользовательские цвета",
    description: "Поверхности, текст, акцент и границы интерфейса.",
    synonyms: ["цвета"],
  },
  {
    id: "density",
    category: "appearance",
    section: "Отображение интерфейса",
    title: "Плотность интерфейса",
    description: "Размер и расстояния между элементами.",
    synonyms: ["масштаб", "шрифт"],
  },
  {
    id: "bindings",
    category: "shortcuts",
    section: "Список комбинаций",
    title: "Комбинации клавиш",
    description: "Горячие клавиши приложения.",
    synonyms: ["горячие клавиши", "кнопки", "клавиатура"],
  },
  {
    id: "conflicts",
    category: "shortcuts",
    section: "Конфликты",
    title: "Конфликты комбинаций",
    description: "Совпадения назначенных клавиш.",
    synonyms: ["конфликты"],
  },
  {
    id: "hints",
    category: "shortcuts",
    section: "Подсказки",
    title: "Подсказки клавиш",
    description: "Отображение комбинаций рядом с действиями.",
    synonyms: ["подсказки"],
  },
  {
    id: "window",
    category: "application",
    section: "Поведение окна",
    title: "Закрытие окна",
    description: "Поведение настольного приложения при закрытии.",
    synonyms: ["трей", "свернуть"],
  },
  {
    id: "about",
    category: "application",
    section: "Информация",
    title: "О приложении",
    description: "Сведения о Zvonok и версии клиента.",
    synonyms: ["версия", "информация"],
  },
] as const satisfies readonly SettingDefinition[];
export function validateRegistry(registry: readonly SettingDefinition[]) {
  const ids = new Set<string>();
  for (const field of registry) {
    if (ids.has(field.id)) throw new Error(`Duplicate setting id: ${field.id}`);
    ids.add(field.id);
  }
}
validateRegistry(fields);
export function searchSettings(query: string): readonly SettingDefinition[] {
  const words = query
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];
  return fields.filter((field) => {
    const category = categories.find((item) => item.id === field.category)!;
    const text = [
      field.title,
      field.description,
      field.section,
      category.title,
      ...field.synonyms,
    ]
      .join(" ")
      .toLocaleLowerCase("ru")
      .replaceAll("ё", "е");
    return words.every((word) => text.includes(word));
  }).sort((a,b) => Number(b.title.toLocaleLowerCase('ru').startsWith(words.join(' '))) - Number(a.title.toLocaleLowerCase('ru').startsWith(words.join(' '))));
}
