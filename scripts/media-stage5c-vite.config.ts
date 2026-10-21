import { defineConfig } from 'vite';
import base from './media-stage5b-vite.config';
export default defineConfig({ ...base, server: { ...base.server,
  watch: { ignored: ['**/artifacts/stages/release-stage5*/**', '**/media-stage5*-evidence/**', '**/dist-stage5c-*/**'] },
} });
