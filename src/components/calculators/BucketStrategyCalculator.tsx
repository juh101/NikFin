
"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend 
} from 'recharts';
import { 
  TrendingUp, ChevronDown, ChevronUp, Wallet, ShieldCheck, Layers, Info,
  CheckCircle2, AlertTriangle, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Strategy Preset Definitions
 */
const STRATEGIES = {
  conservative: {
    name: 'Conservative',
    description: 'More safety, slower growth',
    assumptions: {
      inflationRate: 6,
      cashBucketYears: 2,
      debtBucketYears: 5,
      cashReturn: 3,
      debtReturn: 6,
      growthReturn: 10,
      projectionYears: 40
    }
  },
  balanced: {
    name: 'Balanced',
    description: 'Recommended default',
    assumptions: {
      inflationRate: 6,
      cashBucketYears: 2,
      debtBucketYears: 3,
      cashReturn: 3,
      debtReturn: 7,
      growthReturn: 12,
      projectionYears: 40
    }
  },
  aggressive: {
    name: 'Aggressive',
    description: 'More growth, higher risk',
    assumptions: {
      inflationRate: 6,
      cashBucketYears: 1,
      debtBucketYears: 2,
      cashReturn: 3,
      debtReturn: 7,
      growthReturn: 14,
      projectionYears: 40
    }
  }
};

type StrategyType = keyof typeof STRATEGIES;

/**
 * Simple Input Row Component - Mobile Optimized
 */
function SimpleBucketInput({ label, value, setValue, min, max, step, prefix = "", suffix = "" }: any) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^\d.]/g, '');
    setValue(rawValue);
  };

  const displayValue = useMemo(() => {
    if (prefix === '₹') {
      const num = parseFloat(value);
      if (isNaN(num)) return value;
      return num.toLocaleString('en-IN');
    }
    return value;
  }, [value, prefix]);

  return (
    <div className="w-full bg-secondary/10 border border-white/5 p-4 rounded-[20px] mb-3 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <label className="text-sm font-bold text-foreground/80 tracking-tight flex-1 min-w-0">{label}</label>
        <div className="flex items-center bg-background/60 px-3 py-1.5 rounded-xl border border-white/10 min-w-[120px] md:min-w-[140px] flex-shrink-0 ml-auto">
          {prefix && <span className="text-[10px] font-bold text-primary/60 mr-1">{prefix}</span>}
          <input
            type="text"
            className="w-full bg-transparent border-none text-right text-xs font-black focus:outline-none text-foreground tabular-nums p-0"
            value={displayValue}
            onChange={handleInputChange}
          />
          {suffix && <span className="text-[10px] font-bold text-muted-foreground/60 ml-1">{suffix}</span>}
        </div>
      </div>
      <div className="px-1">
        <Slider
          value={[parseFloat(value) || 0]}
          min={min}
          max={max}
          step={step}
          onValueChange={(vals) => setValue(String(vals[0]))}
          className="py-1"
        />
      </div>
    </div>
  );
}

