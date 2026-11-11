
"use client"

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RefreshCcw, Target, TrendingUp, AlertTriangle, CheckCircle2, IndianRupee, Percent, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VariableStrip } from './SIPCalculator';

export function RetirementCalculator() {
  const [mode, setMode] = useState('need');

  // Shared inputs
  const [currentAge, setCurrentAge] = useState('30');
  const [retireAge, setRetireAge] = useState('60');
  const [currentSavings, setCurrentSavings] = useState('500000');

  // Mode A: Need
  const [monthlyExpense, setMonthlyExpense] = useState('50000');
  const [inflation, setInflation] = useState('6');
  const [postRetireReturn, setPostRetireReturn] = useState('8');
  const [lifeExpectancy, setLifeExpectancy] = useState('85');
  const [resultsA, setResultsA] = useState<any>(null);

  // Mode B: Build
  const [sipAmount, setSipAmount] = useState('10000');
  const [lumpSum, setLumpSum] = useState('0');
  const [preRetireReturn, setPreRetireReturn] = useState('12');
  const [stepUp, setStepUp] = useState('5');
  const [resultsB, setResultsB] = useState<any>(null);

  const calculateNeed = () => {
    const cAge = parseInt(currentAge) || 18;
    const rAge = parseInt(retireAge) || 60;
    const lExp = parseInt(lifeExpectancy) || 85;

    if (rAge <= cAge) return;

    const yearsToRetire = rAge - cAge;
    const retirementYears = Math.max(1, lExp - rAge);
    const inflationRate = (parseFloat(inflation) || 0) / 100;
    const postReturn = (parseFloat(postRetireReturn) || 0) / 100;

    const futureMonthlyExpense = (parseFloat(monthlyExpense) || 0) * Math.pow(1 + inflationRate, yearsToRetire);
    const futureAnnualExpense = futureMonthlyExpense * 12;

    const realReturn = (1 + postReturn) / (1 + inflationRate) - 1;
    
    let corpusNeeded = 0;
    if (Math.abs(realReturn) < 0.0001) {
      corpusNeeded = futureAnnualExpense * retirementYears;
    } else {
      corpusNeeded = futureAnnualExpense * (1 - Math.pow(1 + realReturn, -retirementYears)) / realReturn;
    }

    setResultsA({
      yearsToRetire,
      futureMonthlyExpense,
      corpusNeeded,
    });
  };

  const calculateBuild = () => {
    const cAge = parseInt(currentAge) || 18;
    const rAge = parseInt(retireAge) || 60;

    if (rAge <= cAge) return;

    const years = rAge - cAge;
    const preReturn = (parseFloat(preRetireReturn) || 0) / 100 / 12;
    const s = (parseFloat(stepUp) || 0) / 100;
    let currentSip = parseFloat(sipAmount) || 0;
    let totalInvested = parseFloat(lumpSum) || 0;
    let projectedCorpus = (parseFloat(currentSavings) || 0) + (parseFloat(lumpSum) || 0);

    for (let year = 1; year <= years; year++) {
      for (let month = 1; month <= 12; month++) {
        totalInvested += currentSip;
        projectedCorpus = (projectedCorpus + currentSip) * (1 + preReturn);
      }
      currentSip = currentSip * (1 + s);
    }

    setResultsB({
      yearsToRetire: years,
      projectedCorpus,
      totalInvested,
      growth: projectedCorpus - totalInvested - (parseFloat(currentSavings) || 0)
    });
  };

  useEffect(() => {
    calculateNeed();
    calculateBuild();
  }, [currentAge, retireAge, currentSavings, monthlyExpense, inflation, postRetireReturn, lifeExpectancy, sipAmount, lumpSum, preRetireReturn, stepUp]);

  const formatCurrency = (val: number) => {
    if (isNaN(val) || !isFinite(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  const isAgeValid = parseInt(retireAge) > parseInt(currentAge);

  return (
    <div className="space-y-6 pb-6">
      <Tabs value={mode} onValueChange={setMode} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-11 bg-secondary/30 rounded-xl p-1">
          <TabsTrigger value="need" className="text-[9px] uppercase font-bold tracking-widest">Amount Needed</TabsTrigger>
          <TabsTrigger value="build" className="text-[9px] uppercase font-bold tracking-widest">Amount You May Build</TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-3">
          <VariableStrip
            label="Current Age"
            icon={<Calendar className="w-3.5 h-3.5" />}
            value={currentAge}
            setValue={setCurrentAge}
            min={18}
            max={80}
            step={1}
            unitSuffix="Years"
          />
          <VariableStrip
            label="Retirement Age"
            icon={<Target className="w-3.5 h-3.5" />}
            value={retireAge}
            setValue={setRetireAge}
            min={30}
            max={80}
            step={1}
            unitSuffix="Years"
          />
          <VariableStrip
            label="Current Savings"
            icon={<IndianRupee className="w-3.5 h-3.5" />}
            value={currentSavings}
            setValue={setCurrentSavings}
            min={0}
            max={500000000}
            step={10000}
            unitPrefix="₹"
          />
        </div>

        {!isAgeValid && (
          <p className="text-[10px] text-destructive font-bold uppercase tracking-tight mt-2 ml-1">
            Retirement age must be higher than current age.
          </p>
        )}

        <TabsContent value="need" className="space-y-3 mt-4">
          <VariableStrip
            label="Monthly Expenses Today"
            icon={<IndianRupee className="w-3.5 h-3.5" />}
            value={monthlyExpense}
            setValue={setMonthlyExpense}
            min={5000}
            max={5000000}
            step={1000}
            unitPrefix="₹"
          />
          <VariableStrip
            label="Expected Inflation"
            icon={<Percent className="w-3.5 h-3.5" />}
            value={inflation}
            setValue={setInflation}
            min={0}
            max={25}
            step={0.5}
            unitSuffix="%"
          />
          <VariableStrip
            label="Post-Retire Return"
            icon={<Percent className="w-3.5 h-3.5" />}
            value={postRetireReturn}
            setValue={setPostRetireReturn}
            min={0}
            max={50}
            step={0.5}
            unitSuffix="%"
          />
          <VariableStrip
            label="Life Expectancy"
            icon={<Calendar className="w-3.5 h-3.5" />}
            value={lifeExpectancy}
            setValue={setLifeExpectancy}
            min={60}
            max={100}
            step={1}
            unitSuffix="Age"
          />

          {resultsA && (
            <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 gap-3">
                <Card className="glass-card p-4 border-none space-y-1 bg-white/[0.02]">
                  <p className="text-[8px] text-muted-foreground uppercase font-black tracking-[0.2em]">Future Expenses</p>
                  <p className="text-base font-bold text-foreground">{formatCurrency(resultsA.futureMonthlyExpense)}<span className="text-[10px] opacity-50">/mo</span></p>
                </Card>
                <Card className="glass-card p-4 border-none space-y-1 bg-white/[0.02]">
                  <p className="text-[8px] text-muted-foreground uppercase font-black tracking-[0.2em]">Years to Retire</p>
                  <p className="text-base font-bold text-primary">{resultsA.yearsToRetire} Years</p>
                </Card>
              </div>
              <Card className="p-6 border-none bg-accent/5 glow-secondary text-center space-y-1 rounded-3xl border border-accent/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Target size={80} />
                </div>
                <p className="text-[10px] font-bold uppercase text-accent/60 tracking-[0.2em] relative z-10">Goal Corpus Needed</p>
                <h3 className="text-3xl font-black text-accent relative z-10">{formatCurrency(resultsA.corpusNeeded)}</h3>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="build" className="space-y-3 mt-4">
          <VariableStrip
            label="Monthly SIP"
            icon={<IndianRupee className="w-3.5 h-3.5" />}
            value={sipAmount}
            setValue={setSipAmount}
            min={500}
            max={1000000}
            step={500}
            unitPrefix="₹"
          />
          <VariableStrip
            label="Lump Sum Addition"
            icon={<IndianRupee className="w-3.5 h-3.5" />}
            value={lumpSum}
            setValue={setLumpSum}
            min={0}
            max={100000000}
            step={1000}
            unitPrefix="₹"
          />
          <VariableStrip
            label="Pre-Retire Return"
            icon={<Percent className="w-3.5 h-3.5" />}
            value={preRetireReturn}
            setValue={setPreRetireReturn}
            min={0}
            max={50}
            step={0.5}
            unitSuffix="%"
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

          {resultsB && (
            <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 gap-3">
                <Card className="glass-card p-4 border-none space-y-1 bg-white/[0.02]">
                  <p className="text-[8px] text-muted-foreground uppercase font-black tracking-[0.2em]">Total Invested</p>
                  <p className="text-base font-bold text-primary">{formatCurrency(resultsB.totalInvested + (parseFloat(currentSavings) || 0))}</p>
                </Card>
                <Card className="glass-card p-4 border-none space-y-1 bg-white/[0.02]">
                  <p className="text-[8px] text-muted-foreground uppercase font-black tracking-[0.2em]">Growth</p>
                  <p className="text-base font-bold text-emerald-500">{formatCurrency(resultsB.growth)}</p>
                </Card>
              </div>

              <Card className="p-6 border-none bg-primary/5 glow-primary text-center space-y-1 rounded-3xl border border-primary/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <TrendingUp size={80} />
                </div>
                <p className="text-[10px] font-bold uppercase text-primary tracking-[0.2em] relative z-10">Projected Corpus at {retireAge}</p>
                <h3 className="text-3xl font-black text-primary relative z-10">{formatCurrency(resultsB.projectedCorpus)}</h3>
              </Card>

              {resultsA && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 px-1">
                    <Target className="w-4 h-4 text-primary" />
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Goals Check</h4>
                  </div>
                  
                  {resultsB.projectedCorpus >= resultsA.corpusNeeded ? (
                    <Card className="p-5 border-none bg-emerald-500/10 rounded-3xl space-y-3">
                      <div className="flex items-center gap-3 text-emerald-500">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-sm font-bold">On Track for Retirement!</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Your projected savings exceed your goal of {formatCurrency(resultsA.corpusNeeded)} by <span className="text-emerald-500 font-bold">{formatCurrency(resultsB.projectedCorpus - resultsA.corpusNeeded)}</span>.
                      </p>
                    </Card>
                  ) : (
                    <Card className="p-5 border-none bg-destructive/10 rounded-3xl space-y-3">
                      <div className="flex items-center gap-3 text-destructive">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-sm font-bold">Shortfall Detected</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Your projected savings fall short of the {formatCurrency(resultsA.corpusNeeded)} goal by <span className="text-destructive font-bold">{formatCurrency(resultsA.corpusNeeded - resultsB.projectedCorpus)}</span>.
                      </p>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
