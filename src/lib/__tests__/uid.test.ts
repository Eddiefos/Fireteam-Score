import { describe, it, expect } from 'vitest'
import { uid, hashCode } from '../uid'

describe('uid', () => {
  it('returns a string', () => {
    expect(typeof uid()).toBe('string')
  })
  it('is at least 8 characters', () => {
    expect(uid().length).toBeGreaterThanOrEqual(8)
  })
  it('produces unique values', () => {
    expect(uid()).not.toBe(uid())
  })
})

describe('hashCode', () => {
  it('returns a number', () => {
    expect(typeof hashCode('hello')).toBe('number')
  })
  it('returns the same value for the same input', () => {
    expect(hashCode('abc')).toBe(hashCode('abc'))
  })
  it('returns different values for different inputs', () => {
    expect(hashCode('abc')).not.toBe(hashCode('xyz'))
  })
})
