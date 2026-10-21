import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
	base: "/",
	server: {
		port: 3000,
		watch: { ignored: ['**/work/electron-native/**'] },
		headers: {
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp",
		}
	},
	plugins: [react()],
})
