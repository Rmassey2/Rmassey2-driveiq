"use client";

import { useState, useEffect, useCallback } from "react";
import type { DriverLead, CallLog, DripEnrollment } from "@/lib/types";

type Tab = "details" | "calls" | "drip";

interface Props {
  lead: DriverLead;
  onClose: () => void;
  onUpdated: () => void;
}

export default function LeadSlideOver({ lead, onClose, onUpdated }: Props) {
  const [tab, setTab] = useState<Tab>("details");
  const [current, setCurrent] = useState(lead);
  const [saving, setSaving] = useState(false);

  // Detail form state
  const [stage, setStage] = useState(lead.pipeline_stage);
  const [disposition, setDisposition] = useState(lead.disposition);
  const [contactLaterDate, setContactLaterDate] = useState(lead.contact_later_date ?? "");
  const [contactLaterReason, setContactLaterReason] = useState(lead.contact_later_reason ?? "");
  const [dnhReason, setDnhReason] = useState("");
  const [dnhConfirm, setDnhConfirm] = useState("");

  // Call log state
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [callForm, setCallForm] = useState({
    contact_type: "phone",
    outcome: "connected",
    callback_date: "",
    notes: "",
  });

  // Drip state
  const [enrollments, setEnrollments] = useState<DripEnrollment[]>([]);

  // Tenstreet link
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(!!lead.tenstreet_link_sent_at);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Test SMS state
  const [testSmsBody, setTestSmsBody] = useState("");
  const [testSmsTo, setTestSmsTo] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: true; sid?: string; to: string } | { ok: false; error: string } | null
  >(null);

  const fetchCalls = useCallback(async () => {
    const res = await fetch(`/api/leads/call-log?lead_id=${lead.id}`);
    if (res.ok) setCalls(await res.json());
  }, [lead.id]);

  const fetchDrip = useCallback(async () => {
    // We don't have a dedicated drip endpoint yet, but show what we have
    setEnrollments([]);
  }, []);

  useEffect(() => {
    fetchCalls();
    fetchDrip();
  }, [fetchCalls, fetchDrip]);

  async function saveDetails() {
    setSaving(true);
    const body: Record<string, unknown> = {
      pipeline_stage: stage,
      disposition,
    };

    if (disposition === "contact_later") {
      body.contact_later_date = contactLaterDate || null;
      body.contact_later_reason = contactLaterReason || null;
    }
    if (disposition === "do_not_hire") {
      body.do_not_hire = true;
      body.dnh_reason = dnhReason;
    }

    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const updated = await res.json();
      setCurrent(updated);
      onUpdated();
    }
    setSaving(false);
  }

  async function logCall(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/leads/call-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driver_lead_id: lead.id,
        ...callForm,
      }),
    });
    if (res.ok) {
      setCallForm({ contact_type: "phone", outcome: "connected", callback_date: "", notes: "" });
      fetchCalls();
    }
  }

  async function deleteLead() {
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      setShowDeleteModal(false);
      setDeleting(false);
      onUpdated();
      onClose();
      return;
    }
    const msg = await res.json().catch(() => ({ error: "Delete failed" }));
    setDeleteError(msg.error ?? "Delete failed");
    setDeleting(false);
  }

  async function sendTestSms() {
    setSendingTest(true);
    setTestResult(null);
    const res = await fetch("/api/leads/test-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: lead.id,
        to: testSmsTo.trim() || undefined,
        message: testSmsBody.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      setTestResult({ ok: true, sid: data.sid, to: data.to });
    } else {
      setTestResult({ ok: false, error: data?.error ?? `HTTP ${res.status}` });
    }
    setSendingTest(false);
  }

  async function sendTenstreetLink() {
    setSendingLink(true);
    const res = await fetch("/api/leads/tenstreet-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: lead.id }),
    });
    if (res.ok) setLinkSent(true);
    setSendingLink(false);
  }

  const inputCls =
    "mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none";
  const labelCls = "block text-sm font-medium text-gray-300";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-[#111d33] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700/50 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">{current.full_name}</h2>
            <p className="text-sm text-gray-400">
              {current.phone} &middot; {current.email ?? "no email"}
            </p>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-white">
            &times;
          </button>
        </div>

        {/* Score & info bar */}
        <div className="flex gap-4 border-b border-gray-700/50 px-6 py-3">
          <div className="text-center">
            <div className={`text-2xl font-bold ${current.lead_score >= 70 ? "text-green-400" : current.lead_score >= 40 ? "text-yellow-400" : "text-red-400"}`}>
              {current.lead_score}
            </div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{current.pipeline_stage}</div>
            <div className="text-xs text-gray-500">Stage</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium capitalize text-white">{current.segment_interest}</div>
            <div className="text-xs text-gray-500">Segment</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-white">{current.cdl_class ?? "—"}</div>
            <div className="text-xs text-gray-500">CDL</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-white">{current.years_experience ?? "—"}</div>
            <div className="text-xs text-gray-500">Experience</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700/50">
          {(["details", "calls", "drip"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-medium capitalize transition ${
                tab === t ? "border-b-2 border-[#c8a951] text-[#c8a951]" : "text-gray-400 hover:text-white"
              }`}
            >
              {t === "calls" ? "Call Log" : t === "drip" ? "Drip Status" : "Details"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "details" && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Pipeline Stage</label>
                <select value={stage} onChange={(e) => setStage(Number(e.target.value))} className={inputCls}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Stage {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Disposition</label>
                <select value={disposition} onChange={(e) => setDisposition(e.target.value)} className={inputCls}>
                  {["active", "considering", "contact_later", "do_not_hire", "withdrew", "archived"].map((d) => (
                    <option key={d} value={d}>
                      {d.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              {disposition === "contact_later" && (
                <>
                  <div>
                    <label className={labelCls}>Contact Later Date</label>
                    <input
                      type="date"
                      value={contactLaterDate}
                      onChange={(e) => setContactLaterDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Reason</label>
                    <input
                      type="text"
                      value={contactLaterReason}
                      onChange={(e) => setContactLaterReason(e.target.value)}
                      className={inputCls}
                    />
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
                    <input
                      type="text"
                      value={dnhReason}
                      onChange={(e) => setDnhReason(e.target.value)}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Type CONFIRM to proceed</label>
                    <input
                      type="text"
                      value={dnhConfirm}
                      onChange={(e) => setDnhConfirm(e.target.value)}
                      className={inputCls}
                    />
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
              </div>

              <button
                onClick={() => {
                  setDeleteConfirm("");
                  setDeleteError("");
                  setShowDeleteModal(true);
                }}
                className="mt-2 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg ring-1 ring-red-400/50 hover:bg-red-700"
              >
                Delete Lead Permanently
              </button>

              {/* Driver info */}
              <div className="mt-6 space-y-2 border-t border-gray-700/50 pt-4">
                <h3 className="text-sm font-medium text-gray-400">Driver Details</h3>
                <InfoRow label="Zip Code" value={current.zip_code} />
                <InfoRow label="Source" value={current.source_channel} />
                <InfoRow label="Entry Point" value={current.entry_point} />
                <InfoRow label="Campaign" value={current.source_campaign} />
                <InfoRow label="UTM Medium" value={current.utm_medium} />
                <InfoRow label="Created" value={current.created_at ? new Date(current.created_at).toLocaleString() : null} />
                <InfoRow label="Tenstreet ID" value={current.tenstreet_applicant_id} />
                {current.notes && (
                  <div>
                    <span className="text-xs text-gray-500">Notes:</span>
                    <p className="whitespace-pre-wrap text-sm text-gray-300">{current.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "calls" && (
            <div className="space-y-6">
              <form onSubmit={logCall} className="space-y-3 rounded-lg border border-gray-700/50 p-4">
                <h3 className="text-sm font-medium text-white">Log New Call</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Contact Type</label>
                    <select
                      value={callForm.contact_type}
                      onChange={(e) => setCallForm((f) => ({ ...f, contact_type: e.target.value }))}
                      className={inputCls}
                    >
                      {["phone", "text", "email", "voicemail"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Outcome</label>
                    <select
                      value={callForm.outcome}
                      onChange={(e) => setCallForm((f) => ({ ...f, outcome: e.target.value }))}
                      className={inputCls}
                    >
                      {["connected", "no_answer", "voicemail", "callback_scheduled", "not_interested", "wrong_number"].map((o) => (
                        <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Callback Date</label>
                  <input
                    type="date"
                    value={callForm.callback_date}
                    onChange={(e) => setCallForm((f) => ({ ...f, callback_date: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea
                    value={callForm.notes}
                    onChange={(e) => setCallForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className={inputCls}
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-[#c8a951] px-4 py-2 text-sm font-semibold text-[#0a1628]"
                >
                  Log Call
                </button>
              </form>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-400">Call History</h3>
                {calls.length === 0 && <p className="text-sm text-gray-500">No calls logged yet</p>}
                {calls.map((call) => (
                  <div key={call.id} className="rounded-lg bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm capitalize text-white">
                        {call.contact_type} &mdash; {call.outcome?.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(call.logged_at).toLocaleString()}
                      </span>
                    </div>
                    {call.notes && <p className="mt-1 text-sm text-gray-400">{call.notes}</p>}
                    {call.callback_date && (
                      <p className="mt-1 text-xs text-[#c8a951]">Callback: {call.callback_date}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "drip" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-700/50 bg-[#0a1628] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Twilio 901 Test SMS</h3>
                  <span className="text-xs text-gray-500">Sends from the 901 local number</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Verifies the 901 Twilio number is provisioned. Defaults to the lead&apos;s phone;
                  override with another number below to send to your own phone instead.
                </p>
                <div className="mt-3 grid gap-2">
                  <div>
                    <label className={labelCls}>Destination (optional)</label>
                    <input
                      type="tel"
                      placeholder={current.phone ?? "10-digit phone"}
                      value={testSmsTo}
                      onChange={(e) => setTestSmsTo(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Message (optional)</label>
                    <textarea
                      rows={2}
                      placeholder="Leave blank to send a default test message."
                      value={testSmsBody}
                      onChange={(e) => setTestSmsBody(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <button
                    onClick={sendTestSms}
                    disabled={sendingTest}
                    className="rounded-lg bg-[#c8a951] px-4 py-2 text-sm font-semibold text-[#0a1628] disabled:opacity-50"
                  >
                    {sendingTest ? "Sending..." : "Send Test SMS via 901"}
                  </button>
                  {testResult?.ok && (
                    <p className="rounded bg-green-500/10 px-3 py-2 text-xs text-green-400">
                      Sent to {testResult.to}
                      {testResult.sid ? ` (SID ${testResult.sid})` : ""}
                    </p>
                  )}
                  {testResult && !testResult.ok && (
                    <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">
                      {testResult.error}
                    </p>
                  )}
                </div>
              </div>

              <h3 className="text-sm font-medium text-gray-400">Drip Enrollment Status</h3>
              {enrollments.length === 0 && (
                <p className="text-sm text-gray-500">
                  {current.cold_flag
                    ? "Driver flagged as cold — no engagement after 3+ messages"
                    : "No active drip enrollments found"}
                </p>
              )}
              {enrollments.map((enr) => (
                <div key={enr.id} className="rounded-lg bg-white/5 p-4">
                  <div className="flex justify-between">
                    <span className="text-sm capitalize text-white">{enr.status}</span>
                    <span className="text-xs text-gray-500">Sent: {enr.messages_sent}</span>
                  </div>
                  {enr.last_sent_at && (
                    <p className="text-xs text-gray-400">
                      Last sent: {new Date(enr.last_sent_at).toLocaleString()}
                    </p>
                  )}
                  {enr.next_send_at && (
                    <p className="text-xs text-[#c8a951]">
                      Next: {new Date(enr.next_send_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-red-700 bg-[#0a1628] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-red-300">Permanently Delete Lead</h3>
            <p className="mt-2 text-sm text-gray-300">
              This will permanently remove <span className="font-semibold text-white">{current.full_name}</span> and all
              associated call logs, pipeline events, drip enrollments, and review requests. This action cannot be undone.
            </p>
            <p className="mt-4 text-sm text-gray-400">
              Type <span className="font-mono font-semibold text-red-300">DELETE</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoFocus
              className="mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
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

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{value ?? "—"}</span>
    </div>
  );
}
