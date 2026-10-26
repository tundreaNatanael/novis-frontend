import { createContext, useContext } from 'react'
import type { TeachSheetRequest } from './sheet-types'

export interface TeachSheets {
  /** Opens a sheet; one open already is replaced (Finish lesson hands over to Assign homework). */
  open: (request: TeachSheetRequest) => void
  close: () => void
}

export const TeachSheetsContext = createContext<TeachSheets | null>(null)

export function useTeachSheets(): TeachSheets {
  const context = useContext(TeachSheetsContext)
  if (!context) throw new Error('useTeachSheets must be used inside <TeachSheetsProvider>')
  return context
}
