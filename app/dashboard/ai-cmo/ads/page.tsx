"use client";

import { useEffect, useState } from "react";

interface AdResult {
  headline: string;
  body: string;
  cta: string;
  targeting_suggestion: string;
}

interface Campaign {
  id: string;
  campaign_name: string;
  segment: string | null;
  ad_copy_headline: string | null;
  ad_copy_body: string | null;
  cta_text: string | null;
  target_audience: string | null;
  status: string;
  platform: string | null;
  apply_link: string | null;
  ai_generated: boolean | null;
  created_at: string;
}

const SEGMENTS = ["OTR", "Regional", "Local", "Dedicated", "Owner-Op"];
const AD_TYPES = [
  "Job Opening",
  "Referral Bonus",
  "Equipment Highlight",
  "Benefits",
  "Culture",
];

export default function AdStudioPage() {
  const [segment, setSegment] = useState("OTR");
  const [adType, setAdType] = useState("Job Opening");
  const [generating, setGenerating] = useState(false);
  const [adResult, setAdResult] = useState<AdResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadCampaigns() {
    const res = await fetch("/api/cmo/campaigns");
    if (res.ok) setCampaigns(await res.json());
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setAdResult(null);

    const res = await fetch("/api/cmo/generate-ad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segment, ad_type: adType }),
    });

    if (res.ok) {
      const data: AdResult = await res.json();
      setAdResult(data);
      loadCampaigns();
    } else {
      const err = await res.json();
      setError(err.error ?? "Generation failed");
    }
    setGenerating(false);
  }

  async function handleApprove() {
    if (!adResult) return;
    setSaving(true);
    // Find the most recent draft campaign and approve it
    const draft = campaigns.find((c) => c.status === "draft");
    if (draft) {
      await fetch(`/api/cmo/campaigns/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      loadCampaigns();
    }
    setSaving(false);
    setAdResult(null);
  }

  const selectCls =
    "mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none";
  const labelCls = "block text-sm font-medium text-gray-300";

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">AI Ad Studio</h1>

      {/* Controls */}
      <div className="rounded-lg bg-[#111d33] p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Segment</label>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className={selectCls}
            >
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Ad Type</label>
            <select
              value={adType}
              onChange={(e) => setAdType(e.target.value)}
              className={selectCls}
            >
              {AD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full rounded-lg bg-[#c8a951] px-4 py-2 font-semibold text-[#0a1628] hover:bg-[#b8993e] disabled:opacity-50"
            >
              {generating ? "Generating…" : "Generate Ad"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Ad Preview */}
      {adResult && (
        <div className="rounded-lg border border-gray-700/50 bg-[#111d33] p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Facebook Ad Preview
          </h2>
          <div className="rounded-lg bg-white p-4 text-black">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-[#c8a951]" />
              <div>
                <p className="text-sm font-bold">Maco Transport</p>
                <p className="text-xs text-gray-500">Sponsored</p>
              </div>
            </div>
            <p className="mb-2 text-sm">{adResult.body}</p>
            <div className="rounded-md bg-gray-100 p-3">
              <p className="text-lg font-bold">{adResult.headline}</p>
              <p className="text-xs text-gray-500">driveformaco.com</p>
            </div>
            <button className="mt-2 w-full rounded-md bg-blue-600 py-2 text-sm font-semibold text-white">
              {adResult.cta}
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-400">
            <span className="font-medium text-gray-300">
              Targeting Suggestion:
            </span>{" "}
            {adResult.targeting_suggestion}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleApprove}
              disabled={saving}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Approve & Save"}
            </button>
            <button
              onClick={() => setAdResult(null)}
              className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Campaign List */}
      <div className="rounded-lg bg-[#111d33] p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Campaigns</h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-gray-400">
            No campaigns yet. Generate your first ad above.
          </p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-gray-700/50 bg-[#0a1628] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{c.campaign_name}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {c.segment ?? "—"} · {c.platform ?? "—"} ·{" "}
                      {c.ai_generated ? "AI-generated" : "Manual"} ·{" "}
                      {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status === "approved"
                        ? "bg-green-500/10 text-green-400"
                        : c.status === "draft"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                {c.ad_copy_headline && (
                  <p className="mt-2 font-medium text-white">{c.ad_copy_headline}</p>
                )}
                {c.ad_copy_body && (
                  <p className="mt-1 text-sm text-gray-300">{c.ad_copy_body}</p>
                )}
                {c.cta_text && (
                  <p className="mt-2 text-xs">
                    <span className="text-gray-500">CTA:</span>{" "}
                    <span className="text-[#c8a951] font-medium">{c.cta_text}</span>
                  </p>
                )}
                {c.target_audience && (
                  <p className="mt-1 text-xs text-gray-400">
                    <span className="text-gray-500">Target:</span> {c.target_audience}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
