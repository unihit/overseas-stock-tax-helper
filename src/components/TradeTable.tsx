import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  FileSpreadsheet,
  Table2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { BrokerType, TaxSummary, TradeRecord } from '../types/tax';
import { useTaxStore } from '../store/useTaxStore';
import { exportTaxSummaryToExcel } from '../utils/pdfTools';

interface TradeTableProps {
  trades: TradeRecord[];
  summary: TaxSummary;
  onOpenCopyPopup: () => void;
}

const BROKER_OPTIONS: BrokerType[] = [
  '키움증권',
  '토스증권',
  '미래에셋증권',
  '한국투자증권',
  '삼성증권',
  'NH투자증권(나무)',
  'KB증권',
  '메리츠증권',
  '하나증권',
  '신한투자증권',
  '대신증권(크레온)',
  '직접입력/기타',
];

/**
 * 인라인 금액 편집 시 천단위 콤마(,) 재렌더링으로 인해 커서가 맨 끝으로 튀는(Cursor Jump) 현상을 방지하는 입력 컴포넌트
 */
const CurrencyInput: React.FC<{
  value: number;
  onChangeValue: (val: number) => void;
  className?: string;
}> = ({ value, onChangeValue, className }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [rawText, setRawText] = useState(String(value));

  useEffect(() => {
    if (!isFocused) {
      setRawText(String(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const cleaned = input.replace(/[^0-9]/g, '');
    setRawText(cleaned);
    const parsed = parseInt(cleaned, 10);
    onChangeValue(isNaN(parsed) ? 0 : parsed);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={isFocused ? rawText : value.toLocaleString('ko-KR')}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onChange={handleChange}
      className={className}
    />
  );
};

export const TradeTable: React.FC<TradeTableProps> = ({
  trades,
  summary,
  onOpenCopyPopup,
}) => {
  const { updateTrade, deleteTrade, addEmptyTrade } = useTaxStore();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* 상단 툴바 */}
      <div className="p-4 sm:px-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Table2 className="w-5 h-5 text-blue-600" />
            <span>2. 추출 내역 검증 및 인라인 수정 (실시간 반영)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            오인식된 숫자가 있거나 증권사 합계만 바로 입력하려면 표의 숫자를 직접 클릭해 수정하세요. 수정 완료 후 <b>[홈택스 원클릭 복사 도우미]</b> 팝업을 열어 신고하세요.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addEmptyTrade('직접입력/기타')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>증권사/종목 행 추가</span>
          </button>
          <button
            type="button"
            onClick={() => exportTaxSummaryToExcel(trades, summary)}
            disabled={trades.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>엑셀 계산서 다운로드</span>
          </button>
          <button
            type="button"
            onClick={onOpenCopyPopup}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span>홈택스 1:1 원클릭 복사 도우미 열기</span>
          </button>
        </div>
      </div>

      {/* 와이드 풀폭 데이터 그리드 테이블 (데스크톱 좌우 스크롤 불필요) */}
      <div className="w-full overflow-x-auto md:overflow-x-visible">
        <table className="w-full md:table-fixed text-left border-collapse text-xs">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[26%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
            <col className="w-[13%]" />
            <col className="w-[5%]" />
          </colgroup>
          <thead>
            <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 font-bold">
              <th className="py-3 px-4">증권사</th>
              <th className="py-3 px-3">티커 / ISIN(자동) · 종목명</th>
              <th className="py-3 px-3 text-right">양도가액 (원)</th>
              <th className="py-3 px-3 text-right">취득가액 (원)</th>
              <th className="py-3 px-3 text-right">필요경비 (원)</th>
              <th className="py-3 px-4 text-right">양도소득금액 (차익)</th>
              <th className="py-3 px-2 text-center">삭제</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {trades.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400">
                  업로드된 거래 내역이 없습니다. 상단에 증권사 PDF를 드래그하거나 [+ 증권사/종목 행 추가]를 눌러주세요.
                </td>
              </tr>
            ) : (
              trades.map((tr) => {
                const isGain = tr.capitalGainKRW >= 0;
                return (
                  <tr
                    key={tr.id}
                    className={`hover:bg-blue-50/30 transition ${
                      tr.hasWarning ? 'bg-amber-50/60' : ''
                    }`}
                  >
                    {/* 증권사 선택 */}
                    <td className="py-3 px-4 align-middle">
                      <select
                        value={tr.broker}
                        onChange={(e) =>
                          updateTrade(tr.id, { broker: e.target.value as BrokerType })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                      >
                        {BROKER_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      {tr.hasWarning && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold mt-0.5">
                          <AlertCircle className="w-3 h-3 shrink-0" /> 금액 직접 입력 요망
                        </div>
                      )}
                    </td>

                    {/* 티커 및 ISIN */}
                    <td className="py-3 px-3 align-middle">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tr.symbol}
                          onChange={(e) =>
                            updateTrade(tr.id, { symbol: e.target.value.toUpperCase() })
                          }
                          placeholder="티커"
                          className="w-20 shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-900 uppercase focus:border-blue-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={tr.isin}
                          onChange={(e) =>
                            updateTrade(tr.id, { isin: e.target.value.toUpperCase() })
                          }
                          placeholder="ISIN 12자리"
                          className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-mono text-slate-600 uppercase focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-1">
                        {tr.assetName}
                      </div>
                    </td>

                    {/* 양도가액 (원) */}
                    <td className="py-3 px-3 align-middle text-right">
                      <CurrencyInput
                        value={tr.sellAmountKRW}
                        onChangeValue={(val) =>
                          updateTrade(tr.id, { sellAmountKRW: val })
                        }
                        className="w-full text-right rounded-lg border border-slate-200 px-3 py-1.5 font-mono font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                      />
                    </td>

                    {/* 취득가액 (원) */}
                    <td className="py-3 px-3 align-middle text-right">
                      <CurrencyInput
                        value={tr.buyAmountKRW}
                        onChangeValue={(val) =>
                          updateTrade(tr.id, { buyAmountKRW: val })
                        }
                        className="w-full text-right rounded-lg border border-slate-200 px-3 py-1.5 font-mono font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                      />
                    </td>

                    {/* 필요경비 (원) */}
                    <td className="py-3 px-3 align-middle text-right">
                      <CurrencyInput
                        value={tr.feesKRW}
                        onChangeValue={(val) =>
                          updateTrade(tr.id, { feesKRW: val })
                        }
                        className="w-full text-right rounded-lg border border-slate-200 px-3 py-1.5 font-mono font-semibold text-slate-700 focus:border-blue-500 focus:outline-none"
                      />
                    </td>

                    {/* 양도소득금액 (자동계산) */}
                    <td className="py-3 px-4 align-middle text-right">
                      <span
                        className={`font-mono font-extrabold text-sm ${
                          isGain ? 'text-rose-600' : 'text-blue-600'
                        }`}
                      >
                        {isGain ? '+' : ''}
                        {tr.capitalGainKRW.toLocaleString('ko-KR')}
                      </span>
                    </td>

                    {/* 삭제 */}
                    <td className="py-3 px-2 align-middle text-center">
                      <button
                        type="button"
                        onClick={() => deleteTrade(tr.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="행 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* 하단 전체 합계 푸터 */}
          {trades.length > 0 && (
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold text-xs">
                <td colSpan={2} className="py-3.5 px-4">
                  전체 증권사 합산 ({trades.length}건 통산)
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-sm">
                  {summary.totalSellAmountKRW.toLocaleString('ko-KR')}
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-sm">
                  {summary.totalBuyAmountKRW.toLocaleString('ko-KR')}
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-sm">
                  {summary.totalFeesKRW.toLocaleString('ko-KR')}
                </td>
                <td
                  className={`py-3.5 px-4 text-right font-mono text-sm ${
                    summary.netCapitalGainKRW >= 0 ? 'text-amber-300' : 'text-sky-300'
                  }`}
                >
                  {summary.netCapitalGainKRW >= 0 ? '+' : ''}
                  {summary.netCapitalGainKRW.toLocaleString('ko-KR')}원
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
