import {
  approveUser,
  disableUser,
  reactivateUser,
  rejectUser,
  suspendUser,
} from '../../features/admin/api'
import type { AdminUserAction, UserStatus } from '../../features/admin/types'

/**
 * One place describing every account action: its label, its confirmation copy,
 * whether it needs a reason, and which API call it makes.
 *
 * Which actions are *offered* is decided by the server, not here: each user
 * payload carries `allowed_transitions`, and this maps those target states onto
 * actions. The server re-validates the transition anyway, so the UI can never
 * offer something that would be accepted when it shouldn't be.
 */

export type AdminActionDescriptor = {
  action: AdminUserAction
  label: string
  /** Present tense, used in the confirmation dialog title. */
  title: string
  description: (name: string) => string
  confirmLabel: string
  /** High-impact actions get a red confirm button. */
  destructive: boolean
  /** Whether the dialog collects an administrator note. */
  collectsReason: boolean
  reasonLabel?: string
  run: (userId: number, reason?: string) => Promise<unknown>
}

export const ADMIN_ACTIONS: Record<AdminUserAction, AdminActionDescriptor> = {
  approve: {
    action: 'approve',
    label: 'Approve',
    title: 'Approve this account?',
    description: (name) =>
      `${name} will be able to sign in immediately and use the application normally.`,
    confirmLabel: 'Approve User',
    destructive: false,
    collectsReason: false,
    run: (userId) => approveUser(userId),
  },
  reject: {
    action: 'reject',
    label: 'Reject',
    title: 'Reject this registration?',
    description: (name) =>
      `${name} will not be able to sign in. This is permanent and cannot be undone from this screen.`,
    confirmLabel: 'Reject User',
    destructive: true,
    collectsReason: true,
    reasonLabel: 'Reason for rejection (administrators only)',
    run: (userId, reason) => rejectUser(userId, reason),
  },
  suspend: {
    action: 'suspend',
    label: 'Suspend',
    title: 'Suspend this account?',
    description: (name) =>
      `${name} will lose access on their very next request, even if they are signed in right now. You can reactivate them later.`,
    confirmLabel: 'Suspend User',
    destructive: true,
    collectsReason: true,
    reasonLabel: 'Reason for suspension (administrators only)',
    run: (userId, reason) => suspendUser(userId, reason),
  },
  reactivate: {
    action: 'reactivate',
    label: 'Reactivate',
    title: 'Reactivate this account?',
    description: (name) =>
      `${name} will regain full access and be able to sign in again.`,
    confirmLabel: 'Reactivate User',
    destructive: false,
    collectsReason: false,
    run: (userId) => reactivateUser(userId),
  },
  disable: {
    action: 'disable',
    label: 'Disable',
    title: 'Disable this account?',
    description: (name) =>
      `${name} will permanently lose access. This is not reversible from this screen.`,
    confirmLabel: 'Disable User',
    destructive: true,
    collectsReason: true,
    reasonLabel: 'Reason for disabling (administrators only)',
    run: (userId, reason) => disableUser(userId, reason),
  },
}

/**
 * Turn the server's `allowed_transitions` into the actions to render.
 *
 * ACTIVE is reachable from two different states and means two different things:
 * approving a pending signup, or reactivating a suspended one. The current
 * status disambiguates.
 */
export function actionsForUser(
  status: UserStatus | string,
  allowedTransitions: (UserStatus | string)[],
): AdminActionDescriptor[] {
  const current = String(status || '').toLowerCase()

  return allowedTransitions
    .map((target) => {
      switch (String(target).toLowerCase()) {
        case 'active':
          return current === 'pending'
            ? ADMIN_ACTIONS.approve
            : ADMIN_ACTIONS.reactivate
        case 'rejected':
          return ADMIN_ACTIONS.reject
        case 'suspended':
          return ADMIN_ACTIONS.suspend
        case 'disabled':
          return ADMIN_ACTIONS.disable
        default:
          return null
      }
    })
    .filter((descriptor): descriptor is AdminActionDescriptor => descriptor !== null)
}
