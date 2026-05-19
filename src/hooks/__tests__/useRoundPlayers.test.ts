import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../services/roundPlayers', () => ({
  getRoundPlayers: vi.fn().mockResolvedValue([]),
}))

import * as rpService from '../../services/roundPlayers'
import { useRoundPlayers } from '../useRoundPlayers'

beforeEach(() => vi.clearAllMocks())

describe('useRoundPlayers', () => {
  it('loads players for a round', async () => {
    const mockPlayer = {
      id: 'rp1', roundId: 'r1', userId: 'u1', guestName: null,
      displayName: 'Edvard', initials: 'EF', color: '#FF6B1F', isGuest: false,
    }
    vi.mocked(rpService.getRoundPlayers).mockResolvedValue([mockPlayer])

    const { result } = renderHook(() => useRoundPlayers('r1'))
    expect(result.current.loading).toBe(true)

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.players).toHaveLength(1)
    expect(result.current.players[0].displayName).toBe('Edvard')
  })

  it('does nothing when roundId is undefined', async () => {
    const { result } = renderHook(() => useRoundPlayers(undefined))
    await act(async () => {})
    expect(result.current.players).toHaveLength(0)
    expect(rpService.getRoundPlayers).not.toHaveBeenCalled()
  })
})
