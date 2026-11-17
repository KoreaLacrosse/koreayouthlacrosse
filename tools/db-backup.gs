/**
 * KYLA DB 매일 백업 (Google Apps Script)
 *
 * 협회 Firebase(Firestore, 프로젝트 kyla-homepage)의 모든 컬렉션을 하루에 한 번 읽어 와서
 *   1) 이 스프레드시트에 컬렉션마다 탭 하나로 펼쳐 놓고 (사람이 보는 용도. 실행할 때마다 새로 씁니다)
 *   2) 구글 드라이브의 'KYLA DB 백업' 폴더에 날짜가 붙은 JSON 파일로 남깁니다 (되살리는 용도. 최근 60개만 둡니다)
 * 읽기만 합니다. DB 의 내용은 고치지 않습니다. 실패하면 이 시트 주인에게 메일로 알립니다.
 *
 * 설치 (처음 한 번)
 *   1. 협회가 계속 쓸 구글 계정으로 스프레드시트를 새로 만듭니다. 회원 연락처가 들어가니 다른 사람과 공유하지 않습니다.
 *   2. Google Cloud 콘솔(console.cloud.google.com)에서 프로젝트 kyla-homepage 를 고르고,
 *      IAM 및 관리자 > 서비스 계정 > 서비스 계정 만들기. 역할은 'Cloud Datastore 뷰어'(읽기 전용) 하나만 줍니다.
 *   3. 만든 서비스 계정 > 키 > 키 추가 > 새 키 만들기 > JSON. 내려받은 파일이 열쇠입니다.
 *   4. 스프레드시트의 확장 프로그램 > Apps Script 에 이 코드를 붙여 넣고 저장합니다.
 *   5. Apps Script 왼쪽의 톱니바퀴(프로젝트 설정) > 맨 아래 '스크립트 속성' > [스크립트 속성 추가]를 누르고,
 *      속성 칸에 SERVICE_ACCOUNT_JSON, 값 칸에 키 파일의 내용 전체를 넣은 뒤 [스크립트 속성 저장]을 누릅니다.
 *      저장 단추까지 눌러야 남습니다. 그 뒤 내려받은 키 파일은 지웁니다. 이 열쇠는 저장소에도, 다른 사람에게도 주지 않습니다.
 *   6. check 함수를 실행합니다(처음에는 권한을 물어봅니다). 열쇠 → 구글 인증 → DB 읽기를 차례로 확인해 실행 로그에 적습니다.
 *      아무것도 쓰지 않고 메일도 보내지 않으니 몇 번을 돌려도 됩니다. 막힌 곳이 있으면 까닭을 알려 줍니다.
 *   7. backup 함수를 한 번 실행해 탭이 채워지는지 봅니다.
 *   8. install 함수를 한 번 실행하면 매일 새벽 3시쯤 자동으로 돕니다. 끄려면 uninstall 을 실행합니다.
 *
 * 열쇠를 잃어버렸거나 새어 나갔다고 생각되면 Google Cloud 콘솔의 서비스 계정 > 키에서 그 키를 지우고 새로 만듭니다.
 */

var PROJECT_ID = 'kyla-homepage';
var KEY_NAME = 'SERVICE_ACCOUNT_JSON';  // 열쇠를 넣어 두는 스크립트 속성의 이름
var FOLDER_NAME = 'KYLA DB 백업';       // 구글 드라이브에 만들 폴더 이름
var KEEP_FILES = 60;                    // 남겨 둘 JSON 파일 수(하루 한 개씩이면 두 달)
var LOG_SHEET = '백업 기록';
var ROOT = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';
var keyProject_ = '';                   // 열쇠가 만들어진 구글 프로젝트(권한 오류를 안내할 때 씁니다)

