import { Paragraph, Spacing } from "@toss/tds-mobile";

/**
 * 모의투자 고지 문구 — 심사 컴플라이언스용 공용 조각.
 *
 * 배치 계약: 자금·수익률·랭킹처럼 "돈처럼 보이는" 숫자를 노출하는 화면
 * (홈·포트폴리오·거래·백테스트 결과·리더보드)의 **본문 맨 아래**에 한 번만 둔다.
 * 상단 히어로 위나 CTA 아래(하단 고정 영역)에는 넣지 않는다 — 문구가 잘리거나
 * 탭바와 겹친다.
 *
 * 문구·타이포는 고정이다(심사 대응). 화면별로 바꾸지 마라.
 */
export function DisclaimerNotice() {
  return (
    <>
      <Spacing size={16} />
      <Paragraph.Text typography="st13" color="tertiary">
        본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다.
      </Paragraph.Text>
    </>
  );
}
