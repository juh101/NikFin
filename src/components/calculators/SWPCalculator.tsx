
"use client"

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCcw, AlertCircle, TrendingDown, IndianRupee, Percent, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { VariableStrip } from './SIPCalculator';

export function SWPCalculator() {
  const [corpus, setCorpus] = useState('1000000');
  const [returns, setReturns] = useState('8');
  const [withdrawal, setWithdrawal] = useState('10000');
  const [years, setYears] = useState('15');
  const [stepUp, setStepUp] = useState('0');
  const [results, setResults] = useState<any>(null);

  const calculate = () => {
    let currentCorpus = parseFloat(corpus) || 0;
    const monthlyRate = (parseFloat(returns) || 0) / 100 / 12;
    let currentWithdrawal = parseFloat(withdrawal) || 0;
    const n = (parseInt(years) || 1) * 12;
    const s = (parseFloat(stepUp) || 0) / 100;

    let totalWithdrawn = 0;
    const yearlyData = [];
    let isExhausted = false;
    let exhaustionMonth = 0;

    for (let month = 1; month <= n; month++) {
      if (currentCorpus <= 0) {
        if (!isExhausted) {
          isExhausted = true;
          exhaustionMonth = month - 1;
        }
        currentCorpus = 0;
      }

      if (month > 1 && month % 12 === 1) {
        currentWithdrawal = currentWithdrawal * (1 + s);
      }

      const interest = currentCorpus * monthlyRate;
      currentCorpus = currentCorpus + interest - currentWithdrawal;
      totalWithdrawn += currentWithdrawal;

      if (month % 12 === 0 || month === n) {
        yearlyData.push({
          year: `Yr ${Math.ceil(month / 12)}`,
          corpus: Math.round(Math.max(0, currentCorpus))
        });
      }
    }

    setResults({
      totalWithdrawn,
      remainingCorpus: currentCorpus,
      isExhausted,
      exhaustionYear: Math.floor(exhaustionMonth / 12),
      exhaustionMonth: exhaustionMonth % 12,
      yearlyData
    });
  };

  useEffect(() => {
    calculate();
  }, [corpus, returns, withdrawal, years, stepUp]);

  const reset = () => {
    setCorpus('1000000');
    setReturns('8');
    setWithdrawal('10000');
    setYears('15');
    setStepUp('0');
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
          label="Initial Savings Amount"
          icon={<IndianRupee className="w-3.5 h-3.5" />}
          value={corpus}
          setValue={setCorpus}
          min={10000}
          max={500000000}
          step={10000}
          unitPrefix="₹"
        />

        <VariableStrip
          label="Monthly Withdrawal"
          icon={<IndianRupee className="w-3.5 h-3.5" />}
          value={withdrawal}
          setValue={setWithdrawal}
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
          label="Withdrawal Period"
          icon={<Calendar className="w-3.5 h-3.5" />}
          value={years}
          setValue={setYears}
          min={1}
          max={100}
          step={1}
          unitSuffix="Years"
        />

        <VariableStrip
          label="Annual Withdrawal Increase"
          icon={<TrendingDown className="w-3.5 h-3.5" />}
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {results.isExhausted && (
            <Card className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-[10px] text-destructive font-bold uppercase leading-relaxed">
                Savings may run out in {results.exhaustionYear} years, {results.exhaustionMonth} months.
              </p>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Card className="glass-card p-4 border-none space-y-1 bg-white/[0.02]">
              <p className="text-[8px] text-muted-foreground uppercase font-black tracking-[0.2em]">Total Withdrawn</p>
              <p className="text-base font-black text-emerald-500">{formatCurrency(results.totalWithdrawn)}</p>
            </Card>
            <Card className="glass-card p-4 border-none space-y-1 bg-white/[0.02]">
              <p className="text-[8px] text-muted-foreground uppercase font-black tracking-[0.2em]">Remaining Savings</p>
              <p className={cn("text-base font-black", results.remainingCorpus <= 0 ? "text-destructive" : "text-primary")}>
                {formatCurrency(Math.max(0, results.remainingCorpus))}
              </p>
            </Card>
          </div>

          <Card className="glass-card p-6 border-none space-y-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-primary" />
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Savings Over Time</h4>
            </div>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results.yearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }} interval={Math.floor(results.yearlyData.length / 5)} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }} tickFormatter={(v) => `₹${v >= 10000000 ? (v / 10000000).toFixed(1) + 'Cr' : v >= 100000 ? (v / 100000).toFixed(0) + 'L' : v}`} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<SimpleTooltip />} />
                  <Bar dataKey="corpus" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function SimpleTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 border border-white/10 p-2 rounded-xl shadow-xl text-[10px] font-bold">
        <p className="text-primary uppercase tracking-widest border-b border-white/5 pb-1 mb-1">{label}</p>
        <p className="text-foreground">Savings: ₹{payload[0].value.toLocaleString('en-IN')}</p>
      </div>
    );
  }
  return null;
}
