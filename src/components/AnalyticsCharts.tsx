"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { 
  Loader2, ChevronLeft, ChevronRight, Wallet, 
  Target, Info, CheckCircle2, AlertCircle, Sparkles, ArrowUpRight, ArrowDownRight,
  TrendingUp, Calendar, Trophy, ChevronDown, ChevronUp, Clock, X, FileDown
} from 'lucide-react';
import { 
  format, addMonths, subMonths, isValid, getDaysInMonth, startOfMonth, endOfMonth
} from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Progress } from "@/components/ui/progress";
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AnalyticsChartsProps {
  transactions?: any[];
  budgets?: any[];
  loading?: boolean;
  onNavigateToBudgets?: () => void;
}

/**
 * SHARED DATA HELPERS
 */

const MONTH_MAP: Record<string, number> = {
  january: 1, jan: 1, "01": 1, "1": 1,
  february: 2, feb: 2, "02": 2, "2": 2,
  march: 3, mar: 3, "03": 3, "3": 3,
  april: 4, apr: 4, "04": 4, "4": 4,
  may: 5, "05": 5,
  june: 6, jun: 6, "06": 6, "6": 6,
  july: 7, jul: 7, "07": 7, "7": 7,
  august: 8, aug: 8, "08": 8, "8": 8,
  september: 9, sep: 9, "09": 9, "9": 9,
  october: 10, oct: 10, "10": 10,
  november: 11, nov: 11, "11": 11,
  december: 12, dec: 12, "12": 12
};

function getTransactionYearMonth(tx: any): { year: number; month: number; day: number } | null {
  // 1. Try date/Date field
  const dateVal = tx.date || tx.Date;
  if (dateVal) {
    if (typeof dateVal === 'string') {
      const clean = dateVal.trim();
      // YYYY-MM-DD
      const ymd = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      if (ymd) return { year: parseInt(ymd[1]), month: parseInt(ymd[2]), day: parseInt(ymd[3]) };
      // DD/MM/YYYY
      const dmy = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (dmy) return { year: parseInt(dmy[3]), month: parseInt(dmy[2]), day: parseInt(dmy[1]) };
    } else if (dateVal.toDate) {
      const d = dateVal.toDate();
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    } else if (dateVal instanceof Date) {
      return { year: dateVal.getFullYear(), month: dateVal.getMonth() + 1, day: dateVal.getDate() };
    }
  }

  // 2. Try Month + Year fields
  const rawMonth = String(tx.month || tx.Month || "").toLowerCase();
  const rawYear = parseInt(tx.year || tx.Year || "");
  if (rawMonth && !isNaN(rawYear)) {
    const monthNum = MONTH_MAP[rawMonth];
    if (monthNum) return { year: rawYear, month: monthNum, day: 1 };
  }

  // 3. Fallback to createdAt
  const createdVal = tx.createdAt || tx['Created At'] || tx['Created at'];
  if (createdVal) {
    const dateObj = createdVal.toDate ? createdVal.toDate() : new Date(createdVal);
    if (isValid(dateObj)) {
      return { year: dateObj.getFullYear(), month: dateObj.getMonth() + 1, day: dateObj.getDate() };
    }
  }

  return null;
}

function getTransactionAmount(tx: any): number {
  const val = tx.amount ?? tx.Amount ?? 0;
  if (typeof val === 'number') return Math.abs(val);
  return Math.abs(parseFloat(String(val).replace(/[₹,]/g, '')) || 0);
}

function getTransactionType(tx: any): 'income' | 'expense' {
  const val = String(tx.incomeExpense || tx['Income/Expense'] || tx['Type of expense/income'] || "expense").toLowerCase();
  if (val.includes('income')) return 'income';
  return 'expense';
}

const formatINR = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

