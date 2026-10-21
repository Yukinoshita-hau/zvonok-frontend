export interface SettingSectionsSelectorProps {
	sectionName: string;
	onFormStateChange?: (state: {dirty:boolean;busy:boolean}) => void;
	onClose?: () => void;
}
