import { useMemo, useState } from "react";
import { Button, Chip, ListRow, Paragraph, Spacing } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { EmptyState } from "@/components/StateView";
import { formatKstDateTime } from "@/lib/date";
import { formatNumber } from "@/lib/utils";
import type { Trade } from "@/lib/types";

const PAGE_SIZE = 30;

function haptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

/**
 * 포트폴리오 거래내역 탭 — 최신순 목록 + 50건↑ 부분 렌더('더 보기' 30건씩 추가).
 */
export function TradeHistoryTab({
  trades,
  onGoMarket,
}: {
  trades: Trade[];
  onGoMarket: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sorted = useMemo(
    () => [...trades].sort((a, b) => b.tradedAt.getTime() - a.tradedAt.getTime()),
    [trades],
  );
  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  function loadMore() {
    haptic();
    setVisibleCount((count) => count + PAGE_SIZE);
  }

  if (sorted.length === 0) {
    return (
      <div data-testid="trade-history">
        <EmptyState
          title="아직 거래 내역이 없어요"
          description="첫 모의매매를 시작해 보세요"
          action={
            <Button variant="weak" display="block" onClick={onGoMarket}>
              마켓 보러가기
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div data-testid="trade-history">
      {visible.map((t) => (
        <div key={t.id} data-testid="trade-history-row">
          <ListRow
            left={<Chip variant={t.side === "BUY" ? "fill" : "weak"}>{t.side === "BUY" ? "매수" : "매도"}</Chip>}
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={`${t.name} ${t.qty}주`}
                bottom={`${formatNumber(t.price)}원 · 수수료 ${formatNumber(t.fee)}원`}
              />
            }
            right={
              <Paragraph.Text typography="st13" color="tertiary">
                {formatKstDateTime(t.tradedAt)}
              </Paragraph.Text>
            }
          />
        </div>
      ))}
      {hasMore ? (
        <>
          <Spacing size={12} />
          <Button variant="weak" display="block" onClick={loadMore}>
            더 보기
          </Button>
        </>
      ) : null}
    </div>
  );
}
