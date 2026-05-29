/**
 * 대한민국 근로기준법 기반 연차 계산 유틸리티
 * - 1년 미만: 매 개근 1개월마다 1일 (최대 11일)
 * - 1년 이상: 15일 기본 + 가산연차
 * - 가산연차: 3년차부터 2년마다 1일 추가 (최대 25일)
 */

export interface LeaveEntitlement {
  totalDays: number;
  baseDays: number;
  seniorityBonus: number;
  yearsOfService: number;
  monthsOfService: number;
}

/**
 * 근속 연수에 따른 법정 연차 일수 계산
 * @param entryDate 입사일
 * @param referenceDate 기준일 (기본값: 오늘)
 */
export function calculateLeaveEntitlement(
  entryDate: Date,
  referenceDate: Date = new Date()
): LeaveEntitlement {
  const entry = new Date(entryDate);
  const ref = new Date(referenceDate);

  // 총 근속 개월 수 계산
  const totalMonths =
    (ref.getFullYear() - entry.getFullYear()) * 12 +
    (ref.getMonth() - entry.getMonth());

  const yearsOfService = Math.floor(totalMonths / 12);
  const monthsOfService = totalMonths;

  if (yearsOfService < 1) {
    // 1년 미만: 개근 월 1일 (최대 11일)
    const days = Math.min(totalMonths, 11);
    return {
      totalDays: days,
      baseDays: days,
      seniorityBonus: 0,
      yearsOfService,
      monthsOfService,
    };
  }

  // 1년 이상: 기본 15일
  const baseDays = 15;

  // 가산연차: 3년차부터 2년마다 1일 추가
  // Formula: floor((N-1)/2) where N >= 1
  const seniorityBonus = Math.floor((yearsOfService - 1) / 2);

  // 최대 25일 상한
  const totalDays = Math.min(baseDays + seniorityBonus, 25);

  return {
    totalDays,
    baseDays,
    seniorityBonus: totalDays - baseDays,
    yearsOfService,
    monthsOfService,
  };
}

/**
 * 연차 종류에 따른 차감 일수 계산
 */
export function calculateDaysForLeaveType(
  leaveType: "annual" | "half_am" | "half_pm" | "sick" | "special" | "unpaid",
  startDate: Date,
  endDate: Date
): number {
  if (leaveType === "half_am" || leaveType === "half_pm") {
    return 0.5;
  }

  // 날짜 범위의 평일 수 계산 (토/일 제외)
  let days = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days++;
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

/**
 * Alias for calculateLeaveEntitlement — returns total days only.
 * Used by tests and scheduled jobs.
 */
export function calculateLegalLeaveDays(
  entryDate: Date,
  referenceDate: Date = new Date()
): number {
  if (referenceDate < entryDate) return 0;
  return calculateLeaveEntitlement(entryDate, referenceDate).totalDays;
}

/**
 * Count business days (Mon–Fri) between two date strings (inclusive).
 */
export function countBusinessDays(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (end < start) return 0;
  let days = 0;
  const current = new Date(start);
  while (current <= end) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) days++;
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/**
 * 특정 연도의 연차 부여 일수 계산 (회계연도 기준 또는 입사일 기준)
 */
export function calculateGrantedDaysForYear(
  entryDate: Date,
  fiscalYear: number,
  basis: "entry_date" | "fiscal_year" = "entry_date"
): number {
  if (basis === "fiscal_year") {
    // 회계연도 기준: 해당 연도 1월 1일 기준으로 계산
    const referenceDate = new Date(fiscalYear, 0, 1);
    const { totalDays } = calculateLeaveEntitlement(entryDate, referenceDate);
    return totalDays;
  } else {
    // 입사일 기준: 해당 연도의 입사 기념일 기준으로 계산
    const anniversary = new Date(
      fiscalYear,
      entryDate.getMonth(),
      entryDate.getDate()
    );
    const { totalDays } = calculateLeaveEntitlement(entryDate, anniversary);
    return totalDays;
  }
}
