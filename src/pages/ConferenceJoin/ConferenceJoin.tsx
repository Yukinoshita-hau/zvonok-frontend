import { CheckCircle2, Loader2, RadioTower, RotateCcw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useParams } from "react-router-dom";
import { joinConference } from "../../store/slices/call.slice";
import type { AppDispatch, RootState } from "../../store/store";
import styles from "./ConferenceJoin.module.css";

type JoinState = "joining" | "joined" | "error";

interface JoinError {
	status: number;
	message: string;
}

export function ConferenceJoin() {
	const { code } = useParams<{ code: string }>();
	const dispatch = useDispatch<AppDispatch>();
	const callStatus = useSelector((s: RootState) => s.call.status);
	const activeConferenceCode = useSelector((s: RootState) => s.call.conferenceCode);
	const [joinState, setJoinState] = useState<JoinState>("joining");
	const [error, setError] = useState<JoinError | null>(null);

	const normalizedCode = code?.trim() ?? "";
	const isInThisConference = activeConferenceCode === normalizedCode &&
		(callStatus === "connecting" || callStatus === "in_call");
	const canRejoin = joinState === "joined" && !isInThisConference;

	const attemptJoin = useCallback(() => {
		if (!normalizedCode) {
			setJoinState("error");
			setError({ status: 404, message: "Код конференции не найден." });
			return;
		}

		setJoinState("joining");
		setError(null);

		dispatch(joinConference(normalizedCode))
			.unwrap()
			.then(() => setJoinState("joined"))
			.catch((payload) => {
				const apiError = payload as Partial<JoinError> | string;
				setJoinState("error");
				setError({
					status: typeof apiError === "object" ? apiError.status ?? 0 : 0,
					message: typeof apiError === "string"
						? apiError
						: apiError.message ?? "Не удалось войти в конференцию.",
				});
			});
	}, [dispatch, normalizedCode]);

	useEffect(() => {
		attemptJoin();
	}, [attemptJoin]);

	const errorTitle = useMemo(() => {
		if (!error) return "Не удалось войти";
		if (error.status === 404) return "Конференция не найдена";
		if (error.status === 409) return "Конференция завершена";
		if (error.status === 401) return "Нужно войти заново";
		return "Не удалось войти";
	}, [error]);

	return (
		<div className={styles["page"]}>
			<section className={styles["card"]} data-state={joinState}>
				<div className={styles["orb"]} aria-hidden="true" />
				<div className={styles["icon"]}>
					{joinState === "joining" && <Loader2 className={styles["spin"]} size={30} />}
					{joinState === "joined" && <CheckCircle2 size={30} />}
					{joinState === "error" && <TriangleAlert size={30} />}
				</div>

				<div className={styles["content"]}>
					<div className={styles["eyebrow"]}>
						<RadioTower size={15} />
						Конференция
					</div>

					{joinState === "joining" && (
						<>
							<h1>Подключаемся...</h1>
							<p>Проверяем ссылку и готовим комнату LiveKit.</p>
						</>
					)}

					{joinState === "joined" && (
						<>
							<h1>{isInThisConference ? "Вы в конференции" : "Вы вышли из конференции"}</h1>
							<p>
								{isInThisConference
									? "Панель звонка открылась поверх интерфейса. Код комнаты можно оставить себе."
									: "Ссылка осталась активной. Можно снова войти в эту же комнату."}
							</p>
							<div className={styles["code"]}>{normalizedCode}</div>
							{canRejoin && (
								<button type="button" className={styles["home-link"]} onClick={attemptJoin}>
									<RotateCcw size={16} />
									Войти снова
								</button>
							)}
						</>
					)}

					{joinState === "error" && (
						<>
							<h1>{errorTitle}</h1>
							<p>{error?.message ?? "Ссылка недоступна или устарела."}</p>
							<div className={styles["actions"]}>
								<button type="button" className={styles["home-link"]} onClick={attemptJoin}>
									<RotateCcw size={16} />
									Повторить
								</button>
								<Link className={styles["secondary-link"]} to="/">
									Вернуться в Zvonok
								</Link>
							</div>
						</>
					)}
				</div>
			</section>
		</div>
	);
}
