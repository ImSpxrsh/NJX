export interface FamilyChallengeMatrixProvider {
  createPrintablePair(householdId: string): Promise<never>;
}

// P1 boundary only. An implementation must use direct CSPRNG word pairs,
// keep values away from language models and logs, and never let AI judge them.
