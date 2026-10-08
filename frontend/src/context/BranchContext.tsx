import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'

import { getAccessibleBranches, getActiveBranchDetails } from '../features/branches/api'
import type { AccessibleBranch, ActiveBranchDetails } from '../features/branches/types'
import { getApiErrorMessage } from '../lib/api-error'
import {
  getPendingBranchMutationCount,
  setActiveBranchId,
  subscribeToBranchMutations,
  subscribeToInvalidBranch,
} from '../lib/branch-runtime'
import {
  clearStoredBranchId,
  getStoredBranchId,
  saveStoredBranchId,
} from '../lib/branch-session'
import { branchQueryPrefix } from '../lib/branch-query-keys'
import { queryClient } from '../lib/queryClient'
import { useAuth } from './AuthContext'

type BranchContextValue = {
  branches: AccessibleBranch[]
  selectedBranch: AccessibleBranch | null
  selectedBranchId: number | null
  activeShop: ActiveBranchDetails | null
  branchLoading: boolean
  branchError: string
  branchGeneration: number
  isSwitching: boolean
  switchBlocked: boolean
  switchBranch: (branchId: number) => Promise<void>
  refreshBranches: () => Promise<void>
}

const BranchContext = createContext<BranchContextValue | null>(null)

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user, token, loading: authLoading, isSuperAdmin } = useAuth()
  const [branches, setBranches] = useState<AccessibleBranch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null)
  const [activeShop, setActiveShop] = useState<ActiveBranchDetails | null>(null)
  const [branchLoading, setBranchLoading] = useState(false)
  const [hasLoadedBranches, setHasLoadedBranches] = useState(false)
  const [branchError, setBranchError] = useState('')
  const [branchGeneration, setBranchGeneration] = useState(0)
  const [isSwitching, setIsSwitching] = useState(false)
  const pendingMutations = useSyncExternalStore(
    subscribeToBranchMutations,
    getPendingBranchMutationCount,
    getPendingBranchMutationCount,
  )

  const userId = user?.id ?? null
  const organizationId = user?.organization_id ?? null

  const applySelection = useCallback((branch: AccessibleBranch, details: ActiveBranchDetails) => {
    if (!userId || !organizationId) return
    setActiveBranchId(branch.id)
    saveStoredBranchId(userId, organizationId, branch.id)
    setActiveShop(details)
    setSelectedBranchId(branch.id)
  }, [organizationId, userId])

  const loadBranches = useCallback(async () => {
    if (!token || !userId || !organizationId || isSuperAdmin) {
      setActiveBranchId(null)
      setBranches([])
      setSelectedBranchId(null)
      setActiveShop(null)
      setBranchError('')
      setBranchLoading(false)
      setHasLoadedBranches(true)
      return
    }

    setBranchLoading(true)
    setBranchError('')
    const storedBranchId = getStoredBranchId(userId, organizationId)
    const candidateBranchId = selectedBranchId ?? storedBranchId

    try {
      let accessible: AccessibleBranch[]
      try {
        accessible = await getAccessibleBranches(candidateBranchId)
      } catch (error) {
        if (!candidateBranchId) throw error
        setActiveBranchId(null)
        clearStoredBranchId(userId, organizationId)
        accessible = await getAccessibleBranches()
      }

      const activeBranches = accessible.filter((branch) => branch.status === 'active')
      setBranches(activeBranches)

      const selected =
        activeBranches.find((branch) => branch.id === candidateBranchId) ??
        activeBranches.find((branch) => branch.id === user?.shop_id) ??
        activeBranches.find((branch) => branch.is_default_branch) ??
        activeBranches[0] ??
        null

      if (selected) {
        const details = await getActiveBranchDetails(selected.id)
        if (details.id !== selected.id || details.organization_id !== organizationId || details.status !== 'active') {
          throw new Error('The selected branch profile is inconsistent or unavailable.')
        }
        applySelection(selected, details)
      } else {
        setActiveBranchId(null)
        clearStoredBranchId(userId, organizationId)
        setSelectedBranchId(null)
        setActiveShop(null)
      }
    } catch (error) {
      setActiveBranchId(null)
      clearStoredBranchId(userId, organizationId)
      setBranches([])
      setSelectedBranchId(null)
      setActiveShop(null)
      setBranchError(getApiErrorMessage(error, 'Unable to load your branch access.'))
    } finally {
      setBranchLoading(false)
      setHasLoadedBranches(true)
    }
  }, [applySelection, isSuperAdmin, organizationId, selectedBranchId, token, user?.shop_id, userId])

  useEffect(() => {
    setActiveBranchId(null)
    setBranches([])
    setSelectedBranchId(null)
    setActiveShop(null)
    setHasLoadedBranches(false)
    if (!authLoading) void loadBranches()
  }, [authLoading, isSuperAdmin, organizationId, token, userId])

  useEffect(() => subscribeToInvalidBranch(() => {
    void loadBranches()
  }), [loadBranches])

  const switchBranch = useCallback(async (branchId: number) => {
    const nextBranch = branches.find((branch) => branch.id === branchId && branch.status === 'active')
    if (!nextBranch) throw new Error('This branch is no longer available.')
    if (branchId === selectedBranchId) return
    if (getPendingBranchMutationCount() > 0) {
      throw new Error('Wait for the current operation to finish before switching branches.')
    }

    setIsSwitching(true)
    try {
      const previousBranchId = selectedBranchId
      if (previousBranchId) {
        await queryClient.cancelQueries({ queryKey: branchQueryPrefix(previousBranchId) })
      }
      const details = await getActiveBranchDetails(nextBranch.id)
      if (details.id !== nextBranch.id || details.organization_id !== organizationId || details.status !== 'active') {
        throw new Error('The selected branch profile is inconsistent or unavailable.')
      }
      applySelection(nextBranch, details)
      setBranchGeneration((generation) => generation + 1)
      await queryClient.invalidateQueries({ queryKey: branchQueryPrefix(branchId) })
    } finally {
      setIsSwitching(false)
    }
  }, [applySelection, branches, organizationId, selectedBranchId])

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  )

  const value = useMemo<BranchContextValue>(() => ({
    branches,
    selectedBranch,
    selectedBranchId,
    activeShop,
    branchLoading: authLoading || branchLoading || !hasLoadedBranches,
    branchError,
    branchGeneration,
    isSwitching,
    switchBlocked: pendingMutations > 0,
    switchBranch,
    refreshBranches: loadBranches,
  }), [
    authLoading,
    activeShop,
    branchError,
    branchGeneration,
    branchLoading,
    hasLoadedBranches,
    branches,
    isSwitching,
    loadBranches,
    pendingMutations,
    selectedBranch,
    selectedBranchId,
    switchBranch,
  ])

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function useBranch() {
  const context = useContext(BranchContext)
  if (!context) throw new Error('useBranch must be used inside BranchProvider')
  return context
}
