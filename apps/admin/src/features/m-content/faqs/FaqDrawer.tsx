'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { FaqCategory } from '@house/shared';
import { Button, Drawer, Icon, Select, Switch, Textarea, useToast } from '@house/ui';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { faqs } from '../api';
import { faqFormSchema, type FaqForm } from '../api/inputs';
import type { Faq } from '../api/schemas';
import { MarkupEditor } from '../components/MarkupEditor';
import s from '../components/shared.module.css';
import { applyServerErrors } from '../lib/form-errors';
import { FAQ_CATEGORIES, FAQ_CATEGORY_LABEL } from '../lib/labels';
import drawer from '../components/drawer.module.css';

type Editing = { mode: 'create'; category: FaqCategory } | { mode: 'edit'; faq: Faq } | null;

export function FaqDrawer({
  editing,
  onClose,
  onSaved,
  onDelete,
}: {
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (faq: Faq) => void;
}) {
  const { toast } = useToast();
  const faq = editing?.mode === 'edit' ? editing.faq : null;
  const { register, control, handleSubmit, reset, setError, formState } = useForm<FaqForm>({
    resolver: zodResolver(faqFormSchema),
    defaultValues: { category: FaqCategory.GENERAL, question: '', answer: '', isPublished: true },
    mode: 'onBlur',
  });
  useEffect(() => {
    if (!editing) return;
    reset(
      editing.mode === 'edit'
        ? {
            category: editing.faq.category,
            question: editing.faq.question,
            answer: editing.faq.answer,
            isPublished: editing.faq.isPublished,
          }
        : { category: editing.category, question: '', answer: '', isPublished: true },
    );
  }, [editing, reset]);

  const save = useMutation({
    mutationFn: (values: FaqForm) => (faq ? faqs.update(faq.id, values) : faqs.create(values)),
    onSuccess: () => {
      toast(faq ? 'FAQ를 저장했어요.' : 'FAQ를 추가했어요.');
      onSaved();
    },
    onError: (e) => {
      const message = applyServerErrors(e, setError, ['category', 'question', 'answer']);
      if (message) toast({ message, tone: 'error' });
    },
  });
  const errors = formState.errors;

  return (
    <Drawer
      open={editing !== null}
      onClose={onClose}
      title={faq ? 'FAQ 수정' : 'FAQ 추가'}
      width={560}
      footer={
        <div className={drawer.footer}>
          {faq && (
            <Button
              type="button"
              variant="ghost"
              className={s.dangerText}
              iconLeft={<Icon name="trash" size={18} />}
              onClick={() => onDelete(faq)}
            >
              삭제
            </Button>
          )}
          <span className={drawer.spacer} />
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="faq-form" loading={save.isPending}>
            저장
          </Button>
        </div>
      }
    >
      <form
        id="faq-form"
        className={s.stack}
        noValidate
        onSubmit={(e) => void handleSubmit((v) => save.mutate(v))(e)}
      >
        <Select
          label="분류"
          required
          options={FAQ_CATEGORIES.map((c) => ({ value: c, label: FAQ_CATEGORY_LABEL[c] }))}
          error={errors.category?.message}
          help={faq ? '분류를 바꾸면 새 분류의 맨 아래로 옮겨져요.' : undefined}
          {...register('category')}
        />
        <Textarea
          label="질문"
          required
          rows={2}
          maxLength={500}
          placeholder="예: 회원 가입은 어떻게 하나요?"
          error={errors.question?.message}
          {...register('question')}
        />
        <Controller
          control={control}
          name="answer"
          render={({ field }) => (
            <MarkupEditor
              label="답변"
              required
              rows={10}
              maxLength={20_000}
              previewToggle
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.answer?.message}
            />
          )}
        />
        <div className={s.switchRow}>
          <div className={s.switchText}>
            <span className={s.switchLabel}>사용자 화면에 공개</span>
            <span className={s.switchHelp}>끄면 FAQ 목록에 보이지 않아요.</span>
          </div>
          <Switch aria-label="사용자 화면에 공개" {...register('isPublished')} />
        </div>
      </form>
    </Drawer>
  );
}
