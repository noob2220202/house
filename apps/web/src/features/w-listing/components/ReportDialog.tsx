'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { REPORT_REASON_LABEL, ReportReason, phoneSchema } from '@house/shared';
import { Button, Callout, Input, Modal, Radio, Textarea, useToast } from '@house/ui';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ROUTES } from '@/config/nav';
import { ApiError, errorMessage } from '@/lib/api';
import { loginUrl } from '@/lib/auth';
import { createListingReport } from '../api/client';
import type { ListingDetail } from '../api/schemas';
import { listingFullTitle, listingNo } from '../lib/view';
import styles from './dialogs.module.css';

const REASONS = Object.values(ReportReason);
const DETAIL_MAX = 2000;

/** Same rules as `reportCreateSchema` (@house/shared) plus: 기타 needs an explanation. */
export const reportFormSchema = z
  .object({
    reason: z.enum(ReportReason, { error: '신고 사유를 선택해 주세요.' }),
    detail: z
      .string()
      .trim()
      .max(DETAIL_MAX, `${DETAIL_MAX.toLocaleString('ko-KR')}자까지 쓸 수 있어요.`),
    reporterPhone: z.union([z.literal(''), phoneSchema]),
  })
  .refine((v) => v.reason !== ReportReason.OTHER || v.detail.length >= 5, {
    path: ['detail'],
    message: '기타 사유는 내용을 5자 이상 적어 주세요.',
  });
type ReportFormInput = z.input<typeof reportFormSchema>;
type ReportFormValues = z.output<typeof reportFormSchema>;

/** 허위매물 신고 — signed-in users only (the opener gates on the session). */
export function ReportDialog({
  listing,
  open,
  onClose,
}: {
  listing: ListingDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<ReportFormInput, unknown, ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    mode: 'onTouched',
    defaultValues: { detail: '', reporterPhone: '' },
  });
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = form;
  const detailLength = (watch('detail') ?? '').length;

  const mutation = useMutation({
    mutationFn: (values: ReportFormValues) =>
      createListingReport({
        listingId: listing.id,
        reason: values.reason,
        detail: values.detail || undefined,
        reporterPhone: values.reporterPhone || undefined,
      }),
    onSuccess: () => {
      toast({ message: '신고가 접수됐어요. 확인한 뒤 결과를 알림으로 알려 드릴게요.' });
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.isUnauthenticated) {
        const { pathname } = window.location;
        window.location.assign(loginUrl(`${pathname}?intent=report`));
        return;
      }
      if (error instanceof ApiError && error.isValidation) {
        for (const [field, message] of Object.entries(error.fieldErrors())) {
          if (field === 'reason' || field === 'detail' || field === 'reporterPhone') {
            setError(field, { message });
          }
        }
      }
    },
  });
  const failed =
    mutation.isError && !(mutation.error instanceof ApiError && mutation.error.isValidation);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="허위매물 신고"
      description={`매물번호 ${listingNo(listing)} · ${listingFullTitle(listing)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            취소
          </Button>
          <Button
            type="submit"
            form="listing-report-form"
            variant="danger"
            loading={mutation.isPending}
          >
            신고하기
          </Button>
        </>
      }
    >
      <form
        id="listing-report-form"
        className={styles.report}
        noValidate
        onSubmit={(e) => void handleSubmit((values) => mutation.mutate(values))(e)}
      >
        <fieldset
          className={styles.reasons}
          aria-describedby={errors.reason ? 'report-reason-error' : undefined}
        >
          <legend className={styles.legend}>
            어떤 점이 사실과 다른가요? <span className={styles.req}>*</span>
          </legend>
          <div className={styles.reasonGrid}>
            {REASONS.map((reason) => (
              <Radio key={reason} value={reason} {...register('reason')}>
                {REPORT_REASON_LABEL[reason]}
              </Radio>
            ))}
          </div>
          {errors.reason && (
            <p id="report-reason-error" role="alert" className={styles.fieldError}>
              {errors.reason.message}
            </p>
          )}
        </fieldset>
        <Textarea
          label="자세한 내용"
          placeholder="예: 11월 20일에 전화했더니 이미 계약됐다고 안내받았어요."
          rows={4}
          maxLength={DETAIL_MAX}
          help={`확인에 도움이 되는 날짜와 상황을 적어 주세요. ${detailLength.toLocaleString('ko-KR')} / ${DETAIL_MAX.toLocaleString('ko-KR')}`}
          error={errors.detail?.message}
          {...register('detail')}
        />
        <Input
          label="연락처 (선택)"
          placeholder="010-0000-0000"
          inputMode="tel"
          autoComplete="tel"
          help="확인 과정에서 추가로 여쭤볼 때만 연락드려요. 중개사무소에는 알리지 않습니다."
          error={errors.reporterPhone?.message}
          {...register('reporterPhone')}
        />
        {failed && (
          <p role="alert" className={styles.formError}>
            {errorMessage(mutation.error)}
          </p>
        )}
        <Callout tone="muted" size="sm">
          사실과 다른 신고가 반복되면 이용이 제한될 수 있어요.{' '}
          <Link className="link" href={ROUTES.terms('false-listing')}>
            허위매물 신고 정책
          </Link>
        </Callout>
      </form>
    </Modal>
  );
}
