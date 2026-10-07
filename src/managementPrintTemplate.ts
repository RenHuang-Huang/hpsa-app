import reagents from './resources/reagents.json';

interface ManagementRecord {
  name?: string; gender?: string; id_no?: string; birth_date?: string; outpatient_date?: string;
  lab_id?: string; result?: string | number; lab_date?: string; report_date?: string;
  reagent_code?: string; other_reagent_zh?: string; other_reagent_en?: string;
  other_license_no?: string; other_expire_date?: string;
  second_result?: string | number; second_lab_date?: string; second_report_date?: string;
  second_reagent_code?: string; second_other_reagent_zh?: string; second_other_reagent_en?: string;
  second_other_license_no?: string; second_other_expire_date?: string;
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

const date = (value?: string, blue = true) => {
  const clean = String(value ?? '').replace(/\D/g, '');
  const normalized = clean.length === 6 ? `0${clean}` : clean;
  const parts = /^\d{7}$/.test(normalized)
    ? [normalized.slice(0, 3), normalized.slice(3, 5), normalized.slice(5)] : ['', '', ''];
  const color = blue ? ' mg-value' : '';
  return `民國 <span class="mg-date-year${color}">${parts[0]}</span>年 <span class="mg-date-part${color}">${parts[1]}</span>月 <span class="mg-date-part${color}">${parts[2]}</span>日`;
};

const result = (value: unknown, secondary = false) =>
  (secondary ? ['陰性', '陽性'] : ['陰性', '陽性', '檢測失效'])
    .map((label, index) => `<span class="mg-checkbox">□${value !== undefined && value !== null && String(value).trim() === String(index) ? '<span class="mg-check mg-value">✓</span>' : ''}</span>${['⓪', '①', '②'][index]}${label}`).join('，');

/** Generate one combined first/second inspection form; unknown lot expiry stays blank. */
export const getManagementPrintBody = (record: ManagementRecord, hospitalName: string, labName: string) => {
  const reagent = (secondary: boolean) => {
    const code = secondary ? record.second_reagent_code : record.reagent_code;
    const known = reagents.find(item => item.Code === code);
    const custom = code === '999';
    const zh = secondary ? record.second_other_reagent_zh : record.other_reagent_zh;
    const en = secondary ? record.second_other_reagent_en : record.other_reagent_en;
    const license = secondary ? record.second_other_license_no : record.other_license_no;
    const expiry = secondary ? record.second_other_expire_date : record.other_expire_date;
    // The resource stores both languages together; split at the first Latin letter.
    const englishStart = known?.Name.search(/[A-Za-z]/) ?? -1;
    const chineseName = custom ? zh : englishStart >= 0 ? known?.Name.slice(0, englishStart).trim() : known?.Name;
    const englishName = custom ? en : englishStart >= 0 ? known?.Name.slice(englishStart).trim() : '';
    return `<div class="mg-product">（中）<span class="mg-product-line">${escapeHtml(chineseName)}</span></div>
      <div class="mg-product">（英）<span class="mg-product-line">${escapeHtml(englishName)}</span></div>
      <div class="mg-product">許可證字號：<span class="mg-line">${escapeHtml(custom ? license : known?.License)}</span>；有效日期：${date(expiry, false)}</div>`;
  };
  return `<section class="mg-sheet">
    <div class="mg-funding">本項經費由衛生福利部國民健康署運用菸品健康福利捐／公務預算補助</div>
    <div class="mg-edition">115 年 1 月</div>
    <h1>健 康 署「糞便抗原檢測胃幽門螺旋桿菌服務」管理紀錄表—檢驗結果</h1>
    <div class="mg-details">姓名：<span class="mg-line mg-name mg-value">${escapeHtml(record.name)}</span>性別：<span class="mg-line mg-sex mg-value">${record.gender === 'M' ? '男' : record.gender === 'F' ? '女' : ''}</span>採檢單位：<span class="mg-line mg-hospital mg-value">${escapeHtml(hospitalName)}</span></div>
    <div class="mg-demographics">身分證字號：<span class="mg-line mg-id mg-value">${escapeHtml(record.id_no)}</span>　生日：${date(record.birth_date)}　門診日期：${date(record.outpatient_date)}</div>
    <div class="mg-label"><span>糞便抗原檢驗資料</span>（由糞便抗原檢驗單位／機構填寫）</div>
    <div>1. 檢驗單位機構代碼：<span class="mg-line">${escapeHtml(record.lab_id)}</span>，檢驗單位機構名稱：<span class="mg-line">${escapeHtml(labName)}</span></div>
    <div>2. 檢驗日期：${date(record.lab_date)}</div>
    <div>3. 檢驗結果：${result(record.result)}</div>
    <div>4. 試劑商品名稱：</div>${reagent(false)}
    <div>5. 報告日期：${date(record.report_date)}</div>
    <div class="mg-second">若首次檢驗結果為 ②檢測失效，再次檢測後請填寫以下內容</div>
    <div>6. 二次檢驗日期：${date(record.second_lab_date)}</div>
    <div>7. 二次檢驗結果：${result(record.second_result, true)}</div>
    <div>8. 二次試劑商品名稱：</div>${reagent(true)}
    <div>9. 二次報告日期：${date(record.second_report_date)}</div>
    <aside><span>第一聯：檢驗機構回報採檢機構聯</span><span>第二聯：檢驗醫事機構留存聯</span></aside>
    <footer>※本表由採檢單位委託之醫事檢驗單位／機構辦理本項檢驗資料上傳至癌症篩檢與追蹤管理資訊整合系統。</footer>
  </section>`;
};

export const managementPrintStyles = `
  @page { size: A4 portrait; margin: 0; }
  .mg-sheet { box-sizing: border-box; width: 210mm; height: 148.5mm; padding: 5mm 13mm 12mm 8mm;
    position: relative; color: #000; font: 12pt/1.28 "DFKai-SB", "標楷體", serif;
    break-before: page; break-after: page; break-inside: avoid; }
  .mg-sheet h1 { font-size: 14pt; text-align: center; margin: 2mm 0 4mm; letter-spacing: 0; }
  .mg-funding { text-align: right; font-size: 10pt; margin-right: -9mm; }
  .mg-edition { text-align: right; font-size: 10pt; margin-right: -9mm; }
  .mg-line { display: inline-block; min-width: 12mm; min-height: 1em; border-bottom: 1px solid black; padding: 0 1mm; overflow-wrap: anywhere; vertical-align: baseline; }
  .mg-name { width: 32mm; } .mg-sex { width: 16mm; } .mg-hospital { width: 42mm; } .mg-id { width: 38mm; }
  .mg-demographics { font-size: inherit; }
  .mg-demographics .mg-id { width: 22mm; }
  .mg-demographics .mg-date-year { width: 7mm; }
  .mg-demographics .mg-date-part { width: 5mm; }
  .mg-date-year, .mg-date-part { display: inline-block; text-align: center; border-bottom: 1px solid black; min-height: 1em; width: 8mm; }
  .mg-date-part { width: 6mm; }
  .mg-sheet .mg-value { color: #2b4c85; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .mg-checkbox { display: inline-block; position: relative; }
  .mg-check { position: absolute; left: 0; top: -0.12em; font-weight: bold; }
  .mg-label { margin-top: 1mm; }
  .mg-label > span { border: 1px solid black; padding: 0 1mm; }
  .mg-product { padding-left: 5mm; font-size: inherit; overflow-wrap: anywhere; line-height: 1.25; }
  .mg-product-line { border-bottom: 1px solid black; min-width: 120mm; display: inline-block; min-height: 1em; max-width: 161mm; }
  .mg-second { margin-top: 3mm; }
  .mg-sheet aside { position: absolute; right: 4mm; top: 25mm; display: flex; gap: 2mm; font-size: 10.5pt; }
  .mg-sheet aside > span { writing-mode: vertical-rl; white-space: nowrap; }
  .mg-sheet footer { position: absolute; bottom: 8mm; left: 8mm; right: 4mm; text-align: right; font-size: 8pt; line-height: 1.2; }
  @media print { body { padding: 0; } .page { padding: 20px; } }
`;
