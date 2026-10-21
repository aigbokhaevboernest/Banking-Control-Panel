export type SecondaryAccountType = "checking" | "savings" | "retirement";

const POOL: SecondaryAccountType[] = ["checking", "savings", "retirement"];

/** Same rule as the user app: always 2 secondaries, never the signup type,
 *  business/unknown -> checking + savings. */
export const getSecondaryAccountTypes = (
  accountType: string | null | undefined
): SecondaryAccountType[] => {
  const normalized = (accountType || "").trim().toLowerCase();
  if (POOL.includes(normalized as SecondaryAccountType)) {
    return POOL.filter((t) => t !== normalized);
  }
  return ["checking", "savings"];
};
