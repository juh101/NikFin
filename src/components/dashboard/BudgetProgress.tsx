
"use client"

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { AlertCircle, Target, CheckCircle2 } from 'lucide-react';

interface BudgetProgressProps {
  transactions: any[];
  budgets: any[];
  loading?: boolean;
}

export function BudgetProgress({ transactions, budgets, loading }: BudgetProgressProps) {
  const activeBudgets = useMemo(() => {
    if (!budgets.length) return [];
    
    const now = new Date();
    const currentMonthPrefix = format(now, 'yyyy-MM');

    return budgets.map(budget => {
      const category = String(budget.category ?? "").toLowerCase();
      const limit = Number(budget.monthlyLimit ?? 0);
      
      const spent = transactions
        .filter(tx => {
          const txDate = tx.date;
          const txCategory = String(tx.category ?? "").toLowerCase();
          const isExpense = !String(tx.incomeExpense ?? "").toLowerCase().includes('income');
          return isExpense && txCategory === category && txDate && txDate.startsWith(currentMonthPrefix);
        })
        .reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);

      const percentage = limit > 0 ? (spent / limit) * 100 : 0;
      const remaining = limit - spent;
      const isExceeded = spent >= limit;

      let statusMessage = "";
      let statusColorClass = "";
      let indicatorColorClass = "";

      if (percentage < 25) {
        statusMessage = "Budget usage is below 25%.";
        statusColorClass = "text-emerald-500";
        indicatorColorClass = "bg-emerald-500";
      } else if (percentage < 50) {
        statusMessage = "25% of your budget used.";
        statusColorClass = "text-secondary";
        indicatorColorClass = "bg-secondary";
      } else if (percentage < 75) {
        statusMessage = "50% of your budget used.";
        statusColorClass = "text-yellow-500";
        indicatorColorClass = "bg-yellow-500";
      } else if (percentage < 100) {
        statusMessage = "75% of your budget used.";
        statusColorClass = "text-caution";
        indicatorColorClass = "bg-caution";
      } else if (spent === limit) {
        statusMessage = "100% of your budget used.";
        statusColorClass = "text-destructive font-bold";
        indicatorColorClass = "bg-destructive";
      } else {
        statusMessage = `${budget.category} budget exceeded.`;
        statusColorClass = "text-destructive font-bold";
        indicatorColorClass = "bg-destructive";
      }

      return {
        ...budget,
        spent,
        percentage,
        remaining,
        isExceeded,
        statusMessage,
        statusColorClass,
        indicatorColorClass
      };
    });
  }, [transactions, budgets]);

  if (loading) return null;
  if (!budgets.length) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Monthly Budgets</h3>
      </div>
      
      <div className="space-y-3">
        {activeBudgets.map((budget) => (
          <Card key={budget.id} className={cn(
            "p-5 border-none shadow-xl space-y-3 glass-card rounded-[24px]",
            budget.isExceeded ? "ring-1 ring-destructive/10" : ""
          )}>
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <h4 className={cn("text-sm font-bold", budget.isExceeded ? "text-destructive" : "text-foreground")}>
                  {budget.category}
                </h4>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  ₹{budget.spent.toLocaleString()} of ₹{Number(budget.monthlyLimit).toLocaleString()} used
                </p>
              </div>
              <div className="text-right">
                <span className={cn("text-[10px] font-black uppercase tracking-widest", budget.statusColorClass)}>
                  {Math.round(budget.percentage)}%
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Progress 
                value={Math.min(100, budget.percentage)} 
                className="h-2 bg-secondary/10" 
                indicatorClassName={budget.indicatorColorClass} 
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {budget.isExceeded ? (
                    <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  ) : budget.percentage >= 75 ? (
                    <Target className="w-3.5 h-3.5 text-caution" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 opacity-60" />
                  )}
                  <p className={cn("text-[10px] font-bold uppercase tracking-tight", budget.statusColorClass)}>
                    {budget.statusMessage}
                  </p>
                </div>
                {!budget.isExceeded && (
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground opacity-40">
                    ₹{Math.abs(budget.remaining).toLocaleString()} left
                  </p>
                )}
                {budget.isExceeded && (
                  <p className="text-[9px] font-bold uppercase tracking-widest text-destructive">
                    Exceeded by ₹{Math.abs(budget.remaining).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
