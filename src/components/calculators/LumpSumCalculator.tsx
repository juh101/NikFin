
"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCcw, IndianRupee, Percent, Calendar, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VariableStrip } from './SIPCalculator';

export function LumpSumCalculator() {
  const [amount, setAmount] = useState('100000');
  const [returns, setReturns] = useState('12');
  const [years, setYears] = useState('10');
  const [results, setResults] = useState<any>(null);

  const calculate = () => {
    const P = parseFloat(amount) || 0;
    const r = (parseFloat(returns) || 0) / 100;
    const n = parseInt(years) || 1;

    const maturityValue = P * Math.pow((1 + r), n);

    setResults({
      totalInvested: P,
      maturityValue,
      estimatedReturns: maturityValue - P
    });
  };

  useEffect(() => {
    calculate();
  }, [amount, returns, years]);

  const reset = () => {
    setAmount('100000');
    setReturns('12');
    setYears('10');
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
          label="One-time Investment"
          icon={<IndianRupee className="w-3.5 h-3.5" />}
          value={amount}
          setValue={setAmount}
          min={1000}
          max={100000000}
          step={1000}
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-2 gap-3">
            <Card className="glass-card p-4 border-none space-y-1 bg-white/[0.02]">
              <p className="text-[8px] text-muted-foreground uppercase font-black tracking-[0.2em]">Total Invested</p>
              <p className="text-base font-black text-foreground">{formatCurrency(results.totalInvested)}</p>
            </Card>
            <Card className="glass-card p-4 border-none space-y-1 bg-white/[0.02]">
              <p className="text-[8px] text-muted-foreground uppercase font-black tracking-[0.2em]">Estimated Growth</p>
              <p className="text-base font-black text-emerald-500">{formatCurrency(results.estimatedReturns)}</p>
            </Card>
          </div>
          <Card className="glass-card p-6 border-none bg-primary/5 glow-primary text-center space-y-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <TrendingUp size={80} />
            </div>
            <p className="text-[10px] font-bold uppercase text-primary tracking-[0.2em] relative z-10">Estimated Final Amount</p>
            <h3 className="text-3xl font-black text-primary relative z-10">{formatCurrency(results.maturityValue)}</h3>
          </Card>
        </div>
      )}
    </div>
  );
}
