import { vi } from 'vitest'

export type MockResult = { data: unknown; error: unknown }

export function makeSupabaseMock(result: MockResult = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const terminal = vi.fn().mockResolvedValue(result)

  const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'is', 'order', 'limit', 'match']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain['single'] = terminal
  // Make the chain itself thenable (for queries that don't call .single())
  ;(chain as Record<string, unknown>)['then'] = (resolve: (v: MockResult) => void) => Promise.resolve(result).then(resolve)

  const from = vi.fn().mockReturnValue(chain)
  return { from, chain, terminal }
}
