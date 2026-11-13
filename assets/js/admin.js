/* ==========================================================================
   KYLA 관리자 화면 (/admin/)
   구글 계정으로 로그인한 관리자가 2027 제주 교류전 참가 의향 회신을 보고, 내려받고, 지웁니다.

   - 누가 관리자인지는 Firestore 의 admins 컬렉션(문서 ID = 구글 계정 이메일)이 정합니다.
     관리자 이메일은 이 파일을 비롯한 저장소 어디에도 적지 않습니다.
   - 읽기와 삭제 권한은 Firebase 보안 규칙(tools/firestore.rules)이 지킵니다. 이 화면의 권한 확인은 안내용입니다.
   - 회신 내용은 방문자가 적은 글입니다. 화면에 넣을 때는 textContent 만 쓰고 innerHTML 은 쓰지 않습니다.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = (window.KYLA_DATA && window.KYLA_DATA.config) || {};
  var FB = CFG.firebase && CFG.firebase.projectId && CFG.firebase.apiKey ? CFG.firebase : null;
  var API = 'https://firestore.googleapis.com/v1/';
  var DOCS = FB ? 'projects/' + FB.projectId + '/databases/(default)/documents' : '';
  var COLLECTION = 'eoiReplies';
  var LIMIT = 2000;

  // 저장된 값(화면 언어와 상관없는 코드)을 한국어로 보여 줄 때 쓰는 이름. 회신서(index.html #form-eoi)의 보기와 같습니다.
  var LABEL = {
    lang: { ko: '한국어', en: '영어', ja: '일본어' },
    intent: { active: '적극 검토', internal: '내부 협의 후 결정', undecided: '미정', unable: '현재 참가 어려움' },
    period: { '2027-06': '2027년 6월', other: '다른 기간 제안' },
    fee: { ok: '검토 가능', discuss: '협의 필요', hold: '판단 유보' },
    method: { whatsapp: 'WhatsApp', line: 'LINE', kakaotalk: 'KakaoTalk', instagram: 'Instagram', other: '기타' }
  };
  var DIVISIONS = [
    ['u10mixed', 'U10 혼성'], ['u12boys', 'U12 남자부'], ['u12girls', 'U12 여자부'], ['u14boys', 'U14 남자부'],
    ['u14girls', 'U14 여자부'], ['u16boys', 'U16 남자부'], ['u16girls', 'U16 여자부']
  ];
  var INTENTS = ['active', 'internal', 'undecided', 'unable'];

  var auth = null, user = null, replies = [], capped = false, serial = 0;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function label(group, code) { return code ? (LABEL[group][code] || String(code)) : ''; }

  /* ---------- 화면 바꾸기 ---------- */
  function show(name, focus) {
    ['loading', 'signin', 'denied', 'app'].forEach(function (n) { $('adm-' + n).hidden = n !== name; });
    if (focus === false) return;
    var h = $('adm-' + name).querySelector('h1');
    if (h) h.focus();
  }
  function loadingText(t) { $('adm-loading').querySelector('p').textContent = t; }
  // 로그인 창에서 생긴 문제 안내. 이미 다른 계정으로 들어와 있으면 권한 안내 화면 아래에 보여 줍니다.
  function signinMsg(t) {
    ['adm-signin-msg', 'adm-denied-msg'].forEach(function (id) { var m = $(id); m.textContent = t || ''; m.hidden = !t; });
  }
  function setStatus(t, isError, retry) {
    var s = $('adm-status');
    s.textContent = t || '';
    s.classList.toggle('is-error', !!isError);
    if (retry) {
      var b = el('button', 'linkbtn', '다시 시도');
      b.type = 'button';
      b.addEventListener('click', retry);
      s.appendChild(b);
    }
  }
  function renderWho() {
    $('adm-who').hidden = !user;
    $('adm-email').textContent = user ? (user.email || '') : '';
    $('adm-email-foot').textContent = user ? (user.email || '') : '';
  }

  /* ---------- 시각: 보는 사람의 시간대와 상관없이 한국 시간으로 ---------- */
  var KST = null;
  try {
    KST = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
  } catch (e) { KST = null; }
  function timeParts(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return null;
    var p = {};
    if (KST && KST.formatToParts) {
      KST.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    } else {                                    // 아주 오래된 브라우저: 직접 9시간을 더합니다
      var k = new Date(d.getTime() + 9 * 3600 * 1000), two = function (n) { return (n < 10 ? '0' : '') + n; };
      p = { year: String(k.getUTCFullYear()), month: two(k.getUTCMonth() + 1), day: two(k.getUTCDate()), hour: two(k.getUTCHours()), minute: two(k.getUTCMinutes()) };
    }
    if (p.hour === '24') p.hour = '00';
    return p;
  }
  function dateDots(p) { return p ? p.year + '.' + p.month + '.' + p.day : ''; }
  function clock(p) { return p ? p.hour + ':' + p.minute : ''; }

  /* ---------- Firestore 값 풀기 ---------- */
  function val(v) {
    if (!v || typeof v !== 'object') return null;
    if ('stringValue' in v) return String(v.stringValue);
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('booleanValue' in v) return !!v.booleanValue;
    if ('timestampValue' in v) return String(v.timestampValue);
    if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(val);
    if ('mapValue' in v) {
      var o = Object.create(null), f = (v.mapValue && v.mapValue.fields) || {};
      Object.keys(f).forEach(function (k) { o[k] = val(f[k]); });
      return o;
    }
    return null;
  }
  function text(x) { return typeof x === 'string' ? x : (x === null || x === undefined ? '' : String(x)); }
  function count(x) { return typeof x === 'number' && isFinite(x) && x >= 0 ? Math.floor(x) : null; }

  function decodeDoc(doc) {
    var f = val({ mapValue: { fields: doc.fields || {} } });
    var d = f.divisions && typeof f.divisions === 'object' ? f.divisions : {};
    var divisions = [];
    DIVISIONS.forEach(function (pair) {
      var one = d[pair[0]];
      if (!one || typeof one !== 'object') return;
      divisions.push({ code: pair[0], name: pair[1], teams: count(one.teams), players: count(one.players), staff: count(one.staff) });
    });
    return {
      id: String(doc.name || '').split('/').pop(),
      time: timeParts(text(f.submittedAt) || doc.createTime),
      lang: text(f.lang), org: text(f.org), country: text(f.country), contactName: text(f.contactName), role: text(f.role),
      email: text(f.email),
      methods: (Array.isArray(f.contactMethods) ? f.contactMethods : []).map(text),
      contactDetail: text(f.contactDetail), divisions: divisions,
      period: text(f.period), dates: text(f.dates), intent: text(f.intent), fee: text(f.fee), note: text(f.note), text: text(f.text)
    };
  }

  function countText(o) {
    var parts = [];
    if (o.teams !== null) parts.push(o.teams + '팀');
    if (o.players !== null) parts.push('선수 ' + o.players + '명');
    if (o.staff !== null) parts.push('인솔자 ' + o.staff + '명');
    return parts.join(', ');
  }
  function totals(r) {
    var t = { teams: null, players: null, staff: null };
    r.divisions.forEach(function (d) {
      ['teams', 'players', 'staff'].forEach(function (k) { if (d[k] !== null) t[k] = (t[k] || 0) + d[k]; });
    });
    return t;
  }

  /* ---------- Firestore 에 묻기 (로그인한 사람의 권한으로) ---------- */
  function api(method, path, body) {
    return user.getIdToken().then(function (token) {
      var headers = { Authorization: 'Bearer ' + token };
      if (body) headers['Content-Type'] = 'text/plain';        // Firebase 가 쓰는 방식 그대로
      return fetch(API + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
    });
  }
  function httpError(status) { var e = new Error('HTTP ' + status); e.status = status; return e; }

  // 관리자 명단에 있는지: 있음 ok, 없음 none, 규칙이 막음 blocked, 확인 못 함 error
  function checkAdmin() {
    // 명단의 문서 ID 는 소문자 이메일입니다(보안 규칙도 소문자로 바꿔 비교합니다).
    return api('GET', DOCS + '/admins/' + encodeURIComponent((user.email || '').toLowerCase()))
      .then(function (res) {
        if (res.ok) return 'ok';
        if (res.status === 404) return 'none';
        if (res.status === 403) return 'blocked';
        return 'error';
      })
      .catch(function () { return 'error'; });
  }

  function fetchReplies() {
    return api('POST', DOCS + ':runQuery', {
      structuredQuery: {
        from: [{ collectionId: COLLECTION }],
        orderBy: [{ field: { fieldPath: 'submittedAt' }, direction: 'DESCENDING' }],
        limit: LIMIT
      }
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) throw httpError(res.status);
        if (!Array.isArray(data)) throw httpError(0);
        var bad = data.filter(function (x) { return x && x.error; })[0];
        if (bad) throw httpError(Number(bad.error.code) || 0);
        return data.filter(function (x) { return x && x.document; }).map(function (x) { return decodeDoc(x.document); });
      });
    });
  }

  /* ---------- 로그인 ---------- */
  var SIGNIN_ERRORS = {
    'auth/popup-blocked': '브라우저가 로그인 창을 막았습니다. 주소창 옆의 팝업 차단을 풀고 다시 눌러 주세요.',
    'auth/unauthorized-domain': '이 주소가 Firebase에 등록되어 있지 않습니다. Firebase 콘솔의 Authentication > 설정 > 승인된 도메인에 이 사이트 주소를 추가해 주세요.',
    'auth/operation-not-allowed': 'Firebase에서 구글 로그인이 아직 켜져 있지 않습니다. Firebase 콘솔의 Authentication > 로그인 방법에서 Google을 사용 설정해 주세요.',
    'auth/network-request-failed': '인터넷에 연결하지 못했습니다. 연결을 확인한 뒤 다시 눌러 주세요.',
    'auth/internal-error': '구글 로그인 창을 열지 못했습니다. 인터넷 연결을 확인해 주세요. 광고 차단 프로그램을 쓰고 있다면 이 주소에서는 꺼 주세요.',
    'auth/web-storage-unsupported': '이 브라우저에서는 로그인할 수 없습니다. Chrome이나 Safari에서 열어 주세요.',
    'auth/operation-not-supported-in-this-environment': '이 브라우저에서는 로그인할 수 없습니다. Chrome이나 Safari에서 열어 주세요.',
    'auth/user-disabled': '사용이 중지된 계정입니다. 다른 구글 계정으로 로그인해 주세요.'
  };
  var SIGNIN_QUIET = { 'auth/popup-closed-by-user': 1, 'auth/cancelled-popup-request': 1, 'auth/user-cancelled': 1 };

  function signIn() {
    if (!auth) return;
    signinMsg('');
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });       // 계정을 고를 수 있게
    // 창을 여는 일은 누른 그 순간에 해야 브라우저가 막지 않습니다. 결과는 onAuthStateChanged 가 받습니다.
    auth.signInWithPopup(provider).catch(function (err) {
      var code = (err && err.code) || '';
      if (SIGNIN_QUIET[code]) return;
      signinMsg(SIGNIN_ERRORS[code] || '로그인하지 못했습니다. 잠시 뒤 다시 눌러 주세요.' + (code ? ' (' + code + ')' : ''));
    });
  }
  function signOut() {
    if (!auth) return;
    auth.signOut().catch(function () {});
  }

  function setDenied(state) {
    var title = $('adm-denied-title'), body = $('adm-denied-text');
    body.textContent = '';
    signinMsg('');
    if (state === 'none') {
      title.textContent = '이 계정에는 관리자 권한이 없습니다';
      body.appendChild(el('strong', '', (user.email || '').toLowerCase()));
      body.appendChild(document.createTextNode(' 계정은 관리자 명단에 없습니다. 마스터 관리자에게 등록을 요청하거나, 다른 계정으로 로그인해 주세요.'));
    } else if (state === 'blocked') {
      title.textContent = '관리자 권한을 확인하지 못했습니다';
      body.textContent = 'Firebase 보안 규칙이 아직 게시되지 않았을 수 있습니다. Firebase 콘솔의 Firestore > 규칙에 협회 보안 규칙을 붙여 넣고 게시한 뒤 다시 확인해 주세요.';
    } else {
      title.textContent = '관리자 권한을 확인하지 못했습니다';
      body.textContent = '인터넷 연결을 확인한 뒤 다시 확인해 주세요.';
    }
    $('adm-recheck').hidden = state === 'none';
    show('denied');
  }

  function verify() {
    var u = user;
    if (!u) return;
    loadingText('관리자 권한을 확인하고 있습니다.');
    show('loading', false);
    checkAdmin().then(function (state) {
      if (user !== u) return;                    // 그 사이에 로그아웃했거나 계정을 바꿈
      if (state === 'ok') { show('app'); load(); } else setDenied(state);
    });
  }

  function onUser(u) {
    user = u || null;
    replies = []; capped = false;
    renderWho();
    clearList();
    if (!user) { loadingText('로그인 상태를 확인하고 있습니다.'); signinMsg(''); show('signin'); return; }
    verify();
  }

  /* ---------- 회신 목록 ---------- */
  function clearList() {
    $('adm-list').textContent = '';
    $('adm-stats').hidden = true;
    $('adm-cols').hidden = true;
    $('adm-csv').disabled = true;
    setStatus('');
  }

  function load() {
    var u = user;
    if (!u) return;
    $('adm-reload').disabled = true;
    setStatus('회신을 불러오고 있습니다.');
    fetchReplies().then(function (list) {
      if (user !== u) return;
      replies = list; capped = list.length >= LIMIT;
      render();
    }).catch(function (err) {
      if (user !== u) return;
      if (err && err.status === 401) { signOut(); return; }
      if (err && err.status === 403) { verify(); return; }
      setStatus('회신을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.', true, load);
    }).then(function () { $('adm-reload').disabled = false; });
  }

  function render(message) {
    var list = $('adm-list');
    list.textContent = '';
    var has = replies.length > 0;
    $('adm-stats').hidden = !has;
    $('adm-cols').hidden = !has;
    $('adm-csv').disabled = !has;

    var n = { all: replies.length };
    INTENTS.forEach(function (k) { n[k] = 0; });
    replies.forEach(function (r) { if (r.intent in n) n[r.intent] += 1; });
    Array.prototype.forEach.call($('adm-stats').querySelectorAll('[data-stat]'), function (dd) {
      dd.textContent = String(n[dd.getAttribute('data-stat')] || 0);
    });

    if (!has) {
      var empty = el('li', 'adm-empty');
      empty.appendChild(el('strong', '', '아직 받은 회신이 없습니다'));
      empty.appendChild(el('span', '', '참가 의향 회신서가 제출되면 여기에 최근 것부터 쌓입니다.'));
      list.appendChild(empty);
      setStatus(message || '');
      return;
    }
    replies.forEach(function (r) { list.appendChild(rowItem(r)); });
    setStatus(message || (capped
      ? '가장 최근 회신 ' + LIMIT.toLocaleString('ko-KR') + '건까지만 보여 줍니다.'
      : '회신 ' + replies.length.toLocaleString('ko-KR') + '건을 최근 것부터 보여 줍니다. 한 건을 누르면 자세한 내용이 열립니다.'));
  }

  function chevron() {
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path');
    svg.setAttribute('class', 'adm-row__chev');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', 'M9 5l7 7-7 7');
    svg.appendChild(path);
    return svg;
  }

  function rowItem(r) {
    var li = el('li'), btn = el('button', 'adm-row'), detailId = 'adm-detail-' + (++serial);
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', detailId);

    var when = el('span', 'adm-row__when');
    when.appendChild(el('span', '', dateDots(r.time)));
    when.appendChild(document.createTextNode(' '));
    when.appendChild(el('span', '', clock(r.time)));
    btn.appendChild(when);

    var org = el('span', 'adm-row__org');
    org.appendChild(el('span', 'adm-clip', r.org || '(단체 이름 없음)'));
    if (r.country) org.appendChild(el('small', 'adm-clip', r.country));
    btn.appendChild(org);

    var who = el('span', 'adm-row__who');
    who.appendChild(el('span', 'adm-clip', r.contactName));
    if (r.role) who.appendChild(el('small', 'adm-clip', r.role));
    btn.appendChild(who);

    var intent = el('span', 'adm-row__intent'), tag = el('span', 'adm-tag', label('intent', r.intent) || '의향 없음');
    tag.setAttribute('data-intent', INTENTS.indexOf(r.intent) >= 0 ? r.intent : '');
    intent.appendChild(tag);
    btn.appendChild(intent);

    var divs = el('span', 'adm-row__divs', r.divisions.length ? r.divisions.map(function (d) { return d.name; }).join(', ') : '고른 디비전 없음');
    var sum = countText(totals(r));
    if (sum) divs.appendChild(el('small', '', '모두 ' + sum));
    btn.appendChild(divs);
    btn.appendChild(chevron());

    var detail = el('div', 'adm-detail');
    detail.id = detailId;
    detail.hidden = true;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && !detail.firstChild) fillDetail(detail, r);
      detail.hidden = !open;
    });

    li.appendChild(btn);
    li.appendChild(detail);
    return li;
  }

  function addRow(dl, term, value) {
    if (!value || (typeof value === 'string' && !value.trim())) return;
    var row = el('div'), dd = el('dd');
    row.appendChild(el('dt', '', term));
    if (typeof value === 'string') dd.textContent = value; else dd.appendChild(value);
    row.appendChild(dd);
    dl.appendChild(row);
  }

  function fillDetail(box, r) {
    var dl = el('dl');
    addRow(dl, '접수 시각', r.time ? dateDots(r.time) + ' ' + clock(r.time) + ' (한국 시간)' : '');
    addRow(dl, '작성 언어', label('lang', r.lang));
    addRow(dl, '소속 단체', r.org);
    addRow(dl, '국가·지역', r.country);
    addRow(dl, '담당자', r.contactName + (r.role ? ' (' + r.role + ')' : ''));
    if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(r.email)) {
      var a = el('a', '', r.email);
      a.href = 'mailto:' + r.email;
      addRow(dl, '이메일', a);
    } else {
      addRow(dl, '이메일', r.email);
    }
    addRow(dl, '선호 연락 수단', r.methods.map(function (m) { return label('method', m); }).join(', '));
    addRow(dl, '연락 ID·링크·전화', r.contactDetail);
    addRow(dl, '디비전별 예상 인원', r.divisions.map(function (d) {
      var c = countText(d);
      return d.name + (c ? ': ' + c : '');
    }).join('\n'));
    var sum = countText(totals(r));
    if (r.divisions.length > 1 && sum) addRow(dl, '합계', sum);
    addRow(dl, '희망 시기', label('period', r.period));
    addRow(dl, '희망 날짜', r.dates);
    addRow(dl, '참가 의향', label('intent', r.intent));
    addRow(dl, '예상 참가비', label('fee', r.fee));
    addRow(dl, '기타 의견', r.note);
    box.appendChild(dl);

    if (r.text) {
      var raw = el('details', 'adm-detail__raw');
      raw.appendChild(el('summary', '', '보낸 내용 원문 보기'));
      raw.appendChild(el('pre', '', r.text));
      box.appendChild(raw);
    }

    var acts = el('div', 'adm-detail__acts'), del = el('button', 'linkbtn linkbtn--danger', '이 회신 삭제');
    del.type = 'button';
    acts.appendChild(del);
    box.appendChild(acts);

    var confirmBox = null;
    del.addEventListener('click', function () {
      if (confirmBox) { confirmBox.querySelector('button').focus(); return; }
      confirmBox = el('div', 'adm-confirm');
      confirmBox.setAttribute('role', 'group');
      confirmBox.appendChild(el('p', '', '이 회신을 삭제할까요? 삭제하면 되돌릴 수 없습니다. 필요하면 먼저 파일로 내려받아 두세요.'));
      var yes = el('button', 'btn btn--sm btn--ink', '삭제'), no = el('button', 'linkbtn', '취소');
      yes.type = 'button'; no.type = 'button';
      confirmBox.appendChild(yes);
      confirmBox.appendChild(no);
      box.appendChild(confirmBox);
      yes.focus();
      no.addEventListener('click', function () { box.removeChild(confirmBox); confirmBox = null; del.focus(); });
      yes.addEventListener('click', function () {
        yes.disabled = true; no.disabled = true;
        remove(r).catch(function () {
          yes.disabled = false; no.disabled = false;
          confirmBox.querySelector('p').textContent = '삭제하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.';
        });
      });
    });
  }

  function remove(r) {
    var u = user;
    return api('DELETE', DOCS + '/' + COLLECTION + '/' + encodeURIComponent(r.id)).then(function (res) {
      if (!res.ok) throw httpError(res.status);
      if (user !== u) return;
      replies = replies.filter(function (x) { return x !== r; });
      render('회신 1건을 삭제했습니다. 남은 회신은 ' + replies.length.toLocaleString('ko-KR') + '건입니다.');
      $('adm-status').scrollIntoView({ block: 'center' });
      $('adm-status').focus({ preventScroll: true });          // 지운 줄에 있던 초점을 결과 안내로 옮깁니다
    });
  }

  /* ---------- 엑셀용 파일(CSV) ---------- */
  // 엑셀이 수식으로 읽을 수 있는 글자로 시작하면 앞에 작은따옴표를 붙여 글자로만 읽히게 합니다.
  function cell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csv() {
    var head = ['접수 시각(한국 시간)', '작성 언어', '소속 단체', '국가·지역', '담당자', '직책', '이메일', '선호 연락 수단', '연락 ID·링크·전화', '참가 가능 디비전'];
    DIVISIONS.forEach(function (d) { head.push(d[1] + ' 팀 수', d[1] + ' 선수 수', d[1] + ' 인솔자 수'); });
    head.push('팀 수 합계', '선수 수 합계', '인솔자 수 합계', '희망 시기', '희망 날짜', '참가 의향', '예상 참가비', '기타 의견', '문서 ID');
    var lines = [head.map(cell).join(',')];
    replies.forEach(function (r) {
      var t = r.time, sum = totals(r), by = {};
      r.divisions.forEach(function (d) { by[d.code] = d; });
      var row = [
        t ? t.year + '-' + t.month + '-' + t.day + ' ' + t.hour + ':' + t.minute : '', label('lang', r.lang), r.org, r.country, r.contactName, r.role, r.email,
        r.methods.map(function (m) { return label('method', m); }).join(', '), r.contactDetail,
        r.divisions.map(function (d) { return d.name; }).join(', ')
      ];
      DIVISIONS.forEach(function (d) {
        var one = by[d[0]];
        ['teams', 'players', 'staff'].forEach(function (k) { row.push(one && one[k] !== null ? one[k] : ''); });
      });
      row.push(sum.teams, sum.players, sum.staff, label('period', r.period), r.dates, label('intent', r.intent), label('fee', r.fee), r.note, r.id);
      lines.push(row.map(cell).join(','));
    });
    return '﻿' + lines.join('\r\n') + '\r\n';
  }
  function download() {
    if (!replies.length) return;
    var now = timeParts(new Date().toISOString());
    var name = 'KYLA-제주2027-참가의향회신-' + now.year + now.month + now.day + '.csv';
    var url = URL.createObjectURL(new Blob([csv()], { type: 'text/csv;charset=utf-8' }));
    var a = el('a');
    a.href = url; a.download = name; a.hidden = true;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    setStatus('회신 ' + replies.length.toLocaleString('ko-KR') + '건을 ' + name + ' 파일로 내려받았습니다. 엑셀이나 구글 스프레드시트에서 열 수 있습니다.');
  }

  /* ---------- 시작 ---------- */
  function boot() {
    $('adm-google').addEventListener('click', signIn);
    $('adm-switch').addEventListener('click', signIn);
    $('adm-recheck').addEventListener('click', verify);
    $('adm-signout').addEventListener('click', signOut);
    $('adm-reload').addEventListener('click', load);
    $('adm-csv').addEventListener('click', download);

    if (!FB || !window.firebase || !window.firebase.auth) {
      show('signin');
      $('adm-google').disabled = true;
      signinMsg('관리자 화면을 준비하지 못했습니다. 화면을 새로 고쳐 주세요.');
      return;
    }
    try {
      window.firebase.initializeApp({ apiKey: FB.apiKey, authDomain: FB.authDomain, projectId: FB.projectId, appId: FB.appId });
      auth = window.firebase.auth();
      auth.languageCode = 'ko';
    } catch (e) {
      show('signin');
      $('adm-google').disabled = true;
      signinMsg('관리자 화면을 준비하지 못했습니다. 화면을 새로 고쳐 주세요.');
      return;
    }
    auth.onAuthStateChanged(onUser, function () { onUser(null); });
  }

  boot();
})();
