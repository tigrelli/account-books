import { z } from "zod";

// z.email(message) 파라미터 방식이 zod v4에서 deprecated — refine으로 대체
const emailField = z
  .string()
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "올바른 이메일 주소를 입력해 주세요");

export const signUpSchema = z
  .object({
    name: z.string().min(1, "이름을 입력해 주세요").max(50, "이름이 너무 깁니다"),
    email: emailField,
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다")
      .max(72, "비밀번호가 너무 깁니다"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
});

export const profileSchema = z.object({
  name: z.string().min(1, "이름을 입력해 주세요").max(50, "이름이 너무 깁니다"),
});

export const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다")
      .max(72, "비밀번호가 너무 깁니다"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });
