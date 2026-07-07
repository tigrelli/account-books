import { Redis } from "@upstash/redis";

// [S-3-5] 통계 캐시 레이어 — 아키텍처 설계서 8장 "초기엔 Postgres MV만으로 시작 가능, 캐시는
// 선택" 방침에 따라, MV(S-3-1~3)만으로도 화면은 이미 동작한다. 이 클라이언트는 S-3-6(Top10/통계
// API 캐시 적용)에서 요청마다 MV/RPC를 다시 타지 않고 Redis에서 즉시 응답하기 위한 것.
// Redis.fromEnv()는 UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN을 읽는다(Upstash 콘솔 >
// 해당 DB > REST API 섹션) — 서버 전용, 클라이언트(브라우저) 코드에서 import 금지.
let cachedClient: Redis | undefined;

export function getRedisClient(): Redis {
  cachedClient ??= Redis.fromEnv();
  return cachedClient;
}
