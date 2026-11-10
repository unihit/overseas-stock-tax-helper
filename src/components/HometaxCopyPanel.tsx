import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Sparkles,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  FileCheck2,
  RotateCcw,
  ExternalLink,
  X,
  PictureInPicture2,
} from 'lucide-react';
import { TaxSummary, TradeRecord } from '../types/tax';
import { useTaxStore } from '../store/useTaxStore';

interface HometaxCopyPanelProps {
  summary: TaxSummary;
  trades: TradeRecord[];
  onMergePdfClick: () => void;
  onClose?: () => void;
  onOpenStandalonePopup?: () => void;
  isStandaloneWindow?: boolean;
}

interface CopyItemSpec {
  id: string;
  stepNum: number;
  section: 'step1' | 'step2' | 'step3';
  label: string;
  subLabel: string;
  rawValue: string;
  formattedValue: string;
  altRawValue?: string;
  altLabel?: string;
  highlight?: boolean;
  isImportantNote?: string;
}

export const HometaxCopyPanel: React.FC<HometaxCopyPanelProps> = ({
  summary,
  trades,
  onMergePdfClick,
  onClose,
  onOpenStandalonePopup,
  isStandaloneWindow = false,
}) => {
  const {
    stripCommasOnCopy,
    setStripCommasOnCopy,
    customRepIsin,
    setCustomRepIsin,
    activeCopyStepIndex,
    setActiveCopyStepIndex,
    lastCopiedFieldId,
    setLastCopiedFieldId,
  } = useTaxStore();

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [stripDateHyphen, setStripDateHyphen] = useState<boolean>(true);

  const formatForClipboard = (num: number): string => {
    const clean = Math.max(0, Math.round(num));
    return stripCommasOnCopy ? String(clean) : clean.toLocaleString('ko-KR');
  };

  const formatDateForClipboard = (dateStr: string): string => {
    return stripDateHyphen ? dateStr.replace(/-/g, '') : dateStr;
  };

  const copySteps: CopyItemSpec[] = [
    {
      id: 'isin',
      stepNum: 1,
      section: 'step1',
      label: '국제증권식별번호 (ISIN)',
      subLabel: `대표종목 1개만 입력 (${summary.representativeSymbol} · ${summary.representativeName})`,
      rawValue: summary.representativeIsin,
      formattedValue: `${summary.representativeIsin} (${summary.representativeSymbol})`,
      altRawValue: summary.representativeSymbol,
      altLabel: '티커 복사',
    },
    {
      id: 'buyDate',
      stepNum: 2,
      section: 'step1',
      label: '취득일자 (합산신고 권장일)',
      subLabel: '1년 치 합산 신고 시 해당 연도 1월 1일 입력',
      rawValue: formatDateForClipboard(summary.recommendedBuyDate),
      formattedValue: summary.recommendedBuyDate,
    },
    {
      id: 'sellDate',
      stepNum: 3,
      section: 'step1',
      label: '양도일자 (합산신고 권장일)',
      subLabel: '1년 치 합산 신고 시 해당 연도 12월 31일 입력',
      rawValue: formatDateForClipboard(summary.recommendedSellDate),
      formattedValue: summary.recommendedSellDate,
    },
    {
      id: 'sellAmount',
      stepNum: 4,
      section: 'step2',
      label: '양도가액 (1년 총 매도가액 합계)',
      subLabel: '모든 증권사에서 주식을 판 원화 총합계',
      rawValue: formatForClipboard(summary.totalSellAmountKRW),
      formattedValue: `${summary.totalSellAmountKRW.toLocaleString('ko-KR')} 원`,
      highlight: true,
    },
    {
      id: 'buyAmount',
      stepNum: 5,
      section: 'step2',
      label: '취득가액 (1년 총 매수가액 합계)',
      subLabel: '모든 증권사에서 주식을 산 원화 총합계',
      rawValue: formatForClipboard(summary.totalBuyAmountKRW),
      formattedValue: `${summary.totalBuyAmountKRW.toLocaleString('ko-KR')} 원`,
      highlight: true,
    },
    {
      id: 'feesAmount',
      stepNum: 6,
      section: 'step2',
      label: '필요경비 (제비용·수수료 합계)',
      subLabel: '증권사 매매수수료 및 제세금 원화 총합계',
      rawValue: formatForClipboard(summary.totalFeesKRW),
      formattedValue: `${summary.totalFeesKRW.toLocaleString('ko-KR')} 원`,
      highlight: true,
    },
    {
      id: 'basicDeduction',
      stepNum: 7,
      section: 'step3',
      label: '양도소득 기본공제 (필수 입력)',
      subLabel: '해외주식 연간 250만 원 비과세 공제 한도',
      rawValue: formatForClipboard(summary.basicDeductionKRW),
      formattedValue: `${summary.basicDeductionKRW.toLocaleString('ko-KR')} 원`,
      highlight: true,
      isImportantNote: '홈택스 세액계산 단계에서 2,500,000원을 직접 입력해야 공제됩니다!',
    },
  ];

  const handleCopy = async (id: string, valueToCopy: string, label: string, stepIdx?: number) => {
    try {
      await navigator.clipboard.writeText(valueToCopy);
      setLastCopiedFieldId(id);
      if (stepIdx !== undefined) {
        setActiveCopyStepIndex(stepIdx);
      }
      setToastMsg(`[${label}] "${valueToCopy}" 복사 완료! 홈택스 빈칸에 Ctrl+V 하세요.`);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = valueToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setLastCopiedFieldId(id);
      setToastMsg(`[${label}] "${valueToCopy}" 복사 완료!`);
    }
  };

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  // 단축키 Alt+C 로 순서대로 다음 빈칸 복사 지원, ESC로 모달 닫기
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose && !isStandaloneWindow) {
        onClose();
        return;
      }
      if (e.altKey && (e.key === 'c' || e.key === 'C' || e.key === 'ㅊ')) {
        e.preventDefault();
        const currentStep = copySteps[activeCopyStepIndex] || copySteps[0];
        handleCopy(currentStep.id, currentStep.rawValue, currentStep.label, activeCopyStepIndex);
        const nextIdx = (activeCopyStepIndex + 1) % copySteps.length;
        setActiveCopyStepIndex(nextIdx);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCopyStepIndex, copySteps, isStandaloneWindow, onClose, setActiveCopyStepIndex]);

  const handleSequentialCopy = () => {
    const currentStep = copySteps[activeCopyStepIndex] || copySteps[0];
    handleCopy(currentStep.id, currentStep.rawValue, currentStep.label, activeCopyStepIndex);
    const nextIdx = (activeCopyStepIndex + 1) % copySteps.length;
    setActiveCopyStepIndex(nextIdx);
  };

  const uniqueStocks = Array.from(
    new Map(trades.map((t) => [t.isin, { symbol: t.symbol, isin: t.isin, name: t.assetName }])).values()
  );

  return (
    <div
      className={`bg-white flex flex-col overflow-hidden ${
        isStandaloneWindow
          ? 'min-h-screen w-full'
          : 'rounded-2xl border-2 border-blue-600/90 shadow-2xl w-full max-w-xl max-h-[90vh]'
      }`}
    >
      {/* 패널 상단 헤더 */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-5 py-4 text-white shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="bg-white/20 p-1.5 rounded-lg">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight flex flex-wrap items-center gap-2">
                <span>홈택스 1:1 원클릭 복사 도우미</span>
                <span className="text-[11px] bg-yellow-400 text-slate-950 font-extrabold px-2 py-0.5 rounded-full">
                  합계액 간편신고 규격
                </span>
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                홈택스 창 옆에 띄워두고 1번부터 7번까지 순서대로 <b>[복사]</b> → <b>[Ctrl+V]</b> 하세요
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isStandaloneWindow && onOpenStandalonePopup && (
              <button
                type="button"
                onClick={onOpenStandalonePopup}
                className="inline-flex items-center gap-1 text-xs bg-white/15 hover:bg-white/25 text-white px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer"
                title="홈택스 화면 옆에 별도의 작은 리모컨 창으로 분리해서 띄웁니다"
              >
                <PictureInPicture2 className="w-3.5 h-3.5" />
                <span>미니 팝업창 분리</span>
              </button>
            )}
            <a
              href="https://www.hometax.go.kr"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs bg-white/15 hover:bg-white/25 text-white px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer"
              title="국세청 홈택스 새창 열기"
            >
              홈택스 <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {!isStandaloneWindow && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 text-white transition cursor-pointer"
                title="팝업 닫기 (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 순차 복사 액션 바 */}
        <div className="mt-3 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleSequentialCopy}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg shadow-sm transition cursor-pointer"
          >
            <span>
              순서대로 다음 빈칸 복사 ({activeCopyStepIndex + 1}/{copySteps.length}번:{' '}
              {copySteps[activeCopyStepIndex]?.label.split(' ')[0]}) · 단축키 Alt+C
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveCopyStepIndex(0)}
            className="inline-flex items-center gap-1 text-xs bg-blue-800/60 hover:bg-blue-800 text-blue-100 px-2.5 py-2 rounded-lg transition cursor-pointer"
            title="1번 빈칸부터 다시 시작"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 1번부터
          </button>
        </div>
      </div>

      {/* 실시간 복사 완료 토스트 배너 */}
      {toastMsg && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-semibold flex items-center gap-2 shrink-0">
          <Check className="w-4 h-4 shrink-0" />
          <span className="truncate">{toastMsg}</span>
        </div>
      )}

      {/* 복사 포맷 옵션 바 */}
      <div className="bg-slate-100 px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 shrink-0">
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-medium">
          <input
            type="checkbox"
            checked={stripCommasOnCopy}
            onChange={(e) => setStripCommasOnCopy(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>금액 복사 시 콤마(,) 제외</span>
          <span className="text-[11px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-semibold">
            홈택스 권장
          </span>
        </label>

        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-medium">
          <input
            type="checkbox"
            checked={stripDateHyphen}
            onChange={(e) => setStripDateHyphen(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>날짜 하이픈(-) 제외 (예: {summary.taxYear}0101)</span>
        </label>
      </div>

      <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
        {/* STEP 0: 기본정보 선택 가이드 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-xs font-bold text-slate-700 flex items-center justify-between mb-2">
            <span>[사전 단계] 홈택스 기본정보 (양도인) 선택값</span>
            <span className="text-[11px] text-slate-500 font-normal">클릭하여 선택</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white border border-slate-200 rounded-lg p-2">
              <div className="text-[11px] text-slate-400">국내외자산 구분</div>
              <div className="font-bold text-blue-700 mt-0.5">국외</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-2">
              <div className="text-[11px] text-slate-400">양도자산종류</div>
              <div className="font-bold text-blue-700 mt-0.5">국외주식</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-2">
              <div className="text-[11px] text-slate-400">양도연월 / 양수인</div>
              <div className="font-bold text-slate-800 mt-0.5">{summary.taxYear}년 / 입력생략</div>
            </div>
          </div>
        </div>

        {/* STEP 1: 종목 및 일자 입력 */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              STEP 1. 양도소득금액 계산명세서 (종목 · 일자)
            </h3>
            {uniqueStocks.length > 1 && (
              <select
                value={customRepIsin || summary.representativeIsin}
                onChange={(e) => setCustomRepIsin(e.target.value)}
                className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 bg-white text-slate-700"
                title="대표 종목 변경"
              >
                {uniqueStocks.map((st) => (
                  <option key={st.isin} value={st.isin}>
                    대표종목: {st.symbol} ({st.isin})
                  </option>
                ))}
              </select>
            )}
          </div>

          {copySteps
            .filter((s) => s.section === 'step1')
            .map((item) => {
              const globalIdx = copySteps.findIndex((c) => c.id === item.id);
              const isCopied = lastCopiedFieldId === item.id;
              const isCurrentStep = activeCopyStepIndex === globalIdx;

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 transition ${
                    isCurrentStep
                      ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20'
                      : isCopied
                      ? 'border-emerald-400 bg-emerald-50/30'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-white text-[11px] font-bold">
                          {item.stepNum}
                        </span>
                        <span className="text-xs font-bold text-slate-800">{item.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.subLabel}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.altRawValue && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(`${item.id}-alt`, item.altRawValue!, `${item.label} (티커)`, globalIdx)
                          }
                          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                        >
                          {item.altRawValue} 복사
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopy(item.id, item.rawValue, item.label, globalIdx)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> 복사됨
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> {item.rawValue} 복사
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* STEP 2: 핵심 3대 합계 금액 입력 */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-700">
              STEP 2. 전체 합계 금액 3칸 입력 (가장 중요)
            </h3>
            <span className="text-[11px] text-slate-500">복수 증권사 합산 완료</span>
          </div>

          {copySteps
            .filter((s) => s.section === 'step2')
            .map((item) => {
              const globalIdx = copySteps.findIndex((c) => c.id === item.id);
              const isCopied = lastCopiedFieldId === item.id;
              const isCurrentStep = activeCopyStepIndex === globalIdx;

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border-2 p-3.5 transition ${
                    isCurrentStep
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : isCopied
                      ? 'border-emerald-500 bg-emerald-50/40'
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold">
                          {item.stepNum}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{item.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.subLabel}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-extrabold text-slate-900 font-mono">
                        {item.formattedValue}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        복사값: {item.rawValue}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(item.id, item.rawValue, item.label, globalIdx)}
                    className={`mt-2.5 w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold transition cursor-pointer ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4" /> 클립보드에 [{item.rawValue}] 복사됨 (홈택스에 붙여넣기)
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> [{item.label.split(' ')[0]}] 원클릭 복사 ({item.rawValue})
                      </>
                    )}
                  </button>
                </div>
              );
            })}

          {/* 홈택스 자동계산 검증용: 양도소득금액 */}
          <div className="rounded-xl bg-indigo-50/80 border border-indigo-200 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <span>[검증] 양도소득금액 (홈택스 자동계산 칸)</span>
                </div>
                <p className="text-[11px] text-indigo-700">
                  위 3개 숫자를 넣으면 홈택스 하단에 이 금액이 자동 표시되는지 대조하세요
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span
                className={`text-sm font-extrabold font-mono ${
                  summary.netCapitalGainKRW >= 0 ? 'text-indigo-900' : 'text-blue-700'
                }`}
              >
                {summary.netCapitalGainKRW.toLocaleString('ko-KR')} 원
              </span>
            </div>
          </div>
        </div>

        {/* STEP 3: 기본공제 250만원 및 최종 세액 */}
        <div className="space-y-2.5 pt-1">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            STEP 3. 세액계산 (기본공제 250만 원 입력)
          </h3>

          {copySteps
            .filter((s) => s.section === 'step3')
            .map((item) => {
              const globalIdx = copySteps.findIndex((c) => c.id === item.id);
              const isCopied = lastCopiedFieldId === item.id;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border-2 border-amber-400 bg-amber-50/60 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-bold">
                          {item.stepNum}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{item.label}</span>
                      </div>
                      <p className="text-[11px] text-amber-900 font-medium mt-0.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        {item.isImportantNote}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-extrabold text-amber-950 font-mono">
                        {item.formattedValue}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(item.id, item.rawValue, item.label, globalIdx)}
                    className={`mt-2.5 w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold transition cursor-pointer ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4" /> 기본공제 [{item.rawValue}] 복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> 기본공제 [{item.rawValue}] 원클릭 복사
                      </>
                    )}
                  </button>
                </div>
              );
            })}

          {/* 최종 세액 요약 박스 */}
          <div className="rounded-xl bg-slate-900 text-white p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>과세표준 (양도소득금액 - 기본공제)</span>
              <span className="font-mono font-semibold text-white">
                {summary.taxableBaseKRW.toLocaleString('ko-KR')} 원
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>① 홈택스 양도소득세 산출세액 (20%)</span>
              <span className="font-mono font-semibold text-amber-300">
                {summary.capitalGainsTaxKRW.toLocaleString('ko-KR')} 원
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>② 위택스 지방소득세 (2%, 별도납부)</span>
              <span className="font-mono font-semibold text-blue-300">
                {summary.localIncomeTaxKRW.toLocaleString('ko-KR')} 원
              </span>
            </div>
            <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
              <span className="text-xs font-bold text-white">총 납부할 세금 합계 (22%)</span>
              <span className="text-lg font-extrabold font-mono text-emerald-400">
                {summary.totalTaxPayableKRW.toLocaleString('ko-KR')} 원
              </span>
            </div>
          </div>

          {/* STEP 4: 홈택스 증빙서류 제출 안내 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
              <div className="font-bold text-slate-800 flex items-center gap-1">
                <FileCheck2 className="w-4 h-4 text-blue-600" />
                <span>STEP 4. 홈택스 [신고 부속·증빙서류 제출]</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                합계액으로 간편신고했으므로 증권사 PDF를 첨부해야 합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={onMergePdfClick}
              className="shrink-0 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-800 shadow-2xs transition cursor-pointer"
            >
              증빙 PDF 합본 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
