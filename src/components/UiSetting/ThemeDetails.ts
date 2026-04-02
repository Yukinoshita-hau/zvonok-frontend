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
		preview: ["#0f1117", "#131a1f", "#1e2d38", "#00c896"]
	},
	light: {
		title: "Светлая",
		subtitle: "Чистый и яркий интерфейс",
		accent: "#00a67d",
		preview: ["#f4f7fb", "#e9eef5", "#cfdbe7", "#00a67d"]
	},
	purple: {
		title: "Фиолетовая",
		subtitle: "Мягкое фиолетовое свечение",
		accent: "#9b5cff",
		preview: ["#151320", "#1b1830", "#332a56", "#9b5cff"]
	},
	ocean: {
		title: "Океан",
		subtitle: "Холодные синие оттенки",
		accent: "#3cc2ff",
		preview: ["#0b1c26", "#0f2633", "#17485f", "#3cc2ff"]
	},
	matrix: {
		title: "Матрица",
		subtitle: "Неоново-зелёный стиль",
		accent: "#00ff41",
		preview: ["#0a0f0a", "#0d140d", "#163016", "#00ff41"]
	},
	sunset: {
		title: "Закат",
		subtitle: "Тёплая оранжевая палитра",
		accent: "#ff7a3c",
		preview: ["#1a0f0f", "#221515", "#3a2222", "#ff7a3c"]
	},
	midnight: {
		title: "Полночь",
		subtitle: "Глубокий ночной синий",
		accent: "#4da3ff",
		preview: ["#0c1220", "#10182a", "#1c2a4a", "#4da3ff"]
	},
	dracula: {
		title: "Дракула",
		subtitle: "Классическая палитра для кода",
		accent: "#bd93f9",
		preview: ["#282a36", "#303241", "#44475a", "#bd93f9"]
	},
	cyberpunk: {
		title: "Киберпанк",
		subtitle: "Неоновая магента",
		accent: "#ff00ff",
		preview: ["#0a0a0f", "#0f0f17", "#222233", "#ff00ff"]
	},
	terminal: {
		title: "Терминал",
		subtitle: "Ретро-монохром",
		accent: "#33ff33",
		preview: ["#000000", "#050505", "#151515", "#33ff33"]
	},
	nord: {
		title: "Север",
		subtitle: "Спокойные арктические тона",
		accent: "#88c0d0",
		preview: ["#2e3440", "#3b4252", "#4c566a", "#88c0d0"]
	},
	coffee: {
		title: "Кофе",
		subtitle: "Тёплые кофейные оттенки",
		accent: "#c08b5c",
		preview: ["#1a1410", "#221a15", "#3a2b22", "#c08b5c"]
	}
};
