
"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIES, PAYMENT_MODES } from '@/lib/sample-data';
import { cn } from '@/lib/utils';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface EntryFormProps {
  onSuccess?: () => void;
  initialData?: {
    type: 'expense' | 'income';
    amount: string;
    description: string;
    category: string;
    paymentMode: string;
  } | null;
}

export function EntryForm({ onSuccess, initialData }: EntryFormProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const [loading, setLoading] = useState(false);
  
  // Initialize state with initialData if provided
  const [type, setType] = useState<'expense' | 'income'>(initialData?.type || 'expense');
  const [date, setDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState(initialData?.amount || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [paymentMode, setPaymentMode] = useState(initialData?.paymentMode || '');

  async function handleAddEntry() {
    if (!amount || !category || !paymentMode) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please enter Amount, Category, and Payment Mode."
      });
      return;
    }

    if (!user || !db) {
      toast({
        variant: "destructive",
        title: "Sign In Required",
        description: "Please sign in to add entries."
      });
      return;
    }

    setLoading(true);

    const amountNum = parseFloat(amount);
    const incomeExpenseStr = type === 'expense' ? 'Expense' : 'Income';
    const timestamp = new Date();
    
    // Generate readable unique record ID: FIN-YYYYMMDD-HHMMSS
    const recordId = `FIN-${format(timestamp, 'yyyyMMdd')}-${format(timestamp, 'HHmmss')}`;
    
    // Derived transaction type (Big/Small logic based on typical finance tracker patterns)
    const txType = amountNum >= 5000 ? `Big ${incomeExpenseStr}` : `Small ${incomeExpenseStr}`;

    const txData = {
      recordId,
      userId: user.uid,
      date: format(date, 'yyyy-MM-dd'),
      month: format(date, 'MMMM'),
      year: parseInt(format(date, 'yyyy')),
      amount: amountNum,
      category,
      incomeExpense: incomeExpenseStr,
      description: description.trim(),
      transactionType: txType,
      paymentMode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const transactionsRef = collection(db, 'users', user.uid, 'transactions');

    // Initiate Firestore mutation - using .then() to avoid 'await' for instant local cache benefits
    addDoc(transactionsRef, txData)
      .then(() => {
        toast({ title: "Entry added successfully." });
        // Reset form for next entry
        setAmount('');
        setDescription('');
        setCategory('');
        setPaymentMode('');
        if (onSuccess) onSuccess();
        setLoading(false);
      })
      .catch((serverError) => {
        console.error("Firestore Save Error:", serverError);
        
        // Construct and emit rich, contextual error for the development listener
        const permissionError = new FirestorePermissionError({
          path: transactionsRef.path,
          operation: 'create',
          requestResourceData: txData,
        });

        errorEmitter.emit('permission-error', permissionError);

        toast({ 
          variant: "destructive", 
          title: "Error", 
          description: "Unable to add this entry. Please try again." 
        });
        setLoading(false);
      });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold ml-1">Entry Type</Label>
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant={type === 'expense' ? 'default' : 'outline'}
            onClick={() => setType('expense')}
            className={cn(
              "h-12 rounded-xl font-bold transition-all text-sm",
              type === 'expense' && "bg-expense text-white border-expense glow-primary"
            )}
          >
            Expense
          </Button>
          <Button 
            variant={type === 'income' ? 'default' : 'outline'}
            onClick={() => setType('income')}
            className={cn(
              "h-12 rounded-xl font-bold transition-all text-sm",
              type === 'income' && "bg-accent text-white border-accent glow-secondary"
            )}
          >
            Income
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold ml-1">Amount</Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">₹</span>
            <Input 
              type="number" 
              placeholder="0.00" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-14 pl-10 text-3xl font-bold bg-transparent border-none focus-visible:ring-0 placeholder:text-muted/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold ml-1">Date</Label>
            <div className="relative group">
              <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <input 
                type="date"
                value={format(date, 'yyyy-MM-dd')}
                onChange={(e) => setDate(new Date(e.target.value))}
                className="w-full h-12 pl-11 pr-3 bg-secondary/10 border-none rounded-2xl text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all color-scheme-dark"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold ml-1">Description</Label>
            <Input 
              placeholder="What was this for?" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-12 bg-secondary/10 border-none rounded-2xl text-base px-4 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold ml-1">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12 bg-secondary/10 border-none rounded-2xl px-4 font-semibold">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold ml-1">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="h-12 bg-secondary/10 border-none rounded-2xl px-4 font-semibold">
                  <SelectValue placeholder="Choose mode" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map(mode => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleAddEntry}
          disabled={loading}
          className={cn(
            "w-full h-14 rounded-[20px] text-base font-bold mt-4 shadow-lg transition-all active:scale-95",
            type === 'income' ? "bg-accent text-white glow-secondary" : "bg-primary text-white glow-primary"
          )}
        >
          {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Saving...</> : "Save Entry"}
        </Button>
      </div>
    </div>
  );
}

