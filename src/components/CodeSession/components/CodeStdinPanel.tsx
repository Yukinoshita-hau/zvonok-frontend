import styles from "../styles/CodeSessionPanel.module.css";

interface CodeStdinPanelProps {
	value: string;
	disabled?: boolean;
	onChange: (value: string) => void;
}

export function CodeStdinPanel({ value, disabled = false, onChange }: CodeStdinPanelProps) {
	return (
		<section className={`${styles.ioPanel} ${styles.stdinPanel}`}>
			<div className={styles.panelHeader}>
				<span className={styles.panelTitle}>STDIN</span>
			</div>
			<textarea
				className={styles.stdinInput}
				value={value}
				disabled={disabled}
				placeholder={"Например:\n5\n10 20\nhello"}
				onChange={(event) => onChange(event.target.value)}
			/>
		</section>
	);
}
