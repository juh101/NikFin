'use client';

import { useState, useRef, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  FileUp, 
  CheckCircle2, 
  Loader2, 
  ChevronLeft, 
  Search,
  ChevronDown,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, writeBatch, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import * as pdfjs from 'pdfjs-dist';
import { 
  NormalizedImportedTransaction,
  MAX_IMPORT_FILE_SIZE_BYTES,
  MAX_IMPORT_FILE_SIZE_MB,
  parsePhonePePdfText,
  parsePaytmWorkbook,
  normalizeHeader,
  suggestCategory,
  DATE_COLUMNS,
  AMOUNT_COLUMNS,
  DESC_COLUMNS,
  REF_COLUMNS,
  ACCOUNT_COLUMNS
} from '@/lib/import-utils';
import { CATEGORIES, PAYMENT_MODES } from '@/lib/sample-data';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
}

type Step = 'upload' | 'preview' | 'importing' | 'result';

export function ImportTool() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [step, setStep] = useState<Step>('upload');
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; type: string } | null>(null);
  const [selectionGuidance, setSelectionGuidance] = useState<string | null>(null);
  const [rows, setRows] = useState<NormalizedImportedTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [importSummary, setImportSummary] = useState({ imported: 0, skipped: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRows([]);
    setSelectedIds(new Set());
    setExpandedIds(new Set());
    setSearchQuery('');
    setSelectionGuidance(null);

    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      toast({ 
        variant: 'destructive', 
        title: 'File Too Large', 
        description: `This file is larger than ${MAX_IMPORT_FILE_SIZE_MB} MB. Please upload a smaller statement.` 
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') {
      setSelectionGuidance('PDF selected. This format is recommended for PhonePe statements.');
    } else if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
      setSelectionGuidance('Excel/CSV selected. This format is recommended for Paytm statements.');
    }

    setLoading(true);
    setLoadingProgress(0);
    setFileInfo({ name: file.name, size: formatFileSize(file.size), type: file.name.split('.').pop()?.toUpperCase() || 'FILE' });

    try {
      let parsedRows: NormalizedImportedTransaction[] = [];

      if (extension === 'pdf') {
        parsedRows = await processPdf(file);
      } else if (extension === 'csv') {
        parsedRows = await processCsv(file);
      } else {
        parsedRows = await processExcel(file);
      }

      if (parsedRows.length === 0) {
        let msg = 'No valid transactions found.';
        if (extension === 'pdf') msg = 'This PDF does not appear to be a supported PhonePe statement. Please check the file.';
        if (['xlsx', 'xls'].includes(extension || '')) msg = 'This Excel file does not appear to be a supported Paytm statement. Please check the file.';
        throw new Error(msg);
      }

      await preparePreview(parsedRows);
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Import Failed', description: error.message || 'Could not read file.' });
      setStep('upload');
      setSelectionGuidance(null);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processPdf = async (file: File): Promise<NormalizedImportedTransaction[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer, disableFontFace: true }).promise;
    
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      setLoadingProgress(Math.round((i / pdf.numPages) * 100));
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const items = textContent.items as any[];
      const lines: Record<number, any[]> = {};
      items.forEach(item => {
        const y = Math.round(item.transform[5] / 2) * 2;
        if (!lines[y]) lines[y] = [];
        lines[y].push(item);
      });
      
      const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
      sortedY.forEach(y => {
        const lineItems = lines[y].sort((a, b) => a.transform[4] - b.transform[4]);
        fullText += lineItems.map(it => it.str).join(' ') + " ";
      });
    }

    return parsePhonePePdfText(fullText);
  };

  const processCsv = (file: File): Promise<NormalizedImportedTransaction[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: (results) => resolve(mapGenericData(results.data, 'CSV')),
        error: (err) => reject(err)
      });
    });
  };

  const processExcel = async (file: File): Promise<NormalizedImportedTransaction[]> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { cellDates: true });
    
    const paytmRows = await parsePaytmWorkbook(workbook);
    if (paytmRows.length > 0) return paytmRows;

    const targetSheetName = workbook.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheetName], { defval: "" });
    return mapGenericData(rawData, 'Excel');
  };

  const mapGenericData = (data: any[], source: string): NormalizedImportedTransaction[] => {
    if (data.length === 0) return [];
    const headers = Object.keys(data[0]);
    const mapping = {
      date: headers.find(h => DATE_COLUMNS.includes(normalizeHeader(h))),
      desc: headers.find(h => DESC_COLUMNS.includes(normalizeHeader(h))),
      amount: headers.find(h => AMOUNT_COLUMNS.includes(normalizeHeader(h))),
      ref: headers.find(h => REF_COLUMNS.includes(normalizeHeader(h))),
      acc: headers.find(h => ACCOUNT_COLUMNS.includes(normalizeHeader(h)))
    };

    return data.map(row => {
      const amountVal = parseFloat(String(row[mapping.amount || ""] || 0).replace(/[^\d.-]/g, ''));
      let dateVal = String(row[mapping.date || ""] || "");
      let parsedDate = "";
      
      if (dateVal.includes('/')) {
        const parts = dateVal.split('/');
        if (parts.length === 3) parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else {
        parsedDate = dateVal.split('T')[0];
      }

      const desc = String(row[mapping.desc || ""] || "").trim();

      if (!parsedDate || isNaN(amountVal) || amountVal === 0) return null;

      return {
        date: parsedDate,
        description: desc || "Imported Entry",
        amount: Math.abs(amountVal),
        incomeExpense: amountVal < 0 ? 'Expense' : 'Income',
        category: suggestCategory(desc),
        paymentMode: 'Bank',
        source: source as any,
        sourceReference: String(row[mapping.ref || ""] || `REF-${Date.now()}-${Math.random()}`),
        status: 'valid',
        confidence: 'medium',
        needsDescriptionReview: !desc,
        include: true,
        importFingerprint: `${source}-${parsedDate}-${amountVal}-${desc}`
      };
    }).filter(Boolean) as NormalizedImportedTransaction[];
  };

  const preparePreview = async (parsed: NormalizedImportedTransaction[]) => {
    if (!user || !db) return;
    
    const txRef = collection(db, 'users', user.uid, 'transactions');
    const snapshot = await getDocs(txRef);
    const existingRefs = new Set(snapshot.docs.map(d => String(d.data().sourceReference || d.data().importFingerprint || '')));

    const finalRows = parsed.map(r => ({
      ...r,
      status: existingRefs.has(r.sourceReference) || existingRefs.has(r.importFingerprint) ? 'duplicate' : 'valid'
    })) as NormalizedImportedTransaction[];

    setRows(finalRows);
    setSelectedIds(new Set(finalRows.map((r, i) => r.status === 'valid' && r.include ? i : -1).filter(i => i !== -1)));
    setStep('preview');
  };

  const handleImport = async () => {
    if (!user || !db) return;
    setStep('importing');
    setLoading(true);
    
    const toImport = rows.filter((_, i) => selectedIds.has(i));
    const BATCH_SIZE = 400;
    let successCount = 0;

    try {
      for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
        setLoadingProgress(Math.round((i / toImport.length) * 100));
        const batch = writeBatch(db);
        const chunk = toImport.slice(i, i + BATCH_SIZE);

        chunk.forEach(row => {
          const docRef = doc(collection(db, 'users', user.uid, 'transactions'));
          const timestamp = new Date(row.date);
          batch.set(docRef, {
            recordId: `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            userId: user.uid,
            date: row.date,
            time: row.time || "",
            month: format(timestamp, 'MMMM'),
            year: timestamp.getFullYear(),
            amount: row.amount,
            description: row.description,
            category: row.category,
            incomeExpense: row.incomeExpense,
            paymentMode: row.paymentMode,
            source: row.source,
            sourceReference: row.sourceReference,
            sourceAccount: row.sourceAccount,
            additionalDetails: row.additionalDetails || "",
            remarks: row.remarks || "",
            transactionId: row.transactionId || "",
            orderId: row.orderId || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            importedAt: serverTimestamp()
          });
          successCount++;
        });
        await batch.commit();
      }
      setImportSummary({ imported: successCount, skipped: rows.length - successCount });
      setStep('result');
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Import Failed', description: 'Database error occurred.' });
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter(r => 
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.date.includes(searchQuery)
    );
  }, [rows, searchQuery]);

  if (step === 'upload') {
    return (
      <Card className="p-8 border-none bg-card shadow-sm flex flex-col items-center justify-center space-y-6 text-center">
        <input 
          id="statement-upload"
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept=".pdf,.csv,.xlsx,.xls" 
          className="sr-only" 
          disabled={loading}
        />
        
        <label 
          htmlFor="statement-upload"
          className={cn(
            "w-full cursor-pointer group flex flex-col items-center space-y-6",
            loading && "pointer-events-none opacity-50"
          )}
        >
          <div className="w-20 h-20 rounded-[28px] bg-primary/10 text-primary flex items-center justify-center shadow-sm transition-all group-hover:scale-105 group-hover:bg-primary/20 group-active:scale-95">
            {loading ? <Loader2 className="animate-spin w-8 h-8" /> : <FileUp size={40} />}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
              {loading ? 'Processing File...' : 'Upload Paytm Excel or PhonePe PDF'}
            </h3>
            <p className="text-xs text-muted-foreground">
              For the best results, upload the original statement downloaded directly from Paytm or PhonePe.
            </p>
          </div>
        </label>

        <div className="w-full bg-secondary/5 rounded-2xl p-4 text-left space-y-4 border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Info size={14} className="text-primary" />
            <h4 className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Which file should I upload?</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <FileSpreadsheet size={16} />
              </div>
              <div>
                <p className="text-[11px] font-bold">Paytm users</p>
                <p className="text-[10px] text-muted-foreground">Upload the Excel statement downloaded from Paytm.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                <FileText size={16} />
              </div>
              <div>
                <p className="text-[11px] font-bold">PhonePe users</p>
                <p className="text-[10px] text-muted-foreground">Upload the PDF statement downloaded from PhonePe.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="w-full space-y-2">
          <div className="flex flex-col items-center gap-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
              Paytm Excel · PhonePe PDF · Maximum 10 MB
            </p>
            {selectionGuidance && (
              <p className="text-[10px] font-bold text-primary animate-in fade-in slide-in-from-bottom-1">
                {selectionGuidance}
              </p>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (step === 'preview') {
    return (
      <Card className="flex flex-col border-none bg-card shadow-lg overflow-hidden rounded-3xl h-fit max-h-[85vh]">
        <div className="p-4 border-b border-white/5 bg-secondary/10 space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => { setStep('upload'); setSelectionGuidance(null); }} className="text-[10px] uppercase font-bold tracking-widest h-8 px-2">
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase text-primary bg-primary/10 px-2 py-1 rounded-lg">{rows.length} Found</span>
              <span className="text-[9px] font-bold uppercase text-accent bg-accent/10 px-2 py-1 rounded-lg">{selectedIds.size} Selected</span>
            </div>
          </div>
          <Input 
            placeholder="Search entries..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 bg-background/50 border-none rounded-xl text-xs"
          />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-secondary/5 min-h-[300px] max-h-[50vh] pr-4">
          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <Search className="w-10 h-10 mb-2" />
              <p className="text-xs font-bold uppercase">No entries found</p>
            </div>
          ) : (
            filteredRows.map((row, idx) => {
              const isDuplicate = row.status === 'duplicate';
              const isExpanded = expandedIds.has(idx);

              return (
                <div key={idx} className={cn(
                  "flex flex-col p-4 bg-card rounded-2xl border border-white/5 shadow-sm transition-all",
                  isDuplicate && "opacity-60 grayscale-[0.5]"
                )}>
                  <div className="flex gap-4">
                    <Checkbox 
                      checked={selectedIds.has(idx)} 
                      disabled={isDuplicate}
                      onCheckedChange={(c) => {
                        const next = new Set(selectedIds);
                        c ? next.add(idx) : next.delete(idx);
                        setSelectedIds(next);
                      }} 
                      className="rounded-lg h-5 w-5 mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">{row.date}</p>
                          <h4 className="text-sm font-bold truncate pr-2 text-foreground">{row.description}</h4>
                          {row.time && <p className="text-[10px] text-muted-foreground font-medium">{row.time}</p>}
                        </div>
                        <p className={cn("text-sm font-black", row.incomeExpense === 'Income' ? 'text-accent' : 'text-expense')}>
                          {row.incomeExpense === 'Income' ? '+' : '-'}₹{row.amount.toLocaleString('en-IN')}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={row.category} onValueChange={v => { const n = [...rows]; n[idx].category = v; setRows(n); }}>
                          <SelectTrigger className="h-9 text-[10px] bg-secondary/20 border-none rounded-xl font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-[10px] font-bold">{c}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={row.paymentMode} onValueChange={v => { const n = [...rows]; n[idx].paymentMode = v; setRows(n); }}>
                          <SelectTrigger className="h-9 text-[10px] bg-secondary/20 border-none rounded-xl font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m} value={m} className="text-[10px] font-bold">{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>

                      <Collapsible open={isExpanded}>
                        <CollapsibleTrigger asChild>
                          <button onClick={() => { const n = new Set(expandedIds); n.has(idx) ? n.delete(idx) : n.add(idx); setExpandedIds(n); }} className="text-[9px] font-bold uppercase text-primary flex items-center gap-1 pt-1">
                            {isExpanded ? 'Hide Details' : 'More Details'} <ChevronDown className={cn("w-3 h-3", isExpanded && "rotate-180")} />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 space-y-1.5 text-[9px] font-bold uppercase text-muted-foreground/60 border-t border-white/5 mt-2">
                          <div className="flex justify-between"><span>Source</span><span>{row.source}</span></div>
                          <div className="flex justify-between"><span>Reference</span><span className="text-foreground/70">{row.sourceReference}</span></div>
                          {row.sourceAccount && <div className="flex justify-between"><span>Account</span><span className="text-foreground/70">{row.sourceAccount}</span></div>}
                          {row.additionalDetails && <div className="flex flex-col gap-1 mt-1"><span className="opacity-50">UPI Detail</span><span className="text-foreground/70 normal-case font-medium">{row.additionalDetails}</span></div>}
                          {row.remarks && <div className="flex flex-col gap-1 mt-1"><span className="opacity-50">Remarks</span><span className="text-foreground/70 normal-case font-medium">{row.remarks}</span></div>}
                          {row.orderId && <div className="flex justify-between"><span>Order ID</span><span className="text-foreground/70">{row.orderId}</span></div>}
                          {isDuplicate && <div className="flex items-center gap-1 text-destructive mt-1"><AlertCircle size={10} /> Already imported</div>}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-secondary/10 shrink-0">
          <Button onClick={handleImport} disabled={loading || selectedIds.size === 0} className="w-full h-14 rounded-2xl bg-primary text-white font-bold glow-primary shadow-xl">
            Import {selectedIds.size} Selected Entries
          </Button>
        </div>
      </Card>
    );
  }

  if (step === 'importing') {
    return (
      <Card className="p-12 border-none bg-card shadow-sm flex flex-col items-center justify-center space-y-6 text-center">
        <Loader2 className="w-16 h-16 animate-spin text-primary opacity-20" />
        <div className="space-y-2">
          <h3 className="text-xl font-bold">Importing Data...</h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{loadingProgress}% Complete</p>
        </div>
      </Card>
    );
  }

  if (step === 'result') {
    return (
      <Card className="p-8 border-none bg-card shadow-sm flex flex-col items-center justify-center space-y-6 text-center">
        <div className="w-20 h-20 rounded-[32px] bg-accent/10 text-accent flex items-center justify-center mb-2 shadow-inner"><CheckCircle2 size={48} /></div>
        <div className="space-y-1">
          <h3 className="text-2xl font-bold">Import Complete</h3>
          <p className="text-sm font-medium">{importSummary.imported} entries added to your history.</p>
        </div>
        <Button onClick={() => { setStep('upload'); setSelectionGuidance(null); }} className="h-14 px-10 rounded-2xl bg-primary text-white font-bold glow-primary w-full">Done</Button>
      </Card>
    );
  }

  return null;
}
