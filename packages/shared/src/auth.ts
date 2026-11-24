import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(255);
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(256)
  .refine((p) => /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p), {
    message: 'Password must contain upper, lower, and a digit',
  });

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(80),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
  totpCode: z.string().regex(/^\d{6}$/).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const totpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  mfaEnabled: boolean;
}

export interface AuthSessionDto {
  accessToken: string;
  expiresIn: number;
  user: AuthUserDto;
}
