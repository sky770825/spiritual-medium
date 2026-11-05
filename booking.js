(() => {
  const $ = id => document.getElementById(id);
  const taipeiToday = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  ['date1','date2','date3'].forEach(id => { $(id).min = taipeiToday; });
  $('signed-date').value = taipeiToday;
  $('signed-date').max = taipeiToday;
  $('booking-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('name').value.trim();
    const signature = $('signature').value.trim();
    $('name').setCustomValidity(name ? '' : '請填寫姓名');
    $('signature').setCustomValidity(signature ? '' : '請填寫正楷姓名');
    if (!$('booking-form').reportValidity()) return;
    const dates = [...new Set(['date1','date2','date3'].map(id => $(id).value).filter(Boolean))];
    $('summary').value = [
      '【預約申請・待老師確認】',
      '宇宙玉皇大帝原始大天尊無上至尊',
      `預約姓名：${name}`,
      `服務：${document.querySelector('input[name="service"]:checked').value}`,
      `方便日期：${$('availability').value}`,
      `希望日期：${dates.join('、')}`,
      `方便時段：${$('period').value}（台北時間）`,
      $('question').value.trim() ? `主要問題：${$('question').value.trim()}` : '',
      '已閱讀並了解服務內容、費用及預約方式。',
      '首次最多30分鐘；先解惑、後付費；時間由老師親自確認。',
      `簽名：${signature}`,
      `填寫日期：${$('signed-date').value}`
    ].filter(Boolean).join('\n');
    $('copy-status').textContent = '';
    $('result').hidden = false;
    $('result').scrollIntoView({behavior:'smooth',block:'start'});
    $('summary').focus({preventScroll:true});
  });
  ['name','signature'].forEach(id => $(id).addEventListener('input', () => $(id).setCustomValidity('')));
  $('booking-form').addEventListener('input', () => { $('result').hidden = true; });
  $('booking-form').addEventListener('change', () => { $('result').hidden = true; });
  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('summary').value);
      $('copy-status').textContent = '已複製。請開啟 LINE，貼上並送出。';
    } catch {
      $('summary').focus(); $('summary').select();
      $('copy-status').textContent = '無法自動複製，已選取摘要，請長按或使用複製快捷鍵。';
    }
  });
})();