/** 설치 점검. 열쇠 → 구글 인증 → DB 읽기를 차례로 확인해 실행 로그에 적습니다. 아무것도 쓰지 않고 메일도 보내지 않습니다. */
function check() {
  var found = findKey_();
  Logger.log('1/3 열쇠를 찾았습니다: ' + found.sa.client_email + (found.note ? ' (' + found.note + ')' : ''));
  if (found.sa.project_id && found.sa.project_id !== PROJECT_ID) {
    Logger.log('    주의: 이 열쇠는 "' + found.sa.project_id + '" 프로젝트에서 만든 것입니다. DB 가 있는 프로젝트는 "' + PROJECT_ID + '" 입니다.');
  }
  var token = accessToken_();
  Logger.log('2/3 구글이 열쇠를 받아 주었습니다.');
  var names = listCollections_(token);
  Logger.log('3/3 DB 를 읽었습니다. 컬렉션: ' + (names.length ? names.join(', ') : '(아직 없음)'));
  Logger.log('모두 정상입니다. 이제 backup 을 실행해 보세요.');
  return names.join(', ');
}

/** 백업 한 번. 매일 도는 예약도 이 함수를 부릅니다. */
function backup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var token = accessToken_();
    var names = listCollections_(token);
    var all = {}, counts = [];
    names.forEach(function (name) {
      var docs = listDocuments_(token, name);
      all[name] = docs;
      writeTab_(ss, name, toRows_(docs));
      counts.push(name + ' ' + docs.length + '건');
    });
    var file = saveFile_(all);
    log_(ss, '성공', counts.join(', ') + ' / ' + file);
    return counts.join(', ');
  } catch (err) {
    var text = String(err && err.message ? err.message : err);
    log_(ss, '실패', text);
    try {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), '[KYLA] DB 백업이 실패했습니다',
        '오늘 DB 백업을 하지 못했습니다.\n\n까닭: ' + text + '\n\n스프레드시트의 "' + LOG_SHEET + '" 탭에서 기록을 볼 수 있습니다.\n' + ss.getUrl());
    } catch (mailError) { /* 메일을 못 보내도 기록은 남았습니다 */ }
    throw err;
  }
}

/** 매일 새벽 3시쯤(한국 시간) backup 을 돌리는 예약을 겁니다. 여러 번 실행해도 예약은 하나만 남습니다. */
function install() {
  uninstall();
  ScriptApp.newTrigger('backup').timeBased().everyDays(1).atHour(3).inTimezone('Asia/Seoul').create();
  log_(SpreadsheetApp.getActiveSpreadsheet(), '예약', '매일 새벽 3시쯤 자동으로 백업합니다.');
}

/** 예약을 지웁니다. */
function uninstall() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backup') ScriptApp.deleteTrigger(t);
  });
}

/* ---------- Firestore 읽기 ---------- */

// 스크립트 속성에서 서비스 계정 열쇠를 찾습니다.
// 이름이 정확히 SERVICE_ACCOUNT_JSON 이 아니어도(빈칸·쉼표·따옴표·소문자가 섞였거나, 속성 칸과 값 칸을 바꿔 넣은 경우)
// 내용이 열쇠이면 그대로 씁니다. 찾지 못하면 무엇이 저장돼 있는지 알려 줍니다. 값(열쇠)은 어디에도 적지 않습니다.
function findKey_() {
  var all = PropertiesService.getScriptProperties().getProperties() || {};
  var names = Object.keys(all).filter(function (n) { return n !== 'BACKUP_FOLDER_ID'; });
  var alike = names.filter(function (n) { return squash_(n) === squash_(KEY_NAME); });
  var order = [KEY_NAME].concat(alike).concat(names);       // 정확한 이름 → 비슷한 이름 → 나머지
  for (var i = 0; i < order.length; i++) {
    var sa = keyFrom_(all[order[i]]);
    if (sa) return { sa: sa, note: order[i] === KEY_NAME ? '' : '속성 이름이 ' + label_(order[i]) + ' 로 저장돼 있지만 내용이 열쇠라서 그대로 씁니다' };
  }
  for (var j = 0; j < names.length; j++) {
    var swapped = keyFrom_(names[j]);
    if (swapped) return { sa: swapped, note: '열쇠가 값 칸이 아니라 속성(이름) 칸에 들어 있지만 그대로 씁니다' };
  }
  throw new Error(why_(all, names));
}

