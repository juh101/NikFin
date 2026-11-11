
"use client"

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { 
  IndianRupee, 
  Database, 
  Settings2, 
  ShieldCheck, 
  ChevronRight, 
  LogOut, 
  User as UserIcon,
  Pencil,
  Loader2,
  Plus,
  Trash2,
  Target,
  Sparkles,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, setDoc, deleteDoc, collection, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { CATEGORIES, PAYMENT_MODES } from '@/lib/sample-data';
import { cn } from '@/lib/utils';

const EXPENSE_CATEGORIES = CATEGORIES.filter(c => !['Salary', 'Bonus', 'Side Hustle'].includes(c));

export function SettingsView() {
  const { user, profile, displayName } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(displayName);
  const [isSavingName, setIsSavingName] = useState(false);

  // Budget states
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  // Saved Cards states
  const [quickCards, setQuickCards] = useState<any[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [currentCardId, setCurrentCardId] = useState<string | null>(null);
  const [isSavingCard, setIsSavingCard] = useState(false);
  
  // Card Form State
  const [cardName, setCardName] = useState('');
  const [cardType, setCardType] = useState<'Expense' | 'Income'>('Expense');
  const [cardAmount, setCardAmount] = useState('');
  const [cardCategory, setCardCategory] = useState('');
  const [cardDescription, setCardDescription] = useState('');
  const [cardPaymentMode, setCardPaymentMode] = useState('');
  const [cardFrequency, setCardFrequency] = useState('Monthly');

  // Load budgets
  useEffect(() => {
    if (!user || !db) return;
    setLoadingBudgets(true);
    const budgetsRef = collection(db, 'users', user.uid, 'budgets');
    const unsubscribe = onSnapshot(budgetsRef, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBudgets(docs);
      setLoadingBudgets(false);
    });
    return () => unsubscribe();
  }, [user, db]);

  // Load quick cards
  useEffect(() => {
    if (!user || !db) return;
    setLoadingCards(true);
    const cardsRef = collection(db, 'users', user.uid, 'quickCards');
    const q = query(cardsRef, orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuickCards(docs);
      setLoadingCards(false);
    });
    return () => unsubscribe();
  }, [user, db]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const handleSaveName = async () => {
    const trimmedName = newName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 40) {
      toast({ variant: "destructive", title: "Invalid Name", description: "Name must be between 2 and 40 characters." });
      return;
    }
    if (!user || !db) return;
    setIsSavingName(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { displayName: trimmedName, updatedAt: serverTimestamp() }, { merge: true });
      await updateProfile(user, { displayName: trimmedName });
      toast({ title: "Name updated successfully." });
      setIsEditingName(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Unable to update your name. Please try again." });
    } finally { setIsSavingName(false); }
  };

  const handleSaveBudget = async () => {
    if (!selectedCategory || !budgetLimit || Number(budgetLimit) <= 0) {
      toast({ variant: "destructive", title: "Invalid Budget", description: "Please choose a category and enter a valid limit." });
      return;
    }
    if (!user || !db) return;
    setIsSavingBudget(true);
    try {
      const budgetId = selectedCategory.toLowerCase().replace(/\s+/g, '-');
      const budgetRef = doc(db, 'users', user.uid, 'budgets', budgetId);
      const budgetData = {
        category: selectedCategory,
        monthlyLimit: Number(budgetLimit),
        userId: user.uid,
        updatedAt: serverTimestamp(),
        isActive: true,
      };
      // For new budgets, add createdAt
      const existing = budgets.find(b => b.id === budgetId);
      if (!existing) (budgetData as any).createdAt = serverTimestamp();

      await setDoc(budgetRef, budgetData, { merge: true });
      toast({ title: "Monthly budget saved successfully." });
      setSelectedCategory('');
      setBudgetLimit('');
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Unable to save this budget. Please try again." });
    } finally { setIsSavingBudget(false); }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!user || !db) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'budgets', id));
      toast({ title: "Monthly budget removed successfully." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Unable to remove this budget. Please try again." });
    }
  };

  const resetCardForm = () => {
    setCardName('');
    setCardType('Expense');
    setCardAmount('');
    setCardCategory('');
    setCardDescription('');
    setCardPaymentMode('');
    setCardFrequency('Monthly');
    setCurrentCardId(null);
  };

  const handleEditCard = (card: any) => {
    setCardName(card.name);
    setCardType(card.incomeExpense as any);
    setCardAmount(String(card.amount));
    setCardCategory(card.category);
    setCardDescription(card.description || '');
    setCardPaymentMode(card.paymentMode || '');
    setCardFrequency(card.frequencyNote || 'Monthly');
    setCurrentCardId(card.id);
    setIsCardDialogOpen(true);
  };

  const handleSaveCard = async () => {
    if (!cardName || !cardAmount || !cardCategory) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Card Name, Amount, and Category are required." });
      return;
    }
    if (!user || !db) return;
    setIsSavingCard(true);
    try {
      const cardRef = currentCardId 
        ? doc(db, 'users', user.uid, 'quickCards', currentCardId)
        : doc(collection(db, 'users', user.uid, 'quickCards'));
      
      const cardData = {
        name: cardName,
        incomeExpense: cardType,
        amount: Number(cardAmount),
        category: cardCategory,
        description: cardDescription,
        paymentMode: cardPaymentMode,
        frequencyNote: cardFrequency,
        userId: user.uid,
        updatedAt: serverTimestamp(),
      };

      if (!currentCardId) (cardData as any).createdAt = serverTimestamp();

      await setDoc(cardRef, cardData, { merge: true });
      toast({ title: currentCardId ? "Card updated." : "Card created." });
      setIsCardDialogOpen(false);
      resetCardForm();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Unable to save this card. Please try again." });
    } finally { setIsSavingCard(false); }
  };

  const handleDeleteCard = async (id: string) => {
    if (!user || !db) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'quickCards', id));
      toast({ title: "Saved card removed." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Unable to remove this card." });
    }
  };

  const sections = [
    { title: 'Appearance', items: [
      { icon: Settings2, label: 'Theme Preference', color: 'text-primary', action: <ThemeToggle /> },
    ]},
    { title: 'Information', items: [
      { icon: IndianRupee, label: 'Currency', value: 'INR (₹)', color: 'text-accent' },
      { icon: Database, label: 'Data Source', value: 'Cloud Storage', color: 'text-blue-500' },
      { icon: ShieldCheck, label: 'Privacy Mode', toggle: true },
    ]},
  ];

  return (
    <div className="space-y-10 pb-40">
      {/* Your Profile Area */}
      <div className="flex flex-col items-center space-y-4 py-8">
        <div className="relative group">
          <Avatar className="w-24 h-24 rounded-[32px] border-4 border-primary/20 shadow-xl overflow-hidden transition-transform group-hover:scale-105 duration-300">
            <AvatarImage src={user?.photoURL || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
              {displayName?.[0] || <UserIcon size={40} />}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-accent rounded-xl flex items-center justify-center text-white border-4 border-background shadow-lg">
            <ShieldCheck size={14} />
          </div>
        </div>
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 group">
            <h2 className="text-2xl font-bold tracking-tight">{displayName}</h2>
            <button onClick={() => { setNewName(displayName); setIsEditingName(true); }} className="p-1.5 rounded-lg bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/20">
              <Pencil size={14} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground font-medium">{user?.email}</p>
        </div>
      </div>

      {/* Saved Entry Cards */}
      <div id="saved-cards" className="space-y-4 relative z-0 scroll-mt-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Saved Cards</h3>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest opacity-60">Repeated Entries</p>
        </div>
        <Card className="glass-card p-6 border-none rounded-3xl space-y-4 shadow-lg">
          <p className="text-[10px] text-muted-foreground font-medium leading-relaxed opacity-70">
            Save repeated entries and fill them quickly later. Perfect for Rent, EMI, Subscriptions, or SIP.
          </p>
          <Button onClick={() => { resetCardForm(); setIsCardDialogOpen(true); }} className="w-full h-12 rounded-2xl bg-secondary/20 text-primary font-bold hover:bg-secondary/30 transition-all active:scale-95">
            <Plus size={16} className="mr-2" /> Create New Card
          </Button>

          <div className="space-y-3 pt-4 border-t border-white/5">
            {loadingCards ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin w-5 h-5 opacity-20" /></div>
            ) : quickCards.length === 0 ? (
              <p className="text-[10px] text-muted-foreground font-medium text-center py-4 italic">No saved cards yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {quickCards.map((card) => (
                  <div key={card.id} className="flex flex-col p-4 bg-secondary/5 border border-white/5 rounded-2xl space-y-3 transition-colors hover:bg-secondary/10">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold truncate">{card.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md", card.incomeExpense === 'Income' ? 'bg-accent/10 text-accent' : 'bg-expense/10 text-expense')}>
                            {card.incomeExpense}
                          </span>
                          <span className="text-[10px] font-bold text-foreground">₹{Number(card.amount).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleEditCard(card)} className="p-2 rounded-xl bg-primary/10 text-primary active:scale-90 transition-transform">
                          <Pencil size={14} />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="p-2 rounded-xl bg-destructive/10 text-destructive active:scale-90 transition-transform">
                              <Trash2 size={14} />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[32px] border-none glass-card p-8">
                            <AlertDialogHeader className="space-y-3">
                              <AlertDialogTitle className="text-xl font-bold text-center">Delete Card?</AlertDialogTitle>
                              <AlertDialogDescription className="text-center text-sm font-medium">Remove "{card.name}" template? This won't affect past transactions.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-8 flex gap-3">
                              <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-white/5 bg-secondary/20 font-bold">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCard(card.id)} className="flex-1 h-12 rounded-2xl bg-destructive text-white font-bold hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase text-muted-foreground/60 tracking-widest border-t border-white/5 pt-2">
                      <span>{card.category}</span>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                      <span>{card.paymentMode || 'Other'}</span>
                      {card.frequencyNote && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                          <span className="text-primary/60">{card.frequencyNote}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Monthly Budgets */}
      <div id="monthly-budgets" className="space-y-4 relative z-0 scroll-mt-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Monthly Budgets</h3>
          <p className="text-[10px] font-bold text-accent uppercase tracking-widest opacity-60">Limits</p>
        </div>
        <Card className="glass-card p-6 border-none rounded-3xl space-y-4 shadow-lg">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-12 bg-secondary/10 border-none rounded-2xl px-4 font-semibold">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Monthly Limit (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  type="number" 
                  value={budgetLimit} 
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  placeholder="Enter amount"
                  className="h-12 pl-12 bg-secondary/10 border-none rounded-2xl text-base font-bold"
                />
              </div>
            </div>
            <Button 
              onClick={handleSaveBudget} 
              disabled={isSavingBudget} 
              className="w-full h-12 rounded-2xl bg-primary text-white font-bold glow-primary"
            >
              {isSavingBudget ? <Loader2 className="animate-spin w-4 h-4" /> : <><Plus className="w-4 h-4 mr-2" /> Save Budget</>}
            </Button>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/5">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Existing Budgets</Label>
            {loadingBudgets ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin w-5 h-5 opacity-20" /></div>
            ) : budgets.length === 0 ? (
              <p className="text-[10px] text-muted-foreground font-medium text-center py-4 italic">No budgets set yet.</p>
            ) : (
              <div className="space-y-2">
                {budgets.map((budget) => (
                  <div key={budget.id} className="flex items-center justify-between p-3 rounded-2xl bg-secondary/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Target size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{budget.category}</span>
                        <span className="text-[10px] text-muted-foreground font-bold">₹{Number(budget.monthlyLimit).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setSelectedCategory(budget.category); setBudgetLimit(String(budget.monthlyLimit)); }}
                        className="p-2 rounded-lg bg-primary/10 text-primary active:scale-90 transition-transform"
                      >
                        <Pencil size={14} />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-2 rounded-lg bg-destructive/10 text-destructive active:scale-90 transition-transform">
                            <Trash2 size={14} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[32px] border-none glass-card p-8">
                          <AlertDialogHeader className="space-y-3">
                            <AlertDialogTitle className="text-xl font-bold text-center">Delete this budget?</AlertDialogTitle>
                            <AlertDialogDescription className="text-center text-sm font-medium">
                              Remove the monthly budget for {budget.category}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="mt-8 flex gap-3">
                            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-white/5 bg-secondary/20 font-bold">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteBudget(budget.id)} className="flex-1 h-12 rounded-2xl bg-destructive text-white font-bold hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Settings Sections */}
      {sections.map((section, idx) => (
        <div key={idx} className="space-y-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">{section.title}</h3>
          <Card className="glass-card rounded-3xl overflow-hidden border-none shadow-none">
            {section.items.map((item, i) => {
              const ItemIcon = (item as any).icon;
              return (
                <div key={i} className="flex items-center justify-between p-5 border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.01] transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/50 ${item.color || 'text-muted-foreground'}`}>
                      {ItemIcon && <ItemIcon className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{item.label}</span>
                      {item.value && <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{item.value}</span>}
                    </div>
                  </div>
                  {item.action ? item.action : <ChevronRight className="w-4 h-4 text-muted-foreground/30" />}
                </div>
              );
            })}
          </Card>
        </div>
      ))}

      {/* Account / Log Out */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Account</h3>
        <Card className="glass-card rounded-3xl overflow-hidden border-none shadow-none">
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-destructive/10 text-destructive">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold">Log Out</span>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="p-2 rounded-xl bg-destructive/10 text-destructive active:scale-90 transition-transform">
                  <LogOut size={16} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[32px] border-none glass-card p-8">
                <AlertDialogHeader className="space-y-3">
                  <AlertDialogTitle className="text-xl font-bold text-center">Log Out?</AlertDialogTitle>
                  <AlertDialogDescription className="text-center text-sm font-medium">Are you sure you want to log out?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 flex gap-3">
                  <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-white/5 bg-secondary/20 font-bold">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout} className="flex-1 h-12 rounded-2xl bg-destructive text-white font-bold hover:bg-destructive/90">Log Out</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>
      </div>

      {/* Edit Name Dialog */}
      <Dialog open={isEditingName} onOpenChange={setIsEditingName}>
        <DialogContent className="rounded-[32px] border-none glass-card p-8 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">Edit Name</DialogTitle>
            <DialogDescription className="text-center text-xs font-medium text-muted-foreground uppercase tracking-widest">How would you like to be called?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Your Name</Label>
              <Input 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter your name"
                className="h-12 bg-secondary/10 border-none rounded-2xl text-base font-semibold"
                maxLength={40}
              />
            </div>
          </div>
          <DialogFooter className="gap-3 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditingName(false)} className="flex-1 h-12 rounded-2xl border-white/5 bg-secondary/20 font-bold">Cancel</Button>
            <Button onClick={handleSaveName} disabled={isSavingName} className="flex-1 h-12 rounded-2xl bg-primary text-white font-bold glow-primary">
              {isSavingName ? <Loader2 className="animate-spin w-4 h-4" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved Card Dialog */}
      <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
        <DialogContent className="rounded-[32px] border-none glass-card p-8 sm:max-w-md max-h-[90vh] overflow-y-auto no-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">{currentCardId ? 'Edit Card' : 'Save New Card'}</DialogTitle>
            <DialogDescription className="text-center text-xs font-medium text-muted-foreground uppercase tracking-widest">Repeated transaction template</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Card Name</Label>
              <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="e.g. Rent, Netflix" className="h-12 bg-secondary/10 border-none rounded-2xl" maxLength={40} />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant={cardType === 'Expense' ? 'default' : 'outline'} onClick={() => setCardType('Expense')} className={cn("h-10 rounded-xl font-bold", cardType === 'Expense' && "bg-expense text-white border-expense")}>Expense</Button>
                <Button variant={cardType === 'Income' ? 'default' : 'outline'} onClick={() => setCardType('Income')} className={cn("h-10 rounded-xl font-bold", cardType === 'Income' && "bg-accent text-white border-accent")}>Income</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Amount (₹)</Label>
              <Input type="number" value={cardAmount} onChange={(e) => setCardAmount(e.target.value)} placeholder="0.00" className="h-12 bg-secondary/10 border-none rounded-2xl font-bold" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Category</Label>
                <Select value={cardCategory} onValueChange={setCardCategory}>
                  <SelectTrigger className="h-12 bg-secondary/10 border-none rounded-2xl px-4 font-semibold"><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Payment Mode</Label>
                <Select value={cardPaymentMode} onValueChange={setCardPaymentMode}>
                  <SelectTrigger className="h-12 bg-secondary/10 border-none rounded-2xl px-4 font-semibold"><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{PAYMENT_MODES.map(mode => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Default Description</Label>
              <Input value={cardDescription} onChange={(e) => setCardDescription(e.target.value)} placeholder="What is this for?" className="h-12 bg-secondary/10 border-none rounded-2xl" />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Frequency Note (Info Only)</Label>
              <Select value={cardFrequency} onValueChange={setCardFrequency}>
                <SelectTrigger className="h-12 bg-secondary/10 border-none rounded-2xl px-4 font-semibold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="One-time">One-time</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setIsCardDialogOpen(false)} className="flex-1 h-12 rounded-2xl border-white/5 bg-secondary/20 font-bold">Cancel</Button>
            <Button onClick={handleSaveCard} disabled={isSavingCard} className="flex-1 h-12 rounded-2xl bg-primary text-white font-bold glow-primary">
              {isSavingCard ? <Loader2 className="animate-spin w-4 h-4" /> : currentCardId ? "Update Card" : "Save Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

