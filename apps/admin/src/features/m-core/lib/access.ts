import { ADMIN_ROLE_RANK, AdminRole } from '@house/shared';
import { ADMIN_NAV } from '@/config/nav';

export interface NavAccess {
  group: string;
  label: string;
  href: string;
  /** Lowest role that can open the menu. */
  minRole: AdminRole;
  allowed: boolean;
}

/** Every sidebar destination with whether `role` may open it (same rule as the sidebar filter). */
export function navAccess(role: AdminRole): NavAccess[] {
  const can = (min: AdminRole = AdminRole.OPERATOR) =>
    ADMIN_ROLE_RANK[role] >= ADMIN_ROLE_RANK[min];
  const out: NavAccess[] = [];
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      const itemMin = item.minRole ?? AdminRole.OPERATOR;
      if (!item.children?.length) {
        out.push({
          group: group.title ?? '홈',
          label: item.label,
          href: item.href,
          minRole: itemMin,
          allowed: can(itemMin),
        });
        continue;
      }
      for (const child of item.children) {
        // A child can never be more permissive than its parent.
        const childMin =
          ADMIN_ROLE_RANK[child.minRole ?? AdminRole.OPERATOR] > ADMIN_ROLE_RANK[itemMin]
            ? (child.minRole ?? AdminRole.OPERATOR)
            : itemMin;
        out.push({
          group: item.label,
          label: child.label,
          href: child.href,
          minRole: childMin,
          allowed: can(childMin),
        });
      }
    }
  }
  return out;
}

/** One-line description of what a role is for. */
export const ROLE_SUMMARY: Record<AdminRole, string> = {
  OPERATOR: '매물·중개사·회원·신고 등 일상 운영 업무를 처리합니다.',
  ADMIN: '운영 업무와 함께 사이트 정보, 약관, 간편로그인 연동을 설정합니다.',
  SUPER_ADMIN: '모든 메뉴와 관리자 계정을 관리합니다.',
};
