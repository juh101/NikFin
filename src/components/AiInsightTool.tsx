
"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { aiSpendingInsights } from '@/ai/flows/ai-spending-insights';
import { useToast } from '@/hooks/use-toast';

interface AiInsightToolProps {
  transactions?: any[];
  summary?: {
    totalIncome: number;
    totalExpense: number;
    savings: number;
  };
}

export function AiInsightTool({ transactions = [], summary }: AiInsightToolProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const { toast } = useToast();

  async function generateInsights() {
    if (!transactions || transactions.length === 0) {
      setInsight("Add some transactions to enable your AI financial advisor.");
      return;
    }

    setLoading(true);
    
    try {
      // Normalize transactions for Genkit flow to ensure serializable data
      const normalizedTransactions = transactions.slice(0, 15).map(tx => {
        const rawType = tx.incomeExpense || tx.type || "expense";
        const isIncome = String(rawType).toLowerCase().includes('income');
        
        return {
          id: String(tx.id || Math.random().toString()),
          description: String(tx.description || "No description").trim(),
          amount: Number(tx.amount || 0),
          category: String(tx.category || "Other"),
          type: (isIncome ? 'income' : 'expense') as 'income' | 'expense',
          date: String(tx.date || new Date().toISOString().split('T')[0]),
        };
      });

      // Prepare clean summary
      const cleanSummary = summary ? {
        totalIncome: Number(summary.totalIncome || 0),
        totalExpense: Number(summary.totalExpense || 0),
        savings: Number(summary.savings || 0)
      } : undefined;

      const result = await aiSpendingInsights({
        transactions: normalizedTransactions,
        summary: cleanSummary
      });

      if (result && result.insights) {
        setInsight(result.insights);
        setLastGenerated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else {
        throw new Error("Empty insights returned from AI");
      }
    } catch (error: any) {
      console.error("AI Insight Component Error:", error);
      toast({
        variant: "destructive",
        title: "AI Analysis Failed",
        description: "Unable to analyze your spending at this moment. Please try again."
      });
      // Fallback message
      setInsight("Keep tracking your expenses to get personalized AI financial insights soon.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-5 border-none bg-primary/5 border border-primary/10 space-y-4 shadow-[0_0_20px_-10px_rgba(249,115,22,0.2)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-primary">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-bold text-sm tracking-tight">AI Financial Insight</h3>
        </div>
        {!insight && !loading && (
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-xs h-8 px-3 hover:bg-primary/10 text-primary font-bold uppercase tracking-wider"
            onClick={generateInsights}
            disabled={loading}
          >
            Generate
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-6 space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] animate-pulse">
            Analyzing Data...
          </p>
        </div>
      ) : insight ? (
        <div className="space-y-4">
          <div className="relative">
            <p className="text-sm text-foreground leading-relaxed italic pr-2">
              "{insight}"
            </p>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-primary/10">
            {lastGenerated && (
              <div className="flex items-center text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                <Clock className="w-3 h-3 mr-1 opacity-50" />
                Generated {lastGenerated}
              </div>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              className="text-[10px] h-7 px-3 bg-transparent border-primary/20 text-primary hover:bg-primary/5 font-bold uppercase tracking-widest"
              onClick={generateInsights}
            >
              Regenerate
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {transactions && transactions.length > 0 
            ? "Your dashboard data is ready. Generate a personalized analysis of your spending habits."
            : "Add some transactions to enable your financial advisor."}
        </p>
      )}
    </Card>
  );
}
