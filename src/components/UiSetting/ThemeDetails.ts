import type { themes } from "../../store/slices/ui.slice";

type ThemeDetails = {
	title: string;
	subtitle: string;
	accent: string;
	preview: [string, string, string, string];
};

export const THEME_DETAILS: Record<typeof themes[number], ThemeDetails> = {
	dark: {
		title: "Тёмная",
		subtitle: "Сбалансированный контраст",
		accent: "#00c896",
		preview: ["#313338", "#2b2d31", "#1e1f22", "#00c896"]
	},
	light: {
		title: "Светлая",
		subtitle: "Чистый и яркий интерфейс",
		accent: "#00a67d",
		preview: ["#f4f7fb", "#e9eef5", "#ffffff", "#00a67d"]
	},
	purple: {
		title: "Фиолетовая",
		subtitle: "Мягкое фиолетовое свечение",
		accent: "#9b5cff",
		preview: ["#151320", "#1b1830", "#100e1c", "#9b5cff"]
	},
	ocean: {
		title: "Океан",
		subtitle: "Холодные синие оттенки",
		accent: "#3cc2ff",
		preview: ["#0b1c26", "#0f2633", "#08141c", "#3cc2ff"]
	},
	matrix: {
		title: "Матрица",
		subtitle: "Неоново-зелёный стиль",
		accent: "#00ff41",
		preview: ["#0a0f0a", "#0d140d", "#050805", "#00ff41"]
	},
	sunset: {
		title: "Закат",
		subtitle: "Тёплая оранжевая палитра",
		accent: "#ff7a3c",
		preview: ["#1a0f0f", "#221515", "#140909", "#ff7a3c"]
	},
	midnight: {
		title: "Полночь",
		subtitle: "Глубокий ночной синий",
		accent: "#4da3ff",
		preview: ["#0c1220", "#10182a", "#080d18", "#4da3ff"]
	},
	dracula: {
		title: "Дракула",
		subtitle: "Классическая палитра для кода",
		accent: "#bd93f9",
		preview: ["#282a36", "#303241", "#1e1f29", "#bd93f9"]
	},
	cyberpunk: {
		title: "Киберпанк",
		subtitle: "Неоновая магента",
		accent: "#ff00ff",
		preview: ["#0a0a0f", "#0f0f17", "#07070b", "#ff00ff"]
	},
	terminal: {
		title: "Терминал",
		subtitle: "Ретро-монохром",
		accent: "#33ff33",
		preview: ["#000000", "#050505", "#000000", "#33ff33"]
	},
	nord: {
		title: "Север",
		subtitle: "Спокойные арктические тона",
		accent: "#88c0d0",
		preview: ["#2e3440", "#3b4252", "#242933", "#88c0d0"]
	},
	custom: {
		title: "Своя",
		subtitle: "Собранная вручную палитра",
		accent: "#58c7ff",
		preview: ["#101722", "#172233", "#0b111a", "#58c7ff"]
	},
	coffee: {
		title: "Кофе",
		subtitle: "Тёплые кофейные оттенки",
		accent: "#c08b5c",
		preview: ["#1a1410", "#221a15", "#120d0a", "#c08b5c"]
	}
};
