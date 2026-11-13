/**
 * KYLA 홈페이지 접수함 (Google Apps Script)
 *
 * 홈페이지의 신청서, 문의, 참가 의향 회신을 이 스프레드시트의 첫 번째 시트에 한 줄씩 쌓고,
 * 시트 주인에게 메일로 알려 줍니다.
 *
 * 설치
 *   1. 협회가 계속 쓸 구글 계정으로 스프레드시트를 새로 만듭니다.
 *   2. 확장 프로그램 → Apps Script 를 열어 이 코드를 붙여 넣고 저장합니다.
 *   3. 배포 → 새 배포 → 유형: 웹 앱 → 실행: 나, 액세스 권한: 모든 사용자 → 배포.
 *   4. 나온 웹 앱 URL 을 assets/js/data.js 의 formEndpoint 에 넣습니다.
 *
 * 홈페이지가 보내는 내용(JSON): kind(양식 종류), lang(화면 언어), text(정리된 본문),
 * fields, roster, divisions, submittedAt
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var text = String(data.text || '').slice(0, 20000);
    if (!text) return ContentService.createTextOutput('error: empty');
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    sheet.appendRow([new Date(), plain(data.kind), plain(data.lang), plain(text)]);
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
      '[KYLA 홈페이지] ' + text.split('\n')[0].slice(0, 80), text);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err);
  }
}

// 시트가 수식으로 읽지 않도록, = + - @ 로 시작하는 값 앞에 작은따옴표를 붙입니다.
function plain(value) {
  var s = String(value == null ? '' : value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
