import { FileCode2, Sparkles } from "lucide-react";
import styles from "../styles/CodeSessionPanel.module.css";

export interface CodeTemplateOption {
	id: string;
	language: string;
	label: string;
	description: string;
	code: string;
}

interface CodeTemplateMenuProps {
	language: string;
	templates: CodeTemplateOption[];
	disabled?: boolean;
	onApply: (template: CodeTemplateOption) => void;
}

export function CodeTemplateMenu({ language, templates, disabled = false, onApply }: CodeTemplateMenuProps) {
	const visibleTemplates = templates.filter((template) => template.language === language);

	if (visibleTemplates.length === 0) return null;

	return (
		<div className={styles.templateDock}>
			<div className={styles.templateDockTitle}>
				<Sparkles size={14} />
				<span>Шаблоны</span>
			</div>
			<div className={styles.templateList}>
				{visibleTemplates.map((template) => (
					<button
						key={template.id}
						type="button"
						className={styles.templateCard}
						onClick={() => onApply(template)}
						disabled={disabled}
						title={template.description}
					>
						<FileCode2 size={15} />
						<span>
							<strong>{template.label}</strong>
							<small>{template.description}</small>
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
