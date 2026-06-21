/**
 * User-defined tags — Roon-inspired tagging system.
 *
 * Users can tag albums and tracks with custom labels (e.g. "Favorites",
 * "Chill", "Workout", "Late Night"). Tags are persisted to localStorage
 * and can be used for filtering and quick-access tiles.
 */

const LS_KEY = 'lumiere:tags:v1'

export interface TagState {
  /** Map of tag name → array of item ids (albums or tracks). */
  tags: Record<string, string[]>
  /** Which items have which tags (reverse index for quick lookup). */
  itemTags: Record<string, string[]>
}

export function loadTags(): TagState {
  if (typeof window === 'undefined') return { tags: {}, itemTags: {} }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { tags: {}, itemTags: {} }
    return JSON.parse(raw) as TagState
  } catch {
    return { tags: {}, itemTags: {} }
  }
}

export function saveTags(state: TagState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('saveTags failed', err)
  }
}

export function clearTags(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LS_KEY)
}

/** Add a tag to an item. Creates the tag if it doesn't exist. */
export function addTag(
  state: TagState,
  tagName: string,
  itemId: string,
): TagState {
  const tag = tagName.trim()
  if (!tag) return state
  const tags = { ...state.tags }
  const itemTags = { ...state.itemTags }

  // Add to tag → items
  if (!tags[tag]) tags[tag] = []
  if (!tags[tag].includes(itemId)) tags[tag] = [...tags[tag], itemId]

  // Add to item → tags
  if (!itemTags[itemId]) itemTags[itemId] = []
  if (!itemTags[itemId].includes(tag))
    itemTags[itemId] = [...itemTags[itemId], tag]

  return { tags, itemTags }
}

/** Remove a tag from an item. Removes the tag entirely if empty. */
export function removeTag(
  state: TagState,
  tagName: string,
  itemId: string,
): TagState {
  const tags = { ...state.tags }
  const itemTags = { ...state.itemTags }

  if (tags[tagName]) {
    tags[tagName] = tags[tagName].filter((id) => id !== itemId)
    if (tags[tagName].length === 0) delete tags[tagName]
  }

  if (itemTags[itemId]) {
    itemTags[itemId] = itemTags[itemId].filter((t) => t !== tagName)
    if (itemTags[itemId].length === 0) delete itemTags[itemId]
  }

  return { tags, itemTags }
}

/** Get all tags for an item. */
export function getItemTags(state: TagState, itemId: string): string[] {
  return state.itemTags[itemId] || []
}

/** Get all tag names. */
export function getAllTags(state: TagState): string[] {
  return Object.keys(state.tags).sort()
}

/** Get all item ids for a tag. */
export function getTagItems(state: TagState, tagName: string): string[] {
  return state.tags[tagName] || []
}
