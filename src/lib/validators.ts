
/**
 * Checks if a string is a valid ROC date (Format: YYYMMDD, 7 digits).
 * e.g., '1140101' -> 2025/01/01
 */
export const isValidROCDate = (dateStr: string): boolean => {
    if (!/^\d{7}$/.test(dateStr)) return false;

    const year = parseInt(dateStr.substring(0, 3), 10);
    const month = parseInt(dateStr.substring(3, 5), 10);
    const day = parseInt(dateStr.substring(5, 7), 10);

    // Basic range checks
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Gregorian conversion for accurate day checking (Leap years etc)
    const gregorianYear = year + 1911;
    const date = new Date(gregorianYear, month - 1, day);

    return (
        date.getFullYear() === gregorianYear &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
};

export const isFutureROCDate = (dateStr: string): boolean => {
    if (!isValidROCDate(dateStr)) return false; // Invalid date is not "future" in this context (handled by other check)

    const year = parseInt(dateStr.substring(0, 3), 10);
    const month = parseInt(dateStr.substring(3, 5), 10);
    const day = parseInt(dateStr.substring(5, 7), 10);

    const gregorianYear = year + 1911;
    const date = new Date(gregorianYear, month - 1, day);

    // Compare with today (set time to 0 for strict date comparison)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return date > today;
};

/**
 * Counts bytes assuming Big5/Common CJK encoding rules:
 * - ASCII characters (0x00-0x7F) = 1 byte
 * - Non-ASCII characters = 2 bytes
 */
// eslint-disable-next-line
export const countBig5Bytes = (str: string): number => {
    return str.replace(/[^\x00-\xff]/g, "xx").length;
};

/**
 * Validates Taiwan ID (Local) and Resident Certificate (New & Old).
 * Format:
 * - Local / New Resident: [A-Z][0-9]{9}
 * - Old Resident: [A-Z][A-Z][0-9]{8}
 *
 * Checksum:
 * A=10, B=11, ... Z=33
 * Weights: 1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1 (including the converted first char)
 */
export const isValidTaiwanID = (id: string): boolean => {
    if (!id) return false;
    id = id.toUpperCase();

    // Basic regex check
    const isLocalOrNew = /^[A-Z][0-9]{9}$/.test(id);
    const isOldResident = /^[A-Z][A-Z][0-9]{8}$/.test(id);

    if (!isLocalOrNew && !isOldResident) {
        return false;
    }

    // 2nd Character Strict Check
    if (isLocalOrNew) {
        const secondChar = id[1];
        // 1=Male, 2=Female (National ID)
        // 8=Male, 9=Female (New Resident Cert)
        if (!['1', '2', '8', '9'].includes(secondChar)) {
            return false;
        }
    }
    // Old Resident (2nd char is A-Z) is covered by regex

    const cityCodes: { [key: string]: number } = {
        A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, J: 18, K: 19, L: 20, M: 21, N: 22,
        P: 23, Q: 24, R: 25, S: 26, T: 27, U: 28, V: 29, X: 30, Y: 31, W: 32, Z: 33, I: 34, O: 35
    };

    // Prepare digits for checksum
    // First letter
    const firstChar = id[0];
    const firstCode = cityCodes[firstChar];
    if (!firstCode) return false;

    // Convert first char to X1, X2
    const x1 = Math.floor(firstCode / 10);
    const x2 = firstCode % 10;

    let sum = x1 * 1 + x2 * 9;

    // Process remaining characters
    // Weights for D1..D9 (or L2, D2..D9)
    // Position: 1 (L1) has been handled (X1, X2)
    // Remaining string indices 1..9 correspond to standard weights [8, 7, 6, 5, 4, 3, 2, 1, 1(check)]
    // Wait, the standard formula includes the check digit as weight 1 at the end.
    // Let's use standard weights array for the "body" part
    const weights = [8, 7, 6, 5, 4, 3, 2, 1];

    for (let i = 1; i < 9; i++) {
        const char = id[i];
        let num: number;

        if (isNaN(parseInt(char, 10))) {
            // It's a letter (Old Resident 2nd char)
            const code = cityCodes[char];
            if (!code) return false;
            // Use units digit
            num = code % 10;
        } else {
            num = parseInt(char, 10);
        }

        sum += num * weights[i - 1];
    }

    // Check digit (last char)
    const checkDigit = parseInt(id[9], 10);
    sum += checkDigit * 1;

    return sum % 10 === 0;
};
