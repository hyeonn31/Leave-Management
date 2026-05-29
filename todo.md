# 전직원 연차 관리 시스템 TODO

## Phase 2: DB 스키마
- [x] employees 테이블 (직원 프로필: 입사일, 부서, 직급, 상태)
- [x] leave_balances 테이블 (연도별 연차 잔여/사용/총부여)
- [x] leave_requests 테이블 (연차 신청: 종류, 날짜, 상태, 승인자)
- [x] notifications 테이블 (인앱 알림)
- [x] leave_adjustments 테이블 (수동 조정 이력)
- [x] DB 마이그레이션 실행

## Phase 3: 백엔드 tRPC 라우터
- [x] 연차 계산 유틸 함수 (법정 연차 로직: 1년 미만 월 1일, 1년 이상 15~25일)
- [x] employees 라우터 (CRUD, 프로필 조회/수정)
- [x] leaveRequests 라우터 (신청, 승인, 반려, 목록 조회)
- [x] leaveBalance 라우터 (잔여 연차 조회, 연도별 이력)
- [x] notifications 라우터 (읽음 처리, 목록 조회)
- [x] admin 라우터 (전직원 현황, 부서별 통계, 수동 조정)
- [x] CSV 내보내기 엔드포인트 (관리자 전용)
- [x] 인앱 알림 발송 로직 (신청 접수 시 관리자에게, 승인/반려 시 신청자에게)

## Phase 4: 프론트엔드 UI
- [x] 글로벌 스타일 설정 (International Typographic Style: 흰색/검정/빨강)
- [x] DashboardLayout 커스터마이징 (사이드바 네비게이션)
- [x] 직원 대시보드 페이지 (잔여 연차 현황, 도넛 차트)
- [x] 연차 신청 페이지 (날짜 선택, 종류 선택, 사유 입력)
- [x] 내 연차 내역 페이지 (연도별 사용 이력)
- [x] 알림 페이지 (인앱 알림 목록)
- [x] HR 관리자 대시보드 (전직원 현황 요약, 부서별 통계 차트)
- [x] 연차 신청 관리 페이지 (승인/반려 처리)
- [x] 직원 관리 페이지 (CRUD)
- [x] 내 프로필 페이지 (입사일, 부서, 직급 등록/수정)
- [x] CSV 내보내기 버튼 (관리자 전용)

## Phase 5: 스케줄 자동화 및 시딩
- [x] 연차 초기화 스케줄 핸들러 (/api/scheduled/leave-renewal)
- [x] Heartbeat 프로젝트 레벨 cron 등록 (매일 자정 실행)
- [x] 테스트 데이터 시딩 (직원 프로필, 연차 잔여, 알림)

## Phase 6: 테스트 및 최종 검증
- [x] 연차 계산 로직 Vitest 단위 테스트 (13개 케이스 통과)
- [x] auth.logout 기존 테스트 통과
- [x] TypeScript 오류 0개 확인
- [x] 체크포인트 저장
