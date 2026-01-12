export interface BillingItem {
  date: string;
  birth_date: string;
  name: string;
  item: string;
  fee: number;
}

export const getBillingTemplate = (
  labName: string,
  hospitalName: string,
  startDate: string,
  endDate: string,
  items: BillingItem[],
  deduction: number
) => {
  const totalFee = items.reduce((sum, item) => sum + item.fee, 0);
  const grandTotal = totalFee - deduction;
  const printDate = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });

  // rows per page usually depends on font size/layout. 
  // Let's rely on standard table flow and use print css for basic page breaks if needed.
  // Or just a single continuous table which browser paginates.

  const rowsHtml = items.map((item, index) => `
    <tr>
      <td style="text-align: center;">${item.date}</td>
      <td style="text-align: center;">${item.birth_date}</td>
      <td style="text-align: center;">${item.name}</td>
      <td style="text-align: center;">${item.item}</td>
      <td style="text-align: right;">${item.fee}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>對帳單 - ${hospitalName}</title>
  <style>
    body { font-family: "Microsoft JhengHei", sans-serif; padding: 20px; }
    h2 { text-align: center; margin-bottom: 5px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #000; padding: 8px 4px; font-size: 14px; }
    th { background-color: #f0f0f0; }
    .footer { text-align: right; font-size: 16px; margin-top: 20px; }
    .footer div { margin-bottom: 5px; }
    
    @media print {
      body { padding: 0; }
      /* Remove @page margin to allow browser headers/footers (page numbers) */
      @page { margin: auto; size: auto; }
      .no-print { display: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <h2>${labName}對帳單</h2>
  
  <div class="meta">
    <div>送檢單位：${hospitalName}</div>
    <div>對帳日期：${printDate}</div>
  </div>
  <div class="meta">
    <div>期間：${startDate} ~ ${endDate}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 15%">檢驗日期</th>
        <th style="width: 15%">生日</th>
        <th style="width: 20%">姓名</th>
        <th style="width: 35%">檢驗項目</th>
        <th style="width: 15%">金額</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>總檢驗次數：${items.length}</div>
    <div>合計金額：${totalFee}</div>
    <div>預扣試管：${deduction}</div>
    <div style="font-weight: bold; border-top: 1px solid #000; display: inline-block; padding-top: 5px;">
      總額：${grandTotal}
    </div>
  </div>

  <div class="no-print" style="text-align: center; margin-top: 30px;">
    <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer;">列印 / 另存 PDF</button>
  </div>
</body>
</html>
  `;
};
