export type ParseOk<T> = { ok: true; value: T }
export type ParseErr = { ok: false; reason: string }

export type ParseResult<T> = ParseOk<T> | ParseErr

export function parseOk<T>(value: T): ParseOk<T> {
  return { ok: true, value }
}

export function parseErr(reason: string): ParseErr {
  return { ok: false, reason }
}
