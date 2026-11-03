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
  usedOcr: boolean;
  rawTextPreview: string;
}

/**
 * 민감 개인정보(주민등록번호 등) 메모리 내 즉시 마스킹
 */
function maskSensitiveInfo(text: string): string {
  return text.replace(/\b\d{6}\s*-\s*[1-4]\d{6}\b/g, '******-*******');
}

/**
 * 파일명 및 추출 텍스트에서 증권사 자동 식별
 */
export function detectBroker(fileName: string, fullText: string): BrokerType {
  const combined = `${fileName} ${fullText}`.toUpperCase();
  if (combined.includes('키움') || combined.includes('영웅문') || combined.includes('KIWOOM')) {
    return '키움증권';
  }
  if (combined.includes('토스') || combined.includes('TOSS')) {
    return '토스증권';
  }
  if (combined.includes('미래에셋') || combined.includes('MIRAE') || combined.includes('M-STOCK')) {
    return '미래에셋증권';
  }
  if (combined.includes('한국투자') || combined.includes('한투') || combined.includes('KOREA INVESTMENT')) {
    return '한국투자증권';
  }
  if (combined.includes('삼성증권') || combined.includes('SAMSUNG') || combined.includes('MPOP')) {
    return '삼성증권';
  }
  if (combined.includes('NH') || combined.includes('나무') || combined.includes('NAMUH')) {
    return 'NH투자증권(나무)';
  }
  if (combined.includes('KB증권') || combined.includes('M-ABLE') || combined.includes('마블')) {
    return 'KB증권';
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

    // Y 좌표(근사치 4px 이내)별로 그룹화하여 표의 행(Row) 구조 보존
    const rowBuckets: { y: number; items: { x: number; str: string }[] }[] = [];

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const transform = item.transform;
      const x = transform[4];
      const y = transform[5];

      let bucket = rowBuckets.find((b) => Math.abs(b.y - y) <= 4.5);
      if (!bucket) {
        bucket = { y, items: [] };
        rowBuckets.push(bucket);
      }
      bucket.items.push({ x, str: item.str.trim() });
    }

    // 위에서 아래로(Y 내림차순), 좌에서 우로(X 오름차순) 정렬
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
 * 스캔된 이미지 PDF인 경우 브라우저 Canvas 렌더링 후 Tesseract.js 로컬 OCR 폴백 수행
 */
async function runLocalOcrOnPdf(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  onProgress?: (progress: number, msg: string) => void
): Promise<string[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['kor', 'eng']);
  const ocrLines: string[] = [];

  try {
    const maxPages = Math.min(pdfDoc.numPages, 5); // 최대 5페이지 스캔
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      onProgress?.(
        Math.round((pageNum / maxPages) * 80),
        `스캔 이미지 감지: 브라우저 로컬 OCR 판독 중 (${pageNum}/${maxPages}쪽)...`
      );
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
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
  } finally {
    await worker.terminate();
  }

  return ocrLines;
}

/**
 * 문자열에서 금액(원화 정수) 배열을 추출
 */
function extractKrwAmounts(line: string): number[] {
  // 날짜(2025-01-01, 2025.01.01) 및 소수점(환율/달러단가 1,385.50 등) 먼저 제거하여 원화 정수만 정확히 추출
  const cleaned = line
    .replace(/\b20\d{2}[-./](0[1-9]|1[0-2])[-./](0[1-9]|[12]\d|3[01])\b/g, ' ')
    .replace(/\bUS[A-Z0-9]{10}\b/gi, ' ')
    .replace(/[+-]?\d[\d,]*\.\d+/g, ' '); // 소수점이 있는 외화/환율 숫자 제외

  const matches = cleaned.match(/[+-]?\b\d{1,3}(?:,\d{3})+\b|[+-]?\b\d{5,12}\b/g);
  if (!matches) return [];

  return matches
    .map((m) => parseInt(m.replace(/,/g, ''), 10))
    .filter((n) => !isNaN(n) && Math.abs(n) >= 100); // 최소 100원 이상
}

/**
 * 줄에서 날짜(YYYY-MM-DD) 추출
 */
function extractDates(line: string, defaultYear = 2025): { buyDate: string; sellDate: string } {
  const dateRegex = /\b(20\d{2})[-./](0[1-9]|1[0-2])[-./](0[1-9]|[12]\d|3[01])\b/g;
  const found: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = dateRegex.exec(line)) !== null) {
    found.push(`${match[1]}-${match[2]}-${match[3]}`);
  }
  if (found.length >= 2) {
    // 오름차순 정렬하여 앞선 날짜를 취득일, 뒤 날짜를 양도일로 지정
    const sorted = [...found].sort();
    return { buyDate: sorted[0], sellDate: sorted[sorted.length - 1] };
  }
  if (found.length === 1) {
    return { buyDate: `${defaultYear}-01-01`, sellDate: found[0] };
  }
  return { buyDate: `${defaultYear}-01-01`, sellDate: `${defaultYear}-12-31` };
}

