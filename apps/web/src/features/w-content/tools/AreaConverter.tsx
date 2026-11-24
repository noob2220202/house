'use client';
import { Chip, Icon } from '@house/ui';
import { useState } from 'react';
import {
  COMMON_EXCLUSIVE_SQM,
  areaReferenceRows,
  convertArea,
  type AreaInputUnit,
} from './lib/area';
import { parseDecimalInput } from './lib/money';
import { CalcSection, Notes, ResultPanel } from './ui/CalcSection';
import { NumberField } from './ui/NumberField';
import styles from './tools.module.css';

const trim = (n: number): string => Number(n.toFixed(2)).toString();

/** 평 ↔ ㎡ 환산 — type in either field, the other follows (1평 = 3.305785㎡). */
export function AreaConverter() {
  const [sqm, setSqm] = useState('84.98');
  const [pyeong, setPyeong] = useState('25.71');
  const [source, setSource] = useState<AreaInputUnit>('sqm');

  const update = (raw: string, from: AreaInputUnit) => {
    setSource(from);
    const converted = convertArea(parseDecimalInput(raw) ?? Number.NaN, from);
    if (from === 'sqm') {
      setSqm(raw);
      setPyeong(converted ? trim(converted.pyeong) : '');
    } else {
      setPyeong(raw);
      setSqm(converted ? trim(converted.sqm) : '');
    }
  };

  const value = parseDecimalInput(source === 'sqm' ? sqm : pyeong);
  const result = value === null ? null : convertArea(value, source);
  const reference = areaReferenceRows();

  return (
    <CalcSection
      id="area"
      icon="ruler"
      title="평 · ㎡ 환산"
      description="평과 제곱미터를 서로 바꿔 보세요. 한쪽에 입력하면 다른 쪽이 바로 바뀌어요."
      form={
        <>
          <div className={styles.convert}>
            <NumberField
              label="제곱미터"
              value={sqm}
              onChange={(v) => update(v, 'sqm')}
              suffix="㎡"
              decimal
              maxLength={9}
            />
            <span className={styles.swap} aria-hidden="true">
              <Icon name="swap" size={20} />
            </span>
            <NumberField
              label="평"
              value={pyeong}
              onChange={(v) => update(v, 'pyeong')}
              suffix="평"
              decimal
              maxLength={9}
            />
          </div>
          <div>
            <p className={styles.choiceLabel}>자주 찾는 전용면적</p>
            <div className={styles.quick}>
              {COMMON_EXCLUSIVE_SQM.map((s) => (
                <Chip
                  key={s}
                  selected={result?.sqm === s}
                  onClick={() => update(String(s), 'sqm')}
                  aria-label={`${s}제곱미터`}
                >
                  {s}㎡
                </Chip>
              ))}
            </div>
          </div>
        </>
      }
      result={
        <ResultPanel
          label={source === 'sqm' ? '평으로 바꾸면' : '제곱미터로 바꾸면'}
          value={
            result
              ? source === 'sqm'
                ? `${result.pyeong.toLocaleString('ko-KR')}평`
                : `${result.sqm.toLocaleString('ko-KR')}㎡`
              : null
          }
          sub={
            result
              ? source === 'sqm'
                ? `${result.sqm.toLocaleString('ko-KR')}㎡ ÷ 3.305785`
                : `${result.pyeong.toLocaleString('ko-KR')}평 × 3.305785`
              : undefined
          }
          placeholder="면적을 입력해 주세요."
        >
          <table className={styles.refTable}>
            <caption>전용면적 환산표</caption>
            <thead>
              <tr>
                <th scope="col">㎡</th>
                <th scope="col">평</th>
              </tr>
            </thead>
            <tbody>
              {reference.map((row) => (
                <tr key={row.sqm} className={result?.sqm === row.sqm ? styles.hit : undefined}>
                  <td className="num">{row.sqm}㎡</td>
                  <td className="num">{row.pyeong.toFixed(1)}평</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResultPanel>
      }
    >
      <Notes
        items={[
          '1평은 3.305785㎡(400/121㎡)예요. 법정 단위는 ㎡이고, 평은 참고용으로 함께 보여 드려요.',
          '아파트의 "34평형"은 보통 공급면적 기준이라 전용면적 84㎡(약 25.4평)와 다를 수 있어요.',
        ]}
      />
    </CalcSection>
  );
}
