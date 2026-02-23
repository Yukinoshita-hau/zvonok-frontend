import AuthButton from "../../components/AuthButton/AuthButton";
import AuthInput from "../../components/AuthInput/AuthInput";
import styles from "./Register.module.css";
import AuthHeadling from "../../components/AuthHeadling/AuthHeadling";
import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import type { RegisterForm } from "./interfaces/RegisterForm";
import { AxiosError } from "axios";
import type { ErrorApiResponse } from "../../api/interfaces/ErrorApiResponse";
import authApi from "../../api/authApi";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store/store";
import { userActions } from "../../store/slices/user.slice";

export default function Register() {
	const [error, setError] = useState<string | null>();
	const navigate = useNavigate();
	const dispatch = useDispatch<AppDispatch>();

	const submit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);
		const { username, email, password } = e.target as typeof e.target & RegisterForm;
		await sendRegister(username.value, email.value, password.value)
	}


	const sendRegister = async (username: string, email: string, password: string) => {
		try {
			const { data } = await authApi.register({
				username: username,
				email: email,
				password: password
			});
			dispatch(userActions.addJwt(data));
			navigate("/");
		} catch (e) {
			if (e instanceof AxiosError) {
				const errorData = e.response?.data as ErrorApiResponse;
				setError(errorData.message);
			}
		}
	}

	return (
		<div className={styles["register"]}>
			<AuthHeadling type="register">Регистрация</AuthHeadling>
			{error && <div className={styles["error"]}>{error}</div>}
			<form className={styles["form"]} onSubmit={submit}>
				<div className={styles["field"]}>
					<label htmlFor="username">username</label>
					<AuthInput id="username" />
				</div>
				<div className={styles["field"]}>
					<label htmlFor="email">email</label>
					<AuthInput id="email" type="email" />
				</div>
				<div className={styles["field"]}>
					<label htmlFor="password">пароль</label>
					<AuthInput id="password" type="password" />
				</div>
				<AuthButton>Вход</AuthButton>
			</form>
			<div className={styles["links"]}>
				<p>Уже есть аккаунт? <Link to={"/auth/login"} className={styles["login-link"]}>Войти</Link>
				</p>
			</div>
		</div>
	)
}