/**
 * 줄에서 종목 티커 또는 ISIN 감지
 */
function detectStockFromLine(line: string): { symbol: string; isin: string; name: string } | null {
  const upper = line.toUpperCase();

  // 1) ISIN 코드(US로 시작하는 12자리 영숫자) 직접 매칭
  const isinMatch = upper.match(/\b(US[A-Z0-9]{10})\b/);
  if (isinMatch) {
    const isinCode = isinMatch[1];
    for (const [ticker, info] of Object.entries(US_STOCK_ISIN_MAP)) {
      if (info.isin === isinCode) {
        return { symbol: ticker, isin: isinCode, name: info.name };
      }
    }
    return { symbol: isinCode.slice(2, 6), isin: isinCode, name: `해외주식 (${isinCode})` };
  }

  // 2) 알려진 미국 주식 티커 또는 한글 종목명 매칭
  for (const [ticker, info] of Object.entries(US_STOCK_ISIN_MAP)) {
    const tickerRegex = new RegExp(`\\b${ticker}\\b`, 'i');
    const korKeyword = info.name.split(' ')[0];
    if (tickerRegex.test(upper) || line.includes(korKeyword)) {
      return { symbol: ticker, isin: info.isin, name: info.name };
    }
  }

  // 3) 일반 대문자 티커 패턴 (2~5글자)
  const STOP_WORDS = new Set([
    'USD',
    'KRW',
    'TOTAL',
    'SUM',
    'PAGE',
    'DATE',
    'ISIN',
    'TAX',
    'PDF',
    'HTS',
    'MTS',
    'ETF',
    'INC',
    'CORP',
  ]);
  const tokens = upper.match(/\b[A-Z]{2,5}\b/g) || [];
  for (const tok of tokens) {
    if (!STOP_WORDS.has(tok)) {
      const info = lookupStockInfo(tok);
      return info;
    }
  }

  return null;
}

/**
 * 증권사 PDF 텍스트 라인들로부터 개별 거래내역 또는 합계 행을 파싱
 */
export function parseTradesFromLines(
  lines: string[],
  broker: BrokerType,
  fileName: string,
  taxYear: number,
  usedOcr: boolean
): TradeRecord[] {
  const individualTrades: TradeRecord[] = [];
  let summaryTrade: TradeRecord | null = null;
  let globalTopStock: { symbol: string; isin: string; name: string } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 문서 내 등장하는 종목 기억 (합계 행만 추출될 때 대표종목으로 활용)
    const detectedStock = detectStockFromLine(line);
    if (detectedStock && !globalTopStock) {
      globalTopStock = detectedStock;
    }

    // 합계/총계 라인인지 확인
    const isTotalLine =
      /(합\s*계|총\s*계|총\s*양도|전체\s*합계|소\s*계|TOTAL)/i.test(line) &&
      !/기본공제|과세표준|산출세액/.test(line);

    const amounts = extractKrwAmounts(line);
    if (amounts.length < 2) continue;

    // [양도가액, 취득가액, 필요경비, 양도차익] 조합 탐색
    const matchedTuple = findValidTaxTuple(amounts);
    if (!matchedTuple) continue;

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
        assetName: `${stockInfo.name} 외 (${broker} 연간합계)`,
        quantity: 1,
        buyDate: `${taxYear}-01-01`,
        sellDate: `${taxYear}-12-31`,
        sellAmountKRW: sellAmount,
        buyAmountKRW: buyAmount,
        feesKRW: fees,
        capitalGainKRW: gain,
        sourceFileName: fileName,
        parseMethod: usedOcr ? 'ocr-vision' : 'pdf-text',
      };
      continue;
    }

    // 일반 종목 행인 경우
    if (detectedStock) {
      const { buyDate, sellDate } = extractDates(line, taxYear);
      individualTrades.push({
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
      });
    }
  }

  // 개별 종목 행들이 정상 추출되었다면 개별 종목 리스트 반환, 없으면 합계(Summary) 행 반환
  if (individualTrades.length > 0) {
    return individualTrades;
  }
  if (summaryTrade) {
    return [summaryTrade];
  }

  // 만약 세 줄에 걸쳐 세로형 요약표(토스증권 등: "총 양도금액 50,000,000" / "총 취득금액 40,000,000" / "필요경비 120,000")로 되어 있는 경우 파싱
  const verticalSummary = parseVerticalSummaryTable(lines, broker, fileName, taxYear, usedOcr, globalTopStock);
  if (verticalSummary) {
    return [verticalSummary];
  }

  return [];
}

/**
 * 한 줄의 숫자 배열에서 (양도가액 - 취득가액 - 제비용 = 양도소득금액) 관계를 만족하거나
 * 가장 유력한 [양도가액, 취득가액, 제비용] 튜플을 찾는다.
 */
