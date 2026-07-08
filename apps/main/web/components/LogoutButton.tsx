"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";

interface LogoutButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function LogoutButton({ className, children = "로그아웃" }: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => logoutAction())}
      disabled={isPending}
      className={className}
    >
      {isPending ? "로그아웃 중…" : children}
    </button>
  );
}
