/** @OnlyCurrentDoc */
const ROSTER_ENDPOINT='https://spiritual-medium-site.vercel.app/api/booking-roster';
const ROSTER_HEADERS=['預約日期','開始','結束','姓名','LINE名稱','分鐘','費用(NT$)','預約狀態','LINE通知','預約編號','更新時間'];
function onOpen(){SpreadsheetApp.getUi().createMenu('預約名單').addItem('立即更新','syncBookings').addItem('啟用每5分鐘更新','enableAutoSync').addItem('停用自動更新','disableAutoSync').addToUi();}
function syncBookings(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 const ss=SpreadsheetApp.getActiveSpreadsheet(),info=ss.getSheetByName('同步狀態');
 try{
  const token=PropertiesService.getScriptProperties().getProperty('ROSTER_TOKEN');if(!token)throw new Error('尚未設定名單讀取授權');
  const response=UrlFetchApp.fetch(ROSTER_ENDPOINT,{headers:{Authorization:'Bearer '+token},muteHttpExceptions:true});if(response.getResponseCode()!==200)throw new Error('網站回應HTTP '+response.getResponseCode());
  const data=JSON.parse(response.getContentText());if(!data.ok||!Array.isArray(data.rows)||JSON.stringify(data.headers)!==JSON.stringify(ROSTER_HEADERS)||data.rows.some(r=>!Array.isArray(r)||r.length!==11))throw new Error('網站名單格式不正確');
  const sheet=ss.getSheetByName('預約名單'),oldLast=sheet.getLastRow();const rows=data.rows.map(r=>r.map((v,i)=>{if(i===0)return new Date(v+'T00:00:00+08:00');if(i===1||i===2){const parts=String(v).split(':').map(Number);return parts[0]/24+parts[1]/1440;}if(i===10)return typeof v==='number'?new Date(v):'';if(typeof v==='string'&&/^[=+\-@\t\r\n]/.test(v))return "'"+v;return v;}));
  if(rows.length+1>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),rows.length+1-sheet.getMaxRows());
  sheet.getRange(1,1,1,11).setValues([ROSTER_HEADERS]);if(rows.length)sheet.getRange(2,1,rows.length,11).setValues(rows);
  if(oldLast>rows.length+1)sheet.getRange(rows.length+2,1,oldLast-rows.length-1,11).clearContent();
  const count=Math.max(1,rows.length);sheet.getRange(2,1,count,1).setNumberFormat('yyyy/mm/dd');sheet.getRange(2,2,count,2).setNumberFormat('hh:mm');sheet.getRange(2,6,count,2).setNumberFormat('#,##0');sheet.getRange(2,11,count,1).setNumberFormat('yyyy/mm/dd hh:mm');sheet.setFrozenRows(1);sheet.setFrozenColumns(3);
  if(!sheet.getFilter())sheet.getRange(1,1,sheet.getMaxRows(),11).createFilter();
  info.getRange('B2:B4').setValues([['同步成功'],[new Date()],[rows.length]]);info.getRange('B3').setNumberFormat('yyyy/mm/dd hh:mm:ss');info.getRange('B12').setValue(data.version);SpreadsheetApp.flush();
 }catch(error){info.getRange('B2').setValue('同步失敗：'+String(error.message).slice(0,160));throw new Error('名單同步未完成，請查看同步狀態；原有名單保留。');}finally{lock.releaseLock();}
}
function enableAutoSync(){syncBookings();disableAutoSync();ScriptApp.newTrigger('syncBookings').timeBased().everyMinutes(5).create();const info=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('同步狀態');info.getRange('B2').setValue('已啟用自動同步');info.getRange('B5').setValue('每5分鐘；也可使用預約名單選單立即更新');}
function disableAutoSync(){ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='syncBookings'&&t.getEventType()===ScriptApp.EventType.CLOCK).forEach(t=>ScriptApp.deleteTrigger(t));SpreadsheetApp.getActiveSpreadsheet().getSheetByName('同步狀態').getRange('B5').setValue('自動同步已停用；可手動立即更新');}
