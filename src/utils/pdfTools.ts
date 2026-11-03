import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { TaxSummary, TradeRecord, UploadedPdfFile } from '../types/tax';

/**
 * 실제 드래그 앤 드롭 파싱 테스트를 위해 브라우저에서 즉시 다운로드 가능한
 * 증권사 양식 테스트용 PDF 파일을 생성합니다.
 */
export async function downloadSampleBrokerPdf(preset: 'kiwoom' | 'toss') {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 420]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (preset === 'kiwoom') {
    page.drawText('KIWOOM SECURITIES - Overseas Stock Capital Gains Tax Report (2025)', {
      x: 40,
      y: 370,
      size: 13,
      font: boldFont,
      color: rgb(0.1, 0.2, 0.5),
    });
    page.drawText('Document Type: KIWOOM YunguMun Global Tax Calculation Sheet', {
      x: 40,
      y: 348,
      size: 10,
      font,
    });
    page.drawText('----------------------------------------------------------------------------------------', {
      x: 40,
      y: 325,
      size: 10,
      font,
    });
    page.drawText('Ticker / ISIN         Buy Date     Sell Date    Sell(KRW)      Buy(KRW)      Fees(KRW)     Gain(KRW)', {
      x: 40,
      y: 305,
      size: 9,
      font: boldFont,
    });
    page.drawText('NVDA US67066G1040   2025-02-14   2025-10-21   98,450,000     62,100,000    245,000       36,105,000', {
      x: 40,
      y: 280,
      size: 9,
      font,
    });
    page.drawText('AAPL US0378331005   2025-03-10   2025-11-15   29,800,000     23,150,000    85,000        6,565,000', {
      x: 40,
      y: 258,
      size: 9,
      font,
    });
    page.drawText('MSFT US5949181045   2025-05-02   2025-12-03   18,200,000     15,000,000    40,000        3,160,000', {
      x: 40,
      y: 236,
      size: 9,
      font,
    });
    page.drawText('----------------------------------------------------------------------------------------', {
      x: 40,
      y: 212,
      size: 10,
      font,
    });
    page.drawText('TOTAL               2025-01-01   2025-12-31   146,450,000    100,250,000   370,000       45,830,000', {
      x: 40,
      y: 192,
      size: 10,
      font: boldFont,
    });
  } else {
    page.drawText('TOSS SECURITIES - Overseas Stock Capital Gains Statement (2025)', {
      x: 40,
      y: 370,
      size: 13,
      font: boldFont,
      color: rgb(0.0, 0.35, 0.85),
    });
    page.drawText('Broker: TOSS Securities Co., Ltd. (Loss Offset Statement)', {
      x: 40,
      y: 348,
      size: 10,
      font,
    });
    page.drawText('----------------------------------------------------------------------------------------', {
      x: 40,
      y: 325,
      size: 10,
      font,
    });
    page.drawText('Ticker / ISIN         Buy Date     Sell Date    Sell(KRW)      Buy(KRW)      Fees(KRW)     Gain(KRW)', {
      x: 40,
      y: 305,
      size: 9,
      font: boldFont,
    });
    page.drawText('TSLA US88160R1014   2025-01-22   2025-08-19   31,200,000     39,850,000    112,000       -8,762,000', {
      x: 40,
      y: 280,
      size: 9,
      font,
    });
    page.drawText('SOXL US25459W8626   2025-06-11   2025-11-28   14,500,000     17,900,000    55,000        -3,455,000', {
      x: 40,
      y: 258,
      size: 9,
      font,
    });
    page.drawText('----------------------------------------------------------------------------------------', {
      x: 40,
      y: 232,
      size: 10,
      font,
    });
    page.drawText('TOTAL               2025-01-01   2025-12-31   45,700,000     57,750,000    167,000       -12,217,000', {
      x: 40,
      y: 210,
      size: 10,
      font: boldFont,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    preset === 'kiwoom'
      ? '키움증권_해외주식양도소득세_계산보조자료_테스트.pdf'
      : '토스증권_해외주식양도세_거래내역서_테스트.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 업로드된 여러 증권사의 원본 PDF들을 홈택스 [신고 부속·증빙서류 제출]용 단일 PDF로 병합하여 다운로드
 */
export async function mergeUploadedPdfsForHometax(
  files: UploadedPdfFile[],
  taxYear: number
): Promise<boolean> {
  const validFiles = files.filter((f) => f.rawBuffer && f.rawBuffer.byteLength > 0);
  if (validFiles.length === 0) {
    return false;
  }

  const mergedPdf = await PDFDocument.create();

  for (const file of validFiles) {
    if (!file.rawBuffer) continue;
    const srcDoc = await PDFDocument.load(file.rawBuffer);
    const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
    copiedPages.forEach((p) => mergedPdf.addPage(p));
  }

  const pdfBytes = await mergedPdf.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `[홈택스증빙서류제출용]_${taxYear}귀속_해외주식_양도소득세_합본증빙.pdf`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * 홈택스 합계액 신고 요약 및 종목별 거래내역을 엑셀(.xlsx) 파일로 다운로드
 */
export function exportTaxSummaryToExcel(trades: TradeRecord[], summary: TaxSummary) {
  const wb = XLSX.utils.book_new();

  // 시트 1: 홈택스 신고 1:1 입력 요약표
  const hometaxRows = [
    ['[국세청 홈택스 해외주식 양도소득세 확정신고 1:1 입력 요약표]'],
    ['귀속연도', `${summary.taxYear}년 귀속 (${summary.taxYear + 1}년 5월 확정신고)`],
    [],
    ['홈택스 입력 항목', '홈택스 입력값 (숫자만)', '포맷팅 표시값', '입력 안내'],
    ['1. 국내외자산 구분', '국외 / 국외주식', '국외 / 국외주식', '드롭다운에서 국외 -> 국외주식 선택'],
    [
      '2. 국제증권식별번호(ISIN)',
      summary.representativeIsin,
      `${summary.representativeIsin} (${summary.representativeSymbol})`,
      '가장 거래대금이 큰 대표종목 1개 입력',
    ],
    ['3. 양도자산 취득일자', summary.recommendedBuyDate, summary.recommendedBuyDate, '합계액 신고 권장 취득일'],
    ['4. 양도자산 양도일자', summary.recommendedSellDate, summary.recommendedSellDate, '합계액 신고 권장 양도일'],
    [
      '5. 양도가액 (전체 합계)',
      summary.totalSellAmountKRW,
      `${summary.totalSellAmountKRW.toLocaleString()}원`,
      '1년 동안 매도한 총 원화 합계',
    ],
    [
      '6. 취득가액 (전체 합계)',
      summary.totalBuyAmountKRW,
      `${summary.totalBuyAmountKRW.toLocaleString()}원`,
      '1년 동안 매수한 총 원화 합계',
    ],
    [
      '7. 필요경비 (전체 합계)',
      summary.totalFeesKRW,
      `${summary.totalFeesKRW.toLocaleString()}원`,
      '증권사 수수료 및 제세금 총 합계',
    ],
    [
      '8. 양도소득금액 (자동계산 검증)',
      summary.netCapitalGainKRW,
      `${summary.netCapitalGainKRW.toLocaleString()}원`,
      '양도가액 - 취득가액 - 필요경비 일치 여부 확인',
    ],
    [
      '9. 양도소득 기본공제',
      summary.basicDeductionKRW,
      `${summary.basicDeductionKRW.toLocaleString()}원`,
      '연간 250만 원 비과세 한도 직접 입력 필수',
    ],
    [
      '10. 과세표준',
      summary.taxableBaseKRW,
      `${summary.taxableBaseKRW.toLocaleString()}원`,
      '양도소득금액 - 기본공제',
    ],
    [
      '11. 양도소득세 산출세액 (20%)',
      summary.capitalGainsTaxKRW,
      `${summary.capitalGainsTaxKRW.toLocaleString()}원`,
      '홈택스 납부세액 (10원 미만 절사)',
    ],
    [
      '12. 지방소득세 (2%)',
      summary.localIncomeTaxKRW,
      `${summary.localIncomeTaxKRW.toLocaleString()}원`,
      '위택스(Wetax) 연계 납부세액',
    ],
    [
      '13. 총 납부예정 세액 합계 (22%)',
      summary.totalTaxPayableKRW,
      `${summary.totalTaxPayableKRW.toLocaleString()}원`,
      '양도소득세 + 지방소득세 총액',
    ],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(hometaxRows);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 26 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, '홈택스_1대1_입력요약');

  // 시트 2: 증권사별·종목별 상세 내역
  const tradeRows = trades.map((t, idx) => ({
    순번: idx + 1,
    증권사: t.broker,
    티커: t.symbol,
    '국제증권식별번호(ISIN)': t.isin,
    종목명: t.assetName,
    취득일자: t.buyDate,
    양도일자: t.sellDate,
    '양도가액(원)': t.sellAmountKRW,
    '취득가액(원)': t.buyAmountKRW,
    '필요경비(원)': t.feesKRW,
    '양도소득금액(원)': t.capitalGainKRW,
    원본파일: t.sourceFileName || '직접입력',
  }));

  const wsTrades = XLSX.utils.json_to_sheet(tradeRows);
  wsTrades['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
    { wch: 26 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTrades, '증권사별_상세거래내역');

  XLSX.writeFile(wb, `해외주식_양도소득세_홈택스신고계산서_${summary.taxYear}귀속.xlsx`);
}
