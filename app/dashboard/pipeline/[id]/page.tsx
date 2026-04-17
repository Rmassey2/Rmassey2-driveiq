"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { DriverLead, CallLog } from "@/lib/types";

export default function DriverDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [lead, setLead] = useState<DriverLead | null>(null);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [stage, setStage] = useState(1);
  const [disposition, setDisposition] = useState("active");
  const [contactLaterDate, setContactLaterDate] = useState("");
  const [contactLaterReason, setContactLaterReason] = useState("");
  const [dnhReason, setDnhReason] = useState("");
  const [dnhConfirm, setDnhConfirm] = useState("");

  const [callForm, setCallForm] = useState({
    contact_type: "phone",
    outcome: "connected",
    callback_date: "",
    notes: "",
  });

  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const fetchLead = useCallback(async () => {
    const res = await fetch(`/api/leads/${id}`);
    if (res.ok) {
      const data = await res.json();
      setLead(data);
      setStage(data.pipeline_stage);
      setDisposition(data.disposition);
      setContactLaterDate(data.contact_later_date ?? "");
      setContactLaterReason(data.contact_later_reason ?? "");
      setLinkSent(!!data.tenstreet_link_sent_at);
    }
    setLoading(false);
  }, [id]);

  const fetchCalls = useCallback(async () => {
    const res = await fetch(`/api/leads/call-log?lead_id=${id}`);
    if (res.ok) setCalls(await res.json());
  }, [id]);

  useEffect(() => {
    fetchLead();
    fetchCalls();
  }, [fetchLead, fetchCalls]);

  async function saveDetails() {
    setSaving(true);
    const body: Record<string, unknown> = { pipeline_stage: stage, disposition };
    if (disposition === "contact_later") {
      body.contact_later_date = contactLaterDate || null;
      body.contact_later_reason = contactLaterReason || null;
    }
    if (disposition === "do_not_hire") {
      body.do_not_hire = true;
      body.dnh_reason = dnhReason;
    }
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setLead(updated);
    }
    setSaving(false);
  }

  async function logCall(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/leads/call-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver_lead_id: id, ...callForm }),
    });
    if (res.ok) {
      setCallForm({ contact_type: "phone", outcome: "connected", callback_date: "", notes: "" });
      fetchCalls();
    }
  }

  async function deleteLead() {
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard/pipeline");
      return;
    }
    const msg = await res.json().catch(() => ({ error: "Delete failed" }));
    setDeleteError(msg.error ?? "Delete failed");
    setDeleting(false);
  }

  async function sendTenstreetLink() {
    setSendingLink(true);
    const res = await fetch("/api/leads/tenstreet-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: id }),
    });
    if (res.ok) setLinkSent(true);
    setSendingLink(false);
  }

  const inputCls =
    "mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none";
  const labelCls = "block text-sm font-medium text-gray-300";

  if (loading) return <p className="text-gray-400">Loading...</p>;
  if (!lead) return <p className="text-red-400">Driver not found</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">{lead.full_name}</h1>
        <p className="mt-1 text-gray-400">
          {lead.phone} &middot; {lead.email ?? "no email"} &middot; {lead.zip_code ?? "no zip"}
        </p>
      </div>

      {/* Score & stats */}
      <div className="flex gap-6 rounded-lg border border-gray-700/50 bg-[#111d33] p-4">
        <Stat label="Score" value={String(lead.lead_score)} color={lead.lead_score >= 70 ? "text-green-400" : lead.lead_score >= 40 ? "text-yellow-400" : "text-red-400"} />
        <Stat label="Stage" value={`${lead.pipeline_stage}/12`} />
        <Stat label="Segment" value={lead.segment_interest ?? "—"} />
        <Stat label="CDL" value={lead.cdl_class ?? "—"} />
        <Stat label="Experience" value={lead.years_experience ?? "—"} />
        <Stat label="Source" value={lead.source_channel ?? "—"} />
        <Stat label="Created" value={new Date(lead.created_at).toLocaleDateString()} />
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Left: details & controls */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Pipeline Controls</h2>

          <div>
            <label className={labelCls}>Pipeline Stage</label>
            <select value={stage} onChange={(e) => setStage(Number(e.target.value))} className={inputCls}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>Stage {i + 1}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Disposition</label>
            <select value={disposition} onChange={(e) => setDisposition(e.target.value)} className={inputCls}>
              {["active", "considering", "contact_later", "do_not_hire", "withdrew", "archived"].map((d) => (
                <option key={d} value={d}>{d.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          {disposition === "contact_later" && (
            <>
              <div>
                <label className={labelCls}>Contact Later Date</label>
                <input type="date" value={contactLaterDate} onChange={(e) => setContactLaterDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Reason</label>
                <input type="text" value={contactLaterReason} onChange={(e) => setContactLaterReason(e.target.value)} className={inputCls} />
              </div>
            </>
          )}

          {disposition === "do_not_hire" && (
            <div className="space-y-3 rounded-lg border border-red-800 bg-red-900/20 p-4">
              <p className="text-sm font-medium text-red-300">
                This will permanently flag this driver and notify Ops. Cannot be undone without admin override.
              </p>
              <div>
                <label className={labelCls}>DNH Reason (required)</label>
                <input type="text" value={dnhReason} onChange={(e) => setDnhReason(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Type CONFIRM to proceed</label>
                <input type="text" value={dnhConfirm} onChange={(e) => setDnhConfirm(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={saveDetails}
              disabled={saving || (disposition === "do_not_hire" && (dnhConfirm !== "CONFIRM" || !dnhReason))}
              className="rounded-lg bg-[#c8a951] px-4 py-2 text-sm font-semibold text-[#0a1628] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={sendTenstreetLink}
              disabled={sendingLink || linkSent}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-50"
            >
              {linkSent ? "Tenstreet Link Sent" : sendingLink ? "Sending..." : "Send Tenstreet Link"}
            </button>
            <button
              onClick={() => {
                setDeleteConfirm("");
                setDeleteError("");
                setShowDeleteModal(true);
              }}
              className="ml-auto rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/50"
            >
              Delete Lead
            </button>
          </div>

          {lead.notes && (
            <div className="mt-4 border-t border-gray-700/50 pt-4">
              <h3 className="text-sm font-medium text-gray-400">Notes</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-300">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Right: call log */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Call Log</h2>

          <form onSubmit={logCall} className="space-y-3 rounded-lg border border-gray-700/50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Type</label>
                <select value={callForm.contact_type} onChange={(e) => setCallForm((f) => ({ ...f, contact_type: e.target.value }))} className={inputCls}>
                  {["phone", "text", "email", "voicemail"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Outcome</label>
                <select value={callForm.outcome} onChange={(e) => setCallForm((f) => ({ ...f, outcome: e.target.value }))} className={inputCls}>
                  {["connected", "no_answer", "voicemail", "callback_scheduled", "not_interested", "wrong_number"].map((o) => (
                    <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Callback Date</label>
              <input type="date" value={callForm.callback_date} onChange={(e) => setCallForm((f) => ({ ...f, callback_date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <textarea value={callForm.notes} onChange={(e) => setCallForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls} />
            </div>
            <button type="submit" className="rounded-lg bg-[#c8a951] px-4 py-2 text-sm font-semibold text-[#0a1628]">
              Log Call
            </button>
          </form>

          <div className="space-y-2">
            {calls.length === 0 && <p className="text-sm text-gray-500">No calls logged yet</p>}
            {calls.map((call) => (
              <div key={call.id} className="rounded-lg bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm capitalize text-white">
                    {call.contact_type} &mdash; {call.outcome?.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(call.logged_at).toLocaleString()}</span>
                </div>
                {call.notes && <p className="mt-1 text-sm text-gray-400">{call.notes}</p>}
                {call.callback_date && <p className="mt-1 text-xs text-[#c8a951]">Callback: {call.callback_date}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-red-800 bg-[#111d33] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-red-300">Permanently Delete Lead</h3>
            <p className="mt-2 text-sm text-gray-300">
              This will permanently remove <span className="font-semibold text-white">{lead.full_name}</span> and all associated
              call logs, pipeline events, drip enrollments, and review requests. This action cannot be undone.
            </p>
            <p className="mt-4 text-sm text-gray-400">
              Type <span className="font-mono font-semibold text-red-300">DELETE</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className={inputCls}
              autoFocus
            />
            {deleteError && <p className="mt-2 text-sm text-red-400">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteLead}
                disabled={deleting || deleteConfirm !== "DELETE"}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${color ?? "text-white"}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
