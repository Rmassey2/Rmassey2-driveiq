"use client";

import { useState } from "react";

interface ImportResult {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  dnh_blocked?: number;
  skip_reasons?: Record<string, number>;
  detected_columns?: string[];
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/leads/import", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Import failed");
      setLoading(false);
      return;
    }

    setResult(await res.json());
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Import from Tenstreet</h1>
      <p className="text-sm text-gray-400">
        Upload a CSV or Excel (.xlsx/.xls) export from Tenstreet. Duplicates are detected by Applicant ID,
        phone, email, or CDL number. DNH-flagged drivers are automatically blocked.
      </p>

      {/* Accepted columns */}
      <div className="rounded-lg border border-gray-700/50 bg-[#111d33] p-4">
        <h2 className="mb-2 text-sm font-semibold text-[#c8a951]">Accepted Column Names</h2>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <div className="flex justify-between border-b border-gray-700/30 py-1">
            <span className="text-gray-400">Driver name</span>
            <span className="font-mono text-gray-300">Name</span>
          </div>
          <div className="flex justify-between border-b border-gray-700/30 py-1">
            <span className="text-gray-400">or split as</span>
            <span className="font-mono text-gray-300">First Name, Last Name</span>
          </div>
          <div className="flex justify-between border-b border-gray-700/30 py-1">
            <span className="text-gray-400">Phone</span>
            <span className="font-mono text-gray-300">Phone, Pri Phone</span>
          </div>
          <div className="flex justify-between border-b border-gray-700/30 py-1">
            <span className="text-gray-400">Email</span>
            <span className="font-mono text-gray-300">Email</span>
          </div>
          <div className="flex justify-between border-b border-gray-700/30 py-1">
            <span className="text-gray-400">Applicant ID</span>
            <span className="font-mono text-gray-300">Applicant ID</span>
          </div>
          <div className="flex justify-between border-b border-gray-700/30 py-1">
            <span className="text-gray-400">Status</span>
            <span className="font-mono text-gray-300">Status</span>
          </div>
          <div className="flex justify-between border-b border-gray-700/30 py-1">
            <span className="text-gray-400">Source</span>
            <span className="font-mono text-gray-300">Source</span>
          </div>
          <div className="flex justify-between border-b border-gray-700/30 py-1">
            <span className="text-gray-400">CDL</span>
            <span className="font-mono text-gray-300">CDL Number, CDL</span>
          </div>
          <div className="flex justify-between border-b border-gray-700/30 py-1">
            <span className="text-gray-400">Segment</span>
            <span className="font-mono text-gray-300">Worklist</span>
          </div>
          <div className="flex justify-between border-b border-gray-700/30 py-1">
            <span className="text-gray-400">Recruiter</span>
            <span className="font-mono text-gray-300">Recruiter</span>
          </div>
          <div className="flex justify-between border-b border-gray-700/30 py-1">
            <span className="text-gray-400">Date of birth</span>
            <span className="font-mono text-gray-300">DOB</span>
          </div>
          <div className="flex justify-between border-b border-gray-700/30 py-1">
            <span className="text-gray-400">Date applied</span>
            <span className="font-mono text-gray-300">Last App Date</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          &quot;Name&quot; column expects Last, First format. Status maps: Recruiting/Attempting to contact/Wants Local → active, No Response → cold flag.
          Worklist maps: Owner Operator/Contractor for Owner Operator → Owner-Op.
        </p>
      </div>

      <form onSubmit={handleUpload} className="space-y-4">
        <div className="rounded-lg border-2 border-dashed border-gray-600 p-8 text-center">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-400"
          />
          {file && <p className="mt-2 text-sm text-gray-300">{file.name}</p>}
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className="rounded-lg bg-[#c8a951] px-6 py-2 text-sm font-semibold text-[#0a1628] disabled:opacity-50"
        >
          {loading ? "Importing..." : "Upload & Import"}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {result && (
        <div className="rounded-lg border border-gray-700/50 bg-[#111d33] p-6 space-y-2">
          <h2 className="text-lg font-semibold text-white">Import Complete</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Records Processed:</span>
              <span className="ml-2 font-bold text-white">{result.processed}</span>
            </div>
            <div>
              <span className="text-gray-400">Created:</span>
              <span className="ml-2 font-bold text-green-400">{result.created}</span>
            </div>
            <div>
              <span className="text-gray-400">Updated:</span>
              <span className="ml-2 font-bold text-yellow-400">{result.updated}</span>
            </div>
            <div>
              <span className="text-gray-400">Skipped:</span>
              <span className="ml-2 font-bold text-gray-400">{result.skipped}</span>
            </div>
            {(result.dnh_blocked ?? 0) > 0 && (
              <div>
                <span className="text-gray-400">DNH Blocked:</span>
                <span className="ml-2 font-bold text-red-400">{result.dnh_blocked}</span>
              </div>
            )}
          </div>

          {result.detected_columns && result.detected_columns.length > 0 && (
            <div className="mt-3 border-t border-gray-700/50 pt-3">
              <p className="text-xs text-gray-400">
                Detected columns: <span className="font-mono text-gray-300">{result.detected_columns.join(", ")}</span>
              </p>
            </div>
          )}

          {result.skip_reasons && Object.keys(result.skip_reasons).length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-yellow-400">Skip reasons:</p>
              {Object.entries(result.skip_reasons).map(([reason, count]) => (
                <p key={reason} className="text-xs text-gray-400">
                  {reason.replace(/_/g, " ")}: <span className="text-white">{count}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