function squash_(name) { return String(name).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

// 글이 서비스 계정 열쇠(JSON)이면 풀어서 돌려주고, 아니면 null
function keyFrom_(text) {
  var s = String(text === null || text === undefined ? '' : text).replace(/^\uFEFF/, '').trim();
  if (s.charAt(0) !== '{' && s.charAt(0) !== '"') return null;
  var v = parse_(s);
  if (typeof v === 'string') v = parse_(v.trim());          // 따옴표로 한 번 더 싸여 들어간 경우
  if (!v || typeof v !== 'object' || typeof v.client_email !== 'string' || typeof v.private_key !== 'string') return null;
  if (!v.client_email.trim() || v.private_key.indexOf('PRIVATE KEY') < 0) return null;
  return {
    client_email: v.client_email.trim(),
    private_key: v.private_key.replace(/\\n/g, '\n'),       // 줄바꿈이 글자 \n 으로 남은 경우를 되돌립니다
    project_id: typeof v.project_id === 'string' ? v.project_id : ''
  };
}

// 속성 이름을 적을 때. 이름 칸에 긴 글(열쇠일 수 있음)이 들어 있으면 내용 대신 길이만 적습니다.
function label_(name) {
  var s = String(name);
  return s.length > 40 || /[{}"\\]|PRIVATE/.test(s) ? '(속성 칸에 긴 글 ' + s.length + '자)' : '"' + s + '"';
}

// 값의 생김새만 말해 줍니다. 내용은 적지 않습니다.
function shape_(value) {
  var s = String(value === null || value === undefined ? '' : value).replace(/^\uFEFF/, '').trim();
  if (!s) return '값이 비어 있음';
  var size = s.length + '자';
  if (s.charAt(0) === '{') {
    var v = parse_(s);
    if (!v) return '키 파일의 내용이 중간에 끊겼거나 일부가 빠짐(' + size + '. 온전한 키는 2,000자가 넘습니다)';
    if (v.type !== 'service_account') return '서비스 계정 키가 아닌 다른 JSON(' + size + ')';
    return '서비스 계정 키이지만 client_email 이나 private_key 항목이 없거나 온전하지 않음(' + size + ')';
  }
  if (s.indexOf('PRIVATE KEY') >= 0) return '키 파일의 일부(private_key 부분)만 들어 있음(' + size + '). 맨 앞의 { 부터 맨 끝의 } 까지 전부 필요합니다';
  return '키 파일의 내용이 아닌 다른 글(' + size + '). 파일 이름이 아니라 파일을 열어 나온 내용 전체가 필요합니다';
}

// 열쇠를 찾지 못한 까닭을 사람 말로
function why_(all, names) {
  var how = ' 넣는 곳: 왼쪽 톱니바퀴(프로젝트 설정) > 맨 아래 "스크립트 속성" > 속성 칸에 ' + KEY_NAME +
    ', 값 칸에 키 파일(JSON)을 메모장이나 텍스트 편집기로 열어 나온 내용 전체 > [스크립트 속성 저장].';
  if (!names.length) {
    return '이 Apps Script 프로젝트에 저장된 스크립트 속성이 하나도 없습니다. 속성과 값을 적은 뒤 그 아래의 [스크립트 속성 저장] 단추까지 눌러야 남습니다. ' +
      '백업 스프레드시트의 확장 프로그램 > Apps Script 로 연 바로 이 프로젝트에 넣었는지도 봐 주세요.' + how;
  }
  var list = names.slice(0, 5).map(function (n) { return label_(n) + ' → ' + shape_(all[n]); });
  var mixed = names.some(function (n) { return label_(n).charAt(0) === '('; }) ? ' 속성 칸과 값 칸이 서로 바뀐 것 같습니다.' : '';
  return '스크립트 속성은 저장돼 있지만 그 안에 온전한 서비스 계정 키가 없습니다. 지금 저장된 것: ' + list.join(' / ') + '.' + mixed + how;
}

// 서비스 계정 열쇠로 한 시간짜리 출입증(access token)을 받습니다.
function accessToken_() {
  var sa = findKey_().sa;
  keyProject_ = sa.project_id;
  var now = Math.floor(Date.now() / 1000);
  var head = b64_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var claim = b64_(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  }));
  var signature;
  try {
    signature = b64_(Utilities.computeRsaSha256Signature(head + '.' + claim, sa.private_key));
  } catch (e) {
    throw new Error('열쇠의 private_key 부분이 온전하지 않아 서명하지 못했습니다. 키 파일의 내용을 처음부터 끝까지 다시 붙여 넣어 주세요.');
  }
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + signature }
  });
  var body = parse_(res.getContentText());
  if (res.getResponseCode() !== 200 || !body || !body.access_token) {
    throw new Error('구글이 서비스 계정 키를 받아 주지 않았습니다(' + res.getResponseCode() + '). 키가 지워졌거나 잘못 붙여 넣었을 수 있습니다. ' + reason_(body));
  }
  return body.access_token;
}

