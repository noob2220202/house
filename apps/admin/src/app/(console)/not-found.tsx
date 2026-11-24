import { Button, EmptyState } from '@house/ui';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/shell';

export default function ConsoleNotFound() {
  return (
    <>
      <AdminPageHeader title="페이지를 찾을 수 없어요" crumb={[]} />
      <EmptyState
        icon="compass"
        title="아직 없는 화면이에요"
        description="주소가 바뀌었거나 준비 중인 메뉴일 수 있어요."
        action={
          <Button href="/" linkAs={Link} variant="secondary">
            대시보드로
          </Button>
        }
      />
    </>
  );
}
