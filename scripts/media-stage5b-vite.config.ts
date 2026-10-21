import { defineConfig } from 'vite';
import base from './media-stage5a-vite.config';
export default defineConfig({ ...base, server: { ...base.server,
  watch: { ignored: ['**/artifacts/stages/release-stage5b*/**', '**/artifacts/stages/media-stage5b-evidence/**'] },
} });
