export type BranchDirtyGuardState = {
  dirty: boolean
  label: string
  message?: string
  discard: () => void | Promise<void>
  saveDraft?: () => void | Promise<void>
}

export type BranchDirtyGuardReader = () => BranchDirtyGuardState

export class BranchDirtyGuardRegistry {
  private readonly readers = new Map<string, BranchDirtyGuardReader>()

  register(id: string, reader: BranchDirtyGuardReader) {
    this.readers.set(id, reader)
    return () => {
      if (this.readers.get(id) === reader) this.readers.delete(id)
    }
  }

  getDirtyGuards() {
    return [...this.readers.values()]
      .map((reader) => reader())
      .filter((guard) => guard.dirty)
  }

  hasDirtyGuards() {
    return this.getDirtyGuards().length > 0
  }
}
