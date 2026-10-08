import type { QueryKey } from '@tanstack/react-query'

export function branchQueryKey(
  branchId: number | null,
  domain: string,
  ...parts: readonly unknown[]
): QueryKey {
  return ['branch', branchId, domain, ...parts]
}

export function branchQueryPrefix(branchId: number | null, domain?: string): QueryKey {
  return domain ? ['branch', branchId, domain] : ['branch', branchId]
}
