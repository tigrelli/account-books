"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LogoutButton } from "@/components/LogoutButton";
import { navItems, adminNavItem, type NavItem } from "./nav-items";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({
  pathname,
  isAdmin,
  onNavigate = () => {},
}: {
  pathname: string;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  // 동의어 사전 관리(F-3-1-5)는 운영자 전용 — RLS도 authenticated 전체에 쓰기 정책을 안 열어두는
  // 구조라, 사이드바에서도 운영자가 아니면 아예 노출하지 않는다(진입 시도 자체를 줄임 — 실제
  // 접근 차단은 어디까지나 서버 액션의 isAdminEmail 재검증이 진짜 방어선).
  const items: NavItem[] = isAdmin ? [...navItems, adminNavItem] : navItems;

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {items.map((item) => (
        <div key={item.href}>
          <Link
            href={item.href}
            onClick={onNavigate}
            // 사이드바는 모든 화면에 항상 떠있어서 기본 prefetch(뷰포트에 보이면 자동 백그라운드
            // 요청)를 켜두면, 페이지 하나 열 때마다 사이드바 링크 9개가 전부 미리 요청된다 —
            // 대상 라우트가 대부분 force-dynamic이라 캐싱 이득 없이 매번 실제 Supabase 쿼리만
            // 낭비(운영 환경 성능 점검 중 네트워크 로그로 확인, 2026-07-08). 꺼서 클릭 시에만 요청.
            prefetch={false}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive(pathname, item.href)
                ? "bg-[var(--color-sidebar-accent)] text-[var(--color-sidebar-accent-foreground)]"
                : "text-[var(--color-sidebar-foreground)]/70 hover:bg-[var(--color-sidebar-accent)]/60"
            }`}
          >
            {item.label}
          </Link>
          {item.children && (
            <div className="mt-1 ml-3 space-y-1 border-l border-[var(--color-sidebar-border)] pl-3">
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  prefetch={false}
                  className={`block rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isActive(pathname, child.href)
                      ? "font-medium text-[var(--paylens-action)]"
                      : "text-[var(--color-sidebar-foreground)]/60 hover:text-[var(--color-sidebar-foreground)]"
                  }`}
                >
                  {child.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ email }: { email: string }) {
  return (
    <div className="flex items-center justify-between border-t border-[var(--color-sidebar-border)] px-4 py-3">
      <span className="truncate text-xs text-[var(--color-sidebar-foreground)]/60">{email}</span>
      <LogoutButton className="shrink-0 text-xs font-medium text-[var(--color-sidebar-foreground)]/70 hover:text-[var(--color-sidebar-foreground)]" />
    </div>
  );
}

// 알림 기능은 아직 구현 전 — 자리만 잡아두는 장식용 아이콘(클릭 동작 없음)
function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-5 w-5 text-white/70"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

export function AppShell({
  email,
  isAdmin,
  children,
}: {
  email: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // (app) 그룹 전체에서 쓰는 첫 TanStack Query Provider — 지출 목록의 기기별 페이지네이션/더보기
  // 데이터 캐싱용(F-1-1-11 관련). useState로 한 번만 생성해 리렌더마다 새 인스턴스가 만들어지지 않게 한다.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-dvh flex-col">
        {/* 상단바 */}
        <header className="flex h-14 shrink-0 items-center justify-between bg-[var(--paylens-main)] px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="메뉴 열기"
              className="text-white md:hidden"
            >
              ☰
            </button>
            <Link href="/" prefetch={false} className="text-lg font-bold text-white">
              pay<span className="text-[var(--paylens-action)]">L</span>ens
            </Link>
          </div>
          <BellIcon />
        </header>

        <div className="flex flex-1">
          {/* 데스크탑 사이드바 */}
          <aside className="hidden w-56 shrink-0 flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] md:flex">
            <SidebarNav pathname={pathname} isAdmin={isAdmin} />
            <SidebarFooter email={email} />
          </aside>

          {/* 모바일 사이드바 (드로어) */}
          {drawerOpen && (
            <div className="fixed inset-0 z-50 md:hidden">
              <button
                type="button"
                aria-label="메뉴 닫기"
                onClick={() => setDrawerOpen(false)}
                className="absolute inset-0 bg-black/40"
              />
              <aside className="relative flex h-full w-64 flex-col bg-[var(--color-sidebar)]">
                <div className="flex h-14 items-center justify-between border-b border-[var(--color-sidebar-border)] px-4">
                  <span className="text-sm font-bold text-[var(--color-sidebar-foreground)]">
                    메뉴
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="메뉴 닫기"
                    className="text-[var(--color-sidebar-foreground)]"
                  >
                    ✕
                  </button>
                </div>
                <SidebarNav
                  pathname={pathname}
                  isAdmin={isAdmin}
                  onNavigate={() => setDrawerOpen(false)}
                />
                <SidebarFooter email={email} />
              </aside>
            </div>
          )}

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </QueryClientProvider>
  );
}
