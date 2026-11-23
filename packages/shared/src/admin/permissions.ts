// Owned by the admin module team. Fine-grained back-office permissions per admin role.
import type { EnumValue } from '../enums/define';
import { AdminRole } from '../enums/user';

export const AdminPermission = {
  DASHBOARD_READ: 'DASHBOARD_READ',
  REPORTS_MANAGE: 'REPORTS_MANAGE',
  LISTINGS_MODERATE: 'LISTINGS_MODERATE',
  CONTENT_MANAGE: 'CONTENT_MANAGE',
  MEMBERS_READ: 'MEMBERS_READ',
  MEMBERS_SUSPEND: 'MEMBERS_SUSPEND',
  TERMS_MANAGE: 'TERMS_MANAGE',
  SETTINGS_MANAGE: 'SETTINGS_MANAGE',
  AUDIT_READ: 'AUDIT_READ',
  ADMINS_MANAGE: 'ADMINS_MANAGE',
} as const;
export type AdminPermission = EnumValue<typeof AdminPermission>;

export const ADMIN_PERMISSION_LABEL: Record<AdminPermission, string> = {
  DASHBOARD_READ: '대시보드 조회',
  REPORTS_MANAGE: '허위매물 신고 처리',
  LISTINGS_MODERATE: '매물 숨김·종료',
  CONTENT_MANAGE: '공지·FAQ·영상 관리',
  MEMBERS_READ: '회원 조회',
  MEMBERS_SUSPEND: '회원 정지·해제',
  TERMS_MANAGE: '약관 관리',
  SETTINGS_MANAGE: '사이트 설정',
  AUDIT_READ: '감사 로그 조회',
  ADMINS_MANAGE: '관리자 계정 관리',
};

const OPERATOR_PERMISSIONS: readonly AdminPermission[] = [
  AdminPermission.DASHBOARD_READ,
  AdminPermission.REPORTS_MANAGE,
  AdminPermission.LISTINGS_MODERATE,
  AdminPermission.CONTENT_MANAGE,
  AdminPermission.MEMBERS_READ,
];
const ADMIN_PERMISSIONS: readonly AdminPermission[] = [
  ...OPERATOR_PERMISSIONS,
  AdminPermission.MEMBERS_SUSPEND,
  AdminPermission.TERMS_MANAGE,
  AdminPermission.SETTINGS_MANAGE,
  AdminPermission.AUDIT_READ,
];

/** Role → permissions. Higher roles include everything of the lower ones. */
export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  OPERATOR: OPERATOR_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  SUPER_ADMIN: [...ADMIN_PERMISSIONS, AdminPermission.ADMINS_MANAGE],
};

export function hasAdminPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ADMIN_ROLE_PERMISSIONS[role].includes(permission);
}

/** Admin roles holding `permission` (used to build route role lists). */
export function adminRolesWith(permission: AdminPermission): AdminRole[] {
  return (Object.values(AdminRole) as AdminRole[]).filter((r) => hasAdminPermission(r, permission));
}
