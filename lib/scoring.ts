export function calculateLeadScore(opts: {
  cdlClass?: string | null;
  yearsExperience?: string | null;
  source?: string | null;
  hasHazmat?: boolean;
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

  return score;
}
