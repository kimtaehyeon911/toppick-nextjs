# Top Pick — Next.js (App Router)

Vite 버전에서 이전됨. 라우트:
- `/`            경기 보드 (서버 렌더 + ISR 30s, 클라이언트에서 투표/실시간)
- `/match/[id]`  경기 상세 (서버 렌더 + generateMetadata — SEO/OG 대응)
- `/leaderboard` 리더보드
- `/profile`     내 기록 + 데모 토글

## 실행
```bash
npm install
cp .env.example .env.local   # 비우면 데모 모드(목데이터)
npm run dev
```

## 구조
- `lib/data.ts`   서버 컴포넌트용 공개 데이터 로더 (matches/consensus)
- `lib/api.ts`    클라이언트 데이터 계층 (익명 세션·픽·패스·실시간·커뮤니티)
- `components/providers.tsx`  라우트 공유 상태 (언어·패스·스타배지·결제모달·토스트)
- `supabase/` 마이그레이션 0001–0006 + 엣지 함수, `worker/` 결과 인제스트 — 백엔드 연결 절차는 작업계획서 참조
