
"use client"

import { useState, useEffect, useMemo } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { 
  Bell, 
  TrendingUp, 
  AlertTriangle, 
  Info, 
  AlertCircle,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { useUser } from '@/firebase';

interface Notification {
  id: string;
  title: string;
  message: string;
  supporting?: string;
  type: 'warning' | 'success' | 'info' | 'caution';
  timestamp: string;
  category?: string;
  progress?: number;
  limit?: number;
  spent?: number;
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardData: any;
  transactions: any[];
  budgets: any[];
  onUnreadChange: (count: number) => void;
}

export function NotificationsPanel({ 
  isOpen, 
  onOpenChange, 
  dashboardData, 
  transactions,
  budgets,
  onUnreadChange 
}: NotificationsPanelProps) {
  const { user } = useUser();
  const [readIds, setReadIds] = useState<string[]>([]);

  // Unique storage key per user
  const storageKey = useMemo(() => user ? `nik-finance-notifications-${user.uid}` : null, [user]);

  // Load read state from localStorage
  useEffect(() => {
    if (!storageKey) {
      setReadIds([]);
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setReadIds(JSON.parse(saved));
      else setReadIds([]);
    } catch (e) {
      console.error("Failed to load notifications state", e);
    }
  }, [storageKey]);

  const notifications = useMemo(() => {
    const list: Notification[] = [];
    if (!user) return list;

    const now = new Date();
    const currentMonthPrefix = format(now, 'yyyy-MM');
    const year = format(now, 'yyyy');
    const month = format(now, 'MM');
    const monthName = format(now, 'MMMM yyyy');

    // Calculate dynamic budget alerts
    budgets.forEach(budget => {
      const category = String(budget.category ?? "");
      const categoryLower = category.toLowerCase();
      const limit = Number(budget.monthlyLimit ?? 0);
      
      const spent = transactions
        .filter(tx => {
          const txDate = tx.date;
          const txCategory = String(tx.category ?? "").toLowerCase();
          const isExpense = !String(tx.incomeExpense ?? "").toLowerCase().includes('income');
          return isExpense && txCategory === categoryLower && txDate && txDate.startsWith(currentMonthPrefix);
        })
        .reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);

      if (limit <= 0) return;

      const percentage = (spent / limit) * 100;
      let milestone: number | null = null;
      
      if (percentage >= 100) milestone = 100;
      else if (percentage >= 75) milestone = 75;
      else if (percentage >= 50) milestone = 50;
      else if (percentage >= 25) milestone = 25;

      if (milestone !== null) {
        const notificationId = `budget-${user.uid}-${categoryLower}-${year}-${month}-${milestone}`;
        
        let title = "";
        let message = "";
        let type: Notification['type'] = 'info';
        let supporting = "";

        if (milestone === 100) {
          const exceeded = spent - limit;
          title = exceeded > 0 ? `${category} Budget Exceeded` : `${category} Budget Reached`;
          message = exceeded > 0 
            ? `Your ${category} budget has been exceeded by ₹${exceeded.toLocaleString('en-IN')}.`
            : `Your ${category} budget has reached 100%.`;
          type = 'warning';
          supporting = exceeded > 0 ? "Please check your spending." : "Try to avoid more spending in this category.";
        } else {
          const remaining = limit - spent;
          title = `${category} Budget Alert`;
          message = `${milestone}% of your ${category} budget used. ₹${remaining.toLocaleString('en-IN')} remains.`;
          type = milestone >= 75 ? 'caution' : 'info';
          supporting = milestone >= 75 ? "Consider slowing down spending here." : "Good tracking so far.";
        }

        list.push({
          id: notificationId,
          title,
          message,
          supporting,
          type,
          timestamp: monthName,
          category,
          progress: Math.min(100, percentage),
          limit,
          spent
        });
      }
    });

    // Overall Balance/System Alerts
    const savings = Number(dashboardData?.savings ?? 0);
    if (savings > 0 && list.length < 10) {
      list.push({
        id: `savings-${user.uid}-${currentMonthPrefix}`,
        title: 'Monthly Summary',
        message: `You have saved ₹${savings.toLocaleString('en-IN')} this month. Good job!`,
        type: 'success',
        timestamp: 'System'
      });
    }

    if (list.length === 0) {
      list.push({
        id: 'empty-ledger-info',
        title: 'Welcome to Nik Finance',
        message: 'Add entries and set budgets in Settings to receive spending alerts.',
        type: 'info',
        timestamp: 'System'
      });
    }

    return list;
  }, [dashboardData, transactions, budgets, user]);

  const unreadCount = useMemo(() => notifications.filter(n => !readIds.includes(n.id)).length, [notifications, readIds]);

  useEffect(() => {
    onUnreadChange(unreadCount);
  }, [unreadCount, onUnreadChange]);

  const markAllRead = () => {
    if (!storageKey) return;
    const allIds = notifications.map(n => n.id);
    setReadIds(allIds);
    localStorage.setItem(storageKey, JSON.stringify(allIds));
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 bg-background border-l border-white/5">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-6 pb-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <Bell className="w-5 h-5" />
                <SheetTitle className="text-xl font-bold">Alerts</SheetTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllRead}
                className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-primary"
              >
                Mark all as read
              </Button>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              Personalized budget alerts and milestones
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {notifications.map((n) => {
              const isRead = readIds.includes(n.id);
              const isBudgetAlert = n.id.startsWith('budget-');
              
              let Icon = Info;
              if (n.type === 'warning') Icon = AlertCircle;
              else if (n.type === 'caution') Icon = AlertTriangle;
              else if (n.type === 'success') Icon = TrendingUp;

              return (
                <div 
                  key={n.id}
                  className={cn(
                    "p-4 rounded-2xl glass-card border border-white/5 relative overflow-hidden transition-all",
                    !isRead && (
                      n.type === 'warning' ? "border-[#EF4444]/30 bg-[#EF4444]/[0.02]" : 
                      n.type === 'caution' ? "border-[#F59E0B]/30 bg-[#F59E0B]/[0.02]" :
                      "border-primary/30 bg-primary/[0.02]"
                    )
                  )}
                >
                  {!isRead && (
                    <div className="absolute top-0 right-0 p-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full animate-pulse",
                        n.type === 'warning' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : 
                        n.type === 'caution' ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
                        "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                      )} />
                    </div>
                  )}
                  
                  <div className="flex gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      n.type === 'warning' && "bg-[#EF4444]/10 text-[#EF4444]",
                      n.type === 'caution' && "bg-[#F59E0B]/10 text-[#D97706]",
                      n.type === 'success' && "bg-accent/10 text-accent",
                      n.type === 'info' && "bg-blue-500/10 text-blue-500"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className={cn(
                          "text-sm font-bold truncate pr-4",
                          isBudgetAlert && n.type === 'warning' ? "text-[#EF4444]" : 
                          isBudgetAlert && n.type === 'caution' ? "text-[#D97706]" : ""
                        )}>{n.title}</h4>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest shrink-0">
                          {n.timestamp}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {n.message}
                        </p>

                        {isBudgetAlert && n.progress !== undefined && (
                          <div className="space-y-1.5 pt-1">
                            <Progress 
                              value={n.progress} 
                              className="h-1 bg-secondary/30"
                              indicatorClassName={n.type === 'caution' ? "bg-amber-500" : n.type === 'warning' ? "bg-red-500" : "bg-primary"}
                            />
                            <div className="flex justify-between text-[9px] font-bold uppercase tracking-tighter text-muted-foreground/40">
                              <span>Spent: ₹{n.spent?.toLocaleString('en-IN')}</span>
                              <span>Limit: ₹{n.limit?.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        )}

                        {n.supporting && (
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 italic">
                            {n.supporting}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-6 border-t border-white/5 bg-secondary/20">
            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl border-white/5 font-bold"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
