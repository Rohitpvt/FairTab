import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Landmark } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { Button } from "../../components/ui/Button";
import { groupSchema } from "./groupSchema";
import type { GroupFormData } from "./groupSchema";
import { groupService } from "../../infrastructure/firebase/groupService";
import { toast } from "sonner";

export const CreateGroupPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema) as unknown as Resolver<GroupFormData>,
    defaultValues: {
      name: "",
      description: "",
      type: "trip",
      baseCurrency: "INR",
      simplifyDebts: true,
      settlementStrategy: "minimum_transactions",
    },
  });

  const onSubmit = async (data: GroupFormData) => {
    setIsLoading(true);
    try {
      const groupId = await groupService.createGroup(data);
      toast.success(`Group "${data.name}" created successfully!`);
      navigate(`/groups/${groupId}`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast.error(err.message || "Failed to create group.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer
      title="Create New Group"
      description="Set up a shared space to split expenses with friends or housemates."
    >
      <div className="max-w-xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate("/groups")}
          className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Groups
        </button>

        {/* Form Container */}
        <div className="glass-elevated border border-white/10 rounded-2xl p-6 md:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 text-left">
            {/* Group Name */}
            <div className="flex flex-col gap-2">
              <label htmlFor="grp-name" className="text-sm font-semibold text-text-secondary">
                Group Name *
              </label>
              <input
                id="grp-name"
                type="text"
                {...register("name")}
                placeholder="e.g. Europe Trip 2026, Apartment 4B"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan transition-colors"
              />
              {errors.name && (
                <span className="text-xs text-danger font-medium mt-0.5">{errors.name.message}</span>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <label htmlFor="grp-desc" className="text-sm font-semibold text-text-secondary">
                Description (Optional)
              </label>
              <textarea
                id="grp-desc"
                {...register("description")}
                placeholder="Brief summary or trip agenda..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan transition-colors resize-none"
              />
              {errors.description && (
                <span className="text-xs text-danger font-medium mt-0.5">{errors.description.message}</span>
              )}
            </div>

            {/* Group Type & Base Currency Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Group Type */}
              <div className="flex flex-col gap-2">
                <label htmlFor="grp-type" className="text-sm font-semibold text-text-secondary">
                  Group Type
                </label>
                <select
                  id="grp-type"
                  {...register("type")}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-accent-cyan transition-colors [&>option]:bg-[#0c0f1d]"
                >
                  <option value="trip">✈️ Trip</option>
                  <option value="home">🏠 Home & Rent</option>
                  <option value="couple">❤️ Couple</option>
                  <option value="event">🎉 Event</option>
                  <option value="project">💻 Project</option>
                  <option value="other">📦 Other</option>
                </select>
              </div>

              {/* Base Currency */}
              <div className="flex flex-col gap-2">
                <label htmlFor="grp-currency" className="text-sm font-semibold text-text-secondary">
                  Base Currency
                </label>
                <select
                  id="grp-currency"
                  {...register("baseCurrency")}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-accent-cyan transition-colors [&>option]:bg-[#0c0f1d]"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>
            </div>

            {/* Debt Simplification Toggle */}
            <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex flex-col gap-1 pr-4">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-accent-indigo" />
                  <span className="text-sm font-semibold text-text-primary">Simplify Debts</span>
                </div>
                <span className="text-xs text-text-muted">
                  Automatically consolidate debts to minimize the total number of transactions.
                </span>
              </div>
              <input
                id="grp-simplify"
                type="checkbox"
                {...register("simplifyDebts")}
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent-cyan focus:ring-accent-cyan"
              />
            </div>

            {/* Submit Action */}
            <div className="flex gap-4 mt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/groups")}
                className="flex-1"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="gradient"
                className="flex-1"
                isLoading={isLoading}
                loadingText="Creating Group..."
              >
                Create Group
              </Button>
            </div>
          </form>
        </div>
      </div>
    </PageContainer>
  );
};

export default CreateGroupPage;
