"use client";

import { useState } from "react";

interface ImportResult {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
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
        Upload a CSV file from Tenstreet. Expected columns: First Name, Last Name, Phone, Email,
        Applicant ID, Status, Date Applied, Source.
      </p>

      <form onSubmit={handleUpload} className="space-y-4">
        <div className="rounded-lg border-2 border-dashed border-gray-600 p-8 text-center">
          <input
            type="file"
            accept=".csv"
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
          </div>
        </div>
      )}
    </div>
  );
}
