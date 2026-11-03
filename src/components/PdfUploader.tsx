import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  Download,
  Sparkles,
  ScanText,
} from 'lucide-react';
import { useTaxStore } from '../store/useTaxStore';
import { parseBrokerPdfInBrowser } from '../utils/pdfParser';
import { downloadSampleBrokerPdf } from '../utils/pdfTools';
import { BrokerType } from '../types/tax';

const BROKER_BADGE_STYLE: Record<BrokerType, string> = {
  키움증권: 'bg-pink-100 text-pink-800 border-pink-200',
  토스증권: 'bg-blue-100 text-blue-800 border-blue-200',
  미래에셋증권: 'bg-orange-100 text-orange-800 border-orange-200',
  한국투자증권: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  삼성증권: 'bg-sky-100 text-sky-800 border-sky-200',
  'NH투자증권(나무)': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  KB증권: 'bg-amber-100 text-amber-800 border-amber-200',
  '직접입력/기타': 'bg-slate-100 text-slate-800 border-slate-200',
};

export const PdfUploader: React.FC = () => {
  const {
    taxYear,
    uploadedFiles,
    addOrUpdateFile,
    removeFile,
    addTrades,
    loadSampleMultiBrokerData,
    clearAll,
  } = useTaxStore();

  const [isDragging, setIsDragging] = useState(false);
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
          }
        );

        const totalGain = result.trades.reduce((acc, t) => acc + t.capitalGainKRW, 0);

        if (result.trades.length > 0) {
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
            message: `${result.usedOcr ? '[로컬 OCR 판독] ' : ''}거래내역 ${
              result.trades.length
            }건 추출 완료`,
          });
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
            키움·토스·미래에셋·한투·삼성·NH·KB 등 여러 증권사 PDF를 한 번에 드래그하세요 (자동 손익통산)
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
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {file.status === 'parsing' || file.status === 'ocr-running' ? (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                  ) : file.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                          BROKER_BADGE_STYLE[file.detectedBroker]
                        }`}
                      >
                        {file.detectedBroker}
                      </span>
                      <span className="font-semibold text-slate-800 truncate">{file.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{file.message}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {file.status === 'completed' && (
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">추출 손익</div>
                      <div
                        className={`font-bold font-mono ${
                          file.totalGainKRW >= 0 ? 'text-rose-600' : 'text-blue-600'
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
