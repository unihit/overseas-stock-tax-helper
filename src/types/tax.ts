export type BrokerType =
  | '키움증권'
  | '토스증권'
  | '미래에셋증권'
  | '한국투자증권'
  | '삼성증권'
  | 'NH투자증권(나무)'
  | 'KB증권'
  | '메리츠증권'
  | '하나증권'
  | '신한투자증권'
  | '대신증권(크레온)'
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
  sourceFileId?: string;       // 추출된 원본 업로드 파일 고유 ID
  sourceFileName?: string;     // 추출된 원본 PDF 파일명
  parseMethod?: 'pdf-text' | 'ocr-vision' | 'manual' | 'sample';
  rowType?: 'individual' | 'summary'; // 개별 종목 행인지 문서 전체 합계 행인지 구분
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
  rawLines?: string[];         // 브라우저 로컬에서 추출된 텍스트 줄 목록 (원문 확인 및 클릭 매핑용)
  summaryTrade?: TradeRecord | null;     // 문서 내 '합계' 행 추출본
  individualTrades?: TradeRecord[];      // 문서 내 '개별 종목' 행 추출본
  activeMode?: 'individual' | 'summary'; // 현재 테이블에 반영된 모드
  isDuplicateSplit?: boolean;            // 분할 PDF(1/2, 2/2) 동일 합계 중복 합산 방지 여부
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
  COIN: { isin: 'US19260Q1076', name: '코인베이스 글로벌 (Coinbase)' },
  MSTR: { isin: 'US5949724083', name: '마이크로스트래티지 (Strategy)' },
  IONQ: { isin: 'US46222L1089', name: '아이온큐 (IonQ Inc.)' },
  QQQ: { isin: 'US46090E1038', name: 'Invesco QQQ Trust' },
  TQQQ: { isin: 'US74347X8314', name: 'ProShares UltraPro QQQ' },
  SPY: { isin: 'US78462F1030', name: 'SPDR S&P 500 ETF Trust' },
  SOXL: { isin: 'US25459W8626', name: 'Direxion Daily Semiconductor Bull 3X' },
  SCHD: { isin: 'US8085247976', name: 'Schwab US Dividend Equity ETF' },
  BRK: { isin: 'US0846707026', name: '버크셔 해서웨이 B (Berkshire Hathaway)' },
  TSLL: { isin: 'US25461A8339', name: 'Direxion Daily TSLA Bull 2X Shares' },
  NVDL: { isin: 'US38747R8271', name: 'GraniteShares 2x Long NVDA Daily ETF' },
  CONL: { isin: 'US38747R8438', name: 'GraniteShares 2x Long COIN Daily ETF' },
  SMCI: { isin: 'US86800U1043', name: '슈퍼마이크로컴퓨터 (Super Micro Computer)' },
  ARM: { isin: 'US0420682058', name: 'ARM 홀딩스 (Arm Holdings)' },
  INTC: { isin: 'US4581401001', name: '인텔 (Intel Corp.)' },
  MU: { isin: 'US5951121038', name: '마이크론 테크놀로지 (Micron Technology)' },
  QCOM: { isin: 'US7475251036', name: '퀄컴 (Qualcomm Inc.)' },
  TSM: { isin: 'US8740391003', name: 'TSMC ADR (Taiwan Semiconductor)' },
  LLY: { isin: 'US5324571083', name: '일라이 릴리 (Eli Lilly)' },
  NVO: { isin: 'US6701002056', name: '노보 노디스크 (Novo Nordisk)' },
  UNH: { isin: 'US91324P1021', name: '유나이티드헬스 그룹 (UnitedHealth)' },
  COST: { isin: 'US22160K1051', name: '코스트코 (Costco Wholesale)' },
  WMT: { isin: 'US9311421039', name: '월마트 (Walmart Inc.)' },
  JPM: { isin: 'US46625H1005', name: 'JP모건 체이스 (JPMorgan Chase)' },
  V: { isin: 'US92826C8394', name: '비자 (Visa Inc.)' },
  MA: { isin: 'US57636Q1040', name: '마스터카드 (Mastercard Inc.)' },
  DIS: { isin: 'US2546871060', name: '월트 디즈니 (Walt Disney)' },
  BA: { isin: 'US0970231058', name: '보잉 (Boeing Co.)' },
  KO: { isin: 'US1912161007', name: '코카콜라 (Coca-Cola Co.)' },
  PEP: { isin: 'US7134481081', name: '펩시코 (PepsiCo Inc.)' },
  O: { isin: 'US7561091049', name: '리얼티 인컴 (Realty Income)' },
  JEPI: { isin: 'US46641Q3323', name: 'JPMorgan Equity Premium Income ETF' },
  JEPQ: { isin: 'US46654Q2030', name: 'JPMorgan Nasdaq Equity Premium Income ETF' },
  TLT: { isin: 'US4642874329', name: 'iShares 20+ Year Treasury Bond ETF' },
  TMF: { isin: 'US25459W5408', name: 'Direxion Daily 20+ Yr Trsy Bull 3X' },
  SQQQ: { isin: 'US74347X8645', name: 'ProShares UltraPro Short QQQ' },
  SOXS: { isin: 'US25459W1100', name: 'Direxion Daily Semiconductor Bear 3X' },
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
    symbol: upper || 'NVDA',
    isin: upper.length === 12 && upper.startsWith('US') ? upper : 'US67066G1040',
    name: symbolOrName || '해외주식 합산 대표종목',
  };
}
