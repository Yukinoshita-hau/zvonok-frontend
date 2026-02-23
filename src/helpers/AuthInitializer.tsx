import { useEffect, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { AxiosError } from "axios";
import authApi from "../api/authApi";
import { userActions } from "../store/slices/user.slice";
import { userApi } from "../api/userApi";


export function AuthInitializator({ children }: { children: ReactNode }) {
	const dispatch = useDispatch<AppDispatch>();
	const { isAuthChecked } = useSelector((s: RootState) => s.user)

	useEffect(() => {
		const run = async () => {
			if (!isAuthChecked) {

				try {
					const refreshData = await authApi.refresh();
					dispatch(userActions.addJwt(refreshData.data));
					dispatch(userActions.setAuthChecked(true));
					const userData = await userApi.getMyUser();
					dispatch(userActions.addUser(userData.data));
				} catch (e: unknown) {
					if (e instanceof AxiosError) {
						dispatch(userActions.logout());
						dispatch(userActions.setAuthChecked(true));
					}
				}
			}
		};

		run();
	}, [dispatch])

	return <>{children}</>
}
