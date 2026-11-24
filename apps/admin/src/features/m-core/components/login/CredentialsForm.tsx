'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Callout, Icon, Input } from '@house/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { loginWithPassword, type AdminLoginResult } from '../../api';
import { authErrorMessage } from '../../lib/session';
import styles from './login.module.css';

const formSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, '이메일을 입력해 주세요.')
    .max(254, '이메일이 너무 깁니다.')
    .pipe(z.email('이메일 형식이 올바르지 않습니다.')),
  password: z.string().min(1, '비밀번호를 입력해 주세요.').max(200, '비밀번호가 너무 깁니다.'),
});
export type CredentialsValues = z.infer<typeof formSchema>;

export interface CredentialsFormProps {
  /** Values to prefill (mock-mode helper). */
  preset?: Partial<CredentialsValues> | null;
  onSuccess: (result: AdminLoginResult, email: string) => void;
}

/** Step 1 — e-mail + password (POST /admin/auth/login). */
export function CredentialsForm({ preset, onSuccess }: CredentialsFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CredentialsValues>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    values: preset ? { email: preset.email ?? '', password: preset.password ?? '' } : undefined,
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await loginWithPassword(values);
      onSuccess(result, values.email);
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        const fields = error.fieldErrors();
        (['email', 'password'] as const).forEach((name) => {
          if (fields[name]) setError(name, { message: fields[name] });
        });
        if (!fields.email && !fields.password) setFormError(authErrorMessage(error));
      } else {
        setFormError(authErrorMessage(error));
        if (error instanceof ApiError && error.code === 'AUTH_INVALID_CREDENTIALS')
          setFocus('password', { shouldSelect: true });
      }
    }
  });

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
      {formError && (
        <Callout tone="danger" size="sm" live>
          {formError}
        </Callout>
      )}
      <Input
        label="이메일"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="name@example.com"
        aria-required
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="비밀번호"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder="비밀번호"
        aria-required
        error={errors.password?.message}
        suffix={
          <button
            type="button"
            className={styles.pwToggle}
            aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
          >
            <Icon name="eye" size={20} />
          </button>
        }
        {...register('password')}
      />
      <Button type="submit" size="lg" block loading={isSubmitting}>
        다음
      </Button>
    </form>
  );
}
