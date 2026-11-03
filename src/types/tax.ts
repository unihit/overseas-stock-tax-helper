export type BrokerType =
  | '키움증권'
  | '토스증권'
  | '미래에셋증권'
  | '한국투자증권'
  | '삼성증권'
  | 'NH투자증권(나무)'
  | 'KB증권'
  | '직접입력/기타';

export interface TradeRecord {
  id: string;
  broker: BrokerType;
  symbol: string;              // 티커 (예: NVDA, TSLA, AAPL)
  isin: string;                // 국제증권식별번호 12자리 (예: US67066G1040)
  assetName: string;           // 종목명
  quantity: number;            // 양도수량
  buyDate: string;             // 취득일자 (YYYY-MM-DD)
  sellDate: string;            // 양도일자 (YYYY-MM-DD)
  sellAmountKRW: number;       // 양도가액 (원화 총합)
  buyAmountKRW: number;        // 취득가액 (원화 총합)
  feesKRW: number;             // 필요경비/제비용 (원화 총합)
  capitalGainKRW: number;      // 양도소득금액 (양도가액 - 취득가액 - 필요경비)
  sourceFileName?: string;     // 추출된 원본 PDF 파일명
  parseMethod?: 'pdf-text' | 'ocr-vision' | 'manual' | 'sample';
  hasWarning?: boolean;        // 계산 불일치 등 확인 필요 여부
}

export interface UploadedPdfFile {
  id: string;
  name: string;
  size: number;
  detectedBroker: BrokerType;
  status: 'parsing' | 'ocr-running' | 'completed' | 'warning' | 'error';
  progress: number;
  extractedCount: number;
  totalGainKRW: number;
  message?: string;
  rawBuffer?: ArrayBuffer;     // 홈택스 증빙서류 병합 다운로드용 메모리 버퍼 (서버 전송 X)
}

export interface BrokerSummary {
  broker: BrokerType;
  tradeCount: number;
  sellAmountKRW: number;
  buyAmountKRW: number;
  feesKRW: number;
  capitalGainKRW: number;
}

export interface TaxSummary {
  taxYear: number;
  representativeSymbol: string;
  representativeIsin: string;
  representativeName: string;
  recommendedBuyDate: string;
  recommendedSellDate: string;
  totalSellAmountKRW: number;
  totalBuyAmountKRW: number;
  totalFeesKRW: number;
  netCapitalGainKRW: number;       // 양도소득금액 합계 (손익통산 후)
  basicDeductionKRW: number;       // 양도소득 기본공제 (최대 2,500,000원)
  taxableBaseKRW: number;          // 과세표준
  capitalGainsTaxKRW: number;      // 양도소득세 (20%, 원단위 절사)
  localIncomeTaxKRW: number;       // 지방소득세 (2%, 원단위 절사)
  totalTaxPayableKRW: number;      // 총 납부할 세액 (22%)
  brokerSummaries: BrokerSummary[];
}

// 주요 미국 상장주식 티커 -> 국제증권식별번호(ISIN) 및 한글 종목명 사전
export const US_STOCK_ISIN_MAP: Record<string, { isin: string; name: string }> = {
  AAPL: { isin: 'US0378331005', name: '애플 (Apple Inc.)' },
  NVDA: { isin: 'US67066G1040', name: '엔비디아 (NVIDIA Corp.)' },
  TSLA: { isin: 'US88160R1014', name: '테슬라 (Tesla Inc.)' },
  MSFT: { isin: 'US5949181045', name: '마이크로소프트 (Microsoft Corp.)' },
  AMZN: { isin: 'US0231351067', name: '아마존닷컴 (Amazon.com Inc.)' },
  META: { isin: 'US30303M1027', name: '메타 플랫폼스 (Meta Platforms)' },
  GOOGL: { isin: 'US02079K3059', name: '알파벳 A (Alphabet Inc.)' },
  GOOG: { isin: 'US02079K1079', name: '알파벳 C (Alphabet Inc.)' },
  PLTR: { isin: 'US69608A1088', name: '팔란티어 테크놀로지스 (Palantir)' },
  AMD: { isin: 'US0079031078', name: 'AMD (Advanced Micro Devices)' },
  AVGO: { isin: 'US11135F1012', name: '브로드컴 (Broadcom Inc.)' },
  NFLX: { isin: 'US64110L1061', name: '넷플릭스 (Netflix Inc.)' },
  COIN: { isin: 'US19260Q1076', name: '코인데이스 글로벌 (Coinbase)' },
  MSTR: { isin: 'US5949724083', name: '마이크로스트래티지 (Strategy)' },
  IONQ: { isin: 'US46222L1089', name: '아이온큐 (IonQ Inc.)' },
  QQQ: { isin: 'US46090E1038', name: 'Invesco QQQ Trust' },
  TQQQ: { isin: 'US74347X8314', name: 'ProShares UltraPro QQQ' },
  SPY: { isin: 'US78462F1030', name: 'SPDR S&P 500 ETF Trust' },
  SOXL: { isin: 'US25459W8626', name: 'Direxion Daily Semiconductor Bull 3X' },
  SCHD: { isin: 'US8085247976', name: 'Schwab US Dividend Equity ETF' },
  BRK: { isin: 'US0846707026', name: '버크셔 해서웨이 B (Berkshire Hathaway)' },
};

export function lookupStockInfo(symbolOrName: string): { symbol: string; isin: string; name: string } {
  const upper = symbolOrName.trim().toUpperCase();
  if (US_STOCK_ISIN_MAP[upper]) {
    return {
      symbol: upper,
      isin: US_STOCK_ISIN_MAP[upper].isin,
      name: US_STOCK_ISIN_MAP[upper].name,
    };
  }
  // 한글이나 부분 일치 탐색
  for (const [ticker, info] of Object.entries(US_STOCK_ISIN_MAP)) {
    if (upper.includes(ticker) || info.name.toUpperCase().includes(upper) || info.isin === upper) {
      return {
        symbol: ticker,
        isin: info.isin,
        name: info.name,
      };
    }
  }
  return {
    symbol: upper || 'REPRESENTATIVE',
    isin: upper.length === 12 && upper.startsWith('US') ? upper : 'US0378331005',
    name: symbolOrName || '해외주식 합산 대표종목',
  };
}
