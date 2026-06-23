import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import type { RootState } from "../store/store";

export const RequireAuth = ({ children }: { children: ReactNode }) => {
	const { accessToken, isAuthChecked } = useSelector((s: RootState) => s.user);
	const location = useLocation();

	if (!isAuthChecked) {
		return <div>Загрузка авторизации...</div>;
	}

	if (!accessToken) {
		return <Navigate to="/auth/login" replace state={{ from: location.pathname + location.search }} />;
	}

	return children;
};