export function BucketStrategyCalculator() {
  // Main User Inputs
  const [corpus, setCorpus] = useState('5000000');
  const [expenses, setExpenses] = useState('50000');
  const [strategy, setStrategy] = useState<StrategyType>('balanced');
  
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [showFullTable, setShowFullTable] = useState(false);

  const calculate = () => {
    const P = parseFloat(corpus) || 0;
    const E = parseFloat(expenses) || 0;
    const sData = STRATEGIES[strategy].assumptions;
    
    // Strategy parameters
    const Inf = sData.inflationRate / 100;
    const CY = sData.cashBucketYears;
    const DY = sData.debtBucketYears;
    const Cr = sData.cashReturn / 100;
    const Dr = sData.debtReturn / 100;
    const Gr = sData.growthReturn / 100;
    const PY = sData.projectionYears;

    let simulationData = [];
    let currentCash = 0;
    let currentDebt = 0;
    let currentGrowth = 0;

    const getAnnualExpense = (y: number) => E * 12 * Math.pow(1 + Inf, y - 1);

    // Initial Split
    for (let y = 1; y <= CY; y++) currentCash += getAnnualExpense(y);
    if (currentCash > P) currentCash = P;

    let remainingAfterCash = P - currentCash;
    for (let y = CY + 1; y <= CY + DY; y++) currentDebt += getAnnualExpense(y);
    if (currentDebt > remainingAfterCash) currentDebt = remainingAfterCash;

    currentGrowth = Math.max(0, P - currentCash - currentDebt);
    const initialSplit = { cash: currentCash, debt: currentDebt, growth: currentGrowth };

    simulationData.push({
      year: 0,
      cash: Math.round(currentCash),
      debt: Math.round(currentDebt),
      growth: Math.round(currentGrowth),
      total: Math.round(currentCash + currentDebt + currentGrowth),
      expense: 0,
      refill: 0,
      source: '—'
    });

    let monthsLasted = 0;
    let exhausted = false;

    // Simulation loop
    for (let y = 1; y <= PY; y++) {
      if (exhausted) break;
      currentCash *= (1 + Cr);
      currentDebt *= (1 + Dr);
      currentGrowth *= (1 + Gr);

      const annualExp = getAnnualExpense(y);
      let refillAmount = 0;
      let refillSource = '—';

      // Pay from Cash first
      if (currentCash >= annualExp) {
        currentCash -= annualExp;
      } else {
        const shortfallFromCash = annualExp - currentCash;
        currentCash = 0;
        if (currentDebt >= shortfallFromCash) {
          currentDebt -= shortfallFromCash;
        } else {
          const shortfallFromDebt = shortfallFromCash - currentDebt;
          currentDebt = 0;
          if (currentGrowth >= shortfallFromDebt) {
            currentGrowth -= shortfallFromDebt;
          } else {
            const totalRemainingBeforeExhaustion = currentGrowth;
            currentGrowth = 0;
            const fractionOfYear = (shortfallFromCash - (shortfallFromDebt - totalRemainingBeforeExhaustion)) / annualExp;
            monthsLasted = (y - 1) * 12 + Math.floor(fractionOfYear * 12);
            exhausted = true;
          }
        }
      }

      if (exhausted) {
        simulationData.push({ year: y, cash: 0, debt: 0, growth: 0, total: 0, expense: Math.round(annualExp), refill: 0, source: 'Exhausted' });
        break;
      }

      // Cycle Refill (Debt-First)
      if (y % CY === 0) {
        let targetRefill = 0;
        for (let nextY = y + 1; nextY <= y + CY; nextY++) targetRefill += getAnnualExpense(nextY);
        const cashShortfall = Math.max(0, targetRefill - currentCash);
        
        if (cashShortfall > 0) {
          refillAmount = cashShortfall;
          if (currentDebt >= cashShortfall) {
            currentDebt -= cashShortfall;
            currentCash += cashShortfall;
            refillSource = 'Debt';
          } else {
            const debtUsed = currentDebt;
            const remainingShortfall = cashShortfall - currentDebt;
            currentDebt = 0;
            if (currentGrowth >= remainingShortfall) {
              currentGrowth -= remainingShortfall;
              currentCash += (debtUsed + remainingShortfall);
              refillSource = debtUsed > 0 ? 'Debt + Growth' : 'Growth';
            } else {
              const growthUsed = currentGrowth;
              currentGrowth = 0;
              currentCash += (debtUsed + growthUsed);
              refillSource = 'Partial';
            }
          }
        }
      }

      simulationData.push({
        year: y,
        cash: Math.round(currentCash),
        debt: Math.round(currentDebt),
        growth: Math.round(currentGrowth),
        total: Math.round(currentCash + currentDebt + currentGrowth),
        expense: Math.round(annualExp),
        refill: Math.round(refillAmount),
        source: refillSource
      });
      if (!exhausted) monthsLasted = y * 12;
    }

    setResults({ 
      initialSplit, 
      data: simulationData, 
      monthsLasted, 
      isExhausted: exhausted, 
      finalTotal: simulationData[simulationData.length-1].total 
    });
  };

  useEffect(() => { calculate(); }, [corpus, expenses, strategy]);

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Bucket Strategy</h2>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
          Cash, debt and growth bucket plan
        </p>
      </div>

      {/* 1. INPUTS */}
      <div className="space-y-4">
        <SimpleBucketInput label="Initial Corpus" value={corpus} setValue={setCorpus} min={100000} max={50000000} step={100000} prefix="₹" />
        <SimpleBucketInput label="Monthly Expenses" value={expenses} setValue={setExpenses} min={5000} max={1000000} step={1000} prefix="₹" />
        
        {/* Strategy Selector */}
        <div className="space-y-3">
          <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Choose Strategy</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.keys(STRATEGIES) as StrategyType[]).map((sKey) => {
              const isActive = strategy === sKey;
              const s = STRATEGIES[sKey];
              return (
                <button
                  key={sKey}
                  onClick={() => setStrategy(sKey)}
                  className={cn(
                    "flex flex-col p-4 rounded-2xl border-2 transition-all text-left space-y-1 active:scale-95",
                    isActive 
                      ? "bg-primary/10 border-primary shadow-lg shadow-primary/10" 
                      : "bg-secondary/5 border-transparent hover:bg-secondary/10"
                  )}
                >
                  <span className={cn("text-xs font-black uppercase tracking-wider", isActive ? "text-primary" : "text-foreground/80")}>
                    {s.name}
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground leading-tight uppercase opacity-60">
                    {s.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Assumptions Summary */}
        <div className="px-1 pt-2">
          <button 
            onClick={() => setShowAssumptions(!showAssumptions)}
            className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:opacity-70 transition-opacity"
          >
            {showAssumptions ? 'Hide details' : 'View strategy assumptions'}
            {showAssumptions ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
          </button>
        </div>

        {/* Collapsible Detailed Assumptions (Read-Only) */}
        {showAssumptions && (
          <Card className="p-5 border-none bg-secondary/5 rounded-[24px] space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">
              {STRATEGIES[strategy].name} Parameters
            </h4>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6">
              <AssumptionItem label="Inflation Rate" value={`${STRATEGIES[strategy].assumptions.inflationRate}%`} />
              <AssumptionItem label="Projection" value={`${STRATEGIES[strategy].assumptions.projectionYears} Years`} />
              <AssumptionItem label="Cash Bucket" value={`${STRATEGIES[strategy].assumptions.cashBucketYears} Years`} />
              <AssumptionItem label="Debt Bucket" value={`${STRATEGIES[strategy].assumptions.debtBucketYears} Years`} />
              <AssumptionItem label="Cash Return" value={`${STRATEGIES[strategy].assumptions.cashReturn}% p.a.`} />
              <AssumptionItem label="Debt Return" value={`${STRATEGIES[strategy].assumptions.debtReturn}% p.a.`} />
              <AssumptionItem label="Growth Return" value={`${STRATEGIES[strategy].assumptions.growthReturn}% p.a.`} />
              <AssumptionItem label="Refill Logic" value="Debt then Growth" />
            </div>
          </Card>
        )}
      </div>

      {/* 2. RESULTS */}
      {results && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Main Survival Result */}
          <Card className={cn(
            "p-8 border-none text-center space-y-2 rounded-[32px] shadow-2xl relative overflow-hidden",
            results.isExhausted ? "bg-destructive/5 border border-destructive/10" : "bg-primary/5 border border-primary/10"
          )}>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Survival Projection</p>
            <h3 className={cn("text-3xl font-black", results.isExhausted ? "text-destructive" : "text-primary")}>
              {results.monthsLasted >= results.data.length * 12 
                ? `Beyond ${STRATEGIES[strategy].assumptions.projectionYears} Years` 
                : `${Math.floor(results.monthsLasted / 12)} years ${results.monthsLasted % 12} months`}
            </h3>
            <p className="text-[10px] font-medium text-muted-foreground/60 pt-1 leading-relaxed px-4">
              Based on {formatCurrency(parseFloat(expenses))} monthly expenses and the {STRATEGIES[strategy].name} bucket strategy.
            </p>
          </Card>

          {/* Initial Split */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Initial Bucket Split</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SplitCard label="Cash" value={results.initialSplit.cash} color="text-cyan-500" icon={<Wallet size={12}/>} />
              <SplitCard label="Debt" value={results.initialSplit.debt} color="text-orange-500" icon={<Shield size={12}/>} />
              <SplitCard label="Growth" value={results.initialSplit.growth} color="text-emerald-500" icon={<Layers size={12}/>} />
            </div>
          </div>

          {/* Chart */}
          <Card className="glass-card p-6 border-none rounded-[32px] space-y-6 shadow-xl">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Portfolio Movement</h4>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickFormatter={(v) => `₹${v >= 10000000 ? (v/10000000).toFixed(1) + 'Cr' : v >= 100000 ? (v/100000).toFixed(0) + 'L' : v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend verticalAlign="top" align="right" iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '20px' }} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} strokeDasharray="5 5" />
                  <Line type="stepAfter" dataKey="cash" name="Cash" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="debt" name="Debt" stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="growth" name="Growth" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Detailed Logs - Mobile Optimized Card View */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Yearly Projection Log</h4>
              <button onClick={() => setShowFullTable(!showFullTable)} className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1">
                {showFullTable ? 'See Less' : 'Full Log'} {showFullTable ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
              </button>
            </div>
            <div className="space-y-3">
              {(showFullTable ? results.data : results.data.slice(0, 11)).map((row: any) => (
                <ProjectionRow key={row.year} row={row} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Note */}
      <p className="text-[9px] text-muted-foreground/50 text-center font-medium leading-relaxed italic px-6">
        This is an estimate using preset assumptions. Actual results depend on real market returns, inflation, taxes, and spending.
      </p>
    </div>
  );
}

function AssumptionItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-tighter">{label}</p>
      <p className="text-[10px] font-black text-foreground">{value}</p>
    </div>
  );
}

function SplitCard({ label, value, color, icon }: any) {
  return (
    <Card className="bg-secondary/5 border-none p-4 rounded-2xl flex flex-col justify-between space-y-2">
      <div className="flex items-center gap-1.5 opacity-50">
        <span className={cn("p-1 rounded-md bg-background/50", color)}>{icon}</span>
        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-xs font-black tabular-nums", color)}>
        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)}
      </p>
    </Card>
  );
}

function ProjectionRow({ row }: { row: any }) {
  const isRefilled = row.refill > 0;
  return (
    <div className={cn("p-4 rounded-2xl border border-white/5 space-y-3 bg-card", row.year === 0 && "bg-primary/5 border-primary/10")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-secondary/30 flex items-center justify-center text-[10px] font-black text-foreground/50">
            {row.year === 0 ? 'START' : `Y${row.year}`}
          </span>
          <div className="space-y-0">
            <p className="text-xs font-black tabular-nums">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(row.total)}</p>
            <p className="text-[8px] font-bold uppercase text-muted-foreground/40">Portfolio Balance</p>
          </div>
        </div>
        {isRefilled && <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-500 text-[8px] font-black uppercase border border-cyan-500/20">Refilled</span>}
      </div>
      {row.year > 0 && (
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
          <div className="space-y-1">
            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase">Buckets</p>
            <div className="flex justify-between text-[9px] font-bold gap-2"><span className="text-cyan-500/60 shrink-0">Cash</span><span className="text-cyan-500 tabular-nums truncate">₹{row.cash.toLocaleString()}</span></div>
            <div className="flex justify-between text-[9px] font-bold gap-2"><span className="text-orange-500/60 shrink-0">Debt</span><span className="text-orange-500 tabular-nums truncate">₹{row.debt.toLocaleString()}</span></div>
            <div className="flex justify-between text-[9px] font-bold gap-2"><span className="text-emerald-500/60 shrink-0">Grow</span><span className="text-emerald-500 tabular-nums truncate">₹{row.growth.toLocaleString()}</span></div>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-[8px] font-bold text-muted-foreground/40 uppercase">Refill Details</p>
            <p className="text-[9px] font-bold text-foreground/80">{row.source}</p>
            {isRefilled && <p className="text-[9px] font-bold text-cyan-500">₹{row.refill.toLocaleString()}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl text-[9px] font-bold space-y-1.5 min-w-[140px]">
        <p className="text-primary uppercase tracking-widest border-b border-white/5 pb-1 mb-1 font-black">Year {label}</p>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex justify-between gap-4">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="text-foreground tabular-nums">₹{entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
