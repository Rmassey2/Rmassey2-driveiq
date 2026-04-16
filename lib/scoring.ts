export function calculateLeadScore(opts: {
  cdlClass?: string | null;
  yearsExperience?: string | null;
  source?: string | null;
  hasHazmat?: boolean;
  zipCode?: string | null;
}): number {
  let score = 0;

  if (opts.cdlClass?.toUpperCase() === "A") score += 25;
  else if (opts.cdlClass?.toUpperCase() === "B") score += 15;
  else if (opts.cdlClass?.toUpperCase() === "C") score += 10;

  const yrs = opts.yearsExperience?.toLowerCase() ?? "";
  if (yrs.includes("5_plus") || yrs.includes("5+") || yrs.includes("4_5") || yrs.includes("4-5")) {
    score += 20;
  } else if (yrs.includes("2_3") || yrs.includes("2-3")) {
    score += 20;
  }

  if (opts.source?.toLowerCase().includes("referral")) score += 5;
  if (opts.hasHazmat) score += 5;
  if (isMemphisRadiusZip(opts.zipCode)) score += 10;

  return score;
}

// 3-digit ZIP prefixes within roughly 200mi of Memphis, TN.
// Source: USPS ZIP3 areas covering West/Middle TN, N MS, E AR, SE MO, W KY.
const MEMPHIS_ZIP3 = new Set([
  // TN — Memphis, Jackson, Nashville-ish
  "380", "381", "382", "383", "384", "385",
  // MS — north half
  "386", "387", "388", "389",
  // AR — east and central
  "716", "720", "721", "722", "723", "724",
  // MO — bootheel / southeast
  "636", "637", "638", "639",
  // KY — western
  "420", "421", "422", "423", "424", "425", "427",
]);

export function isMemphisRadiusZip(zip?: string | null): boolean {
  if (!zip) return false;
  const prefix = zip.trim().slice(0, 3);
  return MEMPHIS_ZIP3.has(prefix);
}
