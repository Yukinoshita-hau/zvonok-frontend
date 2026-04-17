import AuthButton from "../../components/AuthButton/AuthButton";
import AuthInput from "../../components/AuthInput/AuthInput";
import styles from "./Login.module.css";
import AuthHeadling from "../../components/AuthHeadling/AuthHeadling";
import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import type { LoginForm } from "./interfaces/LoginForm";
import { AxiosError } from "axios";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store/store";
import type { ErrorApiResponse } from "../../api/interfaces/ErrorApiResponse";
import { getMyUser, loginUser } from "../../store/slices/user.slice";

export default function Login() {
	const [error, setError] = useState<string | null>();
	const navigate = useNavigate();
	const dispatch = useDispatch<AppDispatch>();

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);
		const { usernameOrEmail, password } = e.target as typeof e.target & LoginForm;
		await sendLogin(usernameOrEmail.value, password.value);
	}

	const sendLogin = async (usernameOrEmail: string, password: string) => {
		try {
			await dispatch(loginUser({
				usernameOrEmail: usernameOrEmail,
				password: password
			})).unwrap()
			await dispatch(getMyUser()).unwrap();
			navigate("/");
		} catch (e) {
			if (e instanceof AxiosError) {
				const errorData = e.response?.data as ErrorApiResponse;
				setError(errorData.message);
			}
		}
	}

	return (
		<div className={styles["login"]}>
			<AuthHeadling type="login">С возвращением!</AuthHeadling>
			{error && <div className={styles["error"]}>{error}</div>}
			<form className={styles["form"]} onSubmit={submit}>
				<div className={styles["field"]}>
					<label htmlFor="usernameOrEmail">username или email</label>
					<AuthInput id="usernameOrEmail" />
				</div>
				<div className={styles["field"]}>
					<label htmlFor="password">пароль</label>
					<AuthInput id="password" type="password" />
				</div>
				<AuthButton>Вход</AuthButton>
			</form>
			<div className={styles["links"]}>
				<p>Нужен аккаунт? <Link to={"/auth/register"} className={styles["register-link"]}>Регистрация</Link>
				</p>
			</div>
		</div>
	)
}
