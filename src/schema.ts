import { z } from 'zod';
import { countBig5Bytes, isValidROCDate, isFutureROCDate, isValidTaiwanID } from './lib/validators';

// Helper to create a string schema with byte limit
const byteLimitedString = (maxLength: number, fieldName: string) => {
    return z.string().superRefine((val, ctx) => {
        const len = countBig5Bytes(val || '');
        if (len > maxLength) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${fieldName} 超過長度限制 (目前 ${len} bytes / 上限 ${maxLength} bytes)`,
            });
        }
    });
};

// Helper for ROC Date validation
const rocDateSchema = (fieldName: string) => {
    return z.string().superRefine((val, ctx) => {
        if (!val) return; // Allow empty, handle required status elsewhere if needed
        if (!isValidROCDate(val)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${fieldName} 格式錯誤 (需為 7 碼有效民國日期，如 1140101)`,
            });
            return;
        }
        if (isFutureROCDate(val)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${fieldName} 不能為未來時間`,
            });
        }
    });
};

export const formSchema = z.object({
    // --- Basic Info ---
    // --- Basic Info ---
    id_no: z.string()
        .min(10, "身分證/居留證號需為 10 碼")
        .max(10, "身分證/居留證號需為 10 碼")
        .refine((val) => isValidTaiwanID(val), "身分證/居留證號格式錯誤 (請檢查首字英文或檢查碼)"),

    name: z.string().optional(),
    gender: z.string().optional(),
    birth_date: rocDateSchema("生日").optional(), // Allow past dates too? Validator checks validity only.

    hospital_id: z.string().length(10, "院所代碼需為 10 碼"),

    outpatient_date: rocDateSchema("門診日期").and(z.string().length(7)), // Strict 7 length too

    // --- Lab Info ---
    lab_id: z.string().length(10, "檢驗機構代碼需為 10 碼"),
    lab_date: rocDateSchema("檢驗日期").and(z.string().length(7)),

    // --- Result 1 ---
    result: z.enum(['0', '1', '2'], { message: "請選擇檢驗結果" }),
    reagent_code: z.string().length(3, "試劑代碼需為 3 碼"),
    order_number: z.string().length(5, "檢驗單號需為 5 碼"),
    fee: z.string().regex(/^\d*$/, "金額需為數字").optional(),

    // --- Other Reagent 1 (Conditional '999') ---
    other_reagent_zh: byteLimitedString(100, "其他中文品名").optional(),
    other_reagent_en: byteLimitedString(100, "其他英文品名").optional(),
    other_license_no: byteLimitedString(30, "其他許可證號").optional(),
    other_expire_date: z.string().optional().superRefine((val, ctx) => {
        if (val && !isValidROCDate(val)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "其他有效期限 格式錯誤" });
        }
    }),

    report_date: rocDateSchema("報告日期").and(z.string().length(7)),

    // --- Secondary Result (Conditional 'Result=2') ---
    second_outpatient_date: z.string().optional().superRefine((val, ctx) => {
        if (val && !isValidROCDate(val)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "二次門診日期 格式錯誤" });
    }),
    second_lab_date: z.string().optional().superRefine((val, ctx) => {
        if (val && !isValidROCDate(val)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "二次檢驗日期 格式錯誤" });
    }),

    second_result: z.enum(['0', '1']).optional().or(z.literal('')), // '2' not allowed for second result? Image says "0, 1" for second? User spec: "15. second_result: 1 byte (Enum: '0', '1')"
    second_fee: z.string().regex(/^\d*$/, "金額需為數字").optional(),
    second_reagent_code: z.string().max(3, "二次試劑編號最多 3 碼").optional(),

    // --- Other Reagent 2 (Conditional '999') ---
    second_other_reagent_zh: byteLimitedString(100, "二次其他中文品名").optional(),
    second_other_reagent_en: byteLimitedString(100, "二次其他英文品名").optional(),
    second_other_license_no: byteLimitedString(30, "二次其他許可證號").optional(),
    second_other_expire_date: z.string().optional().superRefine((val, ctx) => {
        if (val && !isValidROCDate(val)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "二次其他有效期限 格式錯誤" });
        }
    }),
    second_report_date: z.string().optional().superRefine((val, ctx) => {
        if (val && !isValidROCDate(val)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "二次報告日期 格式錯誤" });
    }),
})
    .superRefine((data, ctx) => {


        // 2. Conditional Requirement (Reagent = '999') - Primary
        if (data.reagent_code === '999') {
            const req = [
                { key: 'other_reagent_zh', name: '其他中文品名' },
                { key: 'other_reagent_en', name: '其他英文品名' },
                { key: 'other_license_no', name: '其他許可證號' },
                { key: 'other_expire_date', name: '其他有效期限' },
            ] as const;

            req.forEach(({ key, name }) => {
                if (!data[key]) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [key],
                        message: `${name} 為必填 (因為試劑編號為 999)`,
                    });
                }
            });
        }

        // 3. Conditional Requirement (Second Reagent = '999')
        // Only check if second_reagent_code is present or if result is 2?
        // User spec: "Conditional Requirement (Reagent = '999')... Same logic applies to second_reagent_code"
        // If user enters 999 in second_reagent_code, even if optional, they must fill others.
        if (data.second_reagent_code === '999') {
            const req = [
                { key: 'second_other_reagent_zh', name: '二次其他中文品名' },
                { key: 'second_other_reagent_en', name: '二次其他英文品名' },
                { key: 'second_other_license_no', name: '二次其他許可證號' },
                { key: 'second_other_expire_date', name: '二次其他有效期限' },
            ] as const;

            req.forEach(({ key, name }) => {
                if (!data[key as keyof typeof data]) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [key],
                        message: `${name} 為必填 (因為二次試劑編號為 999)`,
                    });
                }
            });
        }

        // 4. Conditional Requirement (Second Outpatient Date -> Second Result)
        if (data.second_outpatient_date && !data.second_result) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['second_result'],
                message: "若填寫二次門診日期，則二次檢驗結果為必填",
            });
        }
    });
