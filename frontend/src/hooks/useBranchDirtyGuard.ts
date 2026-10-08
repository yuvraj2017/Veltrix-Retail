import { useEffect, useRef } from 'react'

import { useBranch } from '../context/BranchContext'
import type { BranchDirtyGuardState } from '../lib/branch-guards'

export function useBranchDirtyGuard(id: string, state: BranchDirtyGuardState) {
  const { registerDirtyGuard } = useBranch()
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => registerDirtyGuard(id, () => stateRef.current), [id, registerDirtyGuard])

  useEffect(() => {
    if (!state.dirty) return
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  }, [state.dirty])
}
