
"use client"

import { Card } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, Wallet, Loader2 } from 'lucide-react';

interface BalanceCardProps {
  balance?: number;
  income?: number;
  spent?: number;
  loading?: boolean;
}

export function BalanceCard({ balance = 0, income = 0, spent = 0, loading = false }: BalanceCardProps) {
  if (loading) {
    return (
      <Card className="brand-gradient p-6 relative overflow-hidden glow-primary border-none min-h-[180px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-2 text-white/50">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest">Checking Ledger...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="brand-gradient p-6 relative overflow-hidden glow-primary border-none">
      <div className="absolute top-0 right-0 p-4 opacity-10 text-white">
        <Wallet size={80} />
      </div>
      
      <div className="space-y-1 relative z-10">
        <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Balance</p>
        <h2 className="text-4xl font-bold tracking-tight text-white">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4 relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
        <div className="flex-1 space-y-0.5">
          <div className="flex items-center text-secondary space-x-1">
            <ArrowUpRight size={14} strokeWidth={3} />
            <span className="text-[10px] font-bold uppercase">Income</span>
          </div>
          <p className="text-base font-bold text-white">₹{income.toLocaleString('en-IN')}</p>
        </div>
        
        <div className="w-px h-8 bg-white/20" />

        <div className="flex-1 space-y-0.5">
          <div className="flex items-center text-rose-300 space-x-1">
            <ArrowDownRight size={14} strokeWidth={3} />
            <span className="text-[10px] font-bold uppercase">Spent</span>
          </div>
          <p className="text-base font-bold text-white">₹{spent.toLocaleString('en-IN')}</p>
        </div>
      </div>
    </Card>
  );
}
