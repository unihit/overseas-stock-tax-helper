import { create } from 'zustand';
import {
  BrokerSummary,
  BrokerType,
  lookupStockInfo,
  TaxSummary,
  TradeRecord,
  UploadedPdfFile,
} from '../types/tax';

interface TaxState {
  taxYear: number;
  trades: TradeRecord[];
  uploadedFiles: UploadedPdfFile[];
  stripCommasOnCopy: boolean;
  customRepIsin: string | null;
  activeCopyStepIndex: number;
  lastCopiedFieldId: string | null;

  // Actions
  setTaxYear: (year: number) => void;
  setStripCommasOnCopy: (strip: boolean) => void;
  setCustomRepIsin: (isin: string | null) => void;
  setActiveCopyStepIndex: (index: number) => void;
  setLastCopiedFieldId: (id: string | null) => void;

  addTrades: (newTrades: TradeRecord[]) => void;
  updateTrade: (id: string, patch: Partial<TradeRecord>) => void;
  deleteTrade: (id: string) => void;
  addEmptyTrade: (broker?: BrokerType) => void;
  clearAll: () => void;
  loadSampleMultiBrokerData: () => void;

  addOrUpdateFile: (file: UploadedPdfFile) => void;
  removeFile: (fileId: string, fileName: string) => void;
}

export const INITIAL_SAMPLE_TRADES: TradeRecord[] = [
  {
    id: 'sample-kw-1',
    broker: '키움증권',
    symbol: 'NVDA',
    isin: 'US67066G1040',
    assetName: '엔비디아 (NVIDIA Corp.)',
    quantity: 120,
    buyDate: '2025-02-14',
    sellDate: '2025-10-21',
    sellAmountKRW: 98450000,
    buyAmountKRW: 62100000,
    feesKRW: 245000,
    capitalGainKRW: 36105000,
    sourceFileName: '키움증권_해외주식양도소득세_계산보조자료_2025.pdf',
    parseMethod: 'sample',
  },
  {
    id: 'sample-kw-2',
    broker: '키움증권',
    symbol: 'AAPL',
    isin: 'US0378331005',
    assetName: '애플 (Apple Inc.)',
    quantity: 85,
    buyDate: '2025-03-10',
    sellDate: '2025-11-15',
    sellAmountKRW: 29800000,
    buyAmountKRW: 23150000,
    feesKRW: 85000,
    capitalGainKRW: 6565000,
    sourceFileName: '키움증권_해외주식양도소득세_계산보조자료_2025.pdf',
    parseMethod: 'sample',
  },
  {
    id: 'sample-toss-1',
    broker: '토스증권',
    symbol: 'TSLA',
    isin: 'US88160R1014',
    assetName: '테슬라 (Tesla Inc.)',
    quantity: 95,
    buyDate: '2025-01-22',
    sellDate: '2025-08-19',
    sellAmountKRW: 31200000,
    buyAmountKRW: 39850000,
    feesKRW: 112000,
    capitalGainKRW: -8762000,
    sourceFileName: '토스증권_해외주식양도세_거래내역서_2025.pdf',
    parseMethod: 'sample',
  },
  {
    id: 'sample-mirae-1',
    broker: '미래에셋증권',
    symbol: 'PLTR',
    isin: 'US69608A1088',
    assetName: '팔란티어 테크놀로지스 (Palantir)',
    quantity: 200,
    buyDate: '2025-04-03',
    sellDate: '2025-12-09',
    sellAmountKRW: 21500000,
    buyAmountKRW: 14900000,
    feesKRW: 68000,
    capitalGainKRW: 6532000,
    sourceFileName: '미래에셋증권_해외주식_양도소득금액계산명세서.pdf',
    parseMethod: 'sample',
  },
];

