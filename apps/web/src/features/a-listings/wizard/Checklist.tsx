'use client';
import { Icon, cx } from '@house/ui';
import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { STEPS, toDraftPayload, type ListingFormValues } from '../lib/form';
import { publishRequirements, requirementProgress } from '../lib/requirements';
import { useWizard } from './context';
import styles from './wizard.module.css';

/** Live requirement state of the form (shared by the checklist and the preview step). */
export function useRequirements() {
  const values = useWatch<ListingFormValues>() as ListingFormValues;
  return useMemo(() => {
    const { payload } = toDraftPayload(values);
    const requirements = publishRequirements(payload);
    return { payload, requirements, ...requirementProgress(requirements) };
  }, [values]);
}

/** Sticky aside: 표시·광고 명시사항 checklist grouped by step; each row jumps to its field. */
export function Checklist() {
  const { goToField } = useWizard();
  const { requirements, done, total } = useRequirements();
  const [open, setOpen] = useState(false);
  const complete = done === total;

  const groups = STEPS.map((step, index) => ({
    step,
    items: requirements.filter((r) => r.step === index),
  })).filter((g) => g.items.length > 0);

  return (
    <section className={styles.check} aria-labelledby="chk-t">
      <div className={styles.checkHd}>
        <div className={styles.checkT}>
          <h2 id="chk-t">표시·광고 명시사항</h2>
          <span className={cx(styles.checkN, !complete && styles.todo)}>
            {done} / {total}
          </span>
        </div>
        <div
          className={cx(styles.meter, !complete && styles.todo)}
          role="progressbar"
          aria-label="필수 표시사항 입력 진행"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <span style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }} />
        </div>
        <p className={styles.checkCap}>
          {complete
            ? '필수 표시사항을 모두 입력했어요. 미리보기에서 확인하고 게시해 주세요.'
            : `공인중개사법에 따라 ${total - done}개 항목을 더 입력해야 게시할 수 있어요.`}
        </p>
        <button
          type="button"
          className={cx(styles.textBtn, styles.checkToggle)}
          aria-expanded={open}
          aria-controls="chk-list"
          onClick={() => setOpen((x) => !x)}
        >
          {open ? '항목 접기' : '항목 보기'}
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
        </button>
      </div>
      <div className={cx(styles.checkList, !open && styles.closed)} id="chk-list">
        {groups.map((g) => (
          <div key={g.step.key}>
            <p className={styles.checkStep}>{g.step.label}</p>
            <ul>
              {g.items.map((r) => (
                <li key={r.field}>
                  <button
                    type="button"
                    className={cx(styles.checkItem, r.done && styles.ok)}
                    onClick={() => goToField(r.formField)}
                    aria-label={`${r.label} ${r.done ? '입력 완료' : '입력 필요'} — 해당 항목으로 이동`}
                  >
                    <span className={styles.box} aria-hidden="true">
                      <Icon name="check" size={14} strokeWidth={3} />
                    </span>
                    {r.label}
                    {!r.done && <span className={styles.go}>입력</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className={cx(styles.checkFt, !open && styles.closed)}>
        <Icon name="shield" size={16} />
        <span>
          사무소 명칭·소재지·연락처·등록번호·대표자 성명은 사무소 프로필에서 자동으로 표시돼요.
        </span>
      </p>
    </section>
  );
}
