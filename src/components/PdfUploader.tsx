import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  Download,
  Sparkles,
  ScanText,
  ArrowLeftRight,
  Eye,
  X,
  Search,
} from 'lucide-react';
import { useTaxStore } from '../store/useTaxStore';
import { parseBrokerPdfInBrowser } from '../utils/pdfParser';
import { downloadSampleBrokerPdf } from '../utils/pdfTools';
import { BrokerType, UploadedPdfFile } from '../types/tax';

const BROKER_BADGE_STYLE: Record<BrokerType, string> = {
  키움증권: 'bg-pink-100 text-pink-800 border-pink-200',
  토스증권: 'bg-blue-100 text-blue-800 border-blue-200',
  미래에셋증권: 'bg-orange-100 text-orange-800 border-orange-200',
  한국투자증권: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  삼성증권: 'bg-sky-100 text-sky-800 border-sky-200',
  'NH투자증권(나무)': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  KB증권: 'bg-amber-100 text-amber-800 border-amber-200',
  메리츠증권: 'bg-red-100 text-red-800 border-red-200',
  하나증권: 'bg-teal-100 text-teal-800 border-teal-200',
  신한투자증권: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  '대신증권(크레온)': 'bg-lime-100 text-lime-800 border-lime-200',
  '직접입력/기타': 'bg-slate-100 text-slate-800 border-slate-200',
};

