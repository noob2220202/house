'use client';
import { ConfirmDialog, useToast } from '@house/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { errorMessage } from '@/lib/api';
import { SESSION_QUERY_KEY, useSession } from '@/lib/auth';
import { leaveAgency } from '../api/queries';
import { AGENT_ROUTES } from '../nav';

export interface LeaveAgencyDialogProps {
  open: boolean;
  onClose: () => void;
  agencyName: string;
}

/**
 * "사무소 나가기" for a 소속 중개사 (AGENT): confirm → POST /agencies/membership/leave → the cached
 * console data of the office is dropped, the session is re-read (it is now a plain member) and the
 * console re-renders on the server, landing on /agent/apply (join another office or register one).
 */
export function LeaveAgencyDialog({ open, onClose, agencyName }: LeaveAgencyDialogProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { refresh } = useSession();
  const { toast } = useToast();
  const leave = useMutation({
    mutationFn: leaveAgency,
    onSuccess: async () => {
      // Everything cached so far was read as a member of the office; only the session survives.
      queryClient.removeQueries({
        predicate: (q) => q.queryKey[0] !== SESSION_QUERY_KEY[0],
      });
      await refresh();
      onClose();
      toast({ message: `${agencyName}에서 나왔어요.`, tone: 'success' });
      router.replace(AGENT_ROUTES.apply);
      // The console layout resolves the user and the agency on the server.
      router.refresh();
    },
    onError: (error) => toast({ message: errorMessage(error), tone: 'error' }),
  });

  return (
    <ConfirmDialog
      open={open}
      onClose={() => {
        if (!leave.isPending) onClose();
      }}
      onConfirm={() => leave.mutate()}
      title="사무소에서 나갈까요?"
      description={`${agencyName}의 소속 중개사에서 빠져요. 내가 담당하던 매물 광고는 대표 공인중개사 담당으로 바뀌고, 다시 합류하려면 새 초대 코드가 필요해요.`}
      confirmLabel="사무소 나가기"
      danger
      loading={leave.isPending}
    />
  );
}
