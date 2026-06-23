import AuthButton from "../../components/AuthButton/AuthButton";
import AuthInput from "../../components/AuthInput/AuthInput";
import styles from "./Login.module.css";
import AuthHeadling from "../../components/AuthHeadling/AuthHeadling";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { AxiosError } from "axios";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store/store";
import type { ErrorApiResponse } from "../../api/interfaces/ErrorApiResponse";
import { getMyUser, loginUser } from "../../store/slices/user.slice";

interface LoginLocationState {
	from?: string;
}

export default function Login() {
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const navigate = useNavigate();
	const location = useLocation();
	const dispatch = useDispatch<AppDispatch>();
	const redirectTo = (location.state as LoginLocationState | null)?.from || "/";

	const submit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);

		const form = e.currentTarget;
		const formData = new FormData(form);

		const usernameOrEmail = String(formData.get("usernameOrEmail") ?? "").trim();
		const password = String(formData.get("password") ?? "").trim();

		if (!usernameOrEmail || !password) {
			setError("Заполни username/email и пароль.");
			return;
		}

		setIsSubmitting(true);

		try {
			await dispatch(
				loginUser({
					usernameOrEmail,
					password,
				})
			).unwrap();

			await dispatch(getMyUser()).unwrap();
			navigate(redirectTo, { replace: true });
		} catch (e) {
			if (typeof e === "string") {
				setError(e);
			} else if (e instanceof AxiosError) {
				const errorData = e.response?.data as ErrorApiResponse | undefined;
				setError(errorData?.message ?? e.message ?? "Не удалось войти в аккаунт");
			} else {
				setError("Что-то пошло не так. Попробуй ещё раз.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className={styles["login-wrapper"]}>
			<div className={styles["login"]}>
				<div className={styles["login-header"]}>
					<AuthHeadling type="login">С возвращением!</AuthHeadling>
					<p className={styles["subtitle"]}>
						Войди в аккаунт, чтобы продолжить общение
					</p>
				</div>

				{error && (
					<div className={styles["error-box"]} role="alert" aria-live="polite">
						<div className={styles["error-icon"]}>!</div>
						<div className={styles["error-content"]}>
							<div className={styles["error-title"]}>Не удалось войти</div>
							<div className={styles["error-message"]}>{error}</div>
						</div>
					</div>
				)}

				<form className={styles["form"]} onSubmit={submit}>
					<div className={styles["field"]}>
						<label htmlFor="usernameOrEmail">username или email</label>
						<AuthInput
							id="usernameOrEmail"
							name="usernameOrEmail"
							autoComplete="username"
							placeholder="Введите username или email"
						/>
					</div>

					<div className={styles["field"]}>
						<label htmlFor="password">пароль</label>
						<AuthInput
							id="password"
							name="password"
							type="password"
							autoComplete="current-password"
							placeholder="Введите пароль"
						/>
					</div>

					<div className={styles["button-wrap"]}>
						<AuthButton disabled={isSubmitting}>
							{isSubmitting ? "Входим..." : "Вход"}
						</AuthButton>
					</div>
				</form>

				<div className={styles["links"]}>
					<p>
						Нужен аккаунт?
						<Link to="/auth/register" className={styles["register-link"]}>
							Регистрация
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
