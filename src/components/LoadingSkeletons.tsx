import { Skeleton, Spacing } from "@toss/tds-mobile";

/**
 * 로딩 스켈레톤 세트 — TDS Skeleton만으로 구성한 공용 자리표시자.
 *
 * 배치 계약: 데이터가 도착하면 같은 자리에 실제 콘텐츠로 교체한다(레이아웃 점프 방지).
 * 고정 px 폭을 쓰지 않으므로 부모 폭 100%에 그대로 반응한다. 터치 요소는 없다.
 * 맨텍스트("불러오는 중")로 대체하지 마라.
 */

/** 히어로 자리표시자 — 큰 숫자 한 줄 + 보조 설명 한 줄. */
export function HeroSkeleton() {
  return (
    <div aria-busy="true" style={{ display: "flex", flexDirection: "column" }}>
      <Skeleton height={44} custom={["title"]} repeatLastItemCount={1} />
      <Spacing size={12} />
      <div style={{ display: "flex", width: "60%" }}>
        <Skeleton height={20} custom={["subtitle"]} repeatLastItemCount={1} />
      </div>
    </div>
  );
}

/**
 * 목록 자리표시자 — 종목·거래내역·랭킹 목록이 로딩 중일 때.
 *
 * `rows`가 이 컴포넌트의 계약이고 `count`는 같은 뜻의 별칭이다(호출부 표기 혼용 대비).
 */
export function ListSkeleton({ rows, count = 5 }: { rows?: number; count?: number }) {
  const total = rows ?? count;

  return (
    <div aria-busy="true" style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column" }}>
          {i > 0 ? <Spacing size={8} /> : null}
          <Skeleton height={56} custom={["list"]} repeatLastItemCount={1} />
        </div>
      ))}
    </div>
  );
}