// URL 에 쓸 수 있는 Base64. 글자와 바이트 배열을 모두 받습니다.
function b64_(data) {
  var out = typeof data === 'string' ? Utilities.base64EncodeWebSafe(data, Utilities.Charset.UTF_8) : Utilities.base64EncodeWebSafe(data);
  return out.replace(/=+$/, '');
}

function call_(token, method, url, payload) {
  var options = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } };
  if (payload) { options.contentType = 'application/json'; options.payload = JSON.stringify(payload); }
  var res = UrlFetchApp.fetch(url, options), body = parse_(res.getContentText());
  if (res.getResponseCode() !== 200) {
    var hint = '';
    if (res.getResponseCode() === 403) {
      hint = ' 서비스 계정에 "Cloud Datastore 뷰어" 역할이 있는지 확인해 주세요(Google Cloud 콘솔 > IAM 및 관리자 > IAM). 방금 역할을 주었다면 몇 분 뒤에 다시 해 보세요.';
      if (keyProject_ && keyProject_ !== PROJECT_ID) {
        hint += ' 이 열쇠는 "' + keyProject_ + '" 프로젝트에서 만든 것입니다. DB 가 있는 "' + PROJECT_ID + '" 프로젝트에서 서비스 계정을 만들었는지도 봐 주세요.';
      }
    }
    throw new Error('DB 를 읽지 못했습니다(' + res.getResponseCode() + ').' + hint + ' ' + reason_(body));
  }
  return body || {};
}

// 맨 위 컬렉션의 이름들. 컬렉션이 새로 생겨도 코드를 고치지 않고 함께 백업됩니다.
function listCollections_(token) {
  var names = [], page = '';
  do {
    var body = call_(token, 'post', ROOT + ':listCollectionIds', page ? { pageSize: 100, pageToken: page } : { pageSize: 100 });
    names = names.concat(body.collectionIds || []);
    page = body.nextPageToken || '';
  } while (page);
  return names.sort();
}

// 한 컬렉션의 문서 전부. Firestore 가 돌려준 모양 그대로({ name, fields, createTime, updateTime })
function listDocuments_(token, collection) {
  var docs = [], page = '';
  do {
    var url = ROOT + '/' + encodeURIComponent(collection) + '?pageSize=300' + (page ? '&pageToken=' + encodeURIComponent(page) : '');
    var body = call_(token, 'get', url);
    docs = docs.concat(body.documents || []);
    page = body.nextPageToken || '';
  } while (page);
  return docs;
}

/* ---------- 스프레드시트에 펼치기 ---------- */

