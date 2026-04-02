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
	"coffee"

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
	"coffee"
] as const;

export interface UiState {
	theme: baseTheme;
}

const initialState: UiState = {
	theme: (localStorage.getItem("app-theme") as baseTheme) || "dark"
}

export const uiSlice = createSlice({
	name: "ui",
	initialState: initialState,
	reducers: {
		setTheme: (currentState, action: PayloadAction<baseTheme>) => {
			currentState.theme = action.payload;
			localStorage.setItem("app-theme", action.payload)
		}
	}
})

export default uiSlice.reducer;
export const uiActions = uiSlice.actions;
