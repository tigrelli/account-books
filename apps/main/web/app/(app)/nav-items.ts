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
