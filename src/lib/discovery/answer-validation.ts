
/**
 * A model answer is safe to present as evidence-referenced only when it
 * includes at least one unique reference and every reference belongs to
 * the evidence supplied to the model.
 *
 * This validates reference IDs only. It does not prove that a cited source
 * supports a particular claim or that the source is authentic.
 */
export function hasValidEvidenceReferences(
  references: unknown,
  allowedIds: ReadonlySet<string>,
): references is string[] {
  if (!Array.isArray(references) || references.length === 0) {
    return false;
  }

  const seen = new Set<string>();

  for (const id of references) {
    if (
      typeof id !== "string" ||
      id.trim().length === 0 ||
      !allowedIds.has(id) ||
      seen.has(id)
    ) {
      return false;
    }

    seen.add(id);
  }

  return true;
}
