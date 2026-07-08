import Link from "next/link";

export function PaginationNav({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-[#e2e8f0] pt-4">
      {page > 1 ? (
        <Link
          href={buildHref(page - 1)}
          prefetch={false}
          className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
        >
          ← 이전
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs text-[var(--color-text-secondary)]">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={buildHref(page + 1)}
          prefetch={false}
          className="text-sm font-medium text-[var(--paylens-action)] hover:underline"
        >
          다음 →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
