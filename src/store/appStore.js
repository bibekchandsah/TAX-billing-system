import { create } from 'zustand';

const applyThemeToDOM = (themeName) => {
  if (themeName === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', themeName);
  }
};

const getInitialTheme = () => {
  const saved = localStorage.getItem('theme') || 'system';
  applyThemeToDOM(saved);
  return saved;
};

export const useAppStore = create((set) => ({
  theme: getInitialTheme(),
  toggleTheme: () => set((state) => {
    const nextTheme = {
      'light': 'dark',
      'dark': 'system',
      'system': 'light'
    }[state.theme] || 'light';
    
    applyThemeToDOM(nextTheme);
    localStorage.setItem('theme', nextTheme);
    return { theme: nextTheme };
  }),
  setTheme: (theme) => {
    applyThemeToDOM(theme);
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),

  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Date.now();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    // Auto remove after 3 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
      }));
    }, 3000);
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),
}));

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (useAppStore.getState().theme === 'system') {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
}