// Firestore 값 하나를 평범한 값으로
function plain_(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return String(v.stringValue);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('timestampValue' in v) return String(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(plain_);
  if ('mapValue' in v) {
    var out = {}, f = (v.mapValue && v.mapValue.fields) || {};
    Object.keys(f).sort().forEach(function (k) { out[k] = plain_(f[k]); });
    return out;
  }
  if ('referenceValue' in v) return String(v.referenceValue);
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('bytesValue' in v) return String(v.bytesValue);
  return null;
}

// 시트의 한 칸에 넣을 글자. 목록과 묶음은 JSON 으로, 수식으로 읽힐 글자는 앞에 작은따옴표를 붙입니다.
function cell_(value) {
  if (value === null || value === undefined) return '';
  var s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (s.length > 49000) s = s.slice(0, 49000) + ' …(잘림)';
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// 문서들 → 표(첫 줄은 항목 이름). 항목 이름은 문서들에 나온 것을 모두 모아 가나다순으로 둡니다.
function toRows_(docs) {
  var keys = {};
  docs.forEach(function (d) { Object.keys(d.fields || {}).forEach(function (k) { keys[k] = true; }); });
  var names = Object.keys(keys).sort();
  var rows = [['문서 ID'].concat(names).concat(['만든 시각', '고친 시각'])];
  docs.forEach(function (d) {
    var f = d.fields || {}, row = [cell_(String(d.name || '').split('/').pop())];
    names.forEach(function (k) { row.push(cell_(k in f ? plain_(f[k]) : '')); });
    row.push(cell_(d.createTime || ''), cell_(d.updateTime || ''));
    rows.push(row);
  });
  return rows;
}

function writeTab_(ss, name, rows) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clearContents();
  var range = sheet.getRange(1, 1, rows.length, rows[0].length);
  range.setNumberFormat('@');           // 전화번호 앞의 0 이나 긴 숫자가 바뀌지 않게, 모두 글자로 둡니다
  range.setValues(rows);
  sheet.setFrozenRows(1);
}

/* ---------- 드라이브에 날짜별 파일로 남기기 ---------- */

function folder_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('BACKUP_FOLDER_ID');
  if (id) {
    try { var kept = DriveApp.getFolderById(id); if (!kept.isTrashed()) return kept; } catch (e) { /* 지워졌으면 새로 만듭니다 */ }
  }
  var found = DriveApp.getFoldersByName(FOLDER_NAME);
  var folder = found.hasNext() ? found.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  return folder;
}

// 오늘 날짜의 파일로 저장합니다(같은 날 다시 돌리면 바꿔 씁니다). 오래된 파일은 KEEP_FILES 개만 남기고 휴지통으로.
function saveFile_(all) {
  var folder = folder_();
  var name = 'kyla-db-' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd') + '.json';
  var same = folder.getFilesByName(name);
  while (same.hasNext()) same.next().setTrashed(true);
  folder.createFile(name, JSON.stringify({ project: PROJECT_ID, savedAt: new Date().toISOString(), collections: all }), 'application/json');
  var files = [], it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (/^kyla-db-\d{4}-\d{2}-\d{2}\.json$/.test(f.getName())) files.push(f); }
  files.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; });      // 최근 날짜가 앞
  files.slice(KEEP_FILES).forEach(function (old) { old.setTrashed(true); });
  return name;
}

/* ---------- 기록 ---------- */

function log_(ss, result, text) {
  var sheet = ss.getSheetByName(LOG_SHEET);
  if (!sheet) { sheet = ss.insertSheet(LOG_SHEET); sheet.appendRow(['시각(한국 시간)', '결과', '내용']); sheet.setFrozenRows(1); }
  sheet.appendRow([Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), result, cell_(text)]);
  var extra = sheet.getLastRow() - 401;                 // 기록은 최근 400줄만
  if (extra > 0) sheet.deleteRows(2, extra);
}

function parse_(text) { try { return JSON.parse(text); } catch (e) { return null; } }
function reason_(body) {
  var e = body && body.error;
  if (!e) return '';
  return typeof e === 'string' ? e + (body.error_description ? ': ' + body.error_description : '') : (e.message || e.status || '');
}
