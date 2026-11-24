'use client';
import { AdminRole, type BannerSlot } from '@house/shared';
import { Button, Input, Modal, useToast } from '@house/ui';
import { useState } from 'react';
import { errorMessage } from '@/lib/api';
import { useAdminSession } from '@/lib/auth';
import { useUpdateSlotLimit } from '../api/hooks';
import type { BannerSlotInfo } from '../api/schemas';
import { AD_IMAGE_MAX_BYTES, formatBytes, formatSize, POPUP_IMAGE_SPEC } from '../lib/image-rules';
import { isMobileOnlySlot, SLOT_META } from '../lib/slots';
import styles from './ads.module.css';

export interface SlotSpecModalProps {
  open: boolean;
  onClose: () => void;
  slots: readonly BannerSlotInfo[] | undefined;
}

/**
 * 슬롯 규격표: where each slot appears, the image sizes to upload and how many banners may be live
 * at once. ADMIN and above can change the limit (`PATCH /admin/banner-slots/:slot`).
 */
export function SlotSpecModal({ open, onClose, slots }: SlotSpecModalProps) {
  const { can } = useAdminSession();
  const canEdit = can(AdminRole.ADMIN);
  const { toast } = useToast();
  const update = useUpdateSlotLimit();
  const [drafts, setDrafts] = useState<Partial<Record<BannerSlot, string>>>({});

  const save = (info: BannerSlotInfo) => {
    const value = Number(drafts[info.slot]);
    if (!Number.isInteger(value) || value < 1 || value > 50) {
      toast({ message: '동시 노출 수는 1~50 사이의 숫자로 입력해 주세요', tone: 'error' });
      return;
    }
    update.mutate(
      { slot: info.slot, maxActive: value },
      {
        onSuccess: () => {
          setDrafts((d) => ({ ...d, [info.slot]: undefined }));
          toast(`${info.label} 동시 노출 수를 ${value}개로 바꿨어요`);
        },
        onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="슬롯 규격표"
      description="노출 위치마다 올릴 이미지 크기와 동시에 노출할 수 있는 배너 수예요."
      footer={<Button onClick={onClose}>확인</Button>}
    >
      <div className={styles.specScroll}>
        <table className={styles.specTable}>
          <thead>
            <tr>
              <th scope="col">노출 위치</th>
              <th scope="col">PC 이미지</th>
              <th scope="col">모바일 이미지</th>
              <th scope="col">노출 중</th>
              <th scope="col">동시 노출</th>
            </tr>
          </thead>
          <tbody>
            {(slots ?? []).map((info) => {
              const draft = drafts[info.slot];
              const dirty = draft !== undefined && draft !== String(info.maxActive);
              const mobileOnly = isMobileOnlySlot(info.slot);
              return (
                <tr key={info.slot}>
                  <th scope="row">
                    {info.label}
                    <small>{SLOT_META[info.slot].where}</small>
                  </th>
                  <td>{mobileOnly ? '–' : formatSize(info.pc)}</td>
                  <td>
                    {mobileOnly
                      ? formatSize(info.pc)
                      : info.mobile
                        ? formatSize(info.mobile)
                        : '미노출'}
                  </td>
                  <td>{info.activeCount ?? '–'}</td>
                  <td>
                    {canEdit ? (
                      <span className={styles.specSave}>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          inputMode="numeric"
                          className={styles.maxInput}
                          aria-label={`${info.label} 동시 노출 수`}
                          value={draft ?? String(info.maxActive)}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [info.slot]: e.target.value }))
                          }
                        />
                        {dirty && (
                          <Button
                            size="sm"
                            variant="soft"
                            loading={update.isPending && update.variables?.slot === info.slot}
                            onClick={() => save(info)}
                          >
                            저장
                          </Button>
                        )}
                      </span>
                    ) : (
                      `${info.maxActive}개`
                    )}
                  </td>
                </tr>
              );
            })}
            <tr>
              <th scope="row">
                공지 팝업
                <small>팝업 탭에서 관리 · 화면에는 380 × 300으로 보여요</small>
              </th>
              <td colSpan={2}>{formatSize(POPUP_IMAGE_SPEC)}</td>
              <td>–</td>
              <td>–</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={styles.specNote}>
        JPG · PNG · WebP, 파일당 {formatBytes(AD_IMAGE_MAX_BYTES)} 이하. 표의 크기 이상이면서 같은
        비율이면 올릴 수 있어요(선명하게 보이도록 2배 크기 권장). 모바일 이미지를 비워 두면 PC
        이미지가 대신 쓰여요.
        {!canEdit && ' 동시 노출 수는 관리자 이상 권한에서 바꿀 수 있어요.'}
      </p>
    </Modal>
  );
}
