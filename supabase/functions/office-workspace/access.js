import * as legacy from './accessFinanceV2.js'
import {
  applyInternalV2Patch,
  defaultInternalV2Permissions,
  filterInternalV2Payload,
  internalV2CanManageTeam,
  internalV2Permissions,
  isInternalV2Membership,
  isOwnerMembership,
} from './accessInternalV2.js'

export const ROLE_ADMIN = legacy.ROLE_ADMIN
export const ROLE_COLLABORATOR = legacy.ROLE_COLLABORATOR
export const ROLE_PARTNER = legacy.ROLE_PARTNER
export const DEFAULT_PERMISSIONS = legacy.DEFAULT_PERMISSIONS
export { defaultInternalV2Permissions, isInternalV2Membership, isOwnerMembership }

export function permissionsFor(membership = {}) {
  if (isOwnerMembership(membership)) return legacy.permissionsFor(membership)
  if (isInternalV2Membership(membership)) return internalV2Permissions(membership)
  return legacy.permissionsFor(membership)
}

export function filterPayloadForMembership(payload = {}, membership = {}) {
  if (isOwnerMembership(membership)) return legacy.filterPayloadForMembership(payload, membership)
  if (isInternalV2Membership(membership)) return filterInternalV2Payload(payload, membership)
  return legacy.filterPayloadForMembership(payload, membership)
}

export function applyOfficePatch(fullPayload = {}, patch = {}, membership = {}) {
  if (isOwnerMembership(membership)) return legacy.applyOfficePatch(fullPayload, patch, membership)
  if (isInternalV2Membership(membership)) return applyInternalV2Patch(fullPayload, patch, membership)
  return legacy.applyOfficePatch(fullPayload, patch, membership)
}

export function memberCanSeeTeam(membership = {}) {
  if (isOwnerMembership(membership)) return true
  if (isInternalV2Membership(membership)) return internalV2CanManageTeam(membership)
  return legacy.memberCanSeeTeam(membership)
}

export const clientPartnerIds = legacy.clientPartnerIds
export const partnerCanAccessWork = legacy.partnerCanAccessWork
