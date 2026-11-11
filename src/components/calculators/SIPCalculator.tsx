
"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { TrendingUp, RefreshCcw, IndianRupee, Percent, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SIPCalculator() {
  const [amount, setAmount] = useState('10000');
  const [returns, setReturns] = useState('12');
  const [years, setYears] = useState('10');
  const [stepUp, setStepUp] = useState('10');
  const [results, setResults] = useState<any>(null);

  const calculate = () => {
    const P = parseFloat(amount) || 0;
    const i = (parseFloat(returns) || 0) / 100 / 12;
    const nYears = parseInt(years) || 1;
    const s = (parseFloat(stepUp) || 0) / 100;

    let totalInvested = 0;
    let maturityValue = 0;
    let currentP = P;
    const yearlyData = [];

    for (let year = 1; year <= nYears; year++) {
      for (let month = 1; month <= 12; month++) {
        totalInvested += currentP;
        maturityValue = (maturityValue + currentP) * (1 + i);
      }
      yearlyData.push({
        year: `Yr ${year}`,
        invested: Math.round(totalInvested),
        value: Math.round(maturityValue)
      });
      currentP = currentP * (1 + s);
    }

    setResults({
      totalInvested,
      maturityValue,
      estimatedReturns: maturityValue - totalInvested,
      finalMonthly: currentP / (1 + s),
      yearlyData
    });
  };

  useEffect(() => {
    calculate();
  }, [amount, returns, years, stepUp]);

  const reset = () => {
    setAmount('10000');
    setReturns('12');
    setYears('10');
    setStepUp('10');
  };

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <VariableStrip
          label="Monthly Investment"
          icon={<IndianRupee className="w-3.5 h-3.5" />}
          value={amount}
          setValue={setAmount}
          min={500}
          max={1000000}
          step={500}
          unitPrefix="₹"
        />

        <VariableStrip
          label="Expected Yearly Return"
          icon={<Percent className="w-3.5 h-3.5" />}
          value={returns}
          setValue={setReturns}
          min={0}
          max={50}
          step={0.5}
          unitSuffix="%"
        />

        <VariableStrip
          label="Investment Period"
          icon={<Calendar className="w-3.5 h-3.5" />}
          value={years}
          setValue={setYears}
          min={1}
          max={100}
          step={1}
          unitSuffix="Years"
        />

        <VariableStrip
          label="Annual Step-up"
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          value={stepUp}
          setValue={setStepUp}
          min={0}
          max={50}
          step={1}
          unitSuffix="%"
        />

        <div className="pt-2">
          <Button 
            variant="outline" 
            onClick={reset} 
            className="w-full h-10 rounded-xl border-white/5 bg-secondary/10 text-[10px] font-bold uppercase tracking-widest hover:bg-secondary/20"
          >
            <RefreshCcw className="w-3 h-3 mr-2" /> Reset Values
          </Button>
        </div>
      </div>

      {results && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-2 gap-3">
            <ResultCard 
              label="Total Invested" 
              value={formatCurrency(results.totalInvested)} 
              subValue="Base + Step-up"
            />
            <ResultCard 
              label="Estimated Growth" 
              value={formatCurrency(results.estimatedReturns)} 
              color="text-emerald-500"
              subValue="Returns generated"
            />
          </div>
          
          <Card className="glass-card p-6 border-none bg-primary/5 glow-primary text-center space-y-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <TrendingUp size={80} />
            </div>
            <p className="text-[10px] font-bold uppercase text-primary tracking-[0.2em] relative z-10">Estimated Final Wealth</p>
            <h3 className="text-3xl font-black text-primary relative z-10">{formatCurrency(results.maturityValue)}</h3>
          </Card>

          <Card className="glass-card p-6 border-none space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Wealth Growth Projection</h4>
              </div>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results.yearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }} interval={Math.floor(results.yearlyData.length / 5)} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }} tickFormatter={(v) => `₹${v >= 10000000 ? (v / 10000000).toFixed(1) + 'Cr' : v >= 100000 ? (v / 100000).toFixed(0) + 'L' : v}`} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} content={<CustomTooltip />} />
                  <Bar dataKey="invested" stackId="a" fill="hsl(var(--primary))" fillOpacity={0.2} radius={[0, 0, 0, 0]} barSize={12} />
                  <Bar dataKey="value" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={12}>
                    {results.yearlyData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fillOpacity={0.3 + (index / results.yearlyData.length) * 0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function VariableStrip({ label, icon, value, setValue, min, max, step, unitPrefix, unitSuffix }: any) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^\d.]/g, '');
    setValue(rawValue);
  };

  const displayValue = useMemo(() => {
    if (unitPrefix === '₹') {
      const num = parseFloat(value);
      if (isNaN(num)) return value;
      return num.toLocaleString('en-IN');
    }
    return value;
  }, [value, unitPrefix]);

  return (
    <div className="bg-secondary/20 p-4 rounded-2xl space-y-4 border border-white/5 hover:bg-secondary/30 transition-colors">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2 text-muted-foreground min-w-0 flex-1">
          {icon && (
            <div className="w-6 h-6 rounded-lg bg-background/50 flex items-center justify-center text-primary shadow-inner shrink-0">
              {icon}
            </div>
          )}
          <Label className="text-[11px] uppercase font-bold tracking-wider text-foreground/80 leading-tight">
            {label}
          </Label>
        </div>
        <div className={cn(
          "flex-shrink-0 flex items-center gap-1.5 bg-background/80 px-3 py-1.5 rounded-xl border border-white/10 shadow-sm ml-auto",
          "focus-within:ring-2 focus-within:ring-primary/30 transition-all min-w-[110px] md:min-w-[140px]"
        )}>
          {unitPrefix && <span className="text-[10px] font-bold text-primary/60">{unitPrefix}</span>}
          <input
            type="text"
            className="w-full h-auto p-0 border-none bg-transparent text-right text-xs font-black focus:outline-none placeholder:text-muted/20 text-foreground tabular-nums"
            value={displayValue}
            onChange={handleInputChange}
          />
          {unitSuffix && <span className="text-[10px] font-bold text-muted-foreground/60 ml-0.5">{unitSuffix}</span>}
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

function ResultCard({ label, value, color = "text-foreground", subValue }: any) {
  return (
    <Card className="glass-card p-4 border-none space-y-1 bg-white/[0.02]">
      <p className="text-[8px] text-muted-foreground uppercase font-black tracking-[0.2em]">{label}</p>
      <div className="space-y-0">
        <p className={cn("text-base font-black truncate tabular-nums", color)}>{value}</p>
        {subValue && <p className="text-[8px] text-muted-foreground/50 font-bold uppercase tracking-tight">{subValue}</p>}
      </div>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl text-[10px] font-bold space-y-1.5">
        <p className="text-primary uppercase tracking-widest border-b border-white/5 pb-1 mb-1">{label}</p>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground font-medium">Invested:</span>
          <span className="text-foreground">₹{payload[0].value.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground font-medium">Wealth:</span>
          <span className="text-emerald-500 font-black">₹{payload[1].value.toLocaleString('en-IN')}</span>
        </div>
      </div>
    );
  }
  return null;
}
