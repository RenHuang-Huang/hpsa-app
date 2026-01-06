export const getPrintTemplate = (repo: any, options: { autoPrint: boolean } = { autoPrint: true }) => `
<!DOCTYPE html>
<html>
<head>
  <title>檢驗報告</title>
  <style>
    @font-face {
      font-family: 'BiauKai';
      src: local('BiauKai'), local('DFKai-SB'), local('KaiTi');
    }
    body { 
      font-family: "BiauKai", "DFKai-SB", "KaiTi", "標楷體", serif; 
      padding: 40px; 
      margin: 0;
      color: #000;
      -webkit-print-color-adjust: exact;
    }
    .page { 
      page-break-after: always; 
      position: relative; 
      min-height: 200mm; /* Use min-height instead of fixed height */
      height: auto;
      box-sizing: border-box;
      padding-bottom: 20px;
    }
    .page:last-child {
      page-break-after: avoid; /* Use avoid to be safer */
      margin-bottom: 0;
    }
    @media print {
      body {
        margin: 0;
        padding: 20px; /* Reduced padding for print */
      }
      .page {
        height: auto;
        page-break-inside: avoid;
      }
    }
    
    /* Header */
    .header { 
      text-align: center; 
      font-size: 36px; 
      font-weight: normal;
      margin-bottom: 25px; 
      color: #2b4c85; 
      letter-spacing: 5px;
    }
    .center{
      text-align: center;
      border-bottom: 1px solid #000;
    }
    /* Info Section */
    .info-name { margin-right: 10px; }
    .info-sex { margin-right: 10px; }
    .info-id { margin-right: 10px; }
    .info-date { margin-right: 10px; }
    
    .blue-text { color: #2b4c85; }
    .red-text { color: red; font-weight: bold; }

    /* Table Section */
    .table-container {
      margin-top: 10px;
    }
    .category-box {
      border: 1px solid #2b4c85;
      display: inline-block;
      padding: 2px 5px;
      font-size: 16px;
      margin-bottom: 2px;
      color: #2b4c85;
    }
    .info-table {
          width: 100%;
          margin-bottom: 8px;
          border-collapse: collapse;
        }
        .info-table td {
          padding: 0 15px 0 0; /* Mimic margin-right for items */
          white-space: nowrap;
          font-size: 16px; 
        }
    table { width: 100%; border-collapse: collapse; }
    .table-container{
      font-size: 14px;
    }
    th { 
      background-color: #f3f2bdff; 
      border: 1px solid #2b4c85; 
      
      padding: 8px; 
      font-weight: normal; 
      color: #e00404ff;
      text-align: center;
    }
    .table-container td { 
      padding: 5px; 
    }
    
    /* Footer */
    .footer { 
      margin-top: 30px; 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-end;
      font-size: 16px;
      position: relative;
    }
    .footer-note { 
      width: 100%;
      display: flex;
      justify-content: space-between;
      color: red;
      font-size: 14px;
    }
    .footer-date { margin-left: auto; margin-right: 150px; }

    /* Stamp */
    .stamp-container {
      position: absolute;
      right: 20%;
      bottom: -75px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .stamp {
       width: 40px; 
       height: 40px; 
       border: 2px solid #e11d48;
       border-radius: 50%; 
       color: #e11d48;
       display: flex; flex-direction: column; align-items: center; justify-content: center;
       font-size: 12px; 
       line-height: 1.2;
    }
        
    .stamp::before {
        content: "";
        position: absolute;
        width: 100%;
        height: 2px;
        background: #e11d48;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
   <div class="page">
      <div class="header">${repo.hospitalName}</div>
      <table class="info-table">
        <tr>
          <td>姓名:<span class="blue-text">${repo.name}</span></td>
          <td>性別:<span class="blue-text">${repo.sex}</span></td>
          <td>出生日期:<span class="blue-text">${repo.birth}</span></td>
          <td>就醫日期:<span class="blue-text">${repo.visit}</span></td>
        </tr>
        <tr>
          <td>檢驗單號:<span class="blue-text">${repo.orderNo}</span></td>
          <td></td>
          <td>病歷號碼:<span class="blue-text">${repo.id}</span></td>
          <td>報告日期:<span class="blue-text">${repo.printDate}</span></td>
        </tr>
      </table>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th width="20%">檢 查 項 目</th>
              <th width="20%">中 文 名 稱</th>
              <th width="20%">檢 查 結 果</th>
              <th width="15%">單 位</th>
              <th width="25%">正 常 參 考 值</th>
            </tr>
          </thead>
          <tbody>
            <tr>
                <td>【糞便檢查】</td>
            </tr>
            <tr>
              <td>StoolH.P.Ag</td>
              <td>幽門桿菌糞便抗原</td>
              <td class="center">${repo.value}</td>
              <td></td>
              <td>((-)陰性))</td>
            </tr>
          </tbody>
        </table>
      </div>
      <hr/>
      <div class="footer">
        <div class="footer-note">
            <span>本報告謹供醫師參考</span>
            <span>經費來源由衛生福利部國民健康署運用菸品健康福利捐/公務預算支應</span>
        </div>
        <div class="stamp-container">
            <div class="stamp">
                <span>醫檢師</span>
                <span>${repo.technologist}</span>
            </div>
        </div>
      </div>
   </div>
   
   ${options.autoPrint ? `
   <script>
      window.onload = () => { window.print(); window.close(); }
   </script>` : ''}
</body>
</html>
`;
