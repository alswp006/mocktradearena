import { Spacing } from "@toss/tds-mobile";
import { AdSlot } from "@/components/AdSlot";

/**
 * 배너 광고 섹션 — AdSlot에 상하 여백 계약을 고정한 래퍼.
 *
 * 배치 계약(지키지 않으면 심사에서 걸린다):
 * - 콘텐츠 섹션 사이 또는 화면 본문 하단에만 둔다.
 * - 결과 콘텐츠(수익률·평가금액 카드) 위나 그 위에 겹쳐 놓지 않는다.
 * - 한 화면에 하나만. 스크롤마다 반복 삽입 금지.
 * - 하단 고정 CTA·FloatingTabBar 영역 안에는 넣지 않는다(터치 오작동).
 *
 * 광고 그룹 ID는 앱인토스 콘솔 발급값을 빌드 환경변수로 주입한다.
 * WebView 밖(로컬 브라우저·jsdom)에서는 AdSlot이 조용히 빈 영역으로 degrade한다.
 */
export function AdSection() {
  const adGroupId = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? "";

  return (
    <>
      <Spacing size={16} />
      <AdSlot adGroupId={adGroupId} />
      <Spacing size={16} />
    </>
  );
}