function findValidTaxTuple(
  nums: number[]
): { sellAmount: number; buyAmount: number; fees: number; gain: number } | null {
  // 4개 이상의 숫자가 있을 때: A(양도) - B(취득) - C(비용) = D(차익) 공식 검증 (오차 ±100원 허용)
  for (let i = 0; i <= nums.length - 4; i++) {
    const a = nums[i];
    const b = nums[i + 1];
    const c = nums[i + 2];
    const d = nums[i + 3];
    if (a > 0 && b > 0 && c >= 0 && Math.abs(a - b - c - d) <= 500) {
      return { sellAmount: a, buyAmount: b, fees: c, gain: a - b - c };
    }
    // 일부 증권사(양도가액, 취득가액, 양도차익, 제비용 순서 또는 취득가액, 양도가액 순서) 대응
    if (a > 0 && b > 0 && d >= 0 && Math.abs(a - b - d - c) <= 500) {
      return { sellAmount: a, buyAmount: b, fees: d, gain: a - b - d };
    }
  }

  // 3개의 숫자: A(양도) - B(취득) = C(차익) (제비용이 0이거나 포함된 경우)
  for (let i = 0; i <= nums.length - 3; i++) {
    const a = nums[i];
    const b = nums[i + 1];
    const c = nums[i + 2];
    if (a > 0 && b > 0 && Math.abs(a - b - c) <= 500) {
      return { sellAmount: a, buyAmount: b, fees: 0, gain: a - b };
    }
  }

  return null;
}

/**
 * 토스증권/한국투자 등 세로형 요약 키-밸류 문서 파싱
 */
function parseVerticalSummaryTable(
  lines: string[],
  broker: BrokerType,
  fileName: string,
  taxYear: number,
  usedOcr: boolean,
  topStock: { symbol: string; isin: string; name: string } | null
): TradeRecord | null {
  let sellAmount = 0;
  let buyAmount = 0;
  let fees = 0;

  for (const line of lines) {
    const nums = extractKrwAmounts(line);
    if (nums.length === 0) continue;
    const val = nums[nums.length - 1];

    if (!sellAmount && /(양도가액|총\s*양도금액|매도금액\s*합계)/.test(line)) {
      sellAmount = Math.abs(val);
    } else if (!buyAmount && /(취득가액|총\s*취득금액|매수금액\s*합계)/.test(line)) {
      buyAmount = Math.abs(val);
    } else if (!fees && /(필요경비|제비용|수수료\s*합계)/.test(line)) {
      fees = Math.abs(val);
    }
  }

  if (sellAmount > 0 && buyAmount > 0) {
    const stock = topStock || {
      symbol: 'AAPL',
      isin: 'US0378331005',
      name: `${broker} 대표종목`,
    };
    return {
      id: `parsed-vert-${Date.now()}`,
      broker,
      symbol: stock.symbol,
      isin: stock.isin,
      assetName: `${stock.name} 외 (${broker} 연간합계)`,
      quantity: 1,
      buyDate: `${taxYear}-01-01`,
      sellDate: `${taxYear}-12-31`,
      sellAmountKRW: sellAmount,
      buyAmountKRW: buyAmount,
      feesKRW: fees,
      capitalGainKRW: sellAmount - buyAmount - fees,
      sourceFileName: fileName,
      parseMethod: usedOcr ? 'ocr-vision' : 'pdf-text',
    };
  }

  return null;
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
  // pdf.js가 buffer를 detach할 수 있으므로 증빙서류 병합용 복사본 유지
  const bufferCopy = arrayBuffer.slice(0);

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  onProgress?.(35, `디지털 텍스트 레이어 추출 중 (총 ${pdfDoc.numPages}페이지)...`);
  let lines = await extractStructuredLinesFromPdf(pdfDoc);
  let usedOcr = false;

  // 디지털 텍스트가 거의 없는 스캔본 PDF인 경우 로컬 OCR 엔진 가동
  const totalChars = lines.join('').replace(/\s+/g, '').length;
  if (totalChars < 30) {
    usedOcr = true;
    onProgress?.(45, '텍스트 레이어가 없는 스캔본 PDF 감지 -> 로컬 OCR 엔진 실행...');
    lines = await runLocalOcrOnPdf(pdfDoc, onProgress);
  }

  onProgress?.(85, '증권사 서식 식별 및 양도소득세 항목 정규화 중...');
  const fullText = lines.join('\n');
  const detectedBroker = detectBroker(file.name, fullText);
  const trades = parseTradesFromLines(lines, detectedBroker, file.name, taxYear, usedOcr);

  onProgress?.(100, '파싱 완료');

  return {
    result: {
      detectedBroker,
      trades,
      usedOcr,
      rawTextPreview: fullText.slice(0, 600),
    },
    buffer: bufferCopy,
  };
}