export function AnalyticsCharts({ transactions = [], budgets = [], loading, onNavigateToBudgets }: AnalyticsChartsProps) {
  const { user, displayName } = useUser();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isExporting, setIsExporting] = useState(false);
  
  // Interaction states
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showMoreExpenses, setShowMoreExpenses] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Reset interactions when period changes
  useEffect(() => {
    setSelectedDay(null);
    setShowMoreExpenses(false);
    setShowAllCategories(false);
  }, [selectedDate, selectedYear]);

  // --- 1. Normalized Data Pool ---
  const normalizedData = useMemo(() => {
    return transactions.map(tx => {
      const period = getTransactionYearMonth(tx);
      if (!period) return null;

      return {
        id: tx.id,
        amount: getTransactionAmount(tx),
        type: getTransactionType(tx),
        category: tx.category || tx.Category || "Other",
        description: tx.description || tx.Description || "No Description",
        time: tx.time || (tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'hh:mm a') : ""),
        year: period.year,
        month: period.month,
        day: period.day,
        dateStr: `${period.year}-${String(period.month).padStart(2, '0')}-${String(period.day).padStart(2, '0')}`
      };
    }).filter(Boolean) as any[];
  }, [transactions]);

  // --- 2. Month Overview Logic ---
  const monthStats = useMemo(() => {
    const m = selectedDate.getMonth() + 1;
    const y = selectedDate.getFullYear();
    const monthTx = normalizedData.filter(d => d.year === y && d.month === m);
    
    const income = monthTx.filter(d => d.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter(d => d.type === 'expense').reduce((s, t) => s + t.amount, 0);
    
    return { income, expense, balance: income - expense, count: monthTx.length, transactions: monthTx };
  }, [normalizedData, selectedDate]);

  // --- 3. Category Spending Logic ---
  const categoryStats = useMemo(() => {
    const expenses = monthStats.transactions.filter(d => d.type === 'expense');
    const catMap: Record<string, number> = {};
    expenses.forEach(d => {
      catMap[d.category] = (catMap[d.category] || 0) + d.amount;
    });

    const basis = monthStats.income > 0 ? monthStats.income : monthStats.expense;
    const basisLabel = monthStats.income > 0 
      ? "Percentages are based on monthly income." 
      : "No income recorded this month. Percentages are based on total expenses.";

    const items = Object.entries(catMap)
      .map(([name, value]) => ({
        name,
        value,
        percent: basis > 0 ? Math.round((value / basis) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value);

    return { items, basisLabel };
  }, [monthStats]);

  // --- 4. Budget Usage Logic ---
  const budgetUsage = useMemo(() => {
    const m = selectedDate.getMonth() + 1;
    const y = selectedDate.getFullYear();

    return budgets.map(b => {
      const limit = Number(b.monthlyLimit || 0);
      const spent = normalizedData
        .filter(tx => tx.year === y && tx.month === m && tx.type === 'expense' && tx.category === b.category)
        .reduce((s, t) => s + t.amount, 0);
      
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      return { ...b, spent, limit, percent };
    }).sort((a, b) => b.percent - a.percent);
  }, [budgets, normalizedData, selectedDate]);

  // --- 5. Year Overview Logic ---
  const availableYears = useMemo(() => {
    const years = new Set(normalizedData.map(d => d.year));
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [normalizedData]);

  const yearStats = useMemo(() => {
    const yearTx = normalizedData.filter(d => d.year === selectedYear);
    const income = yearTx.filter(d => d.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = yearTx.filter(d => d.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense, count: yearTx.length };
  }, [normalizedData, selectedYear]);

  // --- 6. Key Notes Logic ---
  const keyNotes = useMemo(() => {
    const notes: string[] = [];
    if (monthStats.count === 0) return ["Add more entries to see useful notes."];

    if (monthStats.balance < 0) notes.push("You spent more than you earned this month.");
    else if (monthStats.income > 0) notes.push("You have a positive balance this month.");

    if (categoryStats.items.length > 0) {
      notes.push(`Your biggest spending category this month is ${categoryStats.items[0].name}.`);
    }

    const riskyBudget = budgetUsage.find(b => b.percent >= 75);
    if (riskyBudget) {
      notes.push(`Your ${riskyBudget.category} budget has crossed 75%.`);
    }

    if (monthStats.income === 0 && monthStats.expense > 0) {
      notes.push("No income has been recorded for this month.");
    }

    return notes.slice(0, 4);
  }, [monthStats, categoryStats, budgetUsage]);

  // --- 7. Daily Spending Trend ---
  const dailyTrendData = useMemo(() => {
    const daysInMonth = getDaysInMonth(selectedDate);
    const data = [];
    const expenses = monthStats.transactions.filter(t => t.type === 'expense');

    for (let day = 1; day <= daysInMonth; day++) {
      const total = expenses
        .filter(t => t.day === day)
        .reduce((sum, t) => sum + t.amount, 0);
      
      data.push({
        day,
        label: `${day}`,
        amount: total
      });
    }
    return data;
  }, [monthStats, selectedDate]);

  // --- 8. Top Expenses Data ---
  const allMonthlyExpenses = useMemo(() => {
    return monthStats.transactions
      .filter(t => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount);
  }, [monthStats]);

  const topExpenses = useMemo(() => {
    return showMoreExpenses ? allMonthlyExpenses.slice(0, 10) : allMonthlyExpenses.slice(0, 5);
  }, [allMonthlyExpenses, showMoreExpenses]);

  const dayTopExpenses = useMemo(() => {
    if (selectedDay === null) return [];
    return monthStats.transactions
      .filter(t => t.type === 'expense' && t.day === selectedDay)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [monthStats, selectedDay]);

  const handleDownloadPDF = () => {
    if (monthStats.count === 0 && yearStats.count === 0) return;
    setIsExporting(true);

    try {
      const doc = new jsPDF();
      const monthYearLabel = format(selectedDate, 'MMMM yyyy');

      // Header
      doc.setFontSize(22);
      doc.setTextColor(91, 92, 226);
      doc.text("Nik Finance", 14, 20);
      
      doc.setFontSize(14);
      doc.setTextColor(100);
      doc.text("Insights Report", 14, 28);

      // User Details
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(`User: ${displayName}`, 14, 38);
      doc.text(`Email: ${user?.email || "N/A"}`, 14, 43);
      doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 48);
      doc.text(`Selected Period: ${monthYearLabel}`, 14, 53);

      // 1. Month Summary
      doc.setFontSize(12);
      doc.setTextColor(50);
      doc.text("1. Month Summary", 14, 65);
      
      autoTable(doc, {
        startY: 68,
        theme: 'grid',
        headStyles: { fillColor: [91, 92, 226] },
        body: [
          ["Income", formatINR(monthStats.income)],
          ["Expense", formatINR(monthStats.expense)],
          ["Balance", formatINR(monthStats.balance)]
        ]
      });

      // 2. Category Spending
      doc.text("2. Category Spending", 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 18,
        head: [['Category', 'Amount Spent', 'Percentage Share']],
        body: categoryStats.items.map(i => [i.name, formatINR(i.value), `${i.percent}%`]),
        theme: 'striped',
        headStyles: { fillColor: [71, 71, 71] }
      });

      // 3. Budget Usage
      if (budgetUsage.length > 0) {
        doc.text("3. Budget Usage", 14, (doc as any).lastAutoTable.finalY + 15);
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 18,
          head: [['Category', 'Spent', 'Limit', 'Used %', 'Status']],
          body: budgetUsage.map(b => [
            b.category, 
            formatINR(b.spent), 
            formatINR(b.limit), 
            `${Math.round(b.percent)}%`,
            b.percent >= 100 ? "Exceeded" : b.percent >= 75 ? "Caution" : "Safe"
          ]),
          theme: 'grid',
          headStyles: { fillColor: [71, 71, 71] }
        });
      }

      // 4. Top Expenses
      const topEx = allMonthlyExpenses.slice(0, 10);

      if (topEx.length > 0) {
        doc.addPage();
        doc.setFontSize(12);
        doc.text("4. Top Expenses", 14, 20);
        autoTable(doc, {
          startY: 23,
          head: [['Description', 'Category', 'Date', 'Amount']],
          body: topEx.map(t => [t.description, t.category, `${t.day} ${format(selectedDate, 'MMM')}`, formatINR(t.amount)]),
          theme: 'striped'
        });
      }

      // 5. Year Summary
      doc.text(`5. Year Summary (${selectedYear})`, 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 18,
        body: [
          ["Year Total Income", formatINR(yearStats.income)],
          ["Year Total Expense", formatINR(yearStats.expense)],
          ["Year Final Balance", formatINR(yearStats.balance)]
        ],
        theme: 'grid'
      });

      // 6. Key Notes
      doc.text("6. Key Notes", 14, (doc as any).lastAutoTable.finalY + 15);
      doc.setFontSize(10);
      doc.setTextColor(80);
      keyNotes.forEach((note, idx) => {
        doc.text(`• ${note}`, 20, (doc as any).lastAutoTable.finalY + 22 + (idx * 6));
      });

      const fileName = `NikFinance_Insights_${format(selectedDate, 'MMMM_yyyy')}.pdf`;
      doc.save(fileName);
      toast({ title: "Report downloaded.", description: "Your monthly insights are ready." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Export Failed", description: "Could not create the Insights PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Analyzing Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-32">
      {/* HEADER */}
      <header className="px-1 flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Insights</h2>
          <p className="text-sm text-muted-foreground font-medium">Understand your income, expenses, and budgets.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleDownloadPDF} 
          disabled={isExporting || (monthStats.count === 0 && yearStats.count === 0)}
          className="rounded-2xl h-12 px-4 border-none bg-card shadow-sm hover:bg-primary/10 transition-all shrink-0 flex items-center gap-2 active:scale-95"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <FileDown className="w-4 h-4 text-primary" />}
          <span className="text-xs font-bold text-primary uppercase tracking-wider">Download PDF</span>
        </Button>
      </header>

      {/* MONTH SELECTOR */}
      <section className="flex items-center justify-between bg-card p-4 rounded-3xl shadow-sm">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
          className="rounded-xl"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <h3 className="text-sm font-bold uppercase tracking-widest">{format(selectedDate, 'MMMM yyyy')}</h3>
          <p className="text-[10px] font-bold text-primary uppercase tracking-tighter cursor-pointer" onClick={() => setSelectedDate(new Date())}>Current Month</p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
          className="rounded-xl"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </section>

      {/* THIS MONTH SUMMARY */}
      <section className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Income" value={monthStats.income} color="text-emerald-500" icon={ArrowUpRight} />
          <MetricCard label="Expense" value={monthStats.expense} color="text-orange-500" icon={ArrowDownRight} />
          <MetricCard label="Balance" value={monthStats.balance} color={monthStats.balance >= 0 ? "text-primary" : "text-destructive"} icon={Wallet} />
        </div>

        <Card className="glass-card p-6 border-none rounded-3xl space-y-6">
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Monthly Income vs Expenses</h4>
          {monthStats.count === 0 ? (
            <div className="py-10 text-center space-y-2 opacity-40">
              <AlertCircle className="w-8 h-8 mx-auto" />
              <p className="text-[10px] font-bold uppercase tracking-widest">No entries found for this month.</p>
            </div>
          ) : (
            <div className="pt-2">
              <ComparisonChart income={monthStats.income} expense={monthStats.expense} balance={monthStats.balance} />
            </div>
          )}
        </Card>
      </section>

      {/* DAILY SPENDING TREND */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Daily Spending Trend</h3>
          {selectedDay && (
            <p className="text-[10px] font-bold text-primary uppercase animate-pulse">Tap bar to close</p>
          )}
        </div>
        <Card className="glass-card p-6 border-none rounded-3xl space-y-4">
          {monthStats.expense === 0 ? (
            <p className="text-center text-[10px] text-muted-foreground font-bold py-10 uppercase tracking-widest opacity-40">No daily spending found for this month.</p>
          ) : (
            <div className="h-[180px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={dailyTrendData} 
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  onClick={(data) => {
                    if (data && data.activePayload) {
                      const day = data.activePayload[0].payload.day;
                      setSelectedDay(prev => prev === day ? null : day);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} interval={2} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickFormatter={(v) => `₹${v >= 1000 ? v/1000 + 'k' : v}`} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }} 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-card/95 border border-white/10 p-2 rounded-xl shadow-xl text-[10px] font-bold">
                            <p className="text-muted-foreground mb-0.5">{format(selectedDate, 'MMM')} {payload[0].payload.day}</p>
                            <p className="text-orange-500">{formatINR(payload[0].value as number)}</p>
                          </div>
                        );
                      }
                      return null;
                    }} 
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={8}>
                    {dailyTrendData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        cursor="pointer"
                        fill={entry.day === selectedDay ? 'hsl(var(--primary))' : 'hsl(var(--expense))'}
                        fillOpacity={entry.day === selectedDay ? 1 : entry.amount > 0 ? 0.6 : 0.1} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Selected Day Expenses Dropdown */}
        {selectedDay !== null && (
          <div className="animate-in slide-in-from-top-4 fade-in duration-300">
            <Card className="p-5 border-none bg-orange-500/5 border border-orange-500/10 rounded-3xl space-y-4 shadow-sm relative">
              <button 
                onClick={() => setSelectedDay(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors"
              >
                <X size={14} />
              </button>
              <div className="flex items-center gap-2 text-orange-500">
                <Calendar className="w-4 h-4" />
                <h4 className="text-sm font-bold tracking-tight">Top expenses on {selectedDay} {format(selectedDate, 'MMM')}</h4>
              </div>
              
              {dayTopExpenses.length === 0 ? (
                <p className="text-[10px] text-muted-foreground font-bold uppercase py-2">No expense details found for this day.</p>
              ) : (
                <div className="space-y-3">
                  {dayTopExpenses.map((tx, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-card border border-white/5 shadow-sm">
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold truncate pr-2">{tx.description}</h5>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">
                          {tx.category} {tx.time && `· ${tx.time}`}
                        </p>
                      </div>
                      <span className="text-xs font-black text-orange-500 shrink-0 tabular-nums">
                        {formatINR(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </section>

      {/* CATEGORY SPENDING */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Category Spending</h3>
        <Card className="glass-card p-6 border-none rounded-3xl space-y-5">
          {categoryStats.items.length === 0 ? (
            <p className="text-center text-[10px] text-muted-foreground font-bold py-6 uppercase tracking-widest opacity-40">No expenses found for this month.</p>
          ) : (
            <div className="space-y-5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 opacity-60">
                <Info size={12} />
                {categoryStats.basisLabel}
              </p>
              <div className="space-y-5">
                {(showAllCategories ? categoryStats.items : categoryStats.items.slice(0, 6)).map((cat, i) => (
                  <div key={i} className="grid grid-cols-[1fr_40px] items-center gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight">
                        <span className="truncate pr-2">{cat.name}</span>
                        <span className="text-foreground shrink-0">{formatINR(cat.value)}</span>
                      </div>
                      <div className="h-2 w-full bg-secondary/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-700" 
                          style={{ width: `${Math.min(100, cat.percent)}%` }} 
                        />
                      </div>
                    </div>
                    <span className="text-xs font-black text-right tabular-nums">{cat.percent}%</span>
                  </div>
                ))}
              </div>
              {categoryStats.items.length > 6 && (
                <div className="pt-2 text-center">
                  <button 
                    onClick={() => setShowAllCategories(!showAllCategories)}
                    className="text-[10px] font-bold text-primary uppercase tracking-widest hover:opacity-70 transition-opacity flex items-center justify-center gap-1 mx-auto"
                  >
                    {showAllCategories ? (
                      <>Show Less</>
                    ) : (
                      <>+{categoryStats.items.length - 6} more categories</>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>
      </section>

      {/* TOP EXPENSES */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Top Expenses</h3>
        <Card className="glass-card p-4 border-none rounded-3xl space-y-3">
          {topExpenses.length === 0 ? (
            <p className="text-center text-[10px] text-muted-foreground font-bold py-8 uppercase tracking-widest opacity-40">No expenses found for this month.</p>
          ) : (
            <>
              <div className="space-y-1">
                {topExpenses.map((tx, i) => (
                  <div key={tx.id || i} className={cn(
                    "flex items-center justify-between p-3 rounded-2xl transition-colors hover:bg-white/5",
                    i !== topExpenses.length - 1 && "border-b border-white/5"
                  )}>
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-black text-xs shrink-0">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold truncate pr-2">{tx.description}</h4>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                          {tx.category} · {tx.day} {format(selectedDate, 'MMM')}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-orange-500 shrink-0 tabular-nums">
                      {formatINR(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>

              {allMonthlyExpenses.length > 5 && (
                <div className="pt-2 text-center">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowMoreExpenses(!showMoreExpenses)}
                    className="text-[10px] uppercase font-bold tracking-widest text-primary hover:bg-primary/10 h-8"
                  >
                    {showMoreExpenses ? (
                      <><ChevronUp className="w-3.5 h-3.5 mr-1.5" /> See Less</>
                    ) : (
                      <><ChevronDown className="w-3.5 h-3.5 mr-1.5" /> See More</>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </section>

      {/* BUDGET USAGE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Budget Usage</h3>
          <Button 
            variant="link" 
            className="h-4 p-0 text-[10px] uppercase font-bold text-primary tracking-widest" 
            onClick={onNavigateToBudgets}
          >
            Set Budgets
          </Button>
        </div>
        
        {budgetUsage.length === 0 ? (
          <Card className="p-8 border-none bg-secondary/5 rounded-3xl border-dashed border-2 border-primary/10 flex flex-col items-center space-y-3">
            <Target className="w-8 h-8 text-muted-foreground opacity-20" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No monthly budgets set yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {budgetUsage.map((b, i) => (
              <Card key={i} className="glass-card p-5 border-none rounded-3xl space-y-3 relative overflow-hidden shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5 min-w-0">
                    <h4 className="text-sm font-bold truncate">{b.category}</h4>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                      {formatINR(b.spent)} of {formatINR(b.limit)} used
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs font-black tabular-nums",
                    b.percent >= 100 ? "text-destructive" : b.percent >= 75 ? "text-orange-500" : "text-emerald-500"
                  )}>
                    {Math.round(b.percent)}%
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Progress 
                    value={Math.min(100, b.percent)} 
                    className="h-1.5 bg-secondary/20" 
                    indicatorClassName={cn(
                      b.percent >= 100 ? "bg-destructive" : b.percent >= 75 ? "bg-orange-500" : "bg-emerald-500"
                    )}
                  />
                  <p className={cn(
                    "text-[9px] font-bold uppercase tracking-widest",
                    b.percent >= 100 ? "text-destructive" : "text-muted-foreground/60"
                  )}>
                    {b.spent > b.limit ? `Exceeded by ${formatINR(b.spent - b.limit)}` : `${formatINR(b.limit - b.spent)} left`}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* YEAR SUMMARY */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Year Summary</h3>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-[200px]">
            {availableYears.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap",
                  selectedYear === year ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-secondary/40 text-muted-foreground hover:bg-secondary/60"
                )}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <Card className="glass-card p-6 border-none rounded-3xl space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <YearMetric label="Income" value={yearStats.income} color="text-emerald-500" />
            <YearMetric label="Expense" value={yearStats.expense} color="text-orange-500" />
            <YearMetric label="Balance" value={yearStats.balance} color={yearStats.balance >= 0 ? "text-primary" : "text-destructive"} />
          </div>
          <div className="pt-2">
            <ComparisonChart income={yearStats.income} expense={yearStats.expense} balance={yearStats.balance} />
          </div>
        </Card>
      </section>

      {/* KEY NOTES */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Key Notes</h3>
        <Card className="p-6 border-none bg-primary/5 border border-primary/10 rounded-3xl space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-4 h-4" />
            <h4 className="text-sm font-bold tracking-tight">Smart Observations</h4>
          </div>
          <div className="space-y-3">
            {keyNotes.map((note, i) => (
              <div key={i} className="flex items-start gap-3 animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-foreground/80 font-medium leading-relaxed">{note}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

/**
 * INTERNAL UI COMPONENTS
 */

function MetricCard({ label, value, color, icon: Icon }: any) {
  return (
    <Card className="bg-card border-none p-3 rounded-2xl flex flex-col justify-between space-y-1 shadow-sm">
      <div className="flex items-center gap-1.5 opacity-60">
        <Icon className={cn("w-3 h-3", color)} />
        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-xs font-black truncate", color)}>
        {formatINR(value)}
      </p>
    </Card>
  );
}

function YearMetric({ label, value, color }: any) {
  const shortVal = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    return formatINR(v);
  };

  return (
    <div className="text-center space-y-0.5">
      <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
      <p className={cn("text-[11px] font-bold", color)}>{shortVal(value)}</p>
    </div>
  );
}

function ComparisonChart({ income, expense, balance }: { income: number, expense: number, balance: number }) {
  const max = Math.max(Math.abs(income), Math.abs(expense), Math.abs(balance), 1);
  const getW = (v: number) => (Math.abs(v) / max) * 100;

  return (
    <div className="space-y-4 py-2">
      {/* Income Row */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Income</span>
          </div>
          <span className="text-emerald-500">{formatINR(income)}</span>
        </div>
        <div className="h-3 w-full bg-secondary/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 transition-all duration-700 ease-out rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
            style={{ width: `${Math.max(1, getW(income))}%` }} 
          />
        </div>
      </div>

      {/* Expense Row */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span>Expense</span>
          </div>
          <span className="text-orange-500">{formatINR(expense)}</span>
        </div>
        <div className="h-3 w-full bg-secondary/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-orange-500 transition-all duration-700 ease-out rounded-full shadow-[0_0_8px_rgba(249,115,22,0.3)]" 
            style={{ width: `${Math.max(1, getW(expense))}%` }} 
          />
        </div>
      </div>

      {/* Balance Row */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <div className="flex items-center gap-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full", balance >= 0 ? "bg-primary" : "bg-destructive")} />
            <span>Balance</span>
          </div>
          <span className={cn(balance >= 0 ? "text-primary" : "text-destructive")}>
            {formatINR(balance)}
          </span>
        </div>
        <div className="h-3 w-full bg-secondary/10 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-700 ease-out rounded-full",
              balance >= 0 ? "bg-primary shadow-[0_0_8px_rgba(91,92,226,0.3)]" : "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.3)]"
            )} 
            style={{ width: `${Math.max(1, getW(balance))}%` }} 
          />
        </div>
      </div>
    </div>
  );
}
