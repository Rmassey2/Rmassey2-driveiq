const GRAPH_BASE = "https://graph.facebook.com";

function apiVersion() {
  return process.env.META_GRAPH_API_VERSION || "v19.0";
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function token() {
  return requireEnv("META_ACCESS_TOKEN");
}

function adAccountId() {
  return requireEnv("META_AD_ACCOUNT_ID");
}

async function graph<T = unknown>(
  method: "GET" | "POST",
  path: string,
  params: Record<string, string | number | boolean | object> = {}
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${apiVersion()}/${path.replace(/^\//, "")}`);
  const isGet = method === "GET";
  const qs = new URLSearchParams();
  qs.set("access_token", token());

  if (isGet) {
    for (const [k, v] of Object.entries(params)) {
      qs.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    url.search = qs.toString();
    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    return handle<T>(res);
  }

  const form = new URLSearchParams();
  form.set("access_token", token());
  for (const [k, v] of Object.entries(params)) {
    form.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });
  return handle<T>(res);
}

async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (json as { error?: { message?: string } })?.error?.message ||
      `Meta API ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  effective_status?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  targeting?: Record<string, unknown>;
}

export interface MetaInsights {
  campaign_id?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  reach?: string;
  date_start?: string;
  date_stop?: string;
}

export async function listCampaigns(): Promise<MetaCampaign[]> {
  const res = await graph<{ data: MetaCampaign[] }>(
    "GET",
    `${adAccountId()}/campaigns`,
    { fields: "id,name,status,objective,effective_status", limit: 50 }
  );
  return res.data ?? [];
}

export async function listAdSets(campaignId: string): Promise<MetaAdSet[]> {
  const res = await graph<{ data: MetaAdSet[] }>(
    "GET",
    `${campaignId}/adsets`,
    { fields: "id,name,campaign_id,status,targeting", limit: 50 }
  );
  return res.data ?? [];
}

export async function getCampaignInsights(
  campaignId: string,
  datePreset: "last_7d" | "last_14d" | "last_30d" | "lifetime" = "last_30d"
): Promise<MetaInsights | null> {
  const res = await graph<{ data: MetaInsights[] }>(
    "GET",
    `${campaignId}/insights`,
    {
      fields: "campaign_id,impressions,clicks,spend,ctr,cpc,reach,date_start,date_stop",
      date_preset: datePreset,
    }
  );
  return res.data?.[0] ?? null;
}

// Memphis, TN — coordinates used as the center of the 200-mile radius.
export const MEMPHIS_GEO = {
  latitude: 35.1495,
  longitude: -90.049,
  name: "Memphis, TN",
};

export interface MemphisTargetingInput {
  radiusMiles?: number; // default 200
  ageMin?: number; // default 25
  ageMax?: number; // default 50
  incomeMin?: number; // default 30000
  incomeMax?: number; // default 75000
}

export function buildMemphisRadiusTargeting(input: MemphisTargetingInput = {}) {
  const radius = input.radiusMiles ?? 200;
  const ageMin = input.ageMin ?? 25;
  const ageMax = input.ageMax ?? 50;
  const incomeMin = input.incomeMin ?? 30000;
  const incomeMax = input.incomeMax ?? 75000;

  return {
    age_min: ageMin,
    age_max: ageMax,
    geo_locations: {
      custom_locations: [
        {
          latitude: MEMPHIS_GEO.latitude,
          longitude: MEMPHIS_GEO.longitude,
          radius,
          distance_unit: "mile",
          name: MEMPHIS_GEO.name,
        },
      ],
      location_types: ["home", "recent"],
    },
    targeting_automation: { advantage_audience: 0 },
    // Household income bracket — Meta uses pre-defined flexible_spec entries.
    // These targeting IDs map to "Top 25%-50% of ZIP codes" etc. We expose
    // min/max dollars in the payload so the snapshot row captures intent even
    // though Meta only exposes bracketed income targeting.
    flexible_spec: [
      {
        income: [
          {
            name: `Household income: $${incomeMin.toLocaleString()} - $${incomeMax.toLocaleString()}`,
            min: incomeMin,
            max: incomeMax,
          },
        ],
      },
    ],
  };
}

export async function updateAdSetTargeting(
  adSetId: string,
  targeting: Record<string, unknown>
) {
  return graph<{ success: boolean }>("POST", adSetId, { targeting });
}
