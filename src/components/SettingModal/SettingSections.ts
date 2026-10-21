export const SECTIONS = {
	ACCOUNT: "Мой аккаунт",
	VOICE: "Голос и видео",
	APPEARANCE: "Внешний вид",
	NOTIFICATIONS: "Уведомления",
	HOTKEYS: "Горячие клавиши",
	APPLICATION: "Приложение"
} as const;

export type SectionType = typeof SECTIONS[keyof typeof SECTIONS];
export const navigateSections: SectionType[] = Object.values(SECTIONS);
