import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  Calculator,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Columns2,
} from 'lucide-react';
import { computeTaxSummary, useTaxStore } from './store/useTaxStore';
import { PdfUploader } from './components/PdfUploader';
import { BrokerSummaryCards } from './components/BrokerSummaryCards';
import { TradeTable } from './components/TradeTable';
import { HometaxCopyPanel } from './components/HometaxCopyPanel';
import { downloadSampleBrokerPdf, mergeUploadedPdfsForHometax } from './utils/pdfTools';

export const App: React.FC = () => {
  const { taxYear, setTaxYear, trades, uploadedFiles, customRepIsin } = useTaxStore();
  const [showGuide, setShowGuide] = useState(false);
  const [mergeAlert, setMergeAlert] = useState<string | null>(null);

  const summary = useMemo(
    () => computeTaxSummary(trades, taxYear, customRepIsin),
    [trades, taxYear, customRepIsin]
  );

  const handleMergePdfClick = async () => {
    const ok = await mergeUploadedPdfsForHometax(uploadedFiles, taxYear);
    if (!ok) {
      // 실제 업로드된 PDF가 아직 없고 예시 데이터만 있는 경우 테스트용 PDF 생성 안내
      setMergeAlert(
        '현재 예시 데이터가 로드되어 있습니다. 직접 업로드하신 증권사 PDF가 1개 이상 있을 때 하나의 합본 PDF로 병합 다운로드됩니다. (테스트용 키움 PDF를 먼저 내려받아 드래그해 보세요!)'
      );
      setTimeout(() => setMergeAlert(null), 5000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* 최상단 100% 브라우저 로컬 처리 보안 안심 배너 */}
      <div className="bg-emerald-950 text-emerald-100 px-4 py-2 text-xs border-b border-emerald-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% 로컬 브라우저 처리
            </span>
            <span>
              🔒 <b>개인정보 안심 보증:</b> 본 서비스는 서버가 없으며, 업로드하신 PDF는 외부로 일체 전송되지 않고 브라우저 메모리에서만 연산된 후 새로고침 시 즉시 파기됩니다.
            </span>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono hidden sm:inline">
            Zero-Server · Client-Side Only (No EXE Install)
          </span>
        </div>
      </div>

      {/* 상단 네비게이션 & 귀속연도 헤더 */}
      <header className="bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                  해외주식 양도소득세 계산기 & 홈택스 원클릭 복사기
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <Columns2 className="w-3.5 h-3.5" /> 화면분할 최적화
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                여러 증권사 PDF를 합산(손익통산)하고, 홈택스 [합계액 간편신고] 빈칸을 클릭 한 번으로 채우세요
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-semibold">신고 귀속연도:</span>
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-yellow-400" />
              <span>홈택스 3분 신고 가이드</span>
              {showGuide ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* 접이식 홈택스 셀프신고 7단계 요약 가이드 */}
        {showGuide && (
          <div className="bg-blue-950 text-blue-100 border-t border-blue-900 px-4 py-4">
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
                  수백 건을 다 적을 필요 없이 우측 <b>[홈택스 1:1 원클릭 복사 도우미]</b>의 대표종목 ISIN, 일자, 양도가액/취득가액/필요경비 합계, 기본공제 250만원을 순서대로 복사해 붙여넣습니다.
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
      <section className="max-w-7xl w-full mx-auto px-4 pt-5">
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

          <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl p-4 shadow-md">
            <div className="text-xs font-semibold text-blue-200 flex items-center justify-between">
              <span>최종 납부예정 세액 (22%)</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
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
        <div className="max-w-7xl w-full mx-auto px-4 mt-3">
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

      {/* 메인 2열 분할 작업 영역 (좌측: 업로드·검증 / 우측: 홈택스 1:1 원클릭 복사기) */}
      <main className="max-w-7xl w-full mx-auto px-4 py-5 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* 좌측 열 (7/12) */}
          <div className="lg:col-span-7 space-y-5">
            <PdfUploader />
            <BrokerSummaryCards summary={summary} />
            <TradeTable trades={trades} summary={summary} />
          </div>

          {/* 우측 열 (5/12) - 홈택스 1:1 원클릭 복사 패널 */}
          <div className="lg:col-span-5">
            <HometaxCopyPanel
              summary={summary}
              trades={trades}
              onMergePdfClick={handleMergePdfClick}
            />
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-400">
        본 계산기는 국세청 홈택스 해외주식 양도소득세 확정신고(합계액 간편신고) 보조 도구입니다. 모든 연산은 사용자 브라우저 내부에서만 처리됩니다.
      </footer>
    </div>
  );
};

export default App;
