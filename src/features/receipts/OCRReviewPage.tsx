/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";
import { groupService } from "../../infrastructure/firebase/groupService";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";
import { ReceiptUploader } from "./ReceiptUploader";
import { ReceiptPreview } from "./ReceiptPreview";
import { ItemizedSplitEditor } from "./ItemizedSplitEditor";
import { TaxTipAllocator, allocateLargestRemainder } from "./TaxTipAllocator";
import { ReceiptUploadStatus } from "./ReceiptUploadStatus";
import { syncManager } from "../../infrastructure/offline/syncManager";
import { auth } from "../../infrastructure/firebase/firebase";
import { receiptStorage } from "../../infrastructure/storage/receiptStorage";
import { receiptService } from "../../infrastructure/firebase/receiptService";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Send, Sparkles } from "lucide-react";

interface ItemizedLine {
  description: string;
  amountMinor: number;
  confidence: number;
  participantIds: string[];
}

export const OCRReviewPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Flow steps: "upload" | "review"
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);

  // Uploaded file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generatedReceiptId, setGeneratedReceiptId] = useState("");

  // Extracted/Edited receipt fields
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [subtotalMinor, setSubtotalMinor] = useState(0);
  const [taxMinor, setTaxMinor] = useState(0);
  const [tipMinor, setTipMinor] = useState(0);
  const [discountMinor, setDiscountMinor] = useState(0);
  const [totalMinor, setTotalMinor] = useState(0);

  // Line items
  const [items, setItems] = useState<ItemizedLine[]>([]);
  const [confidence, setConfidence] = useState<Record<string, number>>({});

  // Payer
  const [payerMemberId, setPayerMemberId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSimulatedOcr, setIsSimulatedOcr] = useState(false);

  // Reconciled allocations
  const [finalAllocations, setFinalAllocations] = useState<Record<string, { base: number; tax: number; tip: number; discount: number; total: number }>>({});

  useEffect(() => {
    if (!groupId) return;

    const unsubGroup = groupService.watchGroup(groupId, (g: GroupDocument | null) => {
      setGroup(g);
      if (g) {
        setCurrency(g.baseCurrency);
      }
      setIsLoading(false);
    });

    const unsubMembers = groupService.watchMembers(groupId, (m: GroupMemberDocument[]) => {
      // Filter active members only
      const activeMembers = m.filter((member) => member.status === "active");
      setMembers(activeMembers);

      // Default payer to current user if they are a member
      const currentUserMember = activeMembers.find((member) => member.userId === auth.currentUser?.uid);
      if (currentUserMember) {
        setPayerMemberId(currentUserMember.id);
      } else if (activeMembers.length > 0) {
        setPayerMemberId(activeMembers[0].id);
      }
    });

    return () => {
      unsubGroup();
      unsubMembers();
    };
  }, [groupId]);

  // Recalculate totals and check discrepancies
  const itemsSum = useMemo(() => items.reduce((sum, it) => sum + it.amountMinor, 0), [items]);
  const mathSumTotal = subtotalMinor + taxMinor + tipMinor - discountMinor;
  const isReconciled = mathSumTotal === totalMinor && itemsSum === subtotalMinor;

  // Track shares of items per participant
  const itemShares = useMemo(() => {
    const shares: Record<string, number> = {};
    members.forEach((m) => { shares[m.id] = 0; });

    items.forEach((item) => {
      const parts = item.participantIds || [];
      if (parts.length === 0) return;
      const divided = allocateLargestRemainder(item.amountMinor, parts.length, parts.reduce((acc, pid) => {
        acc[pid] = 1;
        return acc;
      }, {} as Record<string, number>));

      parts.forEach((pid) => {
        shares[pid] = (shares[pid] || 0) + (divided[pid] || 0);
      });
    });

    return shares;
  }, [items, members]);

  // Run OCR processing
  const handleFileSelected = async (file: File) => {
    setSelectedFile(file);
    const receiptId = crypto.randomUUID();
    setGeneratedReceiptId(receiptId);
    setIsProcessingOcr(true);
    setStep("review");

    try {
      if (syncManager.isOnline) {
        // Upload temporary file to S3 Storage to process OCR on the server
        const version = 1;
        
        const meta = await receiptStorage.uploadReceipt(groupId!, receiptId, file, file.name, version);
        const storagePath = meta.objectKey;

        // Trigger processReceiptOCR via Vercel endpoint
        const ocrData = await receiptService.processReceiptOCR({ groupId: groupId!, storagePath }) as {
          merchant?: string;
          date?: string;
          currency?: string;
          subtotal?: number;
          tax?: number;
          tip?: number;
          discount?: number;
          total?: number;
          confidence?: Record<string, number>;
          items?: Array<{ description?: string; amountMinor?: number; confidence?: number }>;
          isSimulated?: boolean;
        };

        // Populate state from OCR results
        setMerchant(ocrData.merchant || "Supermarket");
        setDate(ocrData.date || new Date().toISOString().split("T")[0]);
        setCurrency(ocrData.currency || group?.baseCurrency || "USD");
        setSubtotalMinor(ocrData.subtotal || 0);
        setTaxMinor(ocrData.tax || 0);
        setTipMinor(ocrData.tip || 0);
        setDiscountMinor(ocrData.discount || 0);
        setTotalMinor(ocrData.total || 0);
        setConfidence(ocrData.confidence || {});

        const mappedItems: ItemizedLine[] = (ocrData.items || []).map((it) => ({
          description: it.description || "Line Item",
          amountMinor: it.amountMinor || 0,
          confidence: it.confidence !== undefined ? it.confidence : 1.0,
          participantIds: members.map((m) => m.id), // Default split among everyone
        }));
        setItems(mappedItems);

        toast.success("Receipt scanned successfully!", {
          description: "Parsed itemized details. Please review confidence levels.",
        });

        // Track simulated OCR status for UI banner
        setIsSimulatedOcr(!!ocrData.isSimulated);

      } else {
        // Offline: load mock OCR data locally so they can work offline!
        setMerchant("Offline Store");
        setDate(new Date().toISOString().split("T")[0]);
        setCurrency(group?.baseCurrency || "USD");
        setSubtotalMinor(3000);
        setTaxMinor(300);
        setTipMinor(500);
        setDiscountMinor(200);
        setTotalMinor(3600);
        setConfidence({ merchant: 0.95, date: 0.95 });
        setItems([
          { description: "Offline Item 1", amountMinor: 1000, confidence: 1.0, participantIds: members.map((m) => m.id) },
          { description: "Offline Item 2", amountMinor: 2000, confidence: 1.0, participantIds: members.map((m) => m.id) },
        ]);

        toast.warning("Scanning offline!", {
          description: "Simulating offline OCR data. This receipt will sync upon reconnection.",
        });
        setIsSimulatedOcr(true);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("OCR Scanning failed. You can still input receipt details manually.");
      // Fallback defaults
      setMerchant("Merchant Name");
      setDate(new Date().toISOString().split("T")[0]);
      setSubtotalMinor(0);
      setTaxMinor(0);
      setTipMinor(0);
      setDiscountMinor(0);
      setTotalMinor(0);
      setItems([]);
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !groupId || !isReconciled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const clientOperationId = crypto.randomUUID();
      const expenseId = crypto.randomUUID();

      // Build splits array from the final tax/tip allocation
      const finalSplits = Object.keys(finalAllocations).map((mid) => {
        const alloc = finalAllocations[mid];
        return {
          memberId: mid,
          amountMinor: alloc.total,
        };
      }).filter((s) => s.amountMinor > 0);

      const ocrPayload = {
        merchant,
        date,
        currency,
        subtotal: subtotalMinor,
        tax: taxMinor,
        tip: tipMinor,
        discount: discountMinor,
        total: totalMinor,
        confidence,
        items,
      };

      // 1. Queue receipt upload
      await syncManager.queueReceiptUpload(
        groupId,
        generatedReceiptId,
        selectedFile?.name || "receipt.jpg",
        selectedFile?.type || "image/jpeg",
        selectedFile!,
        ocrPayload
      );

      // 2. Queue expense creation (linked to receiptId!)
      const expensePayload = {
        clientOperationId,
        groupId,
        expenseId,
        title: `Receipt: ${merchant}`,
        category: "food" as const,
        incurredAtSeconds: Math.floor(new Date(date).getTime() / 1000) || Math.floor(Date.now() / 1000),
        currency,
        amountMinor: totalMinor,
        fxNumerator: 1,
        fxDenominator: 1,
        splitMethod: "exact" as const,
        payers: [{ memberId: payerMemberId, amountMinor: totalMinor }],
        splits: finalSplits,
        receiptId: generatedReceiptId,
      };

      await syncManager.queueCreateExpense(groupId, expensePayload);

      toast.success("Expense and Receipt enqueued!", {
        description: "Your receipt has been queued for foreground synchronization.",
      });

      navigate(`/groups/${groupId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit itemized receipt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Scan Receipt" description="Initializing OCR environment...">
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        </div>
      </PageContainer>
    );
  }

  if (!group) {
    return (
      <PageContainer title="Error" description="Group not found.">
        <div className="text-center py-10 text-white/60">Group not found.</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Scan Receipt & Split"
      description={`Upload receipt file to automatically parse and split costs for ${group.name}.`}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {step === "upload" ? (
          <div className="max-w-xl mx-auto space-y-6">
            <ReceiptUploader onFileSelected={handleFileSelected} />
            <ReceiptUploadStatus groupId={groupId!} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left Column: Receipt File Preview */}
            <div className="space-y-4 lg:sticky lg:top-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("upload")}
                  className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Upload different file
                </button>
                <div className="flex items-center gap-1.5 text-xs text-sky-400 font-semibold bg-sky-500/10 px-2.5 py-1 rounded-full">
                  <Sparkles className="w-3.5 h-3.5" />
                  {isProcessingOcr ? "Extracting text..." : "OCR Parsing Complete"}
                </div>
              </div>

              {isProcessingOcr ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white/5 border border-white/10 rounded-2xl h-[450px]">
                  <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-2" />
                  <p className="text-xs text-white">Analyzing receipt image via OCR...</p>
                  <p className="text-[10px] text-white/40 mt-1">This takes a few seconds.</p>
                </div>
              ) : (
                <ReceiptPreview fileBlob={selectedFile} fileType={selectedFile?.type} />
              )}
            </div>

            {/* Right Column: OCR Editor and splits allocation */}
            <form onSubmit={handleCreateExpense} className="space-y-6 bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-base font-bold text-white">Review & Confirm OCR Extraction</h2>

              {isSimulatedOcr && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-xs">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Simulated OCR</span> — This extraction uses demo data from a mock provider.
                    In production, connect a real OCR service (e.g., Google Vision API) for actual text recognition.
                  </div>
                </div>
              )}

              {/* Receipt metadata inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase mb-1">Merchant</label>
                  <input
                    type="text"
                    required
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                    placeholder="Merchant Name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Financial inputs in Cents/Minor Units */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase mb-1">Subtotal</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={(subtotalMinor / 100).toFixed(2)}
                      onChange={(e) => setSubtotalMinor(Math.round((parseFloat(e.target.value) || 0) * 100))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-2.5 py-2 text-sm text-white focus:border-sky-400 focus:outline-none text-right"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase mb-1">Tax</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={(taxMinor / 100).toFixed(2)}
                      onChange={(e) => setTaxMinor(Math.round((parseFloat(e.target.value) || 0) * 100))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-2.5 py-2 text-sm text-white focus:border-sky-400 focus:outline-none text-right"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase mb-1">Tip</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={(tipMinor / 100).toFixed(2)}
                      onChange={(e) => setTipMinor(Math.round((parseFloat(e.target.value) || 0) * 100))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-2.5 py-2 text-sm text-white focus:border-sky-400 focus:outline-none text-right"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase mb-1">Discount</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={(discountMinor / 100).toFixed(2)}
                      onChange={(e) => setDiscountMinor(Math.round((parseFloat(e.target.value) || 0) * 100))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-6 pr-2.5 py-2 text-sm text-white focus:border-sky-400 focus:outline-none text-right"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/10">
                <div>
                  <span className="text-xs font-semibold text-white/60">AUTHORITATIVE TOTAL</span>
                  <p className="text-[10px] text-white/40">Verified by user click confirmation</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={(totalMinor / 100).toFixed(2)}
                      onChange={(e) => setTotalMinor(Math.round((parseFloat(e.target.value) || 0) * 100))}
                      className="bg-white/5 border border-white/10 rounded-lg pl-6 pr-2.5 py-2 text-sm font-bold text-white w-32 focus:border-sky-400 focus:outline-none text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Itemized Split Editor */}
              <ItemizedSplitEditor
                items={items}
                members={members}
                onItemsChange={setItems}
              />

              {/* Tax & Tip Allocator */}
              <TaxTipAllocator
                subtotal={subtotalMinor}
                tax={taxMinor}
                tip={tipMinor}
                discount={discountMinor}
                total={totalMinor}
                shares={itemShares}
                onAllocationChange={setFinalAllocations}
              />

              {/* Payer selection */}
              <div className="pt-3 border-t border-white/15">
                <label className="block text-xs font-semibold text-white/60 uppercase mb-1">Who Paid?</label>
                <select
                  value={payerMemberId}
                  onChange={(e) => setPayerMemberId(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-sky-400 focus:outline-none"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} {m.userId === auth.currentUser?.uid ? "(You)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={!isReconciled || isSubmitting || isProcessingOcr}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition duration-200 ${
                    isReconciled && !isProcessingOcr
                      ? "bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/25"
                      : "bg-white/5 border border-white/10 text-white/40 cursor-not-allowed"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving Expense...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Save and Create Expense
                    </>
                  )}
                </button>
                {!isReconciled && (
                  <p className="text-[10px] text-rose-400 text-center mt-2 font-medium">
                    ⚠️ Totals do not reconcile: items subtotal (${(itemsSum / 100).toFixed(2)}) must equal subtotal (${(subtotalMinor / 100).toFixed(2)}), and subtotal + tax + tip - discount must equal receipt total (${(totalMinor / 100).toFixed(2)}).
                  </p>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default OCRReviewPage;
