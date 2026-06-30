import { createSlice, type PayloadAction } from "@reduxjs/toolkit";


export type baseTheme =
	"dark" |
	"light" |
	"purple" |
	"ocean" |
	"matrix" |
	"sunset" |
	"midnight" |
	"dracula" |
	"cyberpunk" |
	"terminal" |
	"nord" |
	"coffee" |
	"custom"

export const themes = [
	"dark",
	"light",
	"purple",
	"ocean",
	"matrix",
	"sunset",
	"midnight",
	"dracula",
	"cyberpunk",
	"terminal",
	"nord",
	"coffee",
	"custom"
] as const;

export interface CustomTheme {
	bgPrimary: string;
	bgSecondary: string;
	bgTertiary: string;
	bgInput: string;
	accent: string;
	textPrimary: string;
	textSecondary: string;
	border: string;
}

export interface UiState {
	theme: baseTheme;
	customTheme: CustomTheme;
}

const defaultCustomTheme: CustomTheme = {
	bgPrimary: "#101722",
	bgSecondary: "#172233",
	bgTertiary: "#0b111a",
	bgInput: "#111b29",
	accent: "#58c7ff",
	textPrimary: "#edf6ff",
	textSecondary: "#9db0c8",
	border: "rgba(126, 156, 190, 0.34)",
};

function loadCustomTheme(): CustomTheme {
	const raw = localStorage.getItem("app-custom-theme");
	if (!raw) return defaultCustomTheme;

	try {
		return {
			...defaultCustomTheme,
			...(JSON.parse(raw) as Partial<CustomTheme>),
		};
	} catch {
		return defaultCustomTheme;
	}
}

const initialState: UiState = {
	theme: (localStorage.getItem("app-theme") as baseTheme) || "dark",
	customTheme: loadCustomTheme()
}

export const uiSlice = createSlice({
	name: "ui",
	initialState: initialState,
	reducers: {
		setTheme: (currentState, action: PayloadAction<baseTheme>) => {
			currentState.theme = action.payload;
			localStorage.setItem("app-theme", action.payload)
		},
		setCustomTheme: (currentState, action: PayloadAction<Partial<CustomTheme>>) => {
			currentState.customTheme = {
				...currentState.customTheme,
				...action.payload,
			};
			localStorage.setItem("app-custom-theme", JSON.stringify(currentState.customTheme));
		},
		resetCustomTheme: (currentState) => {
			currentState.customTheme = defaultCustomTheme;
			localStorage.setItem("app-custom-theme", JSON.stringify(defaultCustomTheme));
		}
	}
})

export default uiSlice.reducer;
export const uiActions = uiSlice.actions;
