// 사이드바에 실제로 노출할 메뉴 구성 — 화면이 구현 완료될 때마다 여기 추가할 것.
// 계획 중인 전체 메뉴 트리는 docs/기능명세서_IA.md 1장, 이 배열과의 매핑은 1-1장 참고.
export type NavItem = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

export const navItems: NavItem[] = [
  { label: "홈", href: "/" },
  { label: "지출 입력", href: "/expenses/create" },
  { label: "지출 내역", href: "/expenses" },
  { label: "예산 관리", href: "/budgets" },
  {
    label: "관리비 명세서",
    href: "/utility-bills/upload",
    children: [
      { label: "명세서 업로드", href: "/utility-bills/upload" },
      { label: "명세서 통계", href: "/utility-bills/stats" },
      { label: "명세서 이력", href: "/utility-bills/history" },
    ],
  },
  {
    label: "설정",
    href: "/settings",
    children: [
      { label: "지출분류 관리", href: "/settings/payment-methods" },
      { label: "지출항목 관리", href: "/settings/categories" },
      { label: "지출처 관리", href: "/settings/vendors" },
      { label: "품목 관리", href: "/settings/items" },
    ],
  },
];

// F-3-1-5: 운영자 전용 메뉴 — navItems와 분리해서 AppShell(SidebarNav)이 isAdmin일 때만 조건부로
// 붙인다(일반 사용자에게는 아예 노출 안 함). 관리자 화면이 아직 이거 하나뿐이라 "관리자" 상위
// 메뉴에 별도 인덱스 페이지를 만들지 않고(죽은 링크 방지) 바로 하위 화면으로 연결. 실제 접근
// 차단은 lib/admin.ts의 서버 측 재검증이 진짜 방어선이고, 이건 어디까지나 UI 노출 여부일 뿐.
export const adminNavItem: NavItem = {
  label: "동의어 사전 관리",
  href: "/admin/synonyms",
};
