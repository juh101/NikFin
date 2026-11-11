"use client"

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('nik-finance-theme') || 'dark';
    const isDarkMode = savedTheme === 'dark';
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark ? 'dark' : 'light';
    setIsDark(!isDark);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('nik-finance-theme', newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "w-10 h-10 flex items-center justify-center rounded-xl glass-card transition-all duration-300",
        "hover:scale-105 active:scale-95 text-muted-foreground hover:text-primary"
      )}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="w-5 h-5 animate-in zoom-in-50 duration-300" />
      ) : (
        <Moon className="w-5 h-5 animate-in zoom-in-50 duration-300" />
      )}
    </button>
  );
}