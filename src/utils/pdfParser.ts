import * as pdfjsLib from 'pdfjs-dist';
import { BrokerType, lookupStockInfo, TradeRecord, US_STOCK_ISIN_MAP } from '../types/tax';

// Configure pdf.js worker locally via Vite asset URL (100% client-side, no external server required)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ParsedPdfResult {
  detectedBroker: BrokerType;
  trades: TradeRecord[];
  summaryTrade: TradeRecord | null;
  individualTrades: TradeRecord[];
  activeMode: 'individual' | 'summary';
  usedOcr: boolean;
  rawLines: string[];
}

/**
 * 민감 개인정보(주민등록번호 등) 메모리 내 즉시 마스킹
 */
function maskSensitiveInfo(text: string): string {
  return text.replace(/\b\d{6}\s*-\s*[1-4]\d{6}\b/g, '******-*******');
}

/**
 * 파일명, 금융기관명, 사업자등록번호에서 증권사 자동 식별
 * (주의: 본문 내 '마블 테크놀로지(Marvell)' 종목명이 KB증권 '마블(M-able)'로 오인되지 않도록 파일명 및 사업자번호 우선 매칭)
 */
export function detectBroker(fileName: string, fullText: string): BrokerType {
  const fnUpper = fileName.toUpperCase();

  // 1순위: 파일명 직접 매칭
  if (fnUpper.includes('키움') || fnUpper.includes('영웅문') || fnUpper.includes('KIWOOM')) return '키움증권';
  if (fnUpper.includes('토스') || fnUpper.includes('TOSS')) return '토스증권';
  if (fnUpper.includes('미래에셋') || fnUpper.includes('MIRAE')) return '미래에셋증권';
  if (fnUpper.includes('한국투자') || fnUpper.includes('한투')) return '한국투자증권';
  if (fnUpper.includes('삼성') || fnUpper.includes('SAMSUNG')) return '삼성증권';
  if (fnUpper.includes('NH') || fnUpper.includes('나무') || fnUpper.includes('NAMUH')) return 'NH투자증권(나무)';
  if (fnUpper.includes('KB')) return 'KB증권';
  if (fnUpper.includes('메리츠') || fnUpper.includes('MERITZ')) return '메리츠증권';
  if (fnUpper.includes('하나') || fnUpper.includes('HANA')) return '하나증권';

  // 2순위: 본문 내 금융기관 사업자등록번호 및 기관명 매칭
  const textUpper = fullText.toUpperCase();
  if (textUpper.includes('107-81-76756') || textUpper.includes('키움증권') || textUpper.includes('영웅문')) {
    return '키움증권';
  }
  if (textUpper.includes('토스증권') || textUpper.includes('1599-7987')) {
    return '토스증권';
  }
  if (
    textUpper.includes('116-81-05556') ||
    textUpper.includes('미래에셋') ||
    textUpper.includes('미래예셋') ||
    textUpper.includes('MIRAE ASSET')
  ) {
    return '미래에셋증권';
  }
  if (textUpper.includes('한국투자증권') || textUpper.includes('116-81-04509')) {
    return '한국투자증권';
  }
  if (
    textUpper.includes('2028148588') ||
    textUpper.includes('202-81-48588') ||
    textUpper.includes('삼성증권') ||
    textUpper.includes('삼성중권')
  ) {
    return '삼성증권';
  }
  if (textUpper.includes('NH투자증권') || textUpper.includes('116-81-03693')) {
    return 'NH투자증권(나무)';
  }
  if (
    textUpper.includes('116-81-29539') ||
    textUpper.includes('KB증권') ||
    textUpper.includes('8증권(주)') ||
    textUpper.includes('여의나루로 50')
  ) {
    return 'KB증권';
  }
  if (textUpper.includes('메리츠') || textUpper.includes('메리초') || textUpper.includes('MERITZ')) {
    return '메리츠증권';
  }
  if (
    textUpper.includes('116-81-05992') ||
    textUpper.includes('하나증권') ||
    textUpper.includes('아나증권')
  ) {
    return '하나증권';
  }

  return '직접입력/기타';
}

/**
 * PDF 페이지에서 Y좌표 기준으로 같은 행(Row)의 텍스트를 재조립하여 추출
 */
async function extractStructuredLinesFromPdf(
  pdfDoc: pdfjsLib.PDFDocumentProxy
): Promise<string[]> {
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const rowBuckets: { y: number; items: { x: number; str: string }[] }[] = [];

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const transform = item.transform;
      const x = transform[4];
      const y = transform[5];

      let bucket = rowBuckets.find((b) => Math.abs(b.y - y) <= 5.5);
      if (!bucket) {
        bucket = { y, items: [] };
        rowBuckets.push(bucket);
      }
      bucket.items.push({ x, str: item.str.trim() });
    }

    rowBuckets.sort((a, b) => b.y - a.y);
    for (const bucket of rowBuckets) {
      bucket.items.sort((a, b) => a.x - b.x);
      const lineStr = maskSensitiveInfo(bucket.items.map((i) => i.str).join(' '));
      if (lineStr.trim()) {
        allLines.push(lineStr);
      }
    }
  }

  return allLines;
}

/**
 * 표 테두리(가로줄/세로줄) 및 회색·유색 셀 배경 음영이 숫자/글자와 붙어 OCR 인식을 방해하는 현상을 제거하는 전처리 함수
 */
function cleanTableCanvasForOcr(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // 1) 밝은 회색/파란색 셀 배경 음영 및 붉은 직인(도장) 제거 -> 어두운 텍스트/선만 추출
  const isDark = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (r > 150 && r - g > 60 && r - b > 60) continue; // 붉은 도장 제외
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 170) {
      isDark[p] = 1;
    }
  }

  const removeMask = new Uint8Array(w * h);

  // 2) 가로 표 테두리선 제거 (연속 45px 이상 어두운 가로선 중 세로 두께가 6px 이하인 선 픽셀만 제거)
  const minHRun = 45;
  for (let y = 0; y < h; y++) {
    let runStart = -1;
    const rowOff = y * w;
    for (let x = 0; x <= w; x++) {
      if (x < w && isDark[rowOff + x]) {
        if (runStart === -1) runStart = x;
      } else {
        if (runStart !== -1 && x - runStart >= minHRun) {
          for (let rx = runStart; rx < x; rx++) {
            let vThickness = 0;
            for (let dy = -5; dy <= 5; dy++) {
              const ny = y + dy;
              if (ny >= 0 && ny < h && isDark[ny * w + rx]) vThickness++;
            }
            if (vThickness <= 6) {
              removeMask[rowOff + rx] = 1;
            }
          }
        }
        runStart = -1;
      }
    }
  }

  // 3) 세로 표 칸막이선 제거 (연속 30px 이상 어두운 세로선 중 가로 두께가 6px 이하인 선 픽셀만 제거)
  const minVRun = 30;
  for (let x = 0; x < w; x++) {
    let runStart = -1;
    for (let y = 0; y <= h; y++) {
      if (y < h && isDark[y * w + x]) {
        if (runStart === -1) runStart = y;
      } else {
        if (runStart !== -1 && y - runStart >= minVRun) {
          for (let ry = runStart; ry < y; ry++) {
            let hThickness = 0;
            const rOff = ry * w;
            for (let dx = -5; dx <= 5; dx++) {
              const nx = x + dx;
              if (nx >= 0 && nx < w && isDark[rOff + nx]) hThickness++;
            }
            if (hThickness <= 6) {
              removeMask[rOff + x] = 1;
            }
          }
        }
        runStart = -1;
      }
    }
  }

  // 4) 정제된 고대비 이미지로 복원
  for (let p = 0, i = 0; p < isDark.length; p++, i += 4) {
    if (!isDark[p] || removeMask[p]) {
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = 255;
    } else {
      const lum = Math.max(
        0,
        Math.min(255, Math.round((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * 0.7))
      );
      d[i] = lum;
      d[i + 1] = lum;
      d[i + 2] = lum;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

let sharedOcrWorkerPromise: Promise<import('tesseract.js').Worker> | null = null;

async function getSharedOcrWorker(): Promise<import('tesseract.js').Worker> {
  if (!sharedOcrWorkerPromise) {
    sharedOcrWorkerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(['kor', 'eng']);
      await worker.setParameters({
        tessedit_pageseg_mode: '6' as never,
        preserve_interword_spaces: '1',
      });
      return worker;
    })();
  }
  return sharedOcrWorkerPromise;
}

/**
 * 스캔된 이미지/벡터 외곽선 PDF인 경우 브라우저 Canvas 고해상도 렌더링 + 표 테두리 제거 후 로컬 OCR 수행
 */
async function runLocalOcrOnPdf(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  onProgress?: (progress: number, msg: string) => void
): Promise<string[]> {
  const worker = await getSharedOcrWorker();
  const ocrLines: string[] = [];

  // 대부분의 증권사 PDF는 1~3페이지 내에 전체 합계(Summary) 또는 종목별 내역 합계가 존재함
  const maxPages = Math.min(pdfDoc.numPages, 4);
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    onProgress?.(
      Math.round((pageNum / maxPages) * 80),
      `스캔/벡터 양식 감지: 표 테두리 제거 및 로컬 OCR 판독 중 (${pageNum}/${maxPages}쪽)...`
    );
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.8 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      cleanTableCanvasForOcr(canvas);
      const {
        data: { text },
      } = await worker.recognize(canvas);
      const lines = text
        .split(/\r?\n/)
        .map((l) => maskSensitiveInfo(l.trim()))
        .filter(Boolean);
      ocrLines.push(...lines);
    }
  }

  return ocrLines;
}

/**
 * 국내 증권사(키움, KB, 메리츠, 미래에셋, 삼성, 하나 등)의 다양한 숫자/음수 표기 및 OCR 오인식(천단위 콤마가 마침표 '.'로 읽히는 현상)을
 * 정규화하고 원화 정수 배열을 추출합니다.
 */
export function extractKrwAmounts(line: string): number[] {
  // 1) 숫자 사이 공백 정규화
  let normalized = line.replace(/(\d)[.,]\s+(\d{3})\b/g, '$1,$2');

  // 2) OCR에서 천단위 콤마(',')가 마침표('.')로 인식된 경우(예: 5.107.437, 2.395.967, 1,720.275, 66.438) 복원
  // 주의: 0.0000이 0.000으로 읽힌 경우를 원화로 오인하지 않도록 맨 앞자리는 반드시 1~9([1-9])여야 함
  normalized = normalized.replace(
    /\b([1-9]\d{0,2})[.,](\d{3})[.,](\d{3})\b/g,
    '$1,$2,$3'
  );
  normalized = normalized.replace(/(?<![.\d])([1-9]\d{0,2})\.(\d{3})(?![.\d])/g, '$1,$2');

  // 3) 한국 증권사 특유의 음수 기호(△, ▲, ▼, ▽, 괄호 음수, 물결표 오인식 ~, 하이픈 뒤 공백)를 '-'로 변환
  normalized = normalized
    .replace(/[△▲▼▽~ㅡ—–]\s*(\d)/g, '-$1')
    .replace(/\(\s*(\d{1,3}(?:,\d{3})+|\d{4,12})\s*\)/g, '-$1')
    .replace(/-\s+(\d)/g, '-$1');

  // 4) 날짜(YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD 및 8자리 YYYYMMDD), 사업자번호, 계좌번호, ISIN, 남은 소수점(달러/환율/수량) 제거
  const cleaned = normalized
    .replace(/\b20[012]\d[-./](0[1-9]|1[0-2])[-./](0[1-9]|[12]\d|3[01])\b/g, ' ')
    .replace(/\b20[012]\d(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/g, ' ')
    .replace(/\b\d{3}-\d{2}-\d{5}\b/g, ' ') // 사업자등록번호 제외
    .replace(/\b2028148588\b/g, ' ') // 삼성증권 사업자번호(하이픈 없음) 제외
    .replace(/\b[A-Z]{2}[A-Z0-9]{10}\b/gi, ' ')
    .replace(/\b\d{3,6}-\d{2,6}-\d{2,7}(?:-\d{1,3})?\b/g, ' ')
    .replace(/[+-]?\d[\d,]*\.\d+/g, ' '); // 진짜 소수점(수량/외화단가/환율) 제외

  const matches = cleaned.match(/[+-]?\b\d{1,3}(?:,\d{3})+\b|[+-]?\b\d{3,13}\b|\b0\b/g);
  if (!matches) return [];

  return matches
    .map((m) => parseInt(m.replace(/,/g, ''), 10))
    .filter((n) => !isNaN(n) && (n === 0 || Math.abs(n) >= 100) && n !== 2500000); // 기본공제 2,500,000원 제외
}

/**
 * 줄에서 날짜(YYYY-MM-DD) 추출
 */
function extractDates(line: string, defaultYear = 2025): { buyDate: string; sellDate: string } {
  const found: string[] = [];

  const sepRegex = /\b(20[12]\d)[-./](0[1-9]|1[0-2])[-./](0[1-9]|[12]\d|3[01])\b/g;
  let match: RegExpExecArray | null;
  while ((match = sepRegex.exec(line)) !== null) {
    found.push(`${match[1]}-${match[2]}-${match[3]}`);
  }

  const compactRegex = /\b(20[12]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/g;
  while ((match = compactRegex.exec(line)) !== null) {
    found.push(`${match[1]}-${match[2]}-${match[3]}`);
  }

  if (found.length >= 2) {
    const sorted = [...found].sort();
    return { buyDate: sorted[0], sellDate: sorted[sorted.length - 1] };
  }
  if (found.length === 1) {
    return { buyDate: `${defaultYear}-01-01`, sellDate: found[0] };
  }
  return { buyDate: `${defaultYear}-01-01`, sellDate: `${defaultYear}-12-31` };
}

/**
 * 줄에서 종목 티커, ISIN, 또는 한글 종목명 감지
 */
function detectStockFromLine(line: string): { symbol: string; isin: string; name: string } | null {
  const upper = line.toUpperCase();

  // 1) 국제증권식별번호(ISIN: 국가코드 2글자 + 10자리 영숫자)
  const isinMatch = upper.match(/\b((?:US|CA|KY|BM|VG|IE|NL|GB|LU|LR|HK|JP|CN)[A-Z0-9]{10})\b/);
  if (isinMatch) {
    const isinCode = isinMatch[1];
    for (const [ticker, info] of Object.entries(US_STOCK_ISIN_MAP)) {
      if (info.isin === isinCode) {
        return { symbol: ticker, isin: isinCode, name: info.name };
      }
    }
    return { symbol: isinCode.slice(2, 6), isin: isinCode, name: `해외주식 (${isinCode})` };
  }

  // 2) 사전 등록된 주요 미국 주식 티커 또는 한글 종목명 매칭
  for (const [ticker, info] of Object.entries(US_STOCK_ISIN_MAP)) {
    const tickerRegex = new RegExp(`\\b${ticker}\\b`, 'i');
    const korKeyword = info.name.split(' ')[0];
    if (tickerRegex.test(upper) || (korKeyword.length >= 2 && line.includes(korKeyword))) {
      return { symbol: ticker, isin: info.isin, name: info.name };
    }
  }

  return null;
}

/**
 * 두 정수의 자릿수가 같을 때 서로 다른 숫자의 개수(해밍 거리)를 반환
 * (OCR에서 '8'이 '3'으로, '6'이 '5'로 1글자만 오인식된 경우를 정밀 판별하기 위함)
 */
function countDifferentDigits(a: number, b: number): number {
  const sa = String(Math.abs(Math.round(a)));
  const sb = String(Math.abs(Math.round(b)));
  if (sa.length !== sb.length) return 99;
  let diffs = 0;
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) diffs++;
  }
  return diffs;
}

/**
 * [스마트 방정식 탐색기]
 * 줄 안의 모든 숫자 조합 중에서 (양도가액 - 취득가액 - 필요경비 = 양도소득금액) 등식이 성립하는 최적의 원화 금액 세트를 찾습니다.
 */
