
"use client"

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { 
  ChevronLeft, ChevronRight, Calendar, Info, 
  ArrowUpRight, ArrowDownRight, Layers, Percent, AlertCircle,
  TrendingDown
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, addMonths, subMonths, 
  isWithinInterval, parseISO, isValid 
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface MonthlyBreakdownChartProps {
  transactions: any[];
  loading?: boolean;
}

export function MonthlyBreakdownChart({ transactions = [], loading }: MonthlyBreakdownChartProps) {
  const [refDate, setRefDate] = useState<Date>(new Date());

  const handlePrev = () => setRefDate(prev => subMonths(prev, 1));
  const handleNext = () => setRefDate(prev => addMonths(prev, 1));
  const handleToday = () => setRefDate(new Date());

  const monthLabel = format(refDate, 'MMMM yyyy');

  const processedData = useMemo(() => {
    const start = startOfMonth(refDate);
    const end = endOfMonth(refDate);

    // 1. Filter transactions for the selected month
    const monthTransactions = transactions.filter(tx => {
      let date: Date | null = null;
      if (tx.date) {
        const parts = tx.date.split('-');
        if (parts.length === 3) {
          date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          date = parseISO(tx.date);
        }
      } else if (tx.createdAt) {
        date = typeof tx.createdAt === 'object' && 'seconds' in tx.createdAt 
          ? new Date(tx.createdAt.seconds * 1000) 
          : parseISO(tx.createdAt);
      }

      return date && isValid(date) && isWithinInterval(date, { start, end });
    });

    // 2. Calculate Totals
    let totalIncome = 0;
    let totalExpense = 0;
    const catMap: Record<string, { amount: number; count: number; originalName: string }> = {};

    monthTransactions.forEach(tx => {
      const amount = Number(tx.amount ?? 0);
      const rawType = tx.incomeExpense ?? tx.type ?? "expense";
      const isIncome = String(rawType).toLowerCase().includes('income');
      
      if (isIncome) {
        totalIncome += amount;
      } else {
        totalExpense += amount;
        // Normalize category name for grouping
        const rawCategory = (tx.category || "Other").trim();
        const categoryKey = rawCategory.toLowerCase();
        const displayCategory = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1).toLowerCase();
        
        if (!catMap[categoryKey]) {
          catMap[categoryKey] = { amount: 0, count: 0, originalName: displayCategory };
        }
        catMap[categoryKey].amount += amount;
        catMap[categoryKey].count += 1;
      }
    });

    // 3. Determine Percentage Basis
    const denominator = totalIncome > 0 ? totalIncome : totalExpense;
    const basisLabel = totalIncome > 0 ? "monthly income" : "total monthly expenses";

    // 4. Prepare Chart Data and Find Max for Scaling
    let maxCategoryAmount = 0;
    const rawChartData = Object.entries(catMap)
      .map(([_, data]) => {
        const rawPercentage = denominator > 0 ? (data.amount / denominator) * 100 : 0;
        if (data.amount > maxCategoryAmount) maxCategoryAmount = data.amount;
        return {
          name: data.originalName,
          value: data.amount,
          percentage: Math.round(rawPercentage),
          count: data.count
        };
      })
      .sort((a, b) => b.value - a.value);

    const incomeSpentPercent = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

    return {
      totalIncome,
      totalExpense,
      incomeSpentPercent,
      chartData: rawChartData,
      maxCategoryAmount,
      basisLabel,
      categoryCount: Object.keys(catMap).length,
      hasIncome: totalIncome > 0
    };
  }, [transactions, refDate]);

  if (processedData.chartData.length === 0) {
    return (
      <Card className="glass-card p-6 border-none rounded-3xl space-y-6 shadow-lg">
        <BreakdownHeader 
          monthLabel={monthLabel} 
          onPrev={handlePrev} 
          onNext={handleNext} 
          onToday={handleToday} 
        />
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 opacity-40">
          <Calendar className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-center">No expenses found for this month.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass-card p-6 border-none rounded-3xl space-y-6 shadow-lg">
      <BreakdownHeader 
        monthLabel={monthLabel} 
        onPrev={handlePrev} 
        onNext={handleNext} 
        onToday={handleToday} 
      />

      {/* Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile 
          label="Income" 
          value={`₹${processedData.totalIncome.toLocaleString('en-IN')}`} 
          icon={ArrowUpRight} 
          color="text-accent"
        />
        <SummaryTile 
          label="Expense" 
          value={`₹${processedData.totalExpense.toLocaleString('en-IN')}`} 
          icon={ArrowDownRight} 
          color="text-expense"
        />
        <SummaryTile 
          label="Categories" 
          value={processedData.categoryCount.toString()} 
          icon={Layers} 
          color="text-primary"
        />
        {processedData.hasIncome && (
          <SummaryTile 
            label="% Spent" 
            value={`${Math.round(processedData.incomeSpentPercent)}%`} 
            icon={Percent} 
            color={processedData.incomeSpentPercent > 100 ? "text-destructive" : "text-secondary"}
          />
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col space-y-1">
          <h3 className="text-sm font-bold tracking-tight">Monthly Expense Breakdown</h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Info className="w-3 h-3" />
            {processedData.hasIncome 
              ? `Percentages are calculated against monthly income of ₹${processedData.totalIncome.toLocaleString('en-IN')}.`
              : `Percentages are calculated against total monthly expenses of ₹${processedData.totalExpense.toLocaleString('en-IN')}.`
            }
          </p>
        </div>

        {/* Custom Grid Chart Area */}
        <div className="space-y-3 pt-2">
          {processedData.chartData.map((data, index) => {
            const barWidth = processedData.maxCategoryAmount > 0 
              ? Math.min(100, (data.value / processedData.maxCategoryAmount) * 100) 
              : 0;

            return (
              <Popover key={index}>
                <PopoverTrigger asChild>
                  <div 
                    className="grid grid-cols-[minmax(80px,120px)_1fr_56px] items-center gap-3 group cursor-pointer active:scale-[0.98] transition-all"
                    role="button"
                    tabIndex={0}
                    aria-label={`${data.name}, ₹${data.value.toLocaleString('en-IN')}, ${data.percentage} percent of ${processedData.basisLabel}`}
                  >
                    {/* Category Column */}
                    <span className="text-[11px] font-bold text-muted-foreground truncate uppercase tracking-tight group-hover:text-primary transition-colors">
                      {data.name}
                    </span>

                    {/* Bar Column (Separate Container) */}
                    <div className="h-5 w-full bg-secondary/10 rounded-full overflow-hidden relative min-w-0">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500 ease-out",
                          index === 0 ? "bg-primary" : "bg-primary/70"
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    {/* Percentage Column (Fixed and Separate) */}
                    <span className="text-[12px] font-bold text-foreground text-right tabular-nums">
                      {data.percentage}%
                    </span>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="glass-card p-4 border-none rounded-2xl shadow-2xl min-w-[180px] space-y-2">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest border-b border-white/5 pb-1">{data.name}</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Amount</span>
                      <span className="text-sm font-extrabold">₹{data.value.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Share</span>
                      <span className="text-sm font-extrabold text-accent">{data.percentage}%</span>
                    </div>
                    <p className="text-[8px] text-muted-foreground italic text-right">
                      of {processedData.basisLabel}
                    </p>
                    <div className="pt-1.5 mt-1 border-t border-white/5 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Entries</span>
                      <span className="text-[10px] font-bold">{data.count} entries</span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </div>

      {processedData.incomeSpentPercent > 100 && (
        <div className="p-4 bg-destructive/5 rounded-2xl flex items-center gap-3 border border-destructive/10">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-destructive">
            Warning: Monthly expenses have exceeded your income.
          </p>
        </div>
      )}
    </Card>
  );
}

function BreakdownHeader({ monthLabel, onPrev, onNext, onToday }: any) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <h2 className="text-xl font-bold tracking-tight">{monthLabel}</h2>
        <Button variant="link" onClick={onToday} className="h-4 p-0 text-[10px] uppercase font-bold text-primary tracking-widest justify-start">Current Month</Button>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={onPrev} className="h-10 w-10 rounded-xl border-white/5 bg-white/5 hover:bg-white/10">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Button variant="outline" size="icon" onClick={onNext} className="h-10 w-10 rounded-xl border-white/5 bg-white/5 hover:bg-white/10">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-secondary/20 p-3 rounded-2xl flex flex-col justify-between space-y-1">
      <div className="flex items-center gap-1.5 opacity-50">
        <Icon className="w-3 h-3" />
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn("text-xs font-extrabold truncate", color)}>{value}</p>
    </div>
  );
}
