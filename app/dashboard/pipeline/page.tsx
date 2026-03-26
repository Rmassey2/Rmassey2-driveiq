"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DriverLead } from "@/lib/types";
import AddLeadModal from "./add-lead-modal";
import LeadSlideOver from "./lead-slideover";

type Filter = "all" | "priority" | "follow_up" | "contact_later" | "cold";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

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
  const [merging, setMerging] = useState<string | null>(null);

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

  // Detect duplicates: same normalized phone or same lowercased email
  const duplicateIds = new Set<string>();
  const phoneMap = new Map<string, string[]>();
  const emailMap = new Map<string, string[]>();

  for (const lead of leads) {
    if (lead.phone) {
      const np = normalizePhone(lead.phone);
      if (np.length >= 10) {
        const arr = phoneMap.get(np) ?? [];
        arr.push(lead.id);
        phoneMap.set(np, arr);
      }
    }
    if (lead.email) {
      const ne = lead.email.toLowerCase().trim();
      if (ne) {
        const arr = emailMap.get(ne) ?? [];
        arr.push(lead.id);
        emailMap.set(ne, arr);
      }
    }
  }
  Array.from(phoneMap.values()).forEach((ids) => {
    if (ids.length > 1) ids.forEach((id) => duplicateIds.add(id));
  });
  Array.from(emailMap.values()).forEach((ids) => {
    if (ids.length > 1) ids.forEach((id) => duplicateIds.add(id));
  });

  function findDuplicatePartner(lead: DriverLead): DriverLead | undefined {
    if (lead.phone) {
      const np = normalizePhone(lead.phone);
      const ids = phoneMap.get(np);
      if (ids && ids.length > 1) {
        const partnerId = ids.find((id) => id !== lead.id);
        if (partnerId) return leads.find((l) => l.id === partnerId);
      }
    }
    if (lead.email) {
      const ne = lead.email.toLowerCase().trim();
      const ids = emailMap.get(ne);
      if (ids && ids.length > 1) {
        const partnerId = ids.find((id) => id !== lead.id);
        if (partnerId) return leads.find((l) => l.id === partnerId);
      }
    }
    return undefined;
  }

  function countFilledFields(lead: DriverLead): number {
    let count = 0;
    const fields: (keyof DriverLead)[] = [
      "full_name", "phone", "email", "zip_code", "cdl_number", "cdl_class",
      "endorsements", "years_experience", "segment_interest", "source_channel",
      "notes", "tenstreet_applicant_id",
    ];
    for (const f of fields) {
      if (lead[f] != null && lead[f] !== "" && lead[f] !== false) count++;
    }
    return count;
  }

  async function handleMerge(keepId: string, deleteId: string) {
    setMerging(keepId);
    // Delete the lesser record
    await supabase.from("driver_leads").delete().eq("id", deleteId);
    await fetchLeads();
    setMerging(null);
  }

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
    if (duplicateIds.has(lead.id)) return "border-l-4 border-l-yellow-500 bg-yellow-900/10";
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

      {/* Duplicate warning banner */}
      {duplicateIds.size > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <p className="text-sm font-medium text-yellow-400">
            {duplicateIds.size} duplicate records detected (matching phone or email). Look for the yellow highlight below.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
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
                  <span className="flex items-center gap-1.5">
                    {lead.full_name}
                    {duplicateIds.has(lead.id) && (
                      <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400">
                        DUP
                      </span>
                    )}
                  </span>
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
                  {duplicateIds.has(lead.id) && (
                    <button
                      disabled={merging === lead.id}
                      onClick={() => {
                        const partner = findDuplicatePartner(lead);
                        if (!partner) return;
                        // Keep the record with more data
                        const keepLead = countFilledFields(lead) >= countFilledFields(partner) ? lead : partner;
                        const deleteLead = keepLead.id === lead.id ? partner : lead;
                        if (confirm(`Merge duplicates? Keep "${keepLead.full_name}" (more data), delete "${deleteLead.full_name}".`)) {
                          handleMerge(keepLead.id, deleteLead.id);
                        }
                      }}
                      className="rounded bg-yellow-500/20 px-2 py-1 text-xs text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50"
                    >
                      {merging === lead.id ? "..." : "Merge"}
                    </button>
                  )}
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
