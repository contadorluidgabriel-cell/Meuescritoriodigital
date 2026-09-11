import { useCallback, useMemo } from 'react'
import ObligationsWorkspace from './ObligationsWorkspace.jsx'

export default function ObligationsWorkspaceEntry(props) {
  const { office, update, access } = props
  const adaptedOffice = useMemo(() => ({
    ...office,
    obligationModels: Array.isArray(office?.settings?.obligationModels) ? office.settings.obligationModels : [],
  }), [office])

  const adaptedUpdate = useCallback(recipe => update(draft => {
    if (!draft.settings || typeof draft.settings !== 'object' || Array.isArray(draft.settings)) draft.settings = {}
    draft.obligationModels = structuredClone(Array.isArray(draft.settings.obligationModels) ? draft.settings.obligationModels : [])
    recipe(draft)
    draft.settings.obligationModels = structuredClone(Array.isArray(draft.obligationModels) ? draft.obligationModels : [])
    delete draft.obligationModels
  }), [update])

  const adaptedAccess = useMemo(() => {
    if (access?.membership?.role !== 'collaborator') return access
    return { ...access, membership: { ...access.membership, role: 'partner' } }
  }, [access])

  return <ObligationsWorkspace {...props} office={adaptedOffice} update={adaptedUpdate} access={adaptedAccess} />
}
