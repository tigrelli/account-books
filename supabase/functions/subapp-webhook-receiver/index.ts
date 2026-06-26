// 서브앱(billLens 등) → payLens 지출 이벤트 Webhook 수신
// S-2-x 단계에서 구현 예정
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (_req) => {
  return new Response(JSON.stringify({ message: "not implemented" }), {
    status: 501,
    headers: { "Content-Type": "application/json" },
  });
});
