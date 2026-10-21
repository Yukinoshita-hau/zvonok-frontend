try { document.documentElement.setAttribute('data-theme', localStorage.getItem('app-theme') || 'dark'); } catch { /* Keep the default theme when storage is unavailable. */ }