export const useTaxStore = create<TaxState>((set) => ({
  taxYear: 2025,
  trades: INITIAL_SAMPLE_TRADES,
  uploadedFiles: [
    {
      id: 'sample-file-1',
      name: '키움증권_해외주식양도소득세_계산보조자료_2025.pdf (예시)',
      size: 148200,
      detectedBroker: '키움증권',
      status: 'completed',
      progress: 100,
      extractedCount: 2,
      totalGainKRW: 42670000,
      message: '합계 및 종목 내역 2건 자동 추출 완료',
    },
    {
      id: 'sample-file-2',
      name: '토스증권_해외주식양도세_거래내역서_2025.pdf (예시)',
      size: 94500,
      detectedBroker: '토스증권',
      status: 'completed',
      progress: 100,
      extractedCount: 1,
      totalGainKRW: -8762000,
      message: '손실상계 대상 (-8,762,000원) 추출 완료',
    },
    {
      id: 'sample-file-3',
      name: '미래에셋증권_해외주식_양도소득금액계산명세서.pdf (예시)',
      size: 112400,
      detectedBroker: '미래에셋증권',
      status: 'completed',
      progress: 100,
      extractedCount: 1,
      totalGainKRW: 6532000,
      message: '합계 내역 1건 추출 완료',
    },
  ],
  stripCommasOnCopy: true,
  customRepIsin: null,
  activeCopyStepIndex: 0,
  lastCopiedFieldId: null,

  setTaxYear: (year) => set({ taxYear: year }),
  setStripCommasOnCopy: (strip) => set({ stripCommasOnCopy: strip }),
  setCustomRepIsin: (isin) => set({ customRepIsin: isin }),
  setActiveCopyStepIndex: (index) => set({ activeCopyStepIndex: index }),
  setLastCopiedFieldId: (id) => set({ lastCopiedFieldId: id }),

  addTrades: (newTrades) =>
    set((state) => {
      // 만약 현재 샘플 데이터만 있는 상태에서 실제 PDF를 업로드하면 샘플 데이터를 자동 교체할지,
      // 혹은 샘플 여부에 따라 자연스럽게 병합할지 처리: 샘플 파일만 있을 때 실제 PDF가 들어오면 샘플 제거 후 추가
      const hasOnlySamples =
        state.trades.length > 0 && state.trades.every((t) => t.parseMethod === 'sample');
      const baseTrades = hasOnlySamples ? [] : state.trades;
      const baseFiles = hasOnlySamples
        ? state.uploadedFiles.filter((f) => !f.id.startsWith('sample-file-'))
        : state.uploadedFiles;

      return {
        trades: [...baseTrades, ...newTrades],
        uploadedFiles: baseFiles,
      };
    }),

  updateTrade: (id, patch) =>
    set((state) => ({
      trades: state.trades.map((tr) => {
        if (tr.id !== id) return tr;
        const updated = { ...tr, ...patch };
        // 티커가 변경되면 ISIN 자동 추천 업데이트 (사용자가 직접 ISIN을 바꾼 경우가 아닐 때)
        if (patch.symbol && !patch.isin) {
          const info = lookupStockInfo(patch.symbol);
          updated.isin = info.isin;
          if (!patch.assetName) updated.assetName = info.name;
        }
        // 양도가액, 취득가액, 필요경비 변경 시 양도소득금액 자동 재계산
        if (
          patch.sellAmountKRW !== undefined ||
          patch.buyAmountKRW !== undefined ||
          patch.feesKRW !== undefined
        ) {
          updated.capitalGainKRW =
            Math.round(updated.sellAmountKRW) -
            Math.round(updated.buyAmountKRW) -
            Math.round(updated.feesKRW);
          updated.hasWarning = false;
        }
        return updated;
      }),
    })),

  deleteTrade: (id) =>
    set((state) => ({
      trades: state.trades.filter((tr) => tr.id !== id),
    })),

  addEmptyTrade: (broker = '직접입력/기타') =>
    set((state) => ({
      trades: [
        ...state.trades,
        {
          id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          broker,
          symbol: 'AAPL',
          isin: 'US0378331005',
          assetName: '애플 (Apple Inc.)',
          quantity: 1,
          buyDate: `${state.taxYear}-01-01`,
          sellDate: `${state.taxYear}-12-31`,
          sellAmountKRW: 0,
          buyAmountKRW: 0,
          feesKRW: 0,
          capitalGainKRW: 0,
          parseMethod: 'manual',
        },
      ],
    })),

  clearAll: () =>
    set({
      trades: [],
      uploadedFiles: [],
      customRepIsin: null,
      activeCopyStepIndex: 0,
    }),

  loadSampleMultiBrokerData: () =>
    set({
      trades: INITIAL_SAMPLE_TRADES,
      uploadedFiles: [
        {
          id: 'sample-file-1',
          name: '키움증권_해외주식양도소득세_계산보조자료_2025.pdf (예시)',
          size: 148200,
          detectedBroker: '키움증권',
          status: 'completed',
          progress: 100,
          extractedCount: 2,
          totalGainKRW: 42670000,
          message: '합계 및 종목 내역 2건 자동 추출 완료',
        },
        {
          id: 'sample-file-2',
          name: '토스증권_해외주식양도세_거래내역서_2025.pdf (예시)',
          size: 94500,
          detectedBroker: '토스증권',
          status: 'completed',
          progress: 100,
          extractedCount: 1,
          totalGainKRW: -8762000,
          message: '손실상계 대상 (-8,762,000원) 추출 완료',
        },
        {
          id: 'sample-file-3',
          name: '미래에셋증권_해외주식_양도소득금액계산명세서.pdf (예시)',
          size: 112400,
          detectedBroker: '미래에셋증권',
          status: 'completed',
          progress: 100,
          extractedCount: 1,
          totalGainKRW: 6532000,
          message: '합계 내역 1건 추출 완료',
        },
      ],
      customRepIsin: null,
      activeCopyStepIndex: 0,
    }),

  addOrUpdateFile: (file) =>
    set((state) => {
      const cleaned = state.uploadedFiles.filter((f) => !f.id.startsWith('sample-file-'));
      const exists = cleaned.some((f) => f.id === file.id);
      return {
        uploadedFiles: exists
          ? cleaned.map((f) => (f.id === file.id ? file : f))
          : [...cleaned, file],
      };
    }),

  removeFile: (fileId, fileName) =>
    set((state) => ({
      uploadedFiles: state.uploadedFiles.filter((f) => f.id !== fileId),
      trades: state.trades.filter((t) => t.sourceFileName !== fileName),
    })),
}));

