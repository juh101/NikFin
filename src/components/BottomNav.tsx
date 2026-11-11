
"use client"

import { LayoutDashboard, PlusCircle, History, PieChart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const items = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'transactions', label: 'History', icon: History },
    { id: 'add', label: 'Add', icon: PlusCircle, highlight: true },
    { id: 'analytics', label: 'Insights', icon: PieChart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-2xl border-t border-primary/5 px-6 pb-8 pt-3 md:pb-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "flex flex-col items-center justify-center space-y-1 group transition-all duration-300",
              activeTab === item.id ? "text-primary" : "text-muted-foreground/50 hover:text-primary/60",
              item.highlight && "text-secondary hover:text-secondary/80"
            )}
          >
            <div className={cn(
              "p-2 rounded-xl transition-all duration-300",
              activeTab === item.id && "bg-primary/10 shadow-[0_0_15px_rgba(91,92,226,0.1)]"
            )}>
              <item.icon className={cn("w-6 h-6", activeTab === item.id && "animate-pulse")} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[0.1em]">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
