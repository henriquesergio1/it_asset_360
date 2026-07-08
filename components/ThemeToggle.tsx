import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
        }
        return 'dark'; // Padrão escuro para manter o visual original do app
    });

    useEffect(() => {
        if (theme === 'light') {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    return (
        <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer active:scale-95 flex items-center justify-center border border-slate-300 dark:border-slate-600 shadow-inner"
            aria-label="Alternar tema visual"
        >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
    );
};
