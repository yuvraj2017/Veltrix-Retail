import { useCallback, useEffect, useRef } from 'react'

import { useBranch } from '../context/BranchContext'

export type BranchOperationSnapshot = {
  branchId: number
  generation: number
}

export function useBranchOperation() {
  const { selectedBranchId, branchGeneration } = useBranch()
  const currentRef = useRef({ selectedBranchId, branchGeneration })

  useEffect(() => {
    currentRef.current = { selectedBranchId, branchGeneration }
  }, [branchGeneration, selectedBranchId])

  const captureBranchOperation = useCallback((): BranchOperationSnapshot => {
    if (!currentRef.current.selectedBranchId) throw new Error('No active branch is selected.')
    return {
      branchId: currentRef.current.selectedBranchId,
      generation: currentRef.current.branchGeneration,
    }
  }, [])

  const isCurrentBranchOperation = useCallback((snapshot: BranchOperationSnapshot) => (
    snapshot.branchId === currentRef.current.selectedBranchId &&
    snapshot.generation === currentRef.current.branchGeneration
  ), [])

  return { captureBranchOperation, isCurrentBranchOperation }
}
