import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Toast } from "../interfaces/toast.interface";


export interface ToastState {
	items: Toast[]
}

const initialState: ToastState = {
	items: []
}

export const toastSlice = createSlice({
	name: "toast",
	initialState: initialState,
	reducers: {
		showToast: (previousState, action: PayloadAction<Toast>) => {
			previousState.items.push(action.payload);
		},
		hideToast: (previousState, action: PayloadAction<{
			id: string;
		}>) => {
			previousState.items = previousState.items.filter(t => t.id !== action.payload.id);		
		}
	}
})

export default toastSlice.reducer;
export const toastActions = toastSlice.actions;
