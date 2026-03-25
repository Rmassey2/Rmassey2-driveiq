"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DriverLead } from "@/lib/types";
import AddLeadModal from "./add-lead-modal";
import LeadSlideOver from "./lead-slideover";

type Filter = "all" | "priority" | "follow_up" | "contact_later" | "cold";

export default function PipelinePage() {
  const supabase = createClient();
  const [leads, setLeads] = useState<DriverLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<DriverLead | null>(null);
  const [sortField, setSortField] = useState<keyof DriverLead>("lead_score");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from("driver_leads")
      .select("*")
      .in("disposition", ["active", "considering", "contact_later"])
      .eq("do_not_hire", false)
      .order("lead_score", { ascending: false });
    setLeads((data as DriverLead[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filtered = leads
    .filter((l) => {
      if (filter === "priority") return l.lead_score >= 70;
      if (filter === "follow_up") {
        const daysSince = l.updated_at
          ? Math.floor((Date.now() - new Date(l.updated_at).getTime()) / 86400000)
          : 999;
        return daysSince >= 3 && l.disposition === "active";
      }
      if (filter === "contact_later") {
        return (
          l.disposition === "contact_later" &&
          l.contact_later_date &&
          new Date(l.contact_later_date) <= new Date()
        );
      }
      if (filter === "cold") return l.cold_flag;
      return true;
    })
    .filter((l) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        l.full_name?.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.email?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });

  function handleSort(field: keyof DriverLead) {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  const counts = {
    all: leads.length,
    priority: leads.filter((l) => l.lead_score >= 70).length,
    follow_up: leads.filter((l) => {
      const d = l.updated_at ? Math.floor((Date.now() - new Date(l.updated_at).getTime()) / 86400000) : 999;
      return d >= 3 && l.disposition === "active";
    }).length,
    contact_later: leads.filter(
      (l) => l.disposition === "contact_later" && l.contact_later_date && new Date(l.contact_later_date) <= new Date()
    ).length,
    cold: leads.filter((l) => l.cold_flag).length,
  };

  function scoreColor(score: number) {
    if (score >= 70) return "text-green-400";
    if (score >= 40) return "text-yellow-400";
    return "text-red-400";
  }

  function daysSince(dateStr: string | null): number {
    if (!dateStr) return 0;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  }

  function rowClass(lead: DriverLead) {
    if (lead.lead_score >= 70) return "border-l-4 border-l-[#c8a951]";
    if (lead.cold_flag) return "bg-blue-900/20";
    if (lead.disposition === "contact_later") return "bg-orange-900/20";
    return "";
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-400">Loading pipeline...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Pipeline</h1>
        <input
          type="text"
          placeholder="Search name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-600 bg-[#111d33] px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#c8a951] focus:outline-none"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(
          [
            ["all", "ALL"],
            ["priority", "PRIORITY"],
            ["follow_up", "FOLLOW UP TODAY"],
            ["contact_later", "CONTACT LATER DUE"],
            ["cold", "COLD"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === key
                ? "bg-[#c8a951] text-[#0a1628]"
                : "bg-[#111d33] text-gray-400 hover:text-white"
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700/50">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#111d33] text-xs uppercase text-gray-400">
            <tr>
              {([
                ["full_name", "Name"],
                ["phone", "Phone"],
                ["segment_interest", "Segment"],
                ["lead_score", "Score"],
                ["pipeline_stage", "Stage"],
                ["source_channel", "Source"],
                ["updated_at", "Last Contact"],
                ["pipeline_stage", "Days in Stage"],
                ["disposition", "Disposition"],
              ] as [keyof DriverLead, string][]).map(([field, label]) => (
                <th
                  key={label}
                  className="cursor-pointer px-4 py-3 hover:text-white"
                  onClick={() => handleSort(field)}
                >
                  {label}
                  {sortField === field && (sortAsc ? " ↑" : " ↓")}
                </th>
              ))}
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {filtered.map((lead) => (
              <tr key={lead.id} className={`hover:bg-white/5 ${rowClass(lead)}`}>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-white">
                  {lead.full_name}
                </td>
                <td className="px-4 py-3 text-gray-300">{lead.phone}</td>
                <td className="px-4 py-3 text-gray-300">{lead.segment_interest}</td>
                <td className={`px-4 py-3 font-bold ${scoreColor(lead.lead_score)}`}>
                  {lead.lead_score}
                </td>
                <td className="px-4 py-3 text-gray-300">{lead.pipeline_stage}/12</td>
                <td className="px-4 py-3 text-gray-300">{lead.source_channel}</td>
                <td className="px-4 py-3 text-gray-400">
                  {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {daysSince(lead.updated_at)}d
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs capitalize text-gray-300">
                    {lead.disposition}
                  </span>
                </td>
                <td className="space-x-1 px-4 py-3">
                  <button
                    onClick={() => setSelectedLead(lead)}
                    className="rounded bg-[#c8a951]/20 px-2 py-1 text-xs text-[#c8a951] hover:bg-[#c8a951]/30"
                  >
                    View
                  </button>
                  <button
                    onClick={() => setSelectedLead(lead)}
                    className="rounded bg-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/20"
                  >
                    Call Log
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No leads match your filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Floating add button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-[#c8a951] text-2xl font-bold text-[#0a1628] shadow-lg transition hover:bg-[#b8993e]"
      >
        +
      </button>

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            fetchLeads();
          }}
        />
      )}

      {selectedLead && (
        <LeadSlideOver
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={() => {
            fetchLeads();
          }}
        />
      )}
    </div>
  );
}
