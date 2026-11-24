import { z } from 'zod';

/**
 * Nickname rule of the signup form. The backend accepts 1–30 chars (updateProfileSchema); the UI is
 * a little stricter so nicknames stay readable in listings and proposals.
 */
export const nicknameSchema = z
  .string()
  .trim()
  .min(2, '닉네임은 2자 이상 입력해 주세요.')
  .max(20, '닉네임은 20자까지 쓸 수 있어요.')
  .regex(/^[가-힣a-zA-Z0-9_]+( [가-힣a-zA-Z0-9_]+)*$/, '한글, 영문, 숫자, 밑줄(_)만 쓸 수 있어요.');

export const signupFormSchema = z.object({ nickname: nicknameSchema });
export type SignupFormValues = z.infer<typeof signupFormSchema>;
