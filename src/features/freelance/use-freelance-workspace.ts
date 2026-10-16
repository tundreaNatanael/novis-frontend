import { useOutletContext } from 'react-router'
import type { FreelanceWorkspaceContext } from '@/features/org-workspace/use-org-workspace'

export function useFreelanceWorkspace(): FreelanceWorkspaceContext {
  const context = useOutletContext<FreelanceWorkspaceContext | undefined>()
  if (!context || context.kind !== 'freelance')
    throw new Error('useFreelanceWorkspace used outside the freelance workspace')
  return context
}
