import { createRoot } from 'react-dom/client';
import { SpacesHome } from '../../src/features/spacesPreview/SpacesHome';
import '../../src/styles/shell.css';
import '../../src/features/spacesPreview/SpacesHome.css';

createRoot(document.getElementById('root')!).render(<SpacesHome />);
