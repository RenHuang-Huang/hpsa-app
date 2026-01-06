import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert JS Date object to ROC Date String (e.g. 1120101)
 */
export function toRocDate(date: Date): string {
  const year = date.getFullYear() - 1911;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Convert ROC Date String (1120101) to ISO Date String (2023-01-01) for input[type="date"]
 */
export function rocToIsoDate(rocDate: string): string {
  if (!rocDate || rocDate.length !== 7) return "";
  const year = parseInt(rocDate.substring(0, 3)) + 1911;
  const month = rocDate.substring(3, 5);
  const day = rocDate.substring(5, 7);
  return `${year}-${month}-${day}`;
}

/**
 * Validates a ROC Date string (e.g., "1120101")
 * 1. Must be 7 digits.
 * 2. Must be a valid calendar date.
 * 3. Must not be in the future.
 */
export function isValidRocDate(rocDate: string): { valid: boolean; message?: string } {
  if (!rocDate) return { valid: false, message: "日期不能為空" };
  if (!/^\d{7}$/.test(rocDate)) return { valid: false, message: "格式錯誤 (需為7碼數字)" };

  const rocYear = parseInt(rocDate.substring(0, 3), 10);
  const month = parseInt(rocDate.substring(3, 5), 10);
  const day = parseInt(rocDate.substring(5, 7), 10);

  const year = rocYear + 1911;

  // Basic range check
  if (month < 1 || month > 12) return { valid: false, message: "月份錯誤 (01-12)" };
  if (day < 1 || day > 31) return { valid: false, message: "日期錯誤 (01-31)" };

  // Strict calendar check
  const dateObj = new Date(year, month - 1, day);
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    return { valid: false, message: "無效的日期 (如: 2/30)" };
  }

  // Future check
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of today

  if (dateObj > today) {
    return { valid: false, message: "日期不可超過今日" };
  }

  return { valid: true };
}
