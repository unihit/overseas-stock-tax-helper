import React from 'react';
import { TrendingUp, TrendingDown, PiggyBank, Building2 } from 'lucide-react';
import { TaxSummary } from '../types/tax';

interface BrokerSummaryCardsProps {
  summary: TaxSummary;
}

export const BrokerSummaryCards: React.FC<BrokerSummaryCardsProps> = ({ summary }) => {
  // 손실 본 증권사 합계를 통해 손익통산 절세 효과 계산
  const totalLossOffset = summary.brokerSummaries
    .filter((b) => b.capitalGainKRW < 0)
    .reduce((acc, b) => acc + Math.abs(b.capitalGainKRW), 0);

  const savedTaxByOffset = Math.floor((totalLossOffset * 0.22) / 10) * 10;

  return (
    <div className="space-y-3">
      {/* 손익통산 절세 효과 알림 배너 */}
      {totalLossOffset > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-emerald-600 text-white">
              <PiggyBank className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-emerald-950">
                복수 증권사 손익통산(손실상계) 적용 완료!
              </div>
              <p className="text-[11px] text-emerald-700">
                타 증권사 손실액({totalLossOffset.toLocaleString('ko-KR')}원)을 합산 차감하여 단독 신고 대비 세금을 절감했습니다.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-emerald-700 block">손익통산 절세 효과 (22%)</span>
            <span className="text-sm font-extrabold text-emerald-700 font-mono">
              약 -{savedTaxByOffset.toLocaleString('ko-KR')} 원 절감
            </span>
          </div>
        </div>
      )}

      {/* 증권사별 카드 그리드 */}
      {summary.brokerSummaries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {summary.brokerSummaries.map((b) => {
            const isGain = b.capitalGainKRW >= 0;
            return (
              <div
                key={b.broker}
                className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    {b.broker}
                  </span>
                  <span className="text-[11px] text-slate-400">{b.tradeCount}건 반영</span>
                </div>

                <div className="mt-2.5 flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-500">순양도손익</span>
                  <span
                    className={`text-sm font-extrabold font-mono inline-flex items-center gap-1 ${
                      isGain ? 'text-rose-600' : 'text-blue-600'
                    }`}
                  >
                    {isGain ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    {isGain ? '+' : ''}
                    {b.capitalGainKRW.toLocaleString('ko-KR')}원
                  </span>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-3 gap-1 text-[10px] text-slate-500">
                  <div>
                    <div className="text-slate-400">양도가액</div>
                    <div className="font-mono font-medium text-slate-700 truncate">
                      {b.sellAmountKRW.toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">취득가액</div>
                    <div className="font-mono font-medium text-slate-700 truncate">
                      {b.buyAmountKRW.toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">필요경비</div>
                    <div className="font-mono font-medium text-slate-700 truncate">
                      {b.feesKRW.toLocaleString('ko-KR')}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
