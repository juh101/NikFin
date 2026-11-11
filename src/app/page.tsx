
"use client"

import { useState, useEffect, useMemo } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { BalanceCard } from '@/components/dashboard/BalanceCard';
import { TransactionList } from '@/components/TransactionList';
import { EntryForm } from '@/components/EntryForm';
import { AnalyticsCharts } from '@/components/AnalyticsCharts';
import { SettingsView } from '@/components/SettingsView';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { CalculatorsView } from '@/components/CalculatorsView';
import { BudgetProgress } from '@/components/dashboard/BudgetProgress';
import { ImportTool } from '@/components/ImportTool';
import { Bell, Calculator, Loader2, Plus, FileUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

type AddMode = 'manual' | 'upload';

export default function Home() {
  const { user, displayName, loading: authLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [addMode, setAddMode] = useState<AddMode>('manual');
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [quickCards, setQuickCards] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [prefillData, setPrefillData] = useState<any>(null);

  // Real-time Firestore Transaction Listener
  useEffect(() => {
    if (!user || !db) return;

    setLoadingTransactions(true);
    const transactionsRef = collection(db, 'users', user.uid, 'transactions');
    const q = query(transactionsRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(docs);
      setLoadingTransactions(false);
      setTransactionsError(null);
    }, async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: transactionsRef.path,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      setTransactionsError("Unable to load entries.");
      setLoadingTransactions(false);
    });

    return () => unsubscribe();
  }, [user, db]);

  // Real-time Firestore Budgets Listener
  useEffect(() => {
    if (!user || !db) return;

    setLoadingBudgets(true);
    const budgetsRef = collection(db, 'users', user.uid, 'budgets');

    const unsubscribe = onSnapshot(budgetsRef, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBudgets(docs);
      setLoadingBudgets(false);
    }, (error) => {
      console.error("Error fetching budgets:", error);
      setLoadingBudgets(false);
    });

    return () => unsubscribe();
  }, [user, db]);

  // Real-time Firestore Quick Cards Listener
  useEffect(() => {
    if (!user || !db) return;

    const cardsRef = collection(db, 'users', user.uid, 'quickCards');
    const q = query(cardsRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setQuickCards(docs);
    }, (error) => {
      console.error("Error fetching quick cards:", error);
    });

    return () => unsubscribe();
  }, [user, db]);

  // Derived Dashboard Data from Firestore Transactions
  const dashboardData = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach(tx => {
      const amt = Number(tx.amount ?? 0);
      const rawType = tx.incomeExpense ?? "expense";
      const isIncome = String(rawType).toLowerCase().includes('income');
      
      if (isIncome) income += amt;
      else expense += amt;
    });

    return {
      success: true,
      totalIncome: income,
      totalExpense: expense,
      savings: income - expense
    };
  }, [transactions]);

  const handleGlobalRefresh = () => {
    setTransactionsError(null);
    setPrefillData(null);
  };

  const handleNavigateToBudgets = () => {
    setActiveTab('settings');
    setTimeout(() => {
      const el = document.getElementById('monthly-budgets');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  const handleNavigateToCards = () => {
    setActiveTab('settings');
    setTimeout(() => {
      const el = document.getElementById('saved-cards');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  const handleSelectQuickCard = (card: any) => {
    setAddMode('manual');
    setPrefillData({
      type: String(card.incomeExpense).toLowerCase() === 'income' ? 'income' : 'expense',
      amount: String(card.amount || ''),
      description: card.description || '',
      category: card.category || '',
      paymentMode: card.paymentMode || '',
      timestamp: Date.now() // Unique ID to trigger re-fill
    });
    toast({
      title: `${card.name} details filled`,
      description: "Review and save your entry."
    });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <BalanceCard 
              balance={dashboardData.savings} 
              income={dashboardData.totalIncome} 
              spent={dashboardData.totalExpense} 
              loading={loadingTransactions} 
            />
            
            <BudgetProgress transactions={transactions} budgets={budgets} loading={loadingTransactions || loadingBudgets} />
            
            <div className="space-y-4 pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Recent Entries</h3>
                <button onClick={() => setActiveTab('transactions')} className="text-xs font-bold text-primary">View All</button>
              </div>
              <TransactionList limit={4} data={transactions} loading={loadingTransactions} onDeleteSuccess={handleGlobalRefresh} onUpdateSuccess={handleGlobalRefresh} />
            </div>
          </div>
        );
      case 'transactions':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4">
            <h2 className="text-2xl font-bold px-1">History</h2>
            <TransactionList data={transactions} loading={loadingTransactions} onDeleteSuccess={handleGlobalRefresh} onUpdateSuccess={handleGlobalRefresh} />
          </div>
        );
      case 'add':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="space-y-2 px-1">
              <h2 className="text-2xl font-bold">Add Entries</h2>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Choose how you want to add your transactions</p>
            </div>

            {/* Quick Cards Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" />
                  <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Quick Cards</h3>
                </div>
                <button onClick={handleNavigateToCards} className="text-[10px] font-bold text-primary uppercase tracking-widest hover:opacity-70 transition-opacity">Manage</button>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-3 -mx-6 px-6">
                {quickCards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => handleSelectQuickCard(card)}
                    className="flex-shrink-0 p-4 rounded-[24px] bg-card border border-white/5 shadow-sm hover:bg-primary/5 transition-all active:scale-95 text-left min-w-[140px] space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight truncate group-hover:text-primary transition-colors">{card.name}</p>
                      <Plus size={10} className="text-primary opacity-40 group-hover:opacity-100" />
                    </div>
                    <p className="text-sm font-black text-foreground">₹{Number(card.amount).toLocaleString('en-IN')}</p>
                    <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter truncate">{card.category}</p>
                  </button>
                ))}
                {quickCards.length === 0 && (
                  <div className="w-full flex flex-col items-center justify-center py-6 border-2 border-dashed border-primary/5 rounded-[24px] mx-6">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest text-center opacity-40">No saved cards yet</p>
                    <button onClick={handleNavigateToCards} className="mt-1 text-[9px] font-bold text-primary uppercase tracking-widest hover:underline">Create in Settings</button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setAddMode('manual')}
                className={cn(
                  "p-4 rounded-[24px] border-2 transition-all flex flex-col items-center text-center space-y-2 group active:scale-95",
                  addMode === 'manual' 
                    ? "bg-primary/10 border-primary shadow-[0_0_20px_rgba(91,92,226,0.15)]" 
                    : "bg-card border-transparent hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  addMode === 'manual' ? "bg-primary text-white" : "bg-primary/10 text-primary"
                )}>
                  <Plus size={20} />
                </div>
                <div className="space-y-0.5">
                  <span className={cn("text-xs font-bold block", addMode === 'manual' ? "text-primary" : "text-foreground")}>Add Manually</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Single entry</span>
                </div>
              </button>

              <button 
                onClick={() => setAddMode('upload')}
                className={cn(
                  "p-4 rounded-[24px] border-2 transition-all flex flex-col items-center text-center space-y-2 group active:scale-95",
                  addMode === 'upload' 
                    ? "bg-primary/10 border-primary shadow-[0_0_20px_rgba(91,92,226,0.15)]" 
                    : "bg-card border-transparent hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  addMode === 'upload' ? "bg-primary text-white" : "bg-primary/10 text-primary"
                )}>
                  <FileUp size={20} />
                </div>
                <div className="space-y-0.5">
                  <span className={cn("text-xs font-bold block", addMode === 'upload' ? "text-primary" : "text-foreground")}>Upload Statement</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Bulk Import</span>
                </div>
              </button>
            </div>

            <div className="pt-2">
              {addMode === 'manual' ? (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                  <EntryForm 
                    onSuccess={handleGlobalRefresh} 
                    initialData={prefillData}
                    key={prefillData ? `prefill-${prefillData.timestamp}` : 'manual'}
                  />
                </div>
              ) : (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                  <ImportTool />
                </div>
              )}
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4">
            <AnalyticsCharts 
              transactions={transactions} 
              budgets={budgets} 
              loading={loadingTransactions || loadingBudgets} 
              onNavigateToBudgets={handleNavigateToBudgets}
            />
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4">
            <h2 className="text-2xl font-bold px-1">Settings</h2>
            <SettingsView />
          </div>
        );
      case 'calculators':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4">
            <h2 className="text-2xl font-bold px-1">Calculators</h2>
            <CalculatorsView />
          </div>
        );
      default: return null;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Checking Account...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const firstName = displayName.split(' ')[0];

  return (
    <div className="min-h-screen pt-8 px-6 bg-background relative" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
      <div className="max-w-md mx-auto">
        <header className="flex items-center justify-between mb-8 px-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm overflow-hidden">
              <img src="/icon.svg" alt="Nik Finance logo" className="w-full h-full p-2" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Nik Finance</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
                Hi, {firstName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => setIsNotificationsOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card border-none relative active:scale-90 transition-transform">
              <Bell size={20} className="text-muted-foreground" />
              {unreadNotifications > 0 && <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background animate-pulse" />}
            </button>
          </div>
        </header>
        <main>{renderContent()}</main>
        {!['calculators', 'add'].includes(activeTab) && (
          <button onClick={() => setActiveTab('calculators')} className="fixed bottom-24 right-6 z-50 w-14 h-14 bg-gradient-to-br from-primary to-secondary text-white rounded-[22px] shadow-2xl flex items-center justify-center active:scale-90 transition-transform glow-primary">
            <Calculator className="w-6 h-6" aria-label="Open calculators" />
          </button>
        )}
        <BottomNav activeTab={activeTab === 'calculators' ? '' : activeTab} onTabChange={setActiveTab} />
        <NotificationsPanel isOpen={isNotificationsOpen} onOpenChange={setIsNotificationsOpen} dashboardData={dashboardData} transactions={transactions} budgets={budgets} onUnreadChange={setUnreadNotifications} />
      </div>
    </div>
  );
}
