/** UI label for wire `pantograph_status` (English enums from API). */
export function pantographLabelRu(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (s === 'raised') return 'поднят'
  if (s === 'lowered') return 'опущен'
  if (s === 'fault') return 'неисправность'
  return raw
}
