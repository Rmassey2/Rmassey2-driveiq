"use client";

import { useEffect, useState } from "react";

interface MetaInsights {
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  reach?: string;
  date_start?: string;
  date_stop?: string;
}

interface MetaCampaignRow {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  objective?: string;
  insights: MetaInsights | null;
}

interface MetaResponse {
  campaigns?: MetaCampaignRow[];
  error?: string;
}

export function MetaCampaignOptimizer() {
  const [campaigns, setCampaigns] = useState<MetaCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [radius, setRadius] = useState(200);
  const [ageMin, setAgeMin] = useState(25);
  const [ageMax, setAgeMax] = useState(50);
  const [incomeMin, setIncomeMin] = useState(30000);
  const [incomeMax, setIncomeMax] = useState(75000);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setFetchError(null);
    const res = await fetch("/api/cmo/meta/campaigns");
    const data: MetaResponse = await res.json();
    if (data.error) setFetchError(data.error);
    const list = data.campaigns ?? [];
    setCampaigns(list);
    if (list.length && !selected) setSelected(list[0].id);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOptimize(dryRun: boolean) {
    if (!selected) return;
    setSubmitting(true);
    setResult(null);
    setResultError(null);
    const res = await fetch("/api/cmo/meta/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign_id: selected,
        radius_miles: radius,
        age_min: ageMin,
        age_max: ageMax,
        income_min: incomeMin,
        income_max: incomeMax,
        dry_run: dryRun,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setResultError(data.error ?? "Request failed");
    } else if (data.dry_run) {
      setResult("Dry run logged. Targeting payload saved to Supabase.");
    } else {
      const ok = data.adsets?.filter((a: { ok: boolean }) => a.ok).length ?? 0;
      const total = data.adsets?.length ?? 0;
      setResult(`Updated ${ok}/${total} ad set(s) for campaign ${selected}.`);
    }
    setSubmitting(false);
  }

  const inputCls =
    "mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none";
  const labelCls = "block text-xs font-medium text-gray-400";

  return (
    <div className="rounded-lg bg-[#111d33] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Meta Campaign Optimizer
        </h2>
        <button
          onClick={load}
          className="text-xs text-[#c8a951] hover:underline"
        >
          Refresh
        </button>
      </div>

      {fetchError && (
        <p className="mb-3 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          {fetchError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading Meta campaigns…</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-gray-400">
          No campaigns returned. Add META_ACCESS_TOKEN to enable live data.
        </p>
      ) : (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700/50 text-left text-gray-400">
                <th className="pb-2 pr-3">Campaign</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Clicks (30d)</th>
                <th className="pb-2 pr-3">CPC</th>
                <th className="pb-2 pr-3">CTR</th>
                <th className="pb-2">Spend</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b border-gray-700/30 ${
                    selected === c.id ? "bg-[#0a1628]" : ""
                  } cursor-pointer hover:bg-[#0a1628]`}
                  onClick={() => setSelected(c.id)}
                >
                  <td className="py-2 pr-3 text-white">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={selected === c.id}
                        onChange={() => setSelected(c.id)}
                        className="accent-[#c8a951]"
                      />
                      {c.name}
                    </label>
                  </td>
                  <td className="py-2 pr-3 text-gray-300">
                    {c.effective_status ?? c.status}
                  </td>
                  <td className="py-2 pr-3 text-gray-300">
                    {c.insights?.clicks ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-gray-300">
                    {c.insights?.cpc ? `$${Number(c.insights.cpc).toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-gray-300">
                    {c.insights?.ctr ? `${Number(c.insights.ctr).toFixed(2)}%` : "—"}
                  </td>
                  <td className="py-2 text-gray-300">
                    {c.insights?.spend ? `$${Number(c.insights.spend).toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <label className={labelCls}>Radius (mi)</label>
          <input
            type="number"
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value || "0", 10))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Age Min</label>
          <input
            type="number"
            value={ageMin}
            onChange={(e) => setAgeMin(parseInt(e.target.value || "0", 10))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Age Max</label>
          <input
            type="number"
            value={ageMax}
            onChange={(e) => setAgeMax(parseInt(e.target.value || "0", 10))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Income Min ($)</label>
          <input
            type="number"
            value={incomeMin}
            onChange={(e) => setIncomeMin(parseInt(e.target.value || "0", 10))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Income Max ($)</label>
          <input
            type="number"
            value={incomeMax}
            onChange={(e) => setIncomeMax(parseInt(e.target.value || "0", 10))}
            className={inputCls}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => handleOptimize(false)}
          disabled={submitting || !selected}
          className="rounded-lg bg-[#c8a951] px-4 py-2 text-sm font-semibold text-[#0a1628] hover:bg-[#b8993e] disabled:opacity-50"
        >
          {submitting ? "Applying…" : "Apply Memphis 200mi Targeting"}
        </button>
        <button
          onClick={() => handleOptimize(true)}
          disabled={submitting || !selected}
          className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-[#0a1628] disabled:opacity-50"
        >
          Dry Run
        </button>
      </div>

      {result && (
        <p className="mt-3 rounded-md bg-green-500/10 px-3 py-2 text-xs text-green-300">
          {result}
        </p>
      )}
      {resultError && (
        <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {resultError}
        </p>
      )}
    </div>
  );
}
