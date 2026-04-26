import AuthButton from "../../components/AuthButton/AuthButton";
import AuthInput from "../../components/AuthInput/AuthInput";
import styles from "./Register.module.css";
import AuthHeadling from "../../components/AuthHeadling/AuthHeadling";
import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { AxiosError } from "axios";
import type { ErrorApiResponse } from "../../api/interfaces/ErrorApiResponse";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store/store";
import { getMyUser, registerUser } from "../../store/slices/user.slice";

export default function Register() {
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const navigate = useNavigate();
	const dispatch = useDispatch<AppDispatch>();

	const submit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);

		const formData = new FormData(e.currentTarget);

		const username = String(formData.get("username") ?? "").trim();
		const email = String(formData.get("email") ?? "").trim();
		const password = String(formData.get("password") ?? "").trim();

		if (!username || !email || !password) {
			setError("Заполни username, email и пароль.");
			return;
		}

		if (username.length < 3) {
			setError("Username должен быть минимум 3 символа.");
			return;
		}

		if (password.length < 6) {
			setError("Пароль должен быть минимум 6 символов.");
			return;
		}

		await sendRegister(username, email, password);
	};

	const sendRegister = async (username: string, email: string, password: string) => {
		setIsSubmitting(true);

		try {
			await dispatch(
				registerUser({
					username,
					email,
					password,
				})
			).unwrap();

			await dispatch(getMyUser()).unwrap();
			navigate("/");
		} catch (e) {
			if (typeof e === "string") {
				setError(e);
				return;
			}

			if (e instanceof AxiosError) {
				const errorData = e.response?.data as ErrorApiResponse | undefined;
				setError(errorData?.message ?? e.message ?? "Не удалось создать аккаунт");
				return;
			}

			setError("Что-то пошло не так. Попробуй ещё раз.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className={styles["register-wrapper"]}>
			<div className={styles["register"]}>
				<div className={styles["register-header"]}>
					<AuthHeadling type="register">Регистрация</AuthHeadling>
					<p className={styles["subtitle"]}>
						Создай аккаунт и начни пользоваться Zvonok
					</p>
				</div>

				{error && (
					<div className={styles["error-box"]} role="alert" aria-live="polite">
						<div className={styles["error-icon"]}>!</div>
						<div className={styles["error-content"]}>
							<div className={styles["error-title"]}>Не удалось создать аккаунт</div>
							<div className={styles["error-message"]}>{error}</div>
						</div>
					</div>
				)}

				<form className={styles["form"]} onSubmit={submit}>
					<div className={styles["field"]}>
						<label htmlFor="username">username</label>
						<AuthInput
							id="username"
							name="username"
							autoComplete="username"
							placeholder="Придумай username"
						/>
					</div>

					<div className={styles["field"]}>
						<label htmlFor="email">email</label>
						<AuthInput
							id="email"
							name="email"
							type="email"
							autoComplete="email"
							placeholder="example@mail.com"
						/>
					</div>

					<div className={styles["field"]}>
						<label htmlFor="password">пароль</label>
						<AuthInput
							id="password"
							name="password"
							type="password"
							autoComplete="new-password"
							placeholder="Минимум 6 символов"
						/>
					</div>

					<div className={styles["button-wrap"]}>
						<AuthButton disabled={isSubmitting}>
							{isSubmitting ? "Создаём..." : "Создать"}
						</AuthButton>
					</div>
				</form>

				<div className={styles["links"]}>
					<p>
						Уже есть аккаунт?
						<Link to="/auth/login" className={styles["login-link"]}>
							Войти
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
