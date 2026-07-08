/** 페이지네이션 파라미터 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** 페이지네이션 응답 래퍼 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** API 에러 응답 */
export interface ApiError {
  code: string;
  message: string;
}

/** 날짜 범위 필터 */
export interface DateRangeFilter {
  from: string; // ISO date string (YYYY-MM-DD)
  to: string;
}
