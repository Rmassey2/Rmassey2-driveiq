/**
 * Normalize a phone number to a 10-digit US string.
 * Strips all non-digit characters, removes leading 1 for US numbers.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // If 11 digits starting with 1, strip leading 1
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}
