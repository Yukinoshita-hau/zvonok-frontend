export const SECTIONS = {
	ACCOUNT: "Аккаунт",
	VOICE: "Голос и видео",
	APPEARANCE: "Внешний вид"
} as const;

export type SectionType = typeof SECTIONS[keyof typeof SECTIONS];
export const navigateSections: SectionType[] = Object.values(SECTIONS);
