import { useEffect, useState } from "react";


export function useModalAnimation(isOpen: boolean, duration = 200) {
	const [isVisible, setIsVisible] = useState(isOpen)

	useEffect(() => {
		if (isOpen) {
			setIsVisible(true)
		} else {
			const timer = setTimeout(() => setIsVisible(false), duration);
			return () => clearTimeout(timer)
		}
	}, [isOpen, duration])

	return isVisible;
}
