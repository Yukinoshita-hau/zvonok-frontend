import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { PREFIX } from "./baseApi";
import { store, type AppDispatch, type RootState } from "../store/store";
import authAPi from "./authApi";
import { userActions } from "../store/slices/user.slice";
import type { ErrorApiResponse } from "./interfaces/ErrorApiResponse";

export const TOKEN_REFRESH_THRESHOLD_MS = 60_000;

let getState: (() => RootState) | null = null;
let dispatch: AppDispatch | null = null;

export const setStore = (store: { getState: () => RootState; dispatch: AppDispatch }) => {
	getState = store.getState;
	dispatch = store.dispatch;
}

export const api = axios.create({
	baseURL: PREFIX,
	withCredentials: true
})

api.interceptors.request.use(
	async (config: InternalAxiosRequestConfig) => {
		if (config.url === "/auth/refresh") {
			return config;
		}

		if (!getState || !dispatch) {
			return config;
		}

		const { accessToken, expiresAt, tokenType } = store.getState().user;

		if (!accessToken || !expiresAt || !tokenType) {
			return config
		}
		const timeLeft = expiresAt - Date.now();

		if (timeLeft > TOKEN_REFRESH_THRESHOLD_MS) {
			config.headers.Authorization = `${tokenType} ${accessToken}`;
		} else {
			try {
				const refreshData = await authAPi.refresh();
				const { data } = refreshData;
				dispatch(userActions.addJwt(data));
				config.headers.Authorization = `${data.tokenType} ${data.accessToken}`;
			} catch (e: unknown) {
				if (e instanceof AxiosError) {
					dispatch(userActions.logout());
				}
			}
		}
		return config;
	},
	(error) => {
		if (error instanceof AxiosError) {
			const errorData = error.response?.data as ErrorApiResponse;
			console.log(errorData.message);
		}
		return Promise.reject(error);
	}
)

api.interceptors.response.use(
	async (config) => {
		return config;
	},
	(error) => {
		if (error instanceof AxiosError) {
			const errorResponse = error.response?.data as ErrorApiResponse;
			console.error(errorResponse.message);
		}
		return Promise.reject(error);
	}
)
