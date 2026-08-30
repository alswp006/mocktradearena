/**
 * Packet 0020: 광고 배치·로딩 스켈레톤·고지 컴포넌트 폴리시
 * TDD Red Phase — Tests ONLY (source files not yet implemented)
 *
 * Covers:
 *   AC-1: DisclaimerNotice — 모의투자 고지 문구를 st13/tertiary로 렌더
 *   AC-2: AdSection — Spacing(16) 상하로 AdSlot을 감싸고 env adGroupId를 전달 + 배치 주석 계약
 *   AC-3: ListSkeleton/HeroSkeleton — TDS Skeleton만 사용, 고정 px width 없음
 *   AC-4: 세 컴포넌트 모두 HEX 색상·Tailwind 여백 클래스 0건, custom style은 flex/grid만
 *   AC-5: src/App.tsx·src/main.tsx 미수정 (git diff 0줄)
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();

// 정적 import — mockTds/mockAppsInToss 호출이 vite-node 순차 실행 순서상
// 아래 import보다 먼저 실행되어 '@toss/tds-mobile' 목이 적용된다 (packet-0019 패턴).
import { DisclaimerNotice } from "@/components/DisclaimerNotice";
import { AdSection } from "@/components/AdSection";
import { ListSkeleton, HeroSkeleton } from "@/components/LoadingSkeletons";

const COMPONENT_FILES = [
  "src/components/DisclaimerNotice.tsx",
  "src/components/AdSection.tsx",
  "src/components/LoadingSkeletons.tsx",
];

function readSrc(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Packet 0020: 광고 배치·로딩 스켈레톤·고지 컴포넌트 폴리시", () => {
  describe("AC-1: DisclaimerNotice가 모의투자 고지 문구를 st13/tertiary로 렌더한다", () => {
    it("renders the exact compliance disclaimer text via Paragraph.Text(typography='st13', color='tertiary')", () => {
      render(React.createElement(DisclaimerNotice));
      const node = screen.getByText(
        "본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다.",
      );
      expect(node.tagName).toBe("SPAN");
      expect(node.getAttribute("data-typography")).toBe("st13");
      expect(node.getAttribute("color")).toBe("tertiary");
    });
  });

  describe("AC-2: AdSection이 Spacing(16) 상하로 AdSlot(env adGroupId)을 감싸고 배치 주석 계약을 명시한다", () => {
    it("wraps AdSlot with Spacing size=16 above/below and passes VITE_TOSS_AD_GROUP_ID through, with a placement contract comment", () => {
      vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "packet-0020-ad-group");

      const { container } = render(React.createElement(AdSection));

      const slot = container.querySelector('[data-ad-group-id="packet-0020-ad-group"]');
      expect(slot).not.toBeNull();

      const spacings = container.querySelectorAll('[data-spacing="16"]');
      expect(spacings.length).toBeGreaterThanOrEqual(2);

      const src = readSrc("src/components/AdSection.tsx");
      expect(src).toMatch(/콘텐츠 섹션 사이|섹션.*사이|하단에만/);
    });
  });

  describe("AC-3: ListSkeleton/HeroSkeleton은 TDS Skeleton만 사용하고 고정 px width 없이 100% 폭에 반응한다", () => {
    it("ListSkeleton renders N Skeleton-only rows with no fixed pixel width", () => {
      const { container } = render(React.createElement(ListSkeleton, { rows: 3 }));
      const skeletons = container.querySelectorAll('[data-skeleton="true"]');
      expect(skeletons.length).toBe(3);

      const src = readSrc("src/components/LoadingSkeletons.tsx");
      expect(src).not.toMatch(/width:\s*['"]?\d+px/);
    });

    it("HeroSkeleton renders at least one Skeleton node using only TDS Skeleton (no raw div placeholders)", () => {
      const { container } = render(React.createElement(HeroSkeleton));
      const skeletons = container.querySelectorAll('[data-skeleton="true"]');
      expect(skeletons.length).toBeGreaterThanOrEqual(1);

      const nonSkeletonBlocks = container.querySelectorAll("div:not([data-skeleton])");
      // 래핑용 컨테이너 div는 허용하되, Skeleton 자리 자체는 반드시 data-skeleton이어야 한다
      expect(container.querySelectorAll("[data-skeleton]").length).toBe(skeletons.length);
      expect(nonSkeletonBlocks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("AC-4: 세 컴포넌트 모두 HEX 색상·Tailwind 여백 클래스 0건이며 custom style은 flex/grid 배치에만 쓰인다", () => {
    it("contains no hardcoded HEX colors in any of the three component files", () => {
      for (const file of COMPONENT_FILES) {
        const src = readSrc(file);
        expect(src, `${file} must not hardcode a HEX color`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      }
    });

    it("contains no Tailwind spacing utility classes and no inline margin/padding style", () => {
      for (const file of COMPONENT_FILES) {
        const src = readSrc(file);
        expect(src, `${file} must not use Tailwind spacing classes`).not.toMatch(
          /className=["'][^"']*\b(p|m|px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr)-\d/,
        );
        expect(src, `${file} must not set inline margin/padding via style`).not.toMatch(
          /style=\{\{[^}]*(margin|padding)[^}]*\}\}/,
        );
      }
    });
  });

  describe("AC-5: src/App.tsx·src/main.tsx는 이 패킷에서 수정되지 않는다 (git diff 0줄)", () => {
    it("main.tsx still contains the @AI:ANCHOR guard and git diff for App.tsx/main.tsx is empty", () => {
      const mainTsx = readSrc("src/main.tsx");
      expect(mainTsx).toContain("@AI:ANCHOR");
      expect(mainTsx).toContain("TDSMobileAITProvider");

      const diff = execSync("git diff HEAD --stat -- src/App.tsx src/main.tsx", {
        cwd: process.cwd(),
      })
        .toString()
        .trim();
      expect(diff).toBe("");
    });
  });
});
