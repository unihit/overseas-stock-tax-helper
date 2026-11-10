import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Calculator,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sparkles,
  PictureInPicture2,
} from 'lucide-react';
import {
  computeTaxSummary,
  requestInitialSyncForPopup,
  useTaxStore,
} from './store/useTaxStore';
import { PdfUploader } from './components/PdfUploader';
import { BrokerSummaryCards } from './components/BrokerSummaryCards';
import { TradeTable } from './components/TradeTable';
import { HometaxCopyPanel } from './components/HometaxCopyPanel';
import { downloadSampleBrokerPdf, mergeUploadedPdfsForHometax } from './utils/pdfTools';

export const App: React.FC = () => {
  const { taxYear, setTaxYear, trades, uploadedFiles, customRepIsin } = useTaxStore();
  const [showGuide, setShowGuide] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [mergeAlert, setMergeAlert] = useState<string | null>(null);

  // URL에 ?popup=1 이 있는 경우 독립 미니 브라우저 팝업창 모드로 렌더링
  const isStandalonePopup = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('popup') === '1';
  }, []);

  useEffect(() => {
    if (isStandalonePopup) {
      requestInitialSyncForPopup();
    }
  }, [isStandalonePopup]);

  const summary = useMemo(
    () => computeTaxSummary(trades, taxYear, customRepIsin),
    [trades, taxYear, customRepIsin]
  );

  const handleMergePdfClick = async () => {
    const ok = await mergeUploadedPdfsForHometax(uploadedFiles, taxYear);
    if (!ok) {
      setMergeAlert(
        '현재 예시 데이터가 로드되어 있습니다. 직접 업로드하신 증권사 PDF가 1개 이상 있을 때 하나의 합본 PDF로 병합 다운로드됩니다. (테스트용 키움 PDF를 먼저 내려받아 드래그해 보세요!)'
      );
      setTimeout(() => setMergeAlert(null), 5000);
    }
  };

  // 별도의 독립 미니 브라우저 팝업창(리모컨)으로 열기
  const handleOpenStandaloneWindow = () => {
    const popupUrl = `${window.location.origin}${window.location.pathname}?popup=1`;
    window.open(
      popupUrl,
      'HometaxCopyHelperWindow',
      'width=520,height=860,left=120,top=80,resizable=yes,scrollbars=yes'
    );
    setIsCopyModalOpen(false);
  };

  // 독립 미니 팝업창 모드일 때는 HometaxCopyPanel만 전체 화면으로 깔끔하게 표시
  if (isStandalonePopup) {
    return (
      <HometaxCopyPanel
        summary={summary}
        trades={trades}
        onMergePdfClick={handleMergePdfClick}
        isStandaloneWindow={true}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 pb-20">
      {/* 최상단 100% 브라우저 로컬 처리 보안 안심 배너 */}
      <div className="bg-emerald-950 text-emerald-100 px-4 sm:px-6 py-2 text-xs border-b border-emerald-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% 로컬 브라우저 처리
            </span>
            <span>
              🔒 <b>개인정보 안심 보증:</b> 본 서비스는 서버가 없으며, 업로드하신 PDF는 외부로 일체 전송되지 않고 현재 탭 내에서만 연산된 후 브라우저 탭을 닫으면 즉시 완전 파기됩니다.
            </span>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono hidden sm:inline">
            Zero-Server · Client-Side Only (No EXE Install)
          </span>
        </div>
      </div>

      {/* 상단 네비게이션 & 귀속연도 헤더 */}
      <header className="bg-white border-b border-slate-200 shadow-2xs sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                해외주식 양도소득세 계산기 & 홈택스 원클릭 복사기
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                여러 증권사 PDF를 합산(손익통산)하고, 홈택스 [합계액 간편신고] 빈칸을 팝업 도우미로 한 번에 채우세요
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-semibold">귀속연도:</span>
              <select
                value={taxYear}
                onChange={(e) => setTaxYear(Number(e.target.value))}
                className="font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value={2025}>2025년 귀속 (2026년 5월 신고)</option>
                <option value={2024}>2024년 귀속 (기한후/경정청구)</option>
                <option value={2026}>2026년 귀속 (미리 계산)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>신고 가이드</span>
              {showGuide ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsCopyModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>홈택스 원클릭 복사 도우미 (팝업)</span>
            </button>

            <button
              type="button"
              onClick={handleOpenStandaloneWindow}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
              title="홈택스 옆에 띄워둘 수 있는 독립된 작은 브라우저 팝업창으로 엽니다"
            >
              <PictureInPicture2 className="w-3.5 h-3.5 text-yellow-400" />
              <span>미니 창으로 분리</span>
            </button>
          </div>
        </div>

        {/* 접이식 홈택스 셀프신고 4단계 요약 가이드 */}
        {showGuide && (
          <div className="bg-blue-950 text-blue-100 border-t border-blue-900 px-4 sm:px-6 py-4">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-blue-900/50 rounded-xl p-3 border border-blue-800">
                <div className="font-extrabold text-yellow-300 mb-1">
                  1단계. 홈택스 메뉴 접속
                </div>
                <p className="text-blue-200 leading-relaxed">
                  홈택스 로그인 → <b>[세금신고]</b> → <b>[양도소득세 신고]</b> → <b>[정기신고(확정신고)]</b> 클릭
                </p>
              </div>
              <div className="bg-blue-900/50 rounded-xl p-3 border border-blue-800">
                <div className="font-extrabold text-yellow-300 mb-1">
                  2단계. 기본정보 (양도인)
                </div>
                <p className="text-blue-200 leading-relaxed">
                  국내외자산 구분: <b>[국외]</b>, 양도자산종류: <b>[국외주식]</b>, 양도연월: <b>[{taxYear}년]</b> 선택. 양수인 정보는 입력하지 않고 다음으로 이동!
                </p>
              </div>
              <div className="bg-blue-900/50 rounded-xl p-3 border border-blue-800">
                <div className="font-extrabold text-yellow-300 mb-1">
                  3단계. 합계액 1:1 복사 붙여넣기
                </div>
                <p className="text-blue-200 leading-relaxed">
                  수백 건을 다 적을 필요 없이 <b>[홈택스 원클릭 복사 도우미 팝업]</b>을 열어 대표종목 ISIN, 일자, 양도가액/취득가액/필요경비 합계, 기본공제 250만원을 순서대로 복사해 붙여넣습니다.
                </p>
              </div>
              <div className="bg-blue-900/50 rounded-xl p-3 border border-blue-800">
                <div className="font-extrabold text-yellow-300 mb-1">
                  4단계. 증빙서류 PDF 첨부 및 납부
                </div>
                <p className="text-blue-200 leading-relaxed">
                  신고 완료 후 <b>[신고 부속·증빙서류 제출]</b>에서 증권사 거래내역 PDF를 첨부하고, 양도소득세(20%)와 위택스 지방소득세(2%)를 납부하면 끝!
                </p>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 상단 핵심 KPI 4대 요약 카드 */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="text-xs font-semibold text-slate-500">
              총 양도차익 (손익통산 순수익)
            </div>
            <div
              className={`text-lg sm:text-xl font-extrabold font-mono mt-1 ${
                summary.netCapitalGainKRW >= 0 ? 'text-slate-900' : 'text-blue-600'
              }`}
            >
              {summary.netCapitalGainKRW >= 0 ? '+' : ''}
              {summary.netCapitalGainKRW.toLocaleString('ko-KR')} 원
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              양도가액 - 취득가액 - 필요경비
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="text-xs font-semibold text-slate-500">
              양도소득 기본공제 (비과세 한도)
            </div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-emerald-600 mt-1">
              -{summary.basicDeductionKRW.toLocaleString('ko-KR')} 원
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              연간 250만 원까지 세금 면제
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="text-xs font-semibold text-slate-500">과세표준</div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 mt-1">
              {summary.taxableBaseKRW.toLocaleString('ko-KR')} 원
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {summary.taxableBaseKRW === 0
                ? '납부할 세금이 없습니다 (0원)'
                : '세율 22%(국세20%+지방세2%) 적용 대상'}
            </div>
          </div>

          <div
            onClick={() => setIsCopyModalOpen(true)}
            className="bg-gradient-to-br from-slate-900 to-blue-950 hover:from-blue-950 hover:to-indigo-950 text-white rounded-2xl p-4 shadow-md transition cursor-pointer group"
            title="클릭하여 홈택스 1:1 원클릭 복사 도우미 팝업 열기"
          >
            <div className="text-xs font-semibold text-blue-200 flex items-center justify-between">
              <span>최종 납부예정 세액 (22%)</span>
              <span className="inline-flex items-center gap-1 text-[11px] bg-yellow-400 text-slate-950 font-extrabold px-2 py-0.5 rounded-full group-hover:scale-105 transition">
                <Sparkles className="w-3 h-3" /> 복사 도우미 열기
              </span>
            </div>
            <div className="text-lg sm:text-xl font-extrabold font-mono text-emerald-400 mt-1">
              {summary.totalTaxPayableKRW.toLocaleString('ko-KR')} 원
            </div>
            <div className="text-[11px] text-slate-300 mt-1 font-mono">
              양도세 {summary.capitalGainsTaxKRW.toLocaleString('ko-KR')} + 지방세{' '}
              {summary.localIncomeTaxKRW.toLocaleString('ko-KR')}
            </div>
          </div>
        </div>
      </section>

      {mergeAlert && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 mt-3">
          <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2">
            <span>{mergeAlert}</span>
            <button
              type="button"
              onClick={() => downloadSampleBrokerPdf('kiwoom')}
              className="shrink-0 bg-amber-600 text-white px-3 py-1 rounded-lg text-xs font-bold cursor-pointer"
            >
              키움 테스트 PDF 다운로드
            </button>
          </div>
        </div>
      )}

      {/* 메인 단일 풀폭 작업 영역 (업로드 -> 증권사별 요약 -> 와이드 검증 테이블) */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 flex-1 space-y-5">
        <PdfUploader />
        <BrokerSummaryCards summary={summary} />
        <TradeTable
          trades={trades}
          summary={summary}
          onOpenCopyPopup={() => setIsCopyModalOpen(true)}
        />
      </main>

      {/* 우측 하단 플로팅 원클릭 복사 도우미 실행 바 */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsCopyModalOpen(true)}
          className="inline-flex items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-sm shadow-xl shadow-blue-900/30 border border-white/20 transition transform hover:-translate-y-0.5 cursor-pointer"
        >
          <Sparkles className="w-5 h-5 text-yellow-300" />
          <span>홈택스 1:1 원클릭 복사 도우미 열기</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs font-mono">
            세액 {summary.totalTaxPayableKRW.toLocaleString('ko-KR')}원
          </span>
        </button>
      </div>

      {/* 홈택스 1:1 원클릭 복사 도우미 모달 팝업 */}
      {isCopyModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCopyModalOpen(false);
          }}
        >
          <HometaxCopyPanel
            summary={summary}
            trades={trades}
            onMergePdfClick={handleMergePdfClick}
            onClose={() => setIsCopyModalOpen(false)}
            onOpenStandalonePopup={handleOpenStandaloneWindow}
          />
        </div>
      )}

      {/* 푸터 */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-400">
        본 계산기는 국세청 홈택스 해외주식 양도소득세 확정신고(합계액 간편신고) 보조 도구입니다. 모든 연산은 사용자 브라우저 내부에서만 처리됩니다.
      </footer>
    </div>
  );
};

export default App;
