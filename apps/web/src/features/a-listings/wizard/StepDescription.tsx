'use client';
import { LISTING_OPTION_LABEL, ListingOption } from '@house/shared';
import { ChoiceChip, FormSection, HelpLine, Input, Textarea } from '@house/ui';
import { useFormContext, useWatch } from 'react-hook-form';
import { isLand, type ListingFormValues } from '../lib/form';
import { FormRow } from './parts';
import styles from './wizard.module.css';

const O = ListingOption;
const OPTION_GROUPS: readonly { title: string; items: readonly ListingOption[] }[] = [
  {
    title: '가전',
    items: [O.AIR_CONDITIONER, O.REFRIGERATOR, O.WASHER, O.DRYER, O.TV, O.MICROWAVE, O.DISHWASHER],
  },
  { title: '주방', items: [O.INDUCTION, O.GAS_RANGE] },
  { title: '가구·수납', items: [O.BED, O.DESK, O.CLOSET, O.BUILT_IN_WARDROBE, O.SHOE_RACK] },
  {
    title: '건물·생활',
    items: [O.ELEVATOR, O.PARKING, O.WIFI, O.SECURITY, O.CCTV, O.VERANDA, O.BALCONY, O.PET_ALLOWED],
  },
];

const TITLE_MAX = 80;
const DESC_MAX = 5000;

/** Step 5 — 제목 · 설명 · 옵션. */
export function StepDescription() {
  const { register, setValue, formState } = useFormContext<ListingFormValues>();
  const { errors } = formState;
  const v = useWatch<ListingFormValues>() as ListingFormValues;
  const land = isLand(v.assetType);

  return (
    <>
      <FormSection letter="A" title="매물 소개">
        <FormRow label="한 줄 제목" htmlFor="f-title" help="목록과 검색 결과에 보여요.">
          <Input
            id="f-title"
            placeholder="예: 호수공원 정면 조망, 올확장 34평"
            maxLength={TITLE_MAX}
            error={errors.title?.message}
            {...register('title')}
          />
          <span className={styles.counter}>
            {v.title.length} / {TITLE_MAX}
          </span>
        </FormRow>
        <FormRow label="상세 설명" htmlFor="f-description" help="줄을 바꾸면 문단으로 나뉘어요.">
          <Textarea
            id="f-description"
            rows={9}
            maxLength={DESC_MAX}
            placeholder={
              '직접 확인한 내용을 적어 주세요.\n\n· 채광, 조망, 소음\n· 수리·확장 여부와 시기\n· 학교·마트·정류장까지 걸리는 시간\n· 입주 일정과 협의할 수 있는 조건'
            }
            error={errors.description?.message}
            {...register('description')}
          />
          <span className={styles.counter}>
            {v.description.length.toLocaleString('ko-KR')} / {DESC_MAX.toLocaleString('ko-KR')}
          </span>
          <HelpLine icon="shield">
            사실과 다르거나 과장된 표현, 다른 사무소 비방, 전화번호·메신저 아이디는 적지 말아
            주세요. 연락처는 사무소 정보로 자동 표시돼요.
          </HelpLine>
        </FormRow>
      </FormSection>

      {!land && (
        <FormSection letter="B" title="옵션" note={`${v.options.length}개 선택`}>
          {OPTION_GROUPS.map((group) => (
            <FormRow key={group.title} label={group.title} labelId={`l-opt-${group.title}`}>
              <div className={styles.chips} role="group" aria-labelledby={`l-opt-${group.title}`}>
                {group.items.map((option) => (
                  <ChoiceChip
                    key={option}
                    type="checkbox"
                    name="options"
                    checked={v.options.includes(option)}
                    onChange={(on) =>
                      setValue(
                        'options',
                        on ? [...v.options, option] : v.options.filter((x) => x !== option),
                        { shouldDirty: true },
                      )
                    }
                  >
                    {LISTING_OPTION_LABEL[option]}
                  </ChoiceChip>
                ))}
              </div>
            </FormRow>
          ))}
          <HelpLine>
            실제로 남겨 두는 것만 골라 주세요. 협의가 필요한 품목은 설명에 적어요.
          </HelpLine>
        </FormSection>
      )}
    </>
  );
}