export function computeTaxSummary(
  trades: TradeRecord[],
  taxYear: number,
  customRepIsin: string | null
): TaxSummary {
  let totalSellAmountKRW = 0;
  let totalBuyAmountKRW = 0;
  let totalFeesKRW = 0;

  const brokerMap = new Map<BrokerType, BrokerSummary>();
  let topTrade: TradeRecord | null = null;

  for (const tr of trades) {
    const sell = Math.round(Number(tr.sellAmountKRW) || 0);
    const buy = Math.round(Number(tr.buyAmountKRW) || 0);
    const fee = Math.round(Number(tr.feesKRW) || 0);
    const gain = sell - buy - fee;

    totalSellAmountKRW += sell;
    totalBuyAmountKRW += buy;
    totalFeesKRW += fee;

    if (!topTrade || sell > topTrade.sellAmountKRW) {
      topTrade = tr;
    }

    const existing = brokerMap.get(tr.broker) || {
      broker: tr.broker,
      tradeCount: 0,
      sellAmountKRW: 0,
      buyAmountKRW: 0,
      feesKRW: 0,
      capitalGainKRW: 0,
    };
    existing.tradeCount += 1;
    existing.sellAmountKRW += sell;
    existing.buyAmountKRW += buy;
    existing.feesKRW += fee;
    existing.capitalGainKRW += gain;
    brokerMap.set(tr.broker, existing);
  }

  const netCapitalGainKRW = totalSellAmountKRW - totalBuyAmountKRW - totalFeesKRW;

  // 연간 기본공제 250만원 (양도소득금액이 양수일 때 최대 2,500,000원 공제)
  const basicDeductionKRW =
    netCapitalGainKRW > 0 ? Math.min(2500000, netCapitalGainKRW) : 2500000;

  const taxableBaseKRW = Math.max(0, netCapitalGainKRW - 2500000);

  // 국세기본법상 10원 미만 절사 (원단위 절사)
  const capitalGainsTaxKRW = Math.floor((taxableBaseKRW * 0.2) / 10) * 10;
  const localIncomeTaxKRW = Math.floor((taxableBaseKRW * 0.02) / 10) * 10;
  const totalTaxPayableKRW = capitalGainsTaxKRW + localIncomeTaxKRW;

  const repSymbol = topTrade?.symbol || 'NVDA';
  const repIsin = customRepIsin || topTrade?.isin || 'US67066G1040';
  const repName = topTrade?.assetName || '엔비디아 (NVIDIA Corp.)';

  return {
    taxYear,
    representativeSymbol: repSymbol,
    representativeIsin: repIsin,
    representativeName: repName,
    recommendedBuyDate: `${taxYear}-01-01`,
    recommendedSellDate: `${taxYear}-12-31`,
    totalSellAmountKRW,
    totalBuyAmountKRW,
    totalFeesKRW,
    netCapitalGainKRW,
    basicDeductionKRW,
    taxableBaseKRW,
    capitalGainsTaxKRW,
    localIncomeTaxKRW,
    totalTaxPayableKRW,
    brokerSummaries: Array.from(brokerMap.values()),
  };
}
