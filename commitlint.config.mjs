/** @type {import('@commitlint/types').UserConfig} */
export default {
  plugins: [
    {
      rules: {
        "task-id-format": ({ header }) => {
          // 허용 형식: [S-0-22] 작업 내용  /  [F-1-5-4] 기능 구현  /  [T-1-3-1] 테스트
          const valid = /^\[[A-Z]-[\d][\d-]*\] .+/.test(header ?? "");
          return [
            valid,
            "커밋 메시지는 [TASK-ID] 형식으로 시작해야 합니다 (예: [S-0-22] commitlint 설정)",
          ];
        },
      },
    },
  ],
  rules: {
    "task-id-format": [2, "always"],
  },
};
