export type TagRelation = {
  parentTagId: string
  childTagId: string
}

/**
 * Builds a map from child tag ID to the implied parent tag IDs.
 * When an article matches a child tag, all implied parent tags are also added.
 */
export function buildImpliedTagIdsByChild(relations: TagRelation[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const relation of relations) {
    const existing = map.get(relation.childTagId) ?? []
    existing.push(relation.parentTagId)
    map.set(relation.childTagId, existing)
  }
  return map
}
