/**
 * Fiscal Year utilities for Nepal Bikram Sambat (BS) calendar.
 * Nepal's standard fiscal year: Shrawan (Month 4) to Ashadh (Month 3) of next BS year.
 *
 * All dates stored as YYYY-MM-DD BS strings (e.g. "2083-04-15").
 */

export const NEPALI_MONTHS = [
  'Baisakh',   // 1
  'Jestha',    // 2
  'Ashadh',    // 3
  'Shrawan',   // 4
  'Bhadra',    // 5
  'Ashwin',    // 6
  'Kartik',    // 7
  'Mangsir',   // 8
  'Poush',     // 9
  'Magh',      // 10
  'Falgun',    // 11
  'Chaitra',   // 12
];

/** Returns 1-based month index for a Nepali month name. */
export const getMonthIndex = (monthName) => {
  const idx = NEPALI_MONTHS.indexOf(monthName);
  return idx === -1 ? 4 : idx + 1; // default to Shrawan (4)
};

/** Returns the BS year label like "2083-84" from a start BS year. */
export const getFiscalYearLabel = (startBSYear) => {
  const endShort = String(startBSYear + 1).slice(-2);
  return `${startBSYear}-${endShort}`;
};

/**
 * Given today's BS year/month, return the start BS year of the current fiscal year.
 */
export const getCurrentFYStartYear = (todayBSYear, todayBSMonth, startMonthIndex) => {
  return todayBSMonth >= startMonthIndex ? todayBSYear : todayBSYear - 1;
};

/**
 * Returns a list of fiscal year label strings.
 * Shows 4 years before and 3 years after the given start year.
 */
export const getAvailableFiscalYears = (startBSYear) => {
  const years = [];
  for (let y = startBSYear - 4; y <= startBSYear + 3; y++) {
    years.push(getFiscalYearLabel(y));
  }
  return years;
};

/**
 * Given a FY label like "2083-84" and the start month index (e.g. 4 for Shrawan),
 * returns the BS date strings for the first and last days of that fiscal year.
 * Uses "32" as a safe upper bound for end month last day (no BS month reaches 33).
 */
export const getFiscalYearDateRange = (fyLabel, startMonthIndex) => {
  const startYear = parseInt(fyLabel.split('-')[0], 10);
  const endYear = startYear + 1;
  const endMonthIndex = startMonthIndex === 1 ? 12 : startMonthIndex - 1;

  const pad = (n) => String(n).padStart(2, '0');
  const from = `${startYear}-${pad(startMonthIndex)}-01`;
  const to   = `${endYear}-${pad(endMonthIndex)}-32`;

  return { from, to };
};

/**
 * Given today's BS date string (YYYY-MM-DD) and the start month name,
 * auto-detects and returns the current FY label.
 */
export const detectCurrentFiscalYear = (todayBSDateStr, startMonthName = 'Shrawan') => {
  if (!todayBSDateStr) return null;
  const [year, month] = todayBSDateStr.split('-').map(Number);
  const startMonthIndex = getMonthIndex(startMonthName);
  const fyStartYear = getCurrentFYStartYear(year, month, startMonthIndex);
  return getFiscalYearLabel(fyStartYear);
};

/**
 * Returns today's BS date as a YYYY-MM-DD string using the Nepali Date Picker global utility.
 */
export const getTodayBSDateString = () => {
  try {
    if (window.NepaliDatePicker && window.NepaliDatePicker.utils && window.NepaliDatePicker.utils.getToday) {
      const today = window.NepaliDatePicker.utils.getToday();
      const pad = (n) => String(n).padStart(2, '0');
      return `${today.year}-${pad(today.month)}-${pad(today.day)}`;
    }
  } catch (_) {}
  // Fallback: approximate current BS year
  const adYear = new Date().getFullYear();
  const bsYear = adYear + 56;
  return `${bsYear}-04-01`;
};
