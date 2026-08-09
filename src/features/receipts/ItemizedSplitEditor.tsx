import React from "react";
import type { GroupMemberDocument } from "../groups/memberSchema";
import { ReceiptConfidenceBadge } from "./ReceiptConfidenceBadge";
import { Plus, Trash2, UserCheck } from "lucide-react";

interface ItemizedLine {
  description: string;
  amountMinor: number;
  confidence: number;
  participantIds: string[];
}

interface ItemizedSplitEditorProps {
  items: ItemizedLine[];
  members: GroupMemberDocument[];
  onItemsChange: (items: ItemizedLine[]) => void;
}

export const ItemizedSplitEditor: React.FC<ItemizedSplitEditorProps> = ({
  items,
  members,
  onItemsChange,
}) => {
  const handleItemFieldChange = (index: number, field: keyof ItemizedLine, value: ItemizedLine[keyof ItemizedLine]) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    onItemsChange(updated);
  };

  const handleToggleParticipant = (index: number, memberId: string) => {
    const item = items[index];
    const participantIds = item.participantIds || [];
    const updatedParticipants = participantIds.includes(memberId)
      ? participantIds.filter((id) => id !== memberId)
      : [...participantIds, memberId];

    handleItemFieldChange(index, "participantIds", updatedParticipants);
  };

  const handleSelectAllParticipants = (index: number) => {
    const allMemberIds = members.map((m) => m.id);
    handleItemFieldChange(index, "participantIds", allMemberIds);
  };

  const handleClearParticipants = (index: number) => {
    handleItemFieldChange(index, "participantIds", []);
  };

  const handleAddItem = () => {
    const newItem: ItemizedLine = {
      description: "New Item",
      amountMinor: 0,
      confidence: 1.0, // Manual items have 100% confidence
      participantIds: members.map((m) => m.id), // Default split among everyone
    };
    onItemsChange([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onItemsChange(updated);
  };

  const totalItemsSubtotal = items.reduce((sum, it) => sum + it.amountMinor, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">Itemized Line Items</h3>
        <button
          type="button"
          onClick={handleAddItem}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 rounded-lg text-xs font-semibold transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Item
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => {
          const isLowConfidence = item.confidence < 0.7;

          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition duration-200 ${
                isLowConfidence
                  ? "bg-amber-500/5 border-amber-500/25 ring-1 ring-amber-500/15"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                {/* Item description */}
                <div className="flex-1 w-full min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemFieldChange(idx, "description", e.target.value)}
                      className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-sky-400 focus:outline-none text-sm font-semibold text-white w-full truncate py-0.5"
                      placeholder="Item description"
                    />
                    <ReceiptConfidenceBadge confidence={item.confidence} />
                  </div>
                  {isLowConfidence && (
                    <p className="text-[10px] text-amber-400/80 mb-2">
                      ⚠️ Extracted with low confidence. Please verify name and price.
                    </p>
                  )}
                </div>

                {/* Item price & delete button */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={(item.amountMinor / 100).toFixed(2)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        handleItemFieldChange(idx, "amountMinor", Math.round(val * 100));
                      }}
                      className="bg-white/5 border border-white/10 rounded-lg pl-6 pr-2.5 py-1 text-sm font-medium text-white w-full md:w-28 focus:border-sky-400 focus:outline-none text-right"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1.5 text-white/40 hover:text-rose-400 bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/20 rounded-lg transition"
                    title="Delete item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Participant Selection */}
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">Split with</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllParticipants(idx)}
                      className="text-[10px] text-sky-400 hover:underline"
                    >
                      Split All
                    </button>
                    <span className="text-white/20 text-[10px]">|</span>
                    <button
                      type="button"
                      onClick={() => handleClearParticipants(idx)}
                      className="text-[10px] text-white/40 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {members.map((member) => {
                    const isSelected = item.participantIds?.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleToggleParticipant(idx, member.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition ${
                          isSelected
                            ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                            : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {isSelected && <UserCheck className="w-3 h-3" />}
                        {member.displayName}
                      </button>
                    );
                  })}
                </div>
                
                {(!item.participantIds || item.participantIds.length === 0) && (
                  <p className="text-[10px] text-rose-400/80 mt-2">
                    ⚠️ At least one split participant must be selected.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/10">
        <span className="text-xs font-semibold text-white/60">Subtotal of Items</span>
        <span className="text-sm font-bold text-white">${(totalItemsSubtotal / 100).toFixed(2)}</span>
      </div>
    </div>
  );
};
