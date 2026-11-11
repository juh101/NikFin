"use client"

import { useState, useMemo } from 'react';
import { 
  Coffee, Wallet, ShoppingBag, Car, Tag, Loader2, Trash2, Pencil, 
  Search, X, ChevronDown, ArrowUpRight, ArrowDownRight, Hash, 
  Scale, Info, CalendarIcon, FileDown, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIES, PAYMENT_MODES } from '@/lib/sample-data';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card } from '@/components/ui/card';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Transaction {
  id?: string;
  recordId?: string;
  description?: string;
  amount?: number;
  category?: string;
  type?: 'income' | 'expense';
  incomeExpense?: string;
  date?: string;
  paymentMode?: string;
  transactionType?: string;
  source?: string;
  sourceReference?: string;
  createdAt?: any;
}

interface TransactionListProps {
  limit?: number;
  data?: Transaction[];
  loading?: boolean;
  onDeleteSuccess?: (recordId: string) => void;
  onUpdateSuccess?: () => void;
}

export function TransactionList({ limit, data, loading, onDeleteSuccess, onUpdateSuccess }: TransactionListProps) {
  const { toast } = useToast();
  const { user, displayName } = useUser();
  const db = useFirestore();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setFromToDate] = useState<Date | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("latest");

  const clearFilters = () => {
    setFromDate(undefined);
    setFromToDate(undefined);
    setFilterCategory("all");
    setFilterType("all");
  };

  const hasActiveFilters = fromDate || toDate || filterCategory !== "all" || filterType !== "all";

  const processedList = useMemo(() => {
    if (!data) return [];
    let filtered = [...data];

    // 1. Keyword Search
    const searchLower = searchQuery.toLowerCase().trim();
    if (searchLower) {
      filtered = filtered.filter(tx => {
        const fieldsToSearch = [
          tx.description,
          tx.category,
          tx.paymentMode,
          tx.incomeExpense,
          tx.recordId,
          tx.date,
          tx.amount
        ];
        
        return fieldsToSearch.some(val => 
          val !== undefined && val !== null && String(val).toLowerCase().includes(searchLower)
        );
      });
    }

    // 2. Structural Filters
    filtered = filtered.filter(tx => {
      const txDateStr = tx.date;
      if (!txDateStr) return true;
      const txDate = startOfDay(parseISO(txDateStr));
      if (fromDate && isBefore(txDate, startOfDay(fromDate))) return false;
      if (toDate && isAfter(txDate, endOfDay(toDate))) return false;
      const txCategory = tx.category || "Other";
      if (filterCategory !== "all" && txCategory !== filterCategory) return false;
      const rawType = tx.incomeExpense || "expense";
      const normalizedType = String(rawType).toLowerCase().includes('income') ? 'income' : 'expense';
      if (filterType !== "all" && normalizedType !== filterType) return false;
      return true;
    });

    // 3. Sorting
    filtered.sort((a, b) => {
      const getTimestamp = (tx: Transaction) => {
        const val = tx.createdAt || tx.date || "0";
        if (val && typeof val === 'object' && 'seconds' in val) return val.seconds * 1000;
        return new Date(val).getTime();
      };
      const getAmount = (tx: Transaction) => Number(tx.amount ?? 0);
      const getType = (tx: Transaction) => String(tx.incomeExpense || "expense").toLowerCase().includes('income') ? 'income' : 'expense';

      switch (sortBy) {
        case "latest": return getTimestamp(b) - getTimestamp(a);
        case "oldest": return getTimestamp(a) - getTimestamp(b);
        case "amount-high": return getAmount(b) - getAmount(a);
        case "amount-low": return getAmount(a) - getAmount(b);
        case "income-first": return getType(a) === 'income' ? -1 : 1;
        case "expense-first": return getType(a) === 'expense' ? -1 : 1;
        default: return getTimestamp(b) - getTimestamp(a);
      }
    });

    return limit ? filtered.slice(0, limit) : filtered;
  }, [data, limit, fromDate, toDate, filterCategory, filterType, sortBy, searchQuery]);

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    processedList.forEach(tx => {
      const amount = Number(tx.amount ?? 0);
      const rawType = tx.incomeExpense || "expense";
      const normalizedType = String(rawType).toLowerCase().includes('income') ? 'income' : 'expense';
      if (normalizedType === 'income') income += amount;
      else expense += amount;
    });
    return {
      count: processedList.length,
      income,
      expense,
      net: income - expense
    };
  }, [processedList]);

  const handleExportExcel = () => {
    if (processedList.length === 0) return;
    setIsExporting(true);
    
    try {
      const summaryData = [
        ["App Name", "Nik Finance Tracker"],
        ["Report Type", "History Report"],
        ["User", displayName],
        ["User Email", user?.email || "N/A"],
        ["Generated On", format(new Date(), 'PPpp')],
        [""],
        ["SUMMARY"],
        ["Total Income", `INR ${stats.income.toLocaleString('en-IN')}`],
        ["Total Expenses", `INR ${stats.expense.toLocaleString('en-IN')}`],
        ["Balance", `INR ${stats.net.toLocaleString('en-IN')}`],
        ["Number of Entries", stats.count],
        ["Applied Filters", hasActiveFilters ? "Custom" : "None"]
      ];

      const txData = processedList.map(tx => ({
        "Date": tx.date || "N/A",
        "Type": String(tx.incomeExpense || "Expense").toLowerCase().includes('income') ? "Income" : "Expense",
        "Amount (INR)": tx.amount || 0,
        "Category": tx.category || "Other",
        "Description": tx.description || "",
        "Payment Mode": tx.paymentMode || "Other",
        "Source": tx.source || "",
        "Reference ID": tx.sourceReference || tx.recordId || ""
      }));

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      const wsTx = XLSX.utils.json_to_sheet(txData);

      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
      XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");

      const fileName = `NikFinance_History_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({ title: "Report downloaded.", description: "Excel file is ready." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Export Failed", description: "Could not create the Excel report." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    if (processedList.length === 0) return;
    setIsExporting(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(22);
      doc.setTextColor(91, 92, 226); // Indigo
      doc.text("Nik Finance", 14, 20);
      
      doc.setFontSize(14);
      doc.setTextColor(100);
      doc.text("History Report", 14, 28);

      // User Details
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(`User: ${displayName}`, 14, 38);
      doc.text(`Email: ${user?.email || "N/A"}`, 14, 43);
      doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 48);

      // Summary Table
      autoTable(doc, {
        startY: 55,
        theme: 'grid',
        headStyles: { fillColor: [91, 92, 226] },
        body: [
          ["Total Income", `INR ${stats.income.toLocaleString('en-IN')}`],
          ["Total Expenses", `INR ${stats.expense.toLocaleString('en-IN')}`],
          ["Balance", `INR ${stats.net.toLocaleString('en-IN')}`],
          ["Entries", stats.count.toString()]
        ]
      });

      // Transactions Table
      const tableData = processedList.map(tx => [
        tx.date || "N/A",
        String(tx.incomeExpense || "Expense").toLowerCase().includes('income') ? "Income" : "Expense",
        `INR ${Number(tx.amount || 0).toLocaleString('en-IN')}`,
        tx.category || "Other",
        tx.description || "No description",
        tx.paymentMode || "Other"
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Date', 'Type', 'Amount', 'Category', 'Description', 'Payment']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [71, 71, 71] },
        styles: { fontSize: 8, overflow: 'linebreak' },
        columnStyles: { 4: { cellWidth: 50 } }
      });

      const fileName = `NikFinance_History_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      
      toast({ title: "Report downloaded.", description: "PDF file is ready." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Export Failed", description: "Could not create the PDF report." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleEditClick = (tx: Transaction) => {
    setEditingTransaction({
      ...tx,
      amount: String(tx.amount || ''),
    });
    setEditDialogOpen(true);
  };

  const handleUpdateSubmit = async () => {
    if (!user || !db || !editingTransaction?.id) return;

    setIsUpdating(true);
    const docRef = doc(db, 'users', user.uid, 'transactions', editingTransaction.id);
    
    const amountNum = parseFloat(editingTransaction.amount);
    const dateObj = parseISO(editingTransaction.date);
    
    const updateData = {
      date: editingTransaction.date,
      month: format(dateObj, 'MMMM'),
      year: parseInt(format(dateObj, 'yyyy')),
      amount: amountNum,
      category: editingTransaction.category,
      incomeExpense: editingTransaction.incomeExpense,
      description: editingTransaction.description.trim(),
      transactionType: amountNum >= 5000 ? `Big ${editingTransaction.incomeExpense}` : `Small ${editingTransaction.incomeExpense}`,
      paymentMode: editingTransaction.paymentMode,
      updatedAt: serverTimestamp(),
    };

    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: "Entry updated successfully." });
        setEditDialogOpen(false);
        if (onUpdateSuccess) onUpdateSuccess();
      })
      .catch((error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ 
          variant: "destructive", 
          title: "Update Error", 
          description: "Unable to update this entry. Please try again." 
        });
      })
      .finally(() => setIsUpdating(false));
  };

  const handleDeleteConfirm = async (txId: string) => {
    if (!user || !db || !txId) return;

    setIsDeleting(true);
    const docRef = doc(db, 'users', user.uid, 'transactions', txId);

    deleteDoc(docRef)
      .then(() => {
        toast({ title: "Entry deleted successfully." });
        if (onDeleteSuccess) onDeleteSuccess(txId);
      })
      .catch((error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ 
          variant: "destructive", 
          title: "Delete Error", 
          description: "Unable to delete this entry. Please try again." 
        });
      })
      .finally(() => setIsDeleting(false));
  };

  return (
    <div className="space-y-4 w-full">
      {!limit && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input 
                placeholder="Search entries..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-11 pr-10 bg-card border-none rounded-2xl shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 transition-all text-sm font-medium"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="h-12 px-4 rounded-2xl border-none bg-card shadow-sm hover:bg-primary/10 transition-all shrink-0 flex items-center gap-2 active:scale-95"
                  disabled={isExporting || processedList.length === 0}
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <FileDown className="w-4 h-4 text-primary" />}
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl border-white/5 bg-card p-2 shadow-2xl">
                <DropdownMenuItem 
                  onClick={handleExportExcel} 
                  className="flex items-center gap-3 rounded-xl p-3 focus:bg-primary/10 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold">Download Excel</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleExportPDF} 
                  className="flex items-center gap-3 rounded-xl p-3 focus:bg-primary/10 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-rose-500" />
                  <span className="text-sm font-bold">Download PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen} className="w-full bg-card rounded-2xl overflow-hidden border-none shadow-sm">
            <div className="flex items-center justify-between p-4 bg-primary/5">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Sort & Filter</span>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-primary/10">
                  <ChevronDown className={cn("w-4 h-4 transition-transform text-primary", isFilterOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="p-4 space-y-4 border-t border-primary/5">
              <div className="space-y-1.5">
                <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-11 text-[11px] bg-secondary/20 border-none rounded-xl font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">Latest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="amount-high">Amount High to Low</SelectItem>
                    <SelectItem value="amount-low">Amount Low to High</SelectItem>
                    <SelectItem value="income-first">Income First</SelectItem>
                    <SelectItem value="expense-first">Expense First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">From</Label>
                  <input 
                    type="date" 
                    value={fromDate ? format(fromDate, 'yyyy-MM-dd') : ''} 
                    onChange={(e) => setFromDate(e.target.value ? new Date(e.target.value) : undefined)} 
                    className="h-11 w-full px-3 bg-secondary/20 rounded-xl text-[11px] font-bold outline-none color-scheme-dark border-none" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">To</Label>
                  <input 
                    type="date" 
                    value={toDate ? format(toDate, 'yyyy-MM-dd') : ''} 
                    onChange={(e) => setFromToDate(e.target.value ? new Date(e.target.value) : undefined)} 
                    className="h-11 w-full px-3 bg-secondary/20 rounded-xl text-[11px] font-bold outline-none color-scheme-dark border-none" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Category</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-11 text-[11px] bg-secondary/20 border-none rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Type</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-11 text-[11px] bg-secondary/20 border-none rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  onClick={clearFilters} 
                  className="w-full h-9 text-[10px] uppercase font-bold text-primary hover:bg-primary/10 tracking-widest"
                >
                  Clear Filters
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="grid grid-cols-2 gap-2 mt-4 animate-in fade-in duration-500">
            <Card className="p-3 border-none bg-card shadow-sm rounded-2xl flex flex-col justify-between">
              <div className="flex items-center gap-1.5 opacity-60">
                <Hash className="w-3 h-3 text-muted-foreground" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Entries</span>
              </div>
              <p className="text-sm font-extrabold mt-1">{stats.count} items</p>
            </Card>
            <Card className="p-3 border-none bg-accent/5 shadow-sm rounded-2xl flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-accent opacity-80">
                <ArrowUpRight className="w-3 h-3" />
                <span className="text-[9px] font-bold uppercase tracking-wider">In</span>
              </div>
              <p className="text-sm font-extrabold text-accent mt-1">₹{stats.income.toLocaleString('en-IN')}</p>
            </Card>
            <Card className="p-3 border-none bg-expense/5 shadow-sm rounded-2xl flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-expense opacity-80">
                <ArrowDownRight className="w-3 h-3" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Out</span>
              </div>
              <p className="text-sm font-extrabold text-expense mt-1">₹{stats.expense.toLocaleString('en-IN')}</p>
            </Card>
            <Card className={cn(
              "p-3 border-none shadow-sm rounded-2xl flex flex-col justify-between",
              stats.net >= 0 ? "bg-accent/5" : "bg-destructive/5"
            )}>
              <div className="flex items-center gap-1.5 opacity-60">
                <Scale className={cn("w-3 h-3", stats.net >= 0 ? "text-accent" : "text-destructive")} />
                <span className="text-[9px] font-bold uppercase tracking-wider">Balance</span>
              </div>
              <p className={cn(
                "text-sm font-extrabold mt-1",
                stats.net >= 0 ? "text-accent" : "text-destructive"
              )}>
                ₹{stats.net.toLocaleString('en-IN')}
              </p>
            </Card>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Checking History...</p>
          </div>
        ) : processedList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 opacity-60">
            <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-2">
              <Search className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold text-foreground/80">
              {searchQuery ? "No entries match your search." : "No entries found."}
            </p>
            <p className="text-xs text-muted-foreground">Try adding some records or adjusting your search.</p>
          </div>
        ) : (
          processedList.map((tx, idx) => {
            const amount = Number(tx.amount ?? 0);
            const rawType = tx.incomeExpense || "expense";
            const normalizedType = String(rawType).toLowerCase().includes('income') ? 'income' : 'expense';
            const category = tx.category || "Other";
            const displayDate = tx.date || "";
            const Icon = (category.toLowerCase().includes('salary') ? Wallet : category.toLowerCase().includes('grocery') ? ShoppingBag : category.toLowerCase().includes('transport') ? Car : Tag);

            return (
              <div key={tx.id || idx} className="flex flex-col p-4 bg-card rounded-[22px] border-none shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-colors", 
                      normalizedType === 'income' ? "bg-accent/10 text-accent" : "bg-expense/10 text-expense"
                    )}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-0.5">{category}</p>
                      <h4 className="text-sm font-bold tracking-tight text-foreground/90">{tx.description || "No Description"}</h4>
                    </div>
                  </div>
                  <p className={cn("text-base font-extrabold tracking-tight", normalizedType === 'income' ? "text-accent" : "text-expense")}>
                    {normalizedType === 'income' ? '+' : '-'}₹{amount.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-primary/5">
                  <div className="flex items-center space-x-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                    <span>{displayDate}</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                    <span>{tx.paymentMode || "Other"}</span>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleEditClick(tx)} 
                      className="p-2 rounded-xl active:scale-90 transition-transform bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      <Pencil size={14} />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button 
                          className="p-2 rounded-xl active:scale-90 transition-transform bg-destructive/10 text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 size={14} />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[32px] border-none glass-card p-8">
                        <AlertDialogHeader className="space-y-3">
                          <AlertDialogTitle className="text-xl font-bold text-center">Delete this entry?</AlertDialogTitle>
                          <AlertDialogDescription className="text-center text-sm font-medium">
                            Are you sure you want to delete this {category} entry for ₹{amount.toLocaleString()}? This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-8 flex gap-3">
                          <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-white/5 bg-secondary/20 font-bold">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            disabled={isDeleting}
                            onClick={() => tx.id && handleDeleteConfirm(tx.id)}
                            className="flex-1 h-12 rounded-2xl bg-destructive text-destructive-foreground font-bold hover:bg-destructive/90"
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-[32px] border-none glass-card p-8 sm:max-w-md max-h-[90vh] overflow-y-auto no-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">Edit Entry</DialogTitle>
            <DialogDescription className="text-center text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Update your record details
            </DialogDescription>
          </DialogHeader>

          {editingTransaction && (
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant={editingTransaction.incomeExpense === 'Expense' ? 'default' : 'outline'}
                    onClick={() => setEditingTransaction({...editingTransaction, incomeExpense: 'Expense'})}
                    className={cn("h-10 rounded-xl font-bold", editingTransaction.incomeExpense === 'Expense' && "bg-expense text-white")}
                  >Expense</Button>
                  <Button 
                    variant={editingTransaction.incomeExpense === 'Income' ? 'default' : 'outline'}
                    onClick={() => setEditingTransaction({...editingTransaction, incomeExpense: 'Income'})}
                    className={cn("h-10 rounded-xl font-bold", editingTransaction.incomeExpense === 'Income' && "bg-accent text-white")}
                  >Income</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Amount (₹)</Label>
                <Input 
                  type="number" 
                  value={editingTransaction.amount}
                  onChange={(e) => setEditingTransaction({...editingTransaction, amount: e.target.value})}
                  className="h-11 bg-secondary/10 border-none rounded-xl font-bold text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Date</Label>
                <Input 
                  type="date" 
                  value={editingTransaction.date}
                  onChange={(e) => setEditingTransaction({...editingTransaction, date: e.target.value})}
                  className="h-11 bg-secondary/10 border-none rounded-xl font-bold color-scheme-dark"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Description</Label>
                <Input 
                  value={editingTransaction.description}
                  onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})}
                  className="h-11 bg-secondary/10 border-none rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Category</Label>
                  <Select 
                    value={editingTransaction.category} 
                    onValueChange={(val) => setEditingTransaction({...editingTransaction, category: val})}
                  >
                    <SelectTrigger className="h-11 bg-secondary/10 border-none rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Payment Mode</Label>
                  <Select 
                    value={editingTransaction.paymentMode} 
                    onValueChange={(val) => setEditingTransaction({...editingTransaction, paymentMode: val})}
                  >
                    <SelectTrigger className="h-11 bg-secondary/10 border-none rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map(mode => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-3">
            <Button 
              variant="outline" 
              onClick={() => setEditDialogOpen(false)}
              className="flex-1 h-12 rounded-2xl border-white/5 bg-secondary/20 font-bold"
            >Cancel</Button>
            <Button 
              disabled={isUpdating}
              onClick={handleUpdateSubmit}
              className="flex-1 h-12 rounded-2xl bg-primary text-white font-bold glow-primary"
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