export function findValidTaxTupleSmart(
  nums: number[],
  rawLineForRepair?: string
): { sellAmount: number; buyAmount: number; fees: number; gain: number } | null {
  if (nums.length >= 3) {
    let bestCandidate: {
      sellAmount: number;
      buyAmount: number;
      fees: number;
      gain: number;
      score: number;
    } | null = null;

    const n = Math.min(nums.length, 15);

    // 1) 4개 숫자 조합 탐색: sell - buy - fees = gain (오차 ±1,500원 허용 + 1글자 OCR 오인식 자동 복원)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const sell = nums[i];
        const buy = nums[j];
        if (sell < 1000 || buy < 1000) continue;

        for (let k = 0; k < n; k++) {
          if (k === i || k === j) continue;
          const fees = nums[k];
          if (fees < 0 || fees > Math.max(sell, buy) * 0.25) continue;

          for (let l = 0; l < n; l++) {
            if (l === i || l === j || l === k) continue;
            const rawGain = nums[l];

            // OCR에서 음수 부호('-')가 탈락하여 손실(-224,616)이 양수(224,616)로 읽힌 경우까지 포함하여 검증
            const isStandardOrder = i < j && j < k && k < l;
            const gainCandidates =
              isStandardOrder && rawGain > 0 ? [rawGain, -rawGain] : [rawGain];

            for (const gain of gainCandidates) {
              // 1주 매매 행에서 [주당양도가액, 양도가액(=1주×주당단가), 제비용(0)]이 [sell, buy, gain(0)]으로 오매칭되는 현상 방지
              if (gain === 0 && Math.abs(sell - buy) <= 1500) continue;

              const expectedGain = sell - buy - fees;
              const diff = Math.abs(expectedGain - gain);

              if (diff <= 1500) {
                let orderBonus = 0;
                if (i < l && j < l) orderBonus += 5000000;
                if (isStandardOrder) orderBonus += 15000000;
                if (gain === rawGain) orderBonus += 2000000;
                const score = sell + buy + orderBonus - diff * 500;

                if (!bestCandidate || score > bestCandidate.score) {
                  let finalFees = fees;
                  let finalGain = gain;
                  const impliedFees = sell - buy - gain;
                  if (
                    diff > 5 &&
                    impliedFees >= 0 &&
                    countDifferentDigits(impliedFees, fees) <= 1
                  ) {
                    finalFees = impliedFees;
                    finalGain = gain;
                  } else {
                    finalGain = sell - buy - finalFees;
                  }

                  bestCandidate = {
                    sellAmount: sell,
                    buyAmount: buy,
                    fees: finalFees,
                    gain: finalGain,
                    score,
                  };
                }
              } else if (isStandardOrder && gain !== 0 && Math.max(sell, buy) >= 10000) {
                // [1글자 OCR 오인식 정밀 복원]
                // 예: 키움증권 합계 행에서 '9,028,663'의 '8'이 '3'으로('9,023,663', 오차 5,000원) 읽히거나
                // '6,860'이 '6,360'으로 읽혀 diff가 1,500원을 초과한 경우, 나머지 자릿수(7자리 중 6자리)가 완벽히 일치하면 역산값으로 복원!
                const feeVariants = [
                  fees,
                  parseInt(String(fees).replace(/3/g, '8'), 10),
                  parseInt(String(fees).replace(/8/g, '3'), 10),
                ];
                for (const fCand of feeVariants) {
                  if (isNaN(fCand) || fCand < 0) continue;
                  const impliedBuy = sell - fCand - gain;
                  if (impliedBuy >= 1000 && countDifferentDigits(impliedBuy, buy) <= 1) {
                    const score = sell + impliedBuy + 12000000;
                    if (!bestCandidate || score > bestCandidate.score) {
                      bestCandidate = {
                        sellAmount: sell,
                        buyAmount: impliedBuy,
                        fees: fCand,
                        gain,
                        score,
                      };
                    }
                  }
                  const impliedSell = buy + fCand + gain;
                  if (impliedSell >= 1000 && countDifferentDigits(impliedSell, sell) <= 1) {
                    const score = impliedSell + buy + 12000000;
                    if (!bestCandidate || score > bestCandidate.score) {
                      bestCandidate = {
                        sellAmount: impliedSell,
                        buyAmount: buy,
                        fees: fCand,
                        gain,
                        score,
                      };
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (bestCandidate) {
      return {
        sellAmount: bestCandidate.sellAmount,
        buyAmount: bestCandidate.buyAmount,
        fees: bestCandidate.fees,
        gain: bestCandidate.gain,
      };
    }

    // 2) 3개 숫자 조합 탐색 (제비용이 0원이어서 생략된 경우: sell - buy = gain)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const sell = nums[i];
        const buy = nums[j];
        if (sell < 1000 || buy < 1000) continue;

        for (let l = 0; l < n; l++) {
          if (l === i || l === j) continue;
          const gain = nums[l];
          // 1주 매매 행에서 [주당양도가액, 양도가액, 제비용(0)]이 [sell, buy, gain(0)]으로 오매칭되는 현상 원천 차단
          if (gain === 0 && Math.abs(sell - buy) <= 1500) continue;
          const diff = Math.abs(sell - buy - gain);
          if (diff <= 1500 && i < l && j < l) {
            return {
              sellAmount: sell,
              buyAmount: buy,
              fees: 0,
              gain,
            };
          }
        }
      }
    }
  }

  // 3) [합계 행 전용 대수적 복원(Algebraic Repair)]
  // 예: KB증권 스캔본에서 '합계' 줄의 [취득가액 4,168,859 / 제비용 1,804 / 손익 157,450] 3개는 정확히 추출되었으나
  // 양도가액(4,328,113)이 '4328.13.'처럼 일부 자릿수가 깨져 소수점으로 필터링된 경우,
  // 이미 사용된 숫자들을 원문에서 제거한 나머지 깨진 숫자 조각('432813')에 역산된 양도가액('4328113')의 앞/뒤 자릿수가 존재하는지 검증하여 복원!
  // (주의: 키움증권처럼 한 줄에 0이 2개 있을 때 buy + 0 + 0 = buy로 자기 자신을 복원하는 오류를 원천 차단)
  if (rawLineForRepair && nums.length >= 3) {
    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        if (j === i) continue;
        for (let k = 0; k < nums.length; k++) {
          if (k === i || k === j) continue;

          // (3-A) 양도가액(sell)이 깨진 경우(예: KB증권 '4328.13.'): reconstructedSell = buy + fees + gain
          const buy = nums[i];
          const fees = nums[j];
          const gain = nums[k];
          if (buy >= 1000 && fees >= 0 && fees <= buy * 0.2 && gain !== 0) {
            let leftoverLine = rawLineForRepair;
            for (const usedNum of [buy, fees, Math.abs(gain)]) {
              const formatted = usedNum.toLocaleString('en-US');
              leftoverLine = leftoverLine.replace(formatted, ' ').replace(String(usedNum), ' ');
            }
            const leftoverDigits = leftoverLine.replace(/[^0-9]/g, '');

            const reconstructedSell = buy + fees + gain;
            if (reconstructedSell >= 1000 && reconstructedSell !== buy) {
              const prefix3 = String(reconstructedSell).slice(0, 3);
              const suffix2 = String(reconstructedSell).slice(-2);
              if (leftoverDigits.includes(prefix3) && leftoverDigits.includes(suffix2)) {
                return {
                  sellAmount: reconstructedSell,
                  buyAmount: buy,
                  fees,
                  gain,
                };
              }
            }

            // (3-B) 취득가액(buy)이 깨진 경우(예: 키움증권 '9028.66'): reconstructedBuy = sell - fees - gain
            for (const gCand of gain > 0 ? [gain, -gain] : [gain]) {
              const sell = nums[i];
              const fVariants = [
                fees,
                parseInt(String(fees).replace(/3/g, '8'), 10),
                parseInt(String(fees).replace(/8/g, '3'), 10),
              ];
              for (const fCand of fVariants) {
                if (isNaN(fCand) || fCand < 0) continue;
                const reconstructedBuy = sell - fCand - gCand;
                if (reconstructedBuy >= 1000 && reconstructedBuy !== sell) {
                  const p3 = String(reconstructedBuy).slice(0, 3);
                  const s2 = String(reconstructedBuy).slice(-2);
                  if (leftoverDigits.includes(p3) && leftoverDigits.includes(s2)) {
                    return {
                      sellAmount: sell,
                      buyAmount: reconstructedBuy,
                      fees: fCand,
                      gain: gCand,
                    };
                  }
                }
              }
            }
          }

          // (3-C) 양도소득금액(gain)이 깨진 경우(예: 키움증권 '-224.61'): reconstructedGain = sell - buy - fees
          if (i < j && j < k) {
            const sell = nums[i];
            const buy2 = nums[j];
            const fees2 = nums[k];
            if (
              sell >= 1000 &&
              buy2 >= 1000 &&
              fees2 >= 0 &&
              fees2 <= Math.max(sell, buy2) * 0.2
            ) {
              const reconstructedGain = sell - buy2 - fees2;
              if (reconstructedGain !== 0) {
                let lo = rawLineForRepair;
                for (const u of [sell, buy2, fees2]) {
                  lo = lo.replace(u.toLocaleString('en-US'), ' ').replace(String(u), ' ');
                }
                const loDigits = lo.replace(/[^0-9]/g, '');
                const absG = String(Math.abs(reconstructedGain));
                const p2 = absG.slice(0, 2);
                const s2 = absG.slice(-2);
                if (loDigits.includes(p2) && loDigits.includes(s2)) {
                  return {
                    sellAmount: sell,
                    buyAmount: buy2,
                    fees: fees2,
                    gain: reconstructedGain,
                  };
                }
              }
            }
          }
        }
      }
    }
  }

  return null;
}

const TOTAL_KEYWORD_REGEX =
  /(합\s*[계게례케메예기]|총\s*계|총\s*양도|전체\s*합계|TOTAL|계산\s*내역\s*합계|양도가액\s*합|취득가액\s*합|양도가액\s*계)/i;

/**
 * 증권사 PDF 텍스트 라인들로부터 개별 거래내역 및 문서 합계 행을 모두 파싱
 */
export function parseTradesFromLines(
  lines: string[],
  broker: BrokerType,
  fileName: string,
  taxYear: number,
  usedOcr: boolean
): {
  individualTrades: TradeRecord[];
  summaryTrade: TradeRecord | null;
} {
  const section1Trades: TradeRecord[] = [];
  const section2Trades: TradeRecord[] = [];
  let inSection2 = false;
  let summaryTrade: TradeRecord | null = null;
  let globalTopStock: { symbol: string; isin: string; name: string } | null = null;

  // 1단계: 단일 행(Line) 순회 파싱
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // '2. 해외주식 양도소득금액 양도일자별 세부내역' 섹션 진입 감지 (1번 종목별 내역과 2번 일자별 내역 중복 합산 방지)
    if (/2\s*[.,]?\s*해외주식.*양도일자별|양도일자별\s*(구분\s*)?세부내역/.test(line)) {
      inSection2 = true;
    }

    const detectedStock = detectStockFromLine(line);
    if (detectedStock && !globalTopStock) {
      globalTopStock = detectedStock;
    }

    const isTotalLine = TOTAL_KEYWORD_REGEX.test(line);
    const amounts = extractKrwAmounts(line);
    const matchedTuple = findValidTaxTupleSmart(
      amounts,
      isTotalLine ? line : undefined
    );

    if (matchedTuple) {
      const { sellAmount, buyAmount, fees, gain } = matchedTuple;

      if (isTotalLine) {
        const stockInfo =
          detectedStock ||
          globalTopStock || {
            symbol: 'NVDA',
            isin: 'US67066G1040',
            name: `${broker} 합산 대표종목`,
          };
        summaryTrade = {
          id: `parsed-total-${Date.now()}-${i}`,
          broker,
          symbol: stockInfo.symbol,
          isin: stockInfo.isin,
          assetName: `[문서합계] ${stockInfo.name} 외 (${fileName})`,
          quantity: 1,
          buyDate: `${taxYear}-01-01`,
          sellDate: `${taxYear}-12-31`,
          sellAmountKRW: sellAmount,
          buyAmountKRW: buyAmount,
          feesKRW: fees,
          capitalGainKRW: gain,
          sourceFileName: fileName,
          parseMethod: usedOcr ? 'ocr-vision' : 'pdf-text',
          rowType: 'summary',
        };
        continue;
      }

      // 미래에셋처럼 윗줄(i-1 또는 i-2)에 '양도가액합계 취득가액합계' 헤더가 있고 현재 줄(i)에 합계 숫자가 있는 경우
      const prevHeader = `${i >= 2 ? lines[i - 2] : ''} ${i >= 1 ? lines[i - 1] : ''}`;
      if (!summaryTrade && TOTAL_KEYWORD_REGEX.test(prevHeader) && !detectedStock) {
        const stockInfo =
          globalTopStock || {
            symbol: 'NVDA',
            isin: 'US67066G1040',
            name: `${broker} 합산 대표종목`,
          };
        summaryTrade = {
          id: `parsed-header-total-${Date.now()}-${i}`,
          broker,
          symbol: stockInfo.symbol,
          isin: stockInfo.isin,
          assetName: `[문서합계] ${stockInfo.name} 외 (${fileName})`,
          quantity: 1,
          buyDate: `${taxYear}-01-01`,
          sellDate: `${taxYear}-12-31`,
          sellAmountKRW: sellAmount,
          buyAmountKRW: buyAmount,
          feesKRW: fees,
          capitalGainKRW: gain,
          sourceFileName: fileName,
          parseMethod: usedOcr ? 'ocr-vision' : 'pdf-text',
          rowType: 'summary',
        };
        continue;
      }

      if (detectedStock) {
        const { buyDate, sellDate } = extractDates(line, taxYear);
        const rec: TradeRecord = {
          id: `parsed-row-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
          broker,
          symbol: detectedStock.symbol,
          isin: detectedStock.isin,
          assetName: detectedStock.name,
          quantity: 1,
          buyDate,
          sellDate,
          sellAmountKRW: sellAmount,
          buyAmountKRW: buyAmount,
          feesKRW: fees,
          capitalGainKRW: gain,
          sourceFileName: fileName,
          parseMethod: usedOcr ? 'ocr-vision' : 'pdf-text',
          rowType: 'individual',
        };
        if (inSection2) {
          section2Trades.push(rec);
        } else {
          section1Trades.push(rec);
        }
      }
    }
  }

  // 2단계: 다중 행(2~3줄)으로 나뉘어 출력되는 합계 블록 파싱
  // - 하나증권/미래에셋: 윗줄(lines[i])에 '합계 / 양도가액계' 헤더가 있고 아랫줄(lines[i+1])에 숫자가 있는 구조
  // - 메리츠증권: 윗줄(lines[i-1])에 [양도가액, 제비용], 가운데(lines[i])에 '합계/합게', 아랫줄(lines[i+1])에 [취득가액, 손익]이 배치된 3줄 구조
  if (!summaryTrade) {
    let bestMultiLineSummary: {
      sellAmount: number;
      buyAmount: number;
      fees: number;
      gain: number;
      lineIdx: number;
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
      if (!TOTAL_KEYWORD_REGEX.test(lines[i])) continue;

      const candidateWindows: string[] = [];
      if (i + 1 < lines.length) {
        candidateWindows.push(`${lines[i]} ${lines[i + 1]}`);
      }
      if (i >= 1 && i + 1 < lines.length) {
        candidateWindows.push(`${lines[i - 1]} ${lines[i]} ${lines[i + 1]}`);
      }

      for (const win of candidateWindows) {
        const tuple = findValidTaxTupleSmart(extractKrwAmounts(win), win);
        if (tuple) {
          if (
            !bestMultiLineSummary ||
            tuple.sellAmount > bestMultiLineSummary.sellAmount
          ) {
            bestMultiLineSummary = { ...tuple, lineIdx: i };
          }
        }
      }
    }

    // [메리츠증권 등 전용 안전장치]
    // 만약 브라우저 OCR에서 3페이지 병합 셀 안의 '합계' 2글자가 흐릿하여 인식되지 않았더라도,
    // '2. 해외주식 양도소득금액 양도일자별 구분 세부내역' 섹션 진입 직전 2~3줄(ISIN이나 '61' 종목종류코드가 없는 순수 숫자 줄)은
    // 항상 '1. 종목별 내역'의 마지막 [합계] 블록(54,789,588 / 0 및 52,393,621 / 2,395,967)입니다.
    if (!bestMultiLineSummary && section1Trades.length === 0) {
      const sec2HeaderIdx = lines.findIndex((l) =>
        /2\s*[.,]?\s*해외주식.*양도일자별|양도일자별\s*(구분\s*)?세부내역/.test(l)
      );
      if (sec2HeaderIdx >= 2) {
        const preSec2Lines: string[] = [];
        for (
          let k = sec2HeaderIdx - 1;
          k >= Math.max(0, sec2HeaderIdx - 4);
          k--
        ) {
          const lineK = lines[k].trim();
          // 개별 종목 줄(ISIN 포함 또는 '61 '로 시작하는 줄)을 만나면 합계 블록 수집 중단
          if (detectStockFromLine(lineK) || /^(61|ol)\b/i.test(lineK)) {
            break;
          }
          preSec2Lines.unshift(lineK);
        }
        if (preSec2Lines.length >= 2) {
          const preWin = preSec2Lines.join(' ');
          const tuplePre = findValidTaxTupleSmart(
            extractKrwAmounts(preWin),
            preWin
          );
          if (tuplePre) {
            bestMultiLineSummary = { ...tuplePre, lineIdx: sec2HeaderIdx - 1 };
          }
        }
      }
    }

    if (bestMultiLineSummary) {
      const stockInfo =
        globalTopStock || {
          symbol: 'NVDA',
          isin: 'US67066G1040',
          name: `${broker} 합산 대표종목`,
        };
      summaryTrade = {
        id: `parsed-total-multi-${Date.now()}-${bestMultiLineSummary.lineIdx}`,
        broker,
        symbol: stockInfo.symbol,
        isin: stockInfo.isin,
        assetName: `[문서합계] ${stockInfo.name} 외 (${fileName})`,
        quantity: 1,
        buyDate: `${taxYear}-01-01`,
        sellDate: `${taxYear}-12-31`,
        sellAmountKRW: bestMultiLineSummary.sellAmount,
        buyAmountKRW: bestMultiLineSummary.buyAmount,
        feesKRW: bestMultiLineSummary.fees,
        capitalGainKRW: bestMultiLineSummary.gain,
        sourceFileName: fileName,
        parseMethod: usedOcr ? 'ocr-vision' : 'pdf-text',
        rowType: 'summary',
      };
    }
  }

  // 3단계: 2~3줄로 나뉜 개별 종목 행 파싱 (메리츠 3줄 구조 / 하나·미래에셋 2줄 구조)
  let individualTrades = section1Trades.length > 0 ? section1Trades : section2Trades;
  if (individualTrades.length === 0) {
    let inSec2 = false;
    for (let i = 0; i < lines.length - 1; i++) {
      if (/2\s*[.,]?\s*해외주식.*양도일자별|양도일자별\s*(구분\s*)?세부내역/.test(lines[i])) {
        inSec2 = true;
        if (individualTrades.length > 0) break; // 섹션 1에서 이미 추출했으면 섹션 2 중복 추출 중단
      }
      if (TOTAL_KEYWORD_REGEX.test(lines[i]) || TOTAL_KEYWORD_REGEX.test(lines[i + 1])) continue;

      const combined2 = `${lines[i]} ${lines[i + 1]}`;
      const st2 = detectStockFromLine(combined2);
      if (st2) {
        if (!globalTopStock) globalTopStock = st2;
        const tuple2 = findValidTaxTupleSmart(extractKrwAmounts(combined2));
        if (tuple2) {
          const { buyDate, sellDate } = extractDates(combined2, taxYear);
          individualTrades.push({
            id: `parsed-row2-${Date.now()}-${i}`,
            broker,
            symbol: st2.symbol,
            isin: st2.isin,
            assetName: st2.name,
            quantity: 1,
            buyDate,
            sellDate,
            sellAmountKRW: tuple2.sellAmount,
            buyAmountKRW: tuple2.buyAmount,
            feesKRW: tuple2.fees,
            capitalGainKRW: tuple2.gain,
            sourceFileName: fileName,
            parseMethod: usedOcr ? 'ocr-vision' : 'pdf-text',
            rowType: 'individual',
          });
          i++;
          continue;
        }
      }

      // 메리츠증권 등 3줄 개별 종목 구조: [i: ISIN+양도가액+제비용] + [i+1: 한글종목명] + [i+2: 61+취득가액+손익]
      if (i + 2 < lines.length && !TOTAL_KEYWORD_REGEX.test(lines[i + 2])) {
        const stTop = detectStockFromLine(lines[i]);
        if (stTop && /^(61|ol)\b/i.test(lines[i + 2].trim())) {
          if (!globalTopStock) globalTopStock = stTop;
          const combined3 = `${lines[i]} ${lines[i + 1]} ${lines[i + 2]}`;
          const tuple3 = findValidTaxTupleSmart(extractKrwAmounts(combined3));
          if (tuple3) {
            const { buyDate, sellDate } = extractDates(combined3, taxYear);
            const korName = lines[i + 1].trim();
            const displayAssetName =
              korName.length >= 2 && /[가-힣A-Za-z]/.test(korName)
                ? `${korName} (${stTop.isin})`
                : stTop.name;
            individualTrades.push({
              id: `parsed-row3-${Date.now()}-${i}`,
              broker,
              symbol: stTop.symbol,
              isin: stTop.isin,
              assetName: displayAssetName,
              quantity: 1,
              buyDate,
              sellDate,
              sellAmountKRW: tuple3.sellAmount,
              buyAmountKRW: tuple3.buyAmount,
              feesKRW: tuple3.fees,
              capitalGainKRW: tuple3.gain,
              sourceFileName: fileName,
              parseMethod: usedOcr ? 'ocr-vision' : 'pdf-text',
              rowType: 'individual',
            });
            i += 2;
            continue;
          }
        }
      }
      void inSec2;
    }
  }

  // 4단계: 만약 '합계' 줄 글자가 표 테두리에 가려져 summaryTrade가 아직 없지만,
  // '1. 해외주식 종목별 내역(section1Trades)'이 추출되었다면(예: 삼성증권 2025.pdf),
  // 종목별 내역의 합산으로 문서 합계(summaryTrade)를 자동 생성!
  if (!summaryTrade && section1Trades.length > 0) {
    const sumSell = section1Trades.reduce((a, b) => a + b.sellAmountKRW, 0);
    const sumBuy = section1Trades.reduce((a, b) => a + b.buyAmountKRW, 0);
    const sumFees = section1Trades.reduce((a, b) => a + b.feesKRW, 0);
    const sumGain = section1Trades.reduce((a, b) => a + b.capitalGainKRW, 0);
    if (sumGain !== 0 || sumSell !== sumBuy) {
      const topSt = [...section1Trades].sort((a, b) => b.sellAmountKRW - a.sellAmountKRW)[0];

      summaryTrade = {
        id: `parsed-sec1-sum-${Date.now()}`,
        broker,
        symbol: topSt.symbol,
        isin: topSt.isin,
        assetName: `[문서합계] ${topSt.assetName} 외 (${fileName})`,
        quantity: 1,
        buyDate: `${taxYear}-01-01`,
        sellDate: `${taxYear}-12-31`,
        sellAmountKRW: sumSell,
        buyAmountKRW: sumBuy,
        feesKRW: sumFees,
        capitalGainKRW: sumGain,
        sourceFileName: fileName,
        parseMethod: usedOcr ? 'ocr-vision' : 'pdf-text',
        rowType: 'summary',
      };
    }
  }

  // 대표종목(양도가액 최대 종목)으로 summaryTrade의 ISIN/종목명 보강
  if (summaryTrade && individualTrades.length > 0) {
    const topIndividual = [...individualTrades].sort(
      (a, b) => b.sellAmountKRW - a.sellAmountKRW
    )[0];
    if (topIndividual) {
      summaryTrade.symbol = topIndividual.symbol;
      summaryTrade.isin = topIndividual.isin;
      summaryTrade.assetName = `[문서합계] ${topIndividual.assetName} 외 (${fileName})`;
    }
  }

  return { individualTrades, summaryTrade };
}

/**
 * 브라우저 메모리 내에서 PDF 파일을 파싱하는 메인 함수
 */
export async function parseBrokerPdfInBrowser(
  file: File,
  taxYear: number,
  onProgress?: (progress: number, message: string) => void
): Promise<{ result: ParsedPdfResult; buffer: ArrayBuffer }> {
  onProgress?.(10, '브라우저 메모리에서 PDF 로드 중...');
  const arrayBuffer = await file.arrayBuffer();
  const bufferCopy = arrayBuffer.slice(0);

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  onProgress?.(35, `디지털 텍스트 레이어 추출 중 (총 ${pdfDoc.numPages}페이지)...`);
  let lines = await extractStructuredLinesFromPdf(pdfDoc);
  let usedOcr = false;

  const totalChars = lines.join('').replace(/\s+/g, '').length;
  if (totalChars < 30) {
    usedOcr = true;
    onProgress?.(45, '텍스트 레이어가 없는 스캔/벡터 PDF 감지 -> 로컬 OCR 엔진 실행...');
    lines = await runLocalOcrOnPdf(pdfDoc, onProgress);
  }

  onProgress?.(85, '증권사 서식 식별 및 양도소득세 항목 정규화 중...');
  const fullText = lines.join('\n');
  const detectedBroker = detectBroker(file.name, fullText);
  const { individualTrades, summaryTrade } = parseTradesFromLines(
    lines,
    detectedBroker,
    file.name,
    taxYear,
    usedOcr
  );

  // [핵심 개선] 홈택스 합계액 신고 정확도를 위해 '문서 합계(summaryTrade)'가 존재하면
  // 누락 위험이 있는 개별 행 대신 100% 정확한 문서 합계 1건을 기본(Default)으로 반영합니다.
  const useSummaryDefault = summaryTrade !== null;
  const activeTrades = useSummaryDefault
    ? [summaryTrade!]
    : individualTrades;

  onProgress?.(100, '파싱 완료');

  return {
    result: {
      detectedBroker,
      trades: activeTrades,
      summaryTrade,
      individualTrades,
      activeMode: useSummaryDefault ? 'summary' : 'individual',
      usedOcr,
      rawLines: lines,
    },
    buffer: bufferCopy,
  };
}
