# 📈 해외주식 양도소득세 계산기 & 홈택스 1:1 원클릭 셀프신고 도우미
> **Overseas Stock Capital Gains Tax Calculator & HomeTax 1-Click Copy Helper**  
> 복수 증권사(키움·토스·미래에셋·한투·삼성 등) 해외주식 거래내역 PDF를 올리면 브라우저에서 자동 파싱하고 손익을 통산하여, **국세청 홈택스 확정신고 팝업창 순서 그대로 원클릭 복사(Ctrl+C -> Ctrl+V)**할 수 있도록 도와주는 웹 애플리케이션입니다.

🌐 **웹 서비스 바로가기 (GitHub Pages 배포 주소)**  
👉 **[https://unihit.github.io/overseas-stock-tax-helper/](https://unihit.github.io/overseas-stock-tax-helper/)**  
*(별도 설치나 회원가입 없이 브라우저에서 즉시 실행됩니다)*

---

## 🔒 개인정보 보안 안심 원칙 (Zero-Server / Client-Side Only)
- **100% 브라우저 메모리 연산**: 백엔드 서버가 존재하지 않으며, 업로드한 PDF와 거래내역은 외부 서버로 단 1바이트도 전송되지 않습니다.
- **주민등록번호 즉시 마스킹**: 브라우저 로컬 텍스트 추출 단계에서 주민등록번호 패턴을 자동 마스킹합니다.
- **새로고침 시 완전 파기**: 브라우저 창을 닫거나 새로고침하면 모든 금융 데이터는 메모리에서 즉시 소멸합니다.
- **회사 PC 차단 회피**: 별도 `.exe` 설치 프로그램이 아니므로 사내 보안 프로그램(EDR/AppLocker)에 차단되지 않습니다.

---

## ✨ 핵심 기능

### 1. 국세청 홈택스 1:1 원클릭 복사 도우미 (Hometax Copy Helper)
- 국세청 홈택스 **[주식 등 양도소득금액 계산명세서]** 팝업창 순서와 1:1 매칭
- **STEP 1. 종목 및 일자**:
  - 대표종목 국제증권식별번호 (ISIN 12자리, 예: `US67066G1040`) 및 티커 복사
  - 합산신고 권장 취득일자(`20250101`) / 양도일자(`20251231`) 복사
- **STEP 2. 전체 합계 금액 3칸**:
  - 전 증권사 합산 **양도가액(총수입)** 원클릭 복사 (홈택스 입력 오류 방지 콤마 제거)
  - 전 증권사 합산 **취득가액** 원클릭 복사
  - 전 증권사 합산 **필요경비(수수료·제세금)** 원클릭 복사
  - 홈택스 자동계산 칸 검증용 **양도소득금액(순수익)** 일치 대조
- **STEP 3. 세액계산**:
  - **양도소득 기본공제(연 2,500,000원)** 복사
  - 최종 납부세액 실시간 프리뷰: 양도소득세 20% + 지방소득세 2% (총 22%)
- **편의 기능**:
  - `[순서대로 다음 빈칸 복사]` 버튼 및 `Alt + C` 단축키로 1번부터 7번까지 순차 복사 지원

### 2. 멀티 증권사 PDF 자동 파싱 및 손익통산 (손실상계)
- 여러 증권사(키움, 토스, 미래에셋, 한국투자, 삼성, NH나무, KB 등) PDF를 다중 드래그 앤 드롭
- A사 이익(+4,000만원)과 B사 손실(-1,000만원)을 자동 상계하여 **절감된 세액(22%)을 직관적으로 시각화**
- 디지털 텍스트 PDF 고속 추출(`pdfjs-dist`) 및 스캔본 이미지 PDF 로컬 OCR 폴백(`tesseract.js`)

### 3. 인라인 수정 및 홈택스 증빙서류 합본 다운로드
- 파싱된 수치가 실제와 다르거나 양식이 특이할 경우 테이블에서 셀을 직접 클릭해 즉시 수정 가능
- 업로드한 여러 증권사 원본 PDF들을 홈택스 `[신고 부속·증빙서류 제출]`용 **단일 합본 PDF로 병합 다운로드**
- 세무 보관용 엑셀(`xlsx`) 계산서 다운로드 지원

---

## 🚀 빠른 시작 (Local Development)

### 요구사항
- Node.js 18+ 이상

### 설치 및 실행
```bash
# 1. 저장소 클론
git clone https://github.com/unihit/overseas-stock-tax-helper.git
cd overseas-stock-tax-helper

# 2. 의존성 패키지 설치
npm install

# 3. 개발 서버 구동
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

### 프로덕션 빌드
```bash
npm run build
npm run preview
```

---

## 🛠 기술 스택
- **Framework**: React 18, Vite 6, TypeScript
- **Styling**: Tailwind CSS v4, Lucide React
- **State Management**: Zustand
- **PDF Engine**: `pdfjs-dist` (Client-side Web Worker)
- **Local OCR**: `tesseract.js` (Browser Canvas Wasm OCR)
- **PDF & Excel Tools**: `pdf-lib`, `xlsx`

---

## 📜 라이선스
MIT License