export const PdfUploader: React.FC = () => {
  const {
    taxYear,
    uploadedFiles,
    addOrUpdateFile,
    toggleFileTradeMode,
    removeFile,
    addTrades,
    loadSampleMultiBrokerData,
    clearAll,
  } = useTaxStore();

  const [isDragging, setIsDragging] = useState(false);
  const [inspectingFile, setInspectingFile] = useState<UploadedPdfFile | null>(null);
  const [rawSearchQuery, setRawSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    for (const file of files) {
      const fileId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      addOrUpdateFile({
        id: fileId,
        name: file.name,
        size: file.size,
        detectedBroker: '직접입력/기타',
        status: 'parsing',
        progress: 10,
        extractedCount: 0,
        totalGainKRW: 0,
        message: '브라우저 메모리에서 PDF 분석 시작...',
      });

      try {
        const { result, buffer } = await parseBrokerPdfInBrowser(
          file,
          taxYear,
          (progress, message) => {
            addOrUpdateFile({
              id: fileId,
              name: file.name,
              size: file.size,
              detectedBroker: '직접입력/기타',
              status: progress < 100 ? 'parsing' : 'completed',
              progress,
              extractedCount: 0,
              totalGainKRW: 0,
              message,
            });
          },
          fileId
        );

        const totalGain = result.trades.reduce((acc, t) => acc + t.capitalGainKRW, 0);

        if (result.trades.length > 0) {
          // [분할 PDF 자동 감지 및 중복 합산 방지]
          // 토스증권_2025_1.pdf, 토스증권_2025_2.pdf처럼 한 증권사의 내역이 2개 이상의 PDF로 나뉜 경우,
          // 두 PDF 모두 동일한 연간 전체 합계(양도가액/취득가액/필요경비/양도소득금액)를 포함하고 있습니다.
          // 이미 동일한 증권사 + 동일한 금액의 합계 행이 반영되어 있다면 중복 더하기를 자동 방지하고 증빙 병합용 버퍼만 유지합니다.
          const currentTrades = useTaxStore.getState().trades.filter((t) => t.parseMethod !== 'sample');
          const primaryTrade = result.trades[0];
          const existingDuplicate =
            result.trades.length === 1 &&
            currentTrades.find(
              (t) =>
                t.broker === result.detectedBroker &&
                t.sellAmountKRW === primaryTrade.sellAmountKRW &&
                t.buyAmountKRW === primaryTrade.buyAmountKRW &&
                t.feesKRW === primaryTrade.feesKRW &&
                t.capitalGainKRW === primaryTrade.capitalGainKRW
            );

          if (existingDuplicate) {
            addOrUpdateFile({
              id: fileId,
              name: file.name,
              size: file.size,
              detectedBroker: result.detectedBroker,
              status: 'completed',
              progress: 100,
              extractedCount: 0,
              totalGainKRW: totalGain,
              rawBuffer: buffer,
              rawLines: result.rawLines,
              summaryTrade: result.summaryTrade,
              individualTrades: result.individualTrades,
              activeMode: result.activeMode,
              isDuplicateSplit: true,
              message: `🔗 분할 PDF 자동 감지: [${existingDuplicate.sourceFileName || '앞선 파일'}]에 동일한 연간 합계(${totalGain >= 0 ? '+' : ''}${totalGain.toLocaleString('ko-KR')}원)가 이미 반영되어 중복 합산을 자동 제외했습니다 (증빙 PDF 병합 시에는 함께 포함됨)`,
            });
          } else {
            addTrades(result.trades);
            addOrUpdateFile({
              id: fileId,
              name: file.name,
              size: file.size,
              detectedBroker: result.detectedBroker,
              status: 'completed',
              progress: 100,
              extractedCount: result.trades.length,
              totalGainKRW: totalGain,
              rawBuffer: buffer,
              rawLines: result.rawLines,
              summaryTrade: result.summaryTrade,
              individualTrades: result.individualTrades,
              activeMode: result.activeMode,
              message: `${result.usedOcr ? '[로컬 OCR 정밀판독] ' : ''}${
                result.activeMode === 'summary'
                  ? `연간 문서합계 1건 자동 추출 완료${
                      result.individualTrades.length > 0
                        ? ` (세부 종목 ${result.individualTrades.length}건 검증 완료)`
                        : ''
                    }`
                  : `거래내역 ${result.trades.length}건 추출 완료`
              }`,
            });
          }
        } else {
          // 자동 파싱된 행이 없는 경우 빈 행 1개를 해당 증권사로 자동 추가하여 수동 입력 유도
          addTrades([
            {
              id: `manual-fallback-${Date.now()}`,
              broker: result.detectedBroker,
              symbol: 'NVDA',
              isin: 'US67066G1040',
              assetName: `${result.detectedBroker} 합산 대표종목 (수치 확인 필요)`,
              quantity: 1,
              buyDate: `${taxYear}-01-01`,
              sellDate: `${taxYear}-12-31`,
              sellAmountKRW: 0,
              buyAmountKRW: 0,
              feesKRW: 0,
              capitalGainKRW: 0,
              sourceFileId: fileId,
              sourceFileName: file.name,
              parseMethod: 'manual',
              hasWarning: true,
            },
          ]);

          addOrUpdateFile({
            id: fileId,
            name: file.name,
            size: file.size,
            detectedBroker: result.detectedBroker,
            status: 'warning',
            progress: 100,
            extractedCount: 1,
            totalGainKRW: 0,
            rawBuffer: buffer,
            rawLines: result.rawLines,
            message:
              '비표준 양식 감지: 아래 테이블에 추가된 행에 PDF의 [합계] 금액을 직접 입력해 주세요.',
          });
        }
      } catch (err) {
        addOrUpdateFile({
          id: fileId,
          name: file.name,
          size: file.size,
          detectedBroker: '직접입력/기타',
          status: 'error',
          progress: 100,
          extractedCount: 0,
          totalGainKRW: 0,
          message:
            err instanceof Error
              ? `PDF 읽기 오류: ${err.message} (비밀번호가 걸린 PDF인지 확인하세요)`
              : 'PDF 파싱 중 오류가 발생했습니다.',
        });
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ScanText className="w-5 h-5 text-blue-600" />
            <span>1. 증권사 해외주식 양도소득세 PDF 다중 업로드</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            키움·토스·미래에셋·한투·삼성·NH·KB·메리츠·하나·신한·대신 등 여러 증권사 PDF를 한 번에 드래그하세요 (자동 손익통산)
          </p>
        </div>

        {/* 샘플 데이터 및 테스트용 실제 PDF 생성 버튼 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => downloadSampleBrokerPdf('kiwoom')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            title="드래그 앤 드롭 테스트용 실제 키움증권 양식 PDF 다운로드"
          >
            <Download className="w-3.5 h-3.5 text-pink-600" />
            <span>키움 테스트 PDF 받기</span>
          </button>
          <button
            type="button"
            onClick={() => downloadSampleBrokerPdf('toss')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            title="드래그 앤 드롭 테스트용 실제 토스증권(손실상계) 양식 PDF 다운로드"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>토스 테스트 PDF 받기</span>
          </button>
          <button
            type="button"
            onClick={loadSampleMultiBrokerData}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3개 증권사 합산 예시 복원</span>
          </button>
        </div>
      </div>

      {/* 드래그 앤 드롭 영역 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFilesSelected(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${
          isDragging
            ? 'border-blue-600 bg-blue-50/70'
            : 'border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFilesSelected(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="mx-auto w-11 h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-2.5">
          <UploadCloud className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-800">
          여기를 클릭하거나 증권사 양도소득세 내역서 PDF들을 드래그 앤 드롭하세요
        </p>
        <p className="text-xs text-slate-500 mt-1">
          디지털 텍스트 PDF 즉시 추출 및 스캔본 이미지 PDF 브라우저 로컬 OCR(Tesseract) 자동 지원 · 비밀번호가 없는 PDF를 업로드하세요
        </p>
      </div>

      {/* 업로드된 파일 리스트 */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="font-semibold text-slate-700">
              반영된 증권사 문서 ({uploadedFiles.length}건)
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-rose-600 hover:underline font-medium cursor-pointer"
            >
              전체 초기화
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {uploadedFiles.map((file) => {
              const canToggleMode =
                !file.isDuplicateSplit &&
                file.summaryTrade &&
                file.individualTrades &&
                file.individualTrades.length > 0;
              const hasRawLines = file.rawLines && file.rawLines.length > 0;

              return (
                <div
                  key={file.id}
                  className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {file.status === 'parsing' || file.status === 'ocr-running' ? (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                    ) : file.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            BROKER_BADGE_STYLE[file.detectedBroker]
                          }`}
                        >
                          {file.detectedBroker}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">{file.name}</span>

                        {canToggleMode && (
                          <button
                            type="button"
                            onClick={() => toggleFileTradeMode(file.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 transition cursor-pointer"
                            title="문서 전체 합계(1건) 반영 모드와 종목별 개별 내역(N건) 반영 모드를 전환합니다"
                          >
                            <ArrowLeftRight className="w-3 h-3" />
                            <span>
                              {file.activeMode === 'summary'
                                ? `종목별 ${file.individualTrades!.length}건으로 보기`
                                : '문서합계 1건으로 전환'}
                            </span>
                          </button>
                        )}

                        {hasRawLines && (
                          <button
                            type="button"
                            onClick={() => {
                              setInspectingFile(file);
                              setRawSearchQuery('');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer"
                            title="PDF에서 추출된 원본 텍스트/OCR 줄 내역을 대조합니다"
                          >
                            <Eye className="w-3 h-3" />
                            <span>원문 대조</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{file.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-auto">
                    {file.status === 'completed' && (
                      <div className="text-right">
                        <div className="text-[11px] text-slate-400">
                          {file.isDuplicateSplit ? '중복 합산 제외 (분할문서)' : '추출 손익'}
                        </div>
                        <div
                          className={`font-bold font-mono ${
                            file.isDuplicateSplit
                              ? 'text-slate-400 line-through'
                              : file.totalGainKRW >= 0
                              ? 'text-rose-600'
                              : 'text-blue-600'
                          }`}
                        >
                          {file.totalGainKRW >= 0 ? '+' : ''}
                          {file.totalGainKRW.toLocaleString('ko-KR')}원
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(file.id, file.name.replace(' (예시)', ''))}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="이 문서 내역 제외"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OCR / 텍스트 추출 원문 대조 모달 */}
      {inspectingFile && inspectingFile.rawLines && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setInspectingFile(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[82vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                    {inspectingFile.detectedBroker}
                  </span>
                  <h3 className="text-sm font-bold truncate">
                    {inspectingFile.name} — 추출 원문 대조 ({inspectingFile.rawLines.length}줄)
                  </h3>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  노란색으로 강조된 줄은 합계(TOTAL) 키워드 또는 주요 금액이 감지된 위치입니다. (주민등록번호 등 민감정보는 자동 마스킹됨)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingFile(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={rawSearchQuery}
                  onChange={(e) => setRawSearchQuery(e.target.value)}
                  placeholder="종목명, ISIN 코드, '합계' 또는 금액 검색..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              {inspectingFile.summaryTrade && (
                <div className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-mono shrink-0">
                  합계 손익: {inspectingFile.summaryTrade.capitalGainKRW >= 0 ? '+' : ''}
                  {inspectingFile.summaryTrade.capitalGainKRW.toLocaleString('ko-KR')}원
                </div>
              )}
            </div>

            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-1 bg-slate-950 text-slate-200">
              {inspectingFile.rawLines
                .map((line, idx) => ({ line, idx: idx + 1 }))
                .filter(
                  ({ line }) =>
                    !rawSearchQuery.trim() ||
                    line.toLowerCase().includes(rawSearchQuery.trim().toLowerCase())
                )
                .map(({ line, idx }) => {
                  const isTotalHighlight =
                    /(합\s*[계게례케메예기]|총\s*계|TOTAL|양도가액\s*합|양도가액\s*계)/i.test(
                      line
                    );
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 px-2 py-1 rounded ${
                        isTotalHighlight
                          ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 font-bold'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <span className="text-slate-500 select-none w-8 text-right shrink-0">
                        {idx}
                      </span>
                      <span className="whitespace-pre-wrap break-all">{line}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
