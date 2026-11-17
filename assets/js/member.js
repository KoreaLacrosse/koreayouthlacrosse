/* ==========================================================================
   KYLA 회원 화면 (#member)
   구글 로그인, 가입, 내 정보, 자녀 선수 등록, 시합 소식, 문의하기, 탈퇴.

   - 이 파일과 구글 로그인에 쓰는 파일(assets/vendor/)은 회원 화면을 열 때만 불러옵니다(app.js 의 openMember).
   - 화면의 뼈대와 고정 문구는 index.html 의 <section data-view="member"> 에 있습니다. 여기서는 로그인 상태에 따라
     보여 줄 곳을 고르고, DB 에서 읽은 내용을 채웁니다.
   - 누가 무엇을 할 수 있는지는 Firebase 보안 규칙(tools/firestore.rules)이 정합니다. 이 화면의 확인은 안내용입니다.
     회원 본인의 문서는 members/{로그인 계정의 uid}, 자녀는 guardian 이 보호자 uid 인 문서입니다.
   - 회원이 읽을 수 있는 문서에는 고친 사람(updatedBy)을 이메일이 아니라 로그인 계정의 고유 번호(uid)로 남깁니다.
     가입일(joinedOn)은 비워 보내고, 가입 시각(createdAt, 서버 시각)을 가입일로 봅니다.
   - 선수와 학부모는 함께 고를 수 없습니다. 선수는 출생 연월일을 적고(만 14세 이상인지 여기서 확인합니다),
     학부모는 자녀와의 관계(부·모)와, 가입할 때 자녀 선수 한 명을 함께 적습니다. 연령 구분은 회원에게 묻지 않습니다.
   - 탈퇴하면 회원 정보는 지우고, 탈퇴 기록(memberExits)에 이름·회원 종류·가입일·탈퇴 시각만 남깁니다.
   - DB 에서 온 글(회원이 적은 내용, 협회 답변, 시합 소식)은 textContent 로만 화면에 넣습니다. innerHTML 은 쓰지 않습니다.
   - 화면에 보이는 한국어는 app.js 와 같이 T 함수로 감쌉니다. 영어·일본어는 i18n/catalog.json 에 넣습니다.
   ========================================================================== */
(function () {
  'use strict';
  if (window.KYLA_MEMBER) return;

  var APP = window.KYLA_APP || {};
  var T = APP.T || function (s, vars) {
    return vars ? s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] == null ? m : vars[k]; }) : s;
  };
  var CFG = APP.cfg || {};
  var BASE = APP.base || '';
  var FB = CFG.firebase && CFG.firebase.projectId && CFG.firebase.apiKey ? CFG.firebase : null;
  var API = 'https://firestore.googleapis.com/v1/';
  var DOCS = FB ? 'projects/' + FB.projectId + '/databases/(default)/documents' : '';
  var MAX_KIDS = 8;

  // 아래 값들은 tools/firestore.rules 와 관리자 화면(assets/js/admin/)의 값과 같아야 합니다.
  var TYPES = [['player', T('선수')], ['parent', T('학부모')], ['coach', T('지도자')], ['general', T('일반')]];
  var DIVISIONS = { u10: 'U10', u12: 'U12', u14: 'U14', u16: 'U16', adult: T('성인') };
  var GENDERS = { m: T('남'), f: T('여') };
  var RELATIONS = { father: T('부'), mother: T('모') };          // 학부모가 적는 자녀와의 관계
  var CATS = {
    member: [T('회원·가입'), 'navy'], program: [T('교육 프로그램'), 'orange'], event: [T('대회·시합'), 'red'], cert: [T('지도자 자격 신청'), 'green'],
    docs: [T('증빙 서류 요청'), 'line'], intl: [T('국제교류'), 'blue'], sponsor: [T('후원·협력'), 'navy'], etc: [T('그 밖의 문의'), 'line']
  };
  var INQ_STATE = { 'new': T('접수됨'), read: T('확인함'), done: T('답변 완료') };

  /* ---------- 작은 도구 ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false || c === '') continue;
      if (Array.isArray(c)) { c.forEach(function (x) { add(parent, x); }); continue; }
      parent.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return parent;
  }
  function button(cls, text, onClick) {
    var b = el('button', cls, text);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  function icon(id) {
    var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg'), u = document.createElementNS(NS, 'use');
    s.setAttribute('class', 'ico'); s.setAttribute('aria-hidden', 'true');
    u.setAttribute('href', '#i-' + id); s.appendChild(u);
    return s;
  }
  function bib(label, tone) { return el('span', 'bib bib--' + tone, label); }
  function text(x) { return typeof x === 'string' ? x : (x === null || x === undefined ? '' : String(x)); }
  function lower(s) { return text(s).toLowerCase(); }
  function clean(s, max) { return text(s).replace(/\s+/g, ' ').trim().slice(0, max); }

  // 날짜는 보는 사람의 시간대와 상관없이 한국 시간으로 셉니다. 브라우저마다 날짜를 적는 순서가 달라도 되게 조각을 받아 YYYY-MM-DD 로 맞춥니다.
  function ymd(date) {
    try {
      var o = {};
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
        .forEach(function (x) { o[x.type] = x.value; });
      if (/^\d{4}$/.test(o.year) && /^\d{2}$/.test(o.month) && /^\d{2}$/.test(o.day)) return o.year + '-' + o.month + '-' + o.day;
    } catch (e) { /* 아래 방법으로 넘어갑니다 */ }
    return new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }
  function today() { return ymd(new Date()); }
  function dayOf(iso) { var d = iso ? new Date(iso) : null; return d && !isNaN(d.getTime()) ? ymd(d) : ''; }
  function dots(day) { return day ? day.replace(/-/g, '.') : ''; }

  /* ---------- 출생 연월일 고르기: 연도·월·일 세 칸(이름-y, 이름-m, 이름-d) ---------- */
  function two(n) { return (n < 10 ? '0' : '') + n; }
  // years: 올해부터 몇 해 전까지 고를 수 있게 할지
  function fillDob(prefix, years) {
    var y = $(prefix + '-y'), m = $(prefix + '-m'), d = $(prefix + '-d'), now = Number(today().slice(0, 4)), i;
    if (y.options.length > 1) return;
    for (i = now; i >= now - years; i--) y.appendChild(el('option', '', String(i)));
    for (i = 1; i <= 12; i++) m.appendChild(el('option', '', String(i)));
    for (i = 1; i <= 31; i++) d.appendChild(el('option', '', String(i)));
  }
  function setDob(prefix, value) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value)), y = $(prefix + '-y');
    // 고를 수 있는 범위 밖의 해가 적혀 있으면 그 해를 보기에 더해 줍니다.
    if (p && !Array.prototype.some.call(y.options, function (o) { return o.value === p[1]; })) y.appendChild(el('option', '', p[1]));
    y.value = p ? p[1] : '';
    $(prefix + '-m').value = p ? String(Number(p[2])) : '';
    $(prefix + '-d').value = p ? String(Number(p[3])) : '';
  }
  // 고른 날짜. { value: 'YYYY-MM-DD'(아무것도 고르지 않았으면 ''), error: 고쳐야 할 까닭(없으면 '') }
  function readDob(prefix) {
    var y = $(prefix + '-y').value, m = $(prefix + '-m').value, d = $(prefix + '-d').value;
    if (!y && !m && !d) return { value: '', error: '' };
    if (!y || !m || !d) return { value: '', error: T('연도, 월, 일을 모두 골라 주세요.') };
    var value = y + '-' + two(Number(m)) + '-' + two(Number(d)), date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return { value: '', error: T('없는 날짜입니다. 다시 골라 주세요.') };
    if (value > today()) return { value: '', error: T('오늘보다 뒤의 날짜는 고를 수 없습니다.') };
    return { value: value, error: '' };
  }
  // 만 14세 이상인지(한국 시간의 오늘 기준). 만 14세 미만은 본인이 가입하지 않고 보호자가 자녀로 등록합니다.
  function is14(birth) {
    var t = today();
    return birth <= (Number(t.slice(0, 4)) - 14) + t.slice(4);
  }

  /* ---------- Firestore 와 주고받기 (로그인한 회원의 권한으로) ---------- */
  function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return { integerValue: String(Math.floor(v)) };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    return { stringValue: String(v) };
  }
  function dec(v) {
    if (!v || typeof v !== 'object') return null;
    if ('stringValue' in v) return String(v.stringValue);
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('booleanValue' in v) return !!v.booleanValue;
    if ('timestampValue' in v) return String(v.timestampValue);
    if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(dec);
    return null;
  }
  function decDoc(doc) {
    var o = Object.create(null), f = doc.fields || {};
    Object.keys(f).forEach(function (k) { o[k] = dec(f[k]); });
    o.id = String(doc.name || '').split('/').pop();
    return o;
  }
  function fail(status, code) {
    var e = new Error(code || ('HTTP ' + status));
    e.status = status; e.code = code || '';
    return e;
  }
  var auth = null, user = null;
  function call(method, path, body) {
    var u = user;
    if (!u) return Promise.reject(fail(401, 'UNAUTHENTICATED'));
    return u.getIdToken().then(function (token) {
      var headers = { Authorization: 'Bearer ' + token };
      if (body) headers['Content-Type'] = 'text/plain';        // Firebase 가 쓰는 방식 그대로
      return fetch(API + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        var er = Array.isArray(data) ? (data.filter(function (x) { return x && x.error; })[0] || {}).error : (data && data.error);
        if (!res.ok || er) throw fail(er && er.code ? Number(er.code) : res.status, er && er.status);
        return data;
      });
    }, function (err) {
      if (err && err.status !== undefined) throw err;
      throw fail(0, 'NETWORK');
    });
  }
  // 문서 하나. 없으면 null
  function getDoc(col, id) {
    return call('GET', DOCS + '/' + col + '/' + encodeURIComponent(id)).then(decDoc, function (err) {
      if (err.status === 404) return null;
      throw err;
    });
  }
  // 한 항목이 주어진 값과 같은 문서들. 보안 규칙이 이 조건으로 물을 때만 읽게 해 줍니다.
  function query(col, field, value) {
    var q = { from: [{ collectionId: col }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: enc(value) } }, limit: 300 };
    return call('POST', DOCS + ':runQuery', { structuredQuery: q }).then(function (data) {
      if (!Array.isArray(data)) throw fail(0, 'BAD_RESPONSE');
      return data.filter(function (x) { return x && x.document; }).map(function (x) { return decDoc(x.document); });
    });
  }
  function commit(writes) { return call('POST', DOCS + ':commit', { writes: writes }); }
  // 쓰기 한 건. opt.mask: 이번에 바꿀 항목 이름, opt.times: 서버 시각으로 채울 항목, opt.create: 새 문서만, opt.exists: 있는 문서만
  function wSet(col, id, data, opt) {
    var fields = {};
    Object.keys(data).forEach(function (k) { fields[k] = enc(data[k]); });
    var w = { update: { name: DOCS + '/' + col + '/' + id, fields: fields } };
    if (opt.mask) w.updateMask = { fieldPaths: opt.mask };
    if (opt.create) w.currentDocument = { exists: false };
    else if (opt.exists) w.currentDocument = { exists: true };
    if (opt.times) w.updateTransforms = opt.times.map(function (f) { return { fieldPath: f, setToServerValue: 'REQUEST_TIME' }; });
    return w;
  }
  function wDel(col, id) { return { 'delete': DOCS + '/' + col + '/' + id }; }
  function newId() {
    var abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', buf = new Uint8Array(20), id = '';
    window.crypto.getRandomValues(buf);
    for (var i = 0; i < buf.length; i++) id += abc.charAt(buf[i] % abc.length);
    return id;
  }
  function errorText(err) {
    var code = (err && err.code) || '', status = err && err.status;
    if (code === 'NETWORK' || status === 0) return T('인터넷에 연결하지 못했습니다. 연결을 확인한 뒤 다시 해 주세요.');
    if (status === 401) return T('로그인이 끝났습니다. 다시 로그인해 주세요.');
    if (status === 429 || code === 'RESOURCE_EXHAUSTED') return T('지금은 이용이 많아 처리하지 못했습니다. 내일 다시 해 주세요.');
    if (status === 403) return T('이 계정으로는 할 수 없는 일입니다. 화면을 새로 고친 뒤 다시 해 주세요.');
    return T('처리하지 못했습니다. 잠시 뒤 다시 해 주세요.');
  }

  /* ---------- 지금 상태 ---------- */
  var me = null;            // 본인 회원 문서. 아직 가입하지 않았으면 null
  var staff = false;        // 직원(관리자) 계정인지
  var kids = [];            // 내가 등록한 자녀 선수
  var inquiries = [];       // 내가 남긴 문의
  var posts = null;         // 시합 소식. 볼 수 없으면 null
  var matches = [];         // 협회가 공개한 시합. 시합 소식을 시합별로 묶어 보여 주는 데 씁니다
  var state = '';           // loading | failed | signin | join | home
  var want = { tab: '', inquiry: '' };
  var tab = 'profile', started = false, justLeft = false, kidEditing = null;

  function email() { return user ? lower(user.email) : ''; }
  function active() { return !!me && me.status === 'active' && !me.deletedAt; }
  function canSeePosts() { return staff || (active() && me.matchAccess === true); }

  function gate(name) {
    state = name;
    $('mem-loading').hidden = !(name === 'loading' || name === 'failed');
    $('mem-signin').hidden = name !== 'signin';
    $('mem-join').hidden = name !== 'join';
    $('mem-home').hidden = name !== 'home';
  }
  function status(textValue, canRetry) {
    $('mem-loading-text').textContent = textValue;
    $('mem-retry-wrap').hidden = !canRetry;
  }
  // 화면 아래에 잠깐 뜨는 알림. bad 이면 실패 알림(조금 더 오래 둡니다)
  var flashTimer = 0;
  function flash(textValue, bad) {
    var f = $('mem-flash');
    clearTimeout(flashTimer);
    f.className = 'mem__toast' + (bad ? ' is-error' : '');
    f.textContent = textValue || '';
    f.hidden = !textValue;
    if (textValue) flashTimer = setTimeout(function () { f.hidden = true; }, bad ? 10000 : 6000);
  }

  /* ---------- 양식 공통: 빠진 칸 표시, 결과 상자 ---------- */
  function clearErrors(form) {
    Array.prototype.forEach.call(form.querySelectorAll('.field__err'), function (p) { p.remove(); });
    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (i) { i.removeAttribute('aria-invalid'); });
  }
  function markError(input, msg) {
    input.setAttribute('aria-invalid', 'true');
    var field = input.closest('.field') || input.parentElement;
    field.appendChild(el('p', 'field__err', msg));
  }
  // 보이는 필수 칸이 비어 있으면 표시하고, 처음 빠진 칸을 돌려줍니다.
  function checkRequired(form) {
    clearErrors(form);
    var first = null;
    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (i) {
      if (i.disabled || i.closest('[hidden]')) return;
      var ok = i.type === 'checkbox' ? i.checked : i.value.trim() !== '';
      if (!ok) { markError(i, i.getAttribute('data-msg') || T('필수 항목입니다.')); first = first || i; }
    });
    return first;
  }
  function result(form, kind, title, body) {
    var box = form.querySelector('.result');
    box.className = 'result' + (kind ? ' result--' + kind : '');
    box.textContent = '';
    if (title) add(box, el('p', 'result__title', title), body ? el('p', 'result__text', body) : null);
    box.hidden = !title;
  }
  function busy(form, on, label) {
    var b = form.querySelector('[type="submit"]');
    if (on) { b.setAttribute('data-label', b.textContent); b.textContent = label || T('보내는 중'); b.disabled = true; }
    else { if (b.hasAttribute('data-label')) { b.textContent = b.getAttribute('data-label'); b.removeAttribute('data-label'); } b.disabled = false; }
  }

  /* ---------- 로그인 ---------- */
  var SIGNIN_QUIET = { 'auth/popup-closed-by-user': 1, 'auth/cancelled-popup-request': 1, 'auth/user-cancelled': 1 };
  function signinError(code) {
    if (code === 'auth/popup-blocked') return T('브라우저가 로그인 창을 막았습니다. 팝업 차단을 풀고 다시 눌러 주세요.');
    if (code === 'auth/network-request-failed') return T('인터넷에 연결하지 못했습니다. 연결을 확인한 뒤 다시 눌러 주세요.');
    if (code === 'auth/web-storage-unsupported' || code === 'auth/operation-not-supported-in-this-environment') {
      return T('이 브라우저에서는 로그인할 수 없습니다. Chrome이나 Safari에서 열어 주세요.');
    }
    if (code === 'auth/user-disabled') return T('사용이 중지된 계정입니다. 다른 구글 계정으로 로그인해 주세요.');
    if (code === 'auth/user-mismatch') return T('지금 로그인한 계정과 같은 구글 계정을 골라 주세요.');
    return T('로그인하지 못했습니다. 잠시 뒤 다시 눌러 주세요.') + (code ? ' (' + code + ')' : '');
  }
  function provider() {
    var p = new window.firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });       // 계정을 고를 수 있게
    return p;
  }
  function signinMsg(t) { var m = $('mem-signin-msg'); m.textContent = t || ''; m.hidden = !t; }
  function signIn() {
    if (!auth) return;
    signinMsg('');
    $('mem-left').hidden = true;
    // 로그인 창은 누른 그 순간에 열어야 브라우저가 막지 않습니다. 결과는 onAuthStateChanged 가 받습니다.
    auth.signInWithPopup(provider()).catch(function (err) {
      var code = (err && err.code) || '';
      if (!SIGNIN_QUIET[code]) signinMsg(signinError(code));
    });
  }
  function signOut() { if (auth) auth.signOut().catch(function () {}); }

  // 카카오톡·인스타그램 같은 앱 안에서 열린 화면에서는 구글이 로그인을 막습니다. 다른 브라우저로 여는 길을 알려 줍니다.
  function inApp() {
    var ua = navigator.userAgent || '';
    if (/KAKAOTALK/i.test(ua)) return 'kakao';
    if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|everytimeApp|BAND\/|; wv\)/i.test(ua)) return /Android/i.test(ua) ? 'android' : 'other';
    return '';
  }
  function showInApp() {
    var kind = inApp(), box = $('mem-inapp'), open = $('mem-open-ext');
    box.hidden = !kind;
    if (!kind) return;
    var here = location.href.split('#')[0] + '#member';
    if (kind === 'kakao') open.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(here);
    else if (kind === 'android') open.href = 'intent://' + here.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
    open.hidden = kind === 'other';
  }
  function copyUrl(ev) {
    var b = ev.currentTarget, here = location.href.split('#')[0] + '#member';
    var done = function () { b.textContent = T('주소를 복사했습니다'); };
    var manual = function () { b.textContent = here; b.disabled = true; };
    try { navigator.clipboard.writeText(here).then(done, manual); } catch (e) { manual(); }
  }

  function showSignin() {
    gate('signin');
    signinMsg('');
    $('mem-signin-why').hidden = want.tab !== 'inquiry' || justLeft;
    $('mem-left').hidden = !justLeft;
    justLeft = false;
    showInApp();
  }

  /* ---------- 읽어 오기 ---------- */
  function load() {
    var u = user;
    gate('loading');
    status(T('회원 정보를 불러오고 있습니다.'));
    Promise.all([
      getDoc('members', u.uid),
      getDoc('admins', email()).then(function (d) { return !!d; }, function (err) { if (err.status === 403) return false; throw err; })
    ]).then(function (r) {
      if (user !== u) return null;
      me = r[0]; staff = r[1];
      if (!me) { showJoin(); return null; }
      return loadMore().then(function () { if (user === u) showHome(); });
    }).catch(function (err) {
      if (user !== u) return;
      if (err && err.status === 401) { signOut(); return; }
      gate('failed');
      status(err && err.status === 403 ? T('회원 화면을 아직 쓸 수 없습니다. 협회가 준비를 마치는 대로 열립니다.') : T('회원 정보를 불러오지 못했습니다.') + ' ' + errorText(err), true);
    });
  }
  // 자녀, 내가 남긴 문의, (볼 수 있으면) 시합과 시합 소식
  function loadMore() {
    var u = user, jobs = [
      query('members', 'guardian', u.uid).then(function (list) { kids = list; }),
      query('inquiries', 'uid', u.uid).then(function (list) { inquiries = list; })
    ];
    posts = null; matches = [];
    if (canSeePosts()) {
      jobs.push(query('matchPosts', 'state', 'published').then(function (list) { posts = list; }, function (err) {
        if (err.status === 403) { posts = null; return; }      // 그 사이 권한이 꺼졌으면 잠긴 안내를 보여 줍니다
        throw err;
      }));
      jobs.push(query('matches', 'state', 'published').then(function (list) { matches = list; }, function (err) {
        if (err.status === 403) { matches = []; return; }      // 시합을 읽지 못하면 시합을 정하지 않은 소식만 보여 줍니다
        throw err;
      }));
    }
    return Promise.all(jobs);
  }
  function onUser(u) {
    user = u || null;
    me = null; staff = false; kids = []; inquiries = []; posts = null; matches = []; kidEditing = null;
    resetForms();
    flash('');
    if (!user) { showSignin(); return; }
    load();
  }

  /* ---------- 가입과 회원 정보 수정 (같은 양식 #mem-form 을 씁니다) ---------- */
  var formMode = 'join';
  function typeBoxes() { return Array.prototype.slice.call($('mem-form').querySelectorAll('[data-mtype]')); }
  function hasType(t) { return typeBoxes().some(function (b) { return b.checked && b.getAttribute('data-mtype') === t; }); }
  // 종류에 따라 더 받는 칸을 보이거나 감춥니다.
  // 선수: 출생 연월일·성별·보호자 이름, 지도자: 성별, 학부모: 자녀와의 관계(가입할 때는 자녀 선수 정보와 법정대리인 동의도)
  function syncTypeFields() {
    var player = hasType('player'), parent = hasType('parent'), coach = hasType('coach'), join = formMode === 'join';
    $('mf-birth-field').hidden = !player;
    $('mf-contact-field').hidden = !player;
    $('mf-gender-field').hidden = !(player || coach);
    $('mf-relation-field').hidden = !parent;
    $('mf-more').hidden = !(player || coach || parent);
    $('mf-child').hidden = !(join && parent);
    $('mf-child-consent').hidden = !(join && parent);
  }
  // 선수와 학부모는 함께 고를 수 없습니다. 하나를 고르면 다른 하나는 풀립니다.
  function onTypeChange(box) {
    var t = box.getAttribute('data-mtype'), other = t === 'player' ? 'parent' : (t === 'parent' ? 'player' : '');
    if (box.checked && other) typeBoxes().forEach(function (b) { if (b.getAttribute('data-mtype') === other) b.checked = false; });
    syncTypeFields();
  }
  function fillForm(v) {
    $('mf-name').value = v.name || '';
    typeBoxes().forEach(function (b) { b.checked = (v.types || []).indexOf(b.getAttribute('data-mtype')) >= 0; });
    $('mf-team').value = v.team || '';
    $('mf-phone').value = v.phone || '';
    setDob('mf-birth', v.birth);
    $('mf-gender').value = v.gender || '';
    $('mf-contact').value = v.contactName || '';
    $('mf-relation').value = v.relation || '';
    $('mc-name').value = ''; $('mc-team').value = ''; $('mc-gender').value = '';
    setDob('mc-birth', '');
    $('mc-agree').checked = false;
    $('mf-age').checked = false;
    $('mf-agree').checked = false;
    syncTypeFields();
  }
  function setFormMode(mode) {
    var form = $('mem-form');
    formMode = mode;
    $(mode === 'join' ? 'mem-join-slot' : 'mem-edit-slot').appendChild(form);
    $('mf-consent').hidden = mode !== 'join';
    $('mf-submit').textContent = mode === 'join' ? T('회원 가입') : T('저장');
    $('mf-cancel').hidden = mode === 'join';
    clearErrors(form);
    result(form, '', '');
    busy(form, false);
  }
  // 관리자 화면으로 가는 링크. 영어·일본어 화면에서도 맞는 곳으로 가게 사이트 맨 위 폴더 기준으로 만듭니다.
  function setAdminLinks() {
    Array.prototype.forEach.call(document.querySelectorAll('#mem [data-admin-link]'), function (a) {
      var to = a.getAttribute('data-admin-link');
      a.href = BASE + 'admin/' + (to ? '#' + to : '');
    });
  }
  function showJoin() {
    gate('join');
    setFormMode('join');
    $('mem-join-staff').hidden = !staff;
    setAdminLinks();
    $('mem-join-email').textContent = user.email || '';
    fillForm({ name: clean(user.displayName, 60) });
  }
  function readForm() {
    var player = hasType('player'), parent = hasType('parent'), coach = hasType('coach'), none = { value: '', error: '' };
    return {
      name: clean($('mf-name').value, 60),
      types: typeBoxes().filter(function (b) { return b.checked; }).map(function (b) { return b.getAttribute('data-mtype'); }),
      team: clean($('mf-team').value, 80), phone: clean($('mf-phone').value, 40),
      birth: player ? readDob('mf-birth') : none, gender: player || coach ? $('mf-gender').value : '',
      contactName: player ? clean($('mf-contact').value, 60) : '', relation: parent ? $('mf-relation').value : '',
      player: player, parent: parent, coach: coach,
      // 학부모로 가입할 때 함께 적는 자녀 선수
      child: formMode === 'join' && parent
        ? { name: clean($('mc-name').value, 60), team: clean($('mc-team').value, 80), birth: readDob('mc-birth'), gender: $('mc-gender').value } : null
    };
  }
  // 보호자가 등록하는 자녀 선수의 문서. 자녀는 선수로만 등록하고, 연락처 칸에는 보호자(나)의 이름과 연락처가 들어갑니다. 집 주소는 받지 않습니다.
  function kidDoc(v, u) {
    return {
      name: v.name, types: ['player'], status: 'active', matchAccess: false, team: v.team, division: '', gender: v.gender, birth: v.birth,
      contactName: me.name || '', email: email(), phone: me.phone || '', joinedOn: '', note: '', source: 'guardian', guardian: u.uid, updatedBy: u.uid
    };
  }
  function submitForm(ev) {
    ev.preventDefault();
    var form = $('mem-form'), first = checkRequired(form), v = readForm(), u = user, join = formMode === 'join';
    var mark = function (input, msg) { markError(input, msg); first = first || input; };
    if (!v.types.length) mark(typeBoxes()[0], T('회원 종류를 하나 이상 골라 주세요.'));
    else if (v.player && v.parent) mark(typeBoxes()[0], T('선수와 학부모는 함께 고를 수 없습니다. 하나만 골라 주세요.'));
    if (v.player) {
      var bad = v.birth.error || (!v.birth.value ? T('출생 연월일을 골라 주세요.')
        : (is14(v.birth.value) ? '' : T('만 14세 미만은 본인이 가입할 수 없습니다. 보호자가 학부모로 가입해 자녀를 선수로 등록해 주세요.')));
      if (bad) mark($('mf-birth-y'), bad);
    }
    if (v.child) {
      var cbad = v.child.birth.error || (v.child.birth.value ? '' : T('자녀의 출생 연월일을 골라 주세요.'));
      if (cbad) mark($('mc-birth-y'), cbad);
    }
    if (first) {
      result(form, 'err', T('빠진 항목이 있습니다'), T('표시된 항목을 채운 뒤 다시 눌러 주세요.'));
      first.focus();
      return;
    }
    result(form, '', '');
    var write, saved;
    if (join) {
      // 가입하면 바로 활동 회원입니다. 상태·시합 참가 권한·협회 메모는 회원이 정할 수 없고(보안 규칙), 관리자만 바꿉니다.
      // 연령 구분(division)은 회원에게 묻지 않습니다. 협회가 출생 연월일을 보고 정합니다.
      saved = {
        name: v.name, types: v.types, status: 'active', matchAccess: false, team: v.team, division: '', gender: v.gender, birth: v.birth.value, relation: v.relation,
        contactName: v.contactName, email: email(), phone: v.phone, joinedOn: '', note: '', source: 'self', updatedBy: u.uid
      };
      write = wSet('members', u.uid, saved, { create: true, times: ['createdAt', 'updatedAt', 'agreedAt'] });
    } else {
      // 출생 연월일과 자녀와의 관계는 그 종류가 아니게 되면 비웁니다. 성별과 보호자 이름은 해당 종류일 때만 고칩니다(협회가 적어 둔 값이 있을 수 있습니다).
      saved = { name: v.name, types: v.types, team: v.team, phone: v.phone, birth: v.birth.value, relation: v.relation, updatedBy: u.uid };
      if (v.player || v.coach) saved.gender = v.gender;
      if (v.player) saved.contactName = v.contactName;
      write = wSet('members', u.uid, saved, { mask: Object.keys(saved), exists: true, times: ['updatedAt'] });
    }
    busy(form, true, T('저장하는 중'));
    commit([write]).then(function (res) {
      if (user !== u) return null;
      var t = (res && res.commitTime) || new Date().toISOString();
      if (!join) {
        busy(form, false);
        Object.keys(saved).forEach(function (k) { me[k] = saved[k]; });
        me.updatedAt = t;
        closeEdit();
        renderWho(); renderFacts();
        flash(T('회원 정보를 저장했습니다.'));
        return null;
      }
      me = Object.create(null);
      Object.keys(saved).forEach(function (k) { me[k] = saved[k]; });
      me.id = u.uid; me.createdAt = t; me.agreedAt = t; me.updatedAt = t;
      kids = []; inquiries = []; posts = null; matches = [];
      if (!v.child) {
        busy(form, false);
        showHome();
        flash(staff ? T('가입했습니다.') : T('가입했습니다. 이제 문의를 남길 수 있습니다.'));
        return null;
      }
      // 학부모: 가입에 이어 자녀를 선수로 등록합니다. 여기서 실패해도 가입은 끝난 것이라, 내 정보에서 다시 등록하게 안내합니다.
      var kid = kidDoc({ name: v.child.name, team: v.child.team, birth: v.child.birth.value, gender: v.child.gender }, u), id = newId();
      return commit([wSet('members', id, kid, { create: true, times: ['createdAt', 'updatedAt', 'agreedAt'] })]).then(function (r2) {
        if (user !== u) return;
        busy(form, false);
        var doc = Object.create(null);
        Object.keys(kid).forEach(function (k) { doc[k] = kid[k]; });
        doc.id = id; doc.createdAt = (r2 && r2.commitTime) || t;
        kids = [doc];
        showHome();
        flash(T('가입했습니다. {name} 선수도 함께 등록했습니다.', { name: kid.name }));
      }, function () {
        if (user !== u) return;
        busy(form, false);
        showHome();
        openKid(null, kid);
        flash(T('가입은 끝났습니다. 자녀 선수 등록은 저장하지 못했습니다. 아래에서 다시 등록해 주세요.'), true);
      });
    }, function (err) {
      if (user !== u) return;
      busy(form, false);
      if (join && (err.status === 409 || err.code === 'ALREADY_EXISTS')) { load(); return; }     // 다른 창에서 이미 가입함
      result(form, 'err', join ? T('가입하지 못했습니다') : T('저장하지 못했습니다'), errorText(err));
    });
  }
  function openEdit() {
    setFormMode('edit');
    fillForm(me);
    $('mem-facts').hidden = true;
    $('mem-edit-open').hidden = true;
    flash('');
    $('mf-name').focus();
  }
  function closeEdit() {
    $('mem-join-slot').appendChild($('mem-form'));
    $('mem-facts').hidden = false;
    $('mem-edit-open').hidden = false;
  }

  /* ---------- 회원 화면: 머리, 내 정보 ---------- */
  function typeNames(list) {
    return TYPES.filter(function (t) { return (list || []).indexOf(t[0]) >= 0; }).map(function (t) { return t[1]; });
  }
  function renderWho() {
    $('mem-name').textContent = me.name || '';
    var types = $('mem-types');
    types.textContent = '';
    typeNames(me.types).forEach(function (n) { types.appendChild(bib(n, 'line')); });
    if (staff) types.appendChild(bib(T('직원'), 'navy'));
    $('mem-email').textContent = user.email || '';
  }
  function renderFacts() {
    var dl = $('mem-facts'), types = me.types || [];
    var player = types.indexOf('player') >= 0, parent = types.indexOf('parent') >= 0, coach = types.indexOf('coach') >= 0;
    var row = function (k, v) { add(dl, add(el('div'), el('dt', '', k), el('dd', '', v || T('적지 않음')))); };
    dl.textContent = '';
    row(T('이름'), me.name);
    row(T('회원 종류'), typeNames(me.types).concat(staff ? [T('직원')] : []).join(', '));
    row(T('소속'), me.team);
    if (player) row(T('출생 연월일'), dots(me.birth));
    if (player || coach) row(T('성별'), GENDERS[me.gender] || '');
    if (player) row(T('보호자 이름'), me.contactName);
    if (parent) row(T('자녀와의 관계'), RELATIONS[me.relation] || '');
    row(T('휴대전화'), me.phone);
    row(T('가입일'), dots(me.joinedOn) || dots(dayOf(me.createdAt)));
    row(T('시합 참가 권한'), me.matchAccess === true ? T('있음') : T('없음'));
  }

  /* ---------- 자녀 선수 ---------- */
  function shownKids() { return kids.filter(function (k) { return !k.deletedAt; }); }
  // 출생 연월일을 적기 전에 등록한 자녀는 예전에 고른 연령 구분을 대신 보여 줍니다.
  function kidSummary(k) {
    return [k.team, k.birth ? T('{date} 출생', { date: dots(k.birth) }) : (DIVISIONS[k.division] || ''), GENDERS[k.gender] || ''].filter(Boolean).join(', ');
  }
  function renderKids() {
    var box = $('mem-kids'), list = shownKids();
    box.textContent = '';
    if (!list.length) { box.appendChild(el('p', 'mem__none', T('등록한 자녀 선수가 없습니다.'))); return; }
    var ul = el('ul', 'mem__list');
    list.sort(function (a, b) { return text(a.createdAt) < text(b.createdAt) ? -1 : 1; }).forEach(function (k) {
      var li = el('li', 'mem__item'), acts = el('div', 'mem__item-acts');
      var ask = function () {
        acts.textContent = '';
        var yes = button('linkbtn linkbtn--danger', T('등록 지우기'), function () { removeKid(k, yes); });
        add(acts, yes, button('linkbtn', T('취소'), function () { renderKids(); }));
        yes.focus();
      };
      add(acts, button('linkbtn', T('수정'), function () { openKid(k); }), button('linkbtn', T('삭제'), ask));
      add(li, el('span', 'mem__item-title', k.name), acts,
        el('span', 'mem__item-sub', kidSummary(k) + (k.matchAccess === true ? (kidSummary(k) ? ', ' : '') + T('시합 참가') : '')));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  // k: 고칠 자녀(새로 등록하면 null). preset: 새로 등록할 때 미리 채울 값
  function openKid(k, preset) {
    var form = $('mem-kid-form');
    kidEditing = k || null;
    clearErrors(form);
    result(form, '', '');
    busy(form, false);
    if (!k && shownKids().length >= MAX_KIDS) {
      flash(T('자녀 선수는 {n}명까지 등록할 수 있습니다. 더 등록해야 하면 문의하기로 알려 주세요.', { n: MAX_KIDS }), true);
      return;
    }
    $('mem-kid-legend').textContent = k ? T('자녀 선수 정보 수정') : T('자녀 선수 등록');
    $('mk-submit').textContent = k ? T('저장') : T('등록');
    var from = k || preset || {};
    $('mk-name').value = from.name || '';
    $('mk-team').value = k || preset ? from.team || '' : (me.team || '');
    setDob('mk-birth', from.birth);
    $('mk-gender').value = from.gender || '';
    $('mk-consent').hidden = !!k;            // 동의는 등록할 때 한 번 받습니다
    $('mk-agree').checked = false;
    form.hidden = false;
    $('mem-kid-open').hidden = true;
    $('mk-name').focus();
  }
  function closeKid() {
    kidEditing = null;
    $('mem-kid-form').hidden = true;
    $('mem-kid-open').hidden = !active();
  }
  function submitKid(ev) {
    ev.preventDefault();
    var form = $('mem-kid-form'), first = checkRequired(form), u = user, k = kidEditing;
    var born = readDob('mk-birth'), bad = born.error || (born.value ? '' : T('출생 연월일을 골라 주세요.'));
    if (bad) { markError($('mk-birth-y'), bad); first = first || $('mk-birth-y'); }
    if (first) {
      result(form, 'err', T('빠진 항목이 있습니다'), T('표시된 항목을 채운 뒤 다시 눌러 주세요.'));
      first.focus();
      return;
    }
    var v = { name: clean($('mk-name').value, 60), team: clean($('mk-team').value, 80), birth: born.value, gender: $('mk-gender').value };
    var id = k ? k.id : newId(), saved, write;
    if (k) {
      saved = { name: v.name, team: v.team, birth: v.birth, gender: v.gender, updatedBy: u.uid };
      write = wSet('members', id, saved, { mask: Object.keys(saved), exists: true, times: ['updatedAt'] });
    } else {
      saved = kidDoc(v, u);
      write = wSet('members', id, saved, { create: true, times: ['createdAt', 'updatedAt', 'agreedAt'] });
    }
    busy(form, true, T('저장하는 중'));
    commit([write]).then(function (res) {
      if (user !== u) return;
      busy(form, false);
      var t = (res && res.commitTime) || new Date().toISOString(), doc = k;
      if (!doc) { doc = Object.create(null); doc.id = id; doc.createdAt = t; kids.push(doc); }
      Object.keys(saved).forEach(function (key) { doc[key] = saved[key]; });
      closeKid();
      renderKids();
      flash(k ? T('자녀 선수 정보를 저장했습니다.') : T('{name} 선수를 등록했습니다.', { name: v.name }));
    }, function (err) {
      if (user !== u) return;
      busy(form, false);
      result(form, 'err', T('저장하지 못했습니다'), errorText(err));
    });
  }
  function removeKid(k, btn) {
    var u = user;
    btn.disabled = true;
    commit([wDel('members', k.id)]).then(function () {
      if (user !== u) return;
      kids = kids.filter(function (x) { return x.id !== k.id; });
      if (kidEditing && kidEditing.id === k.id) closeKid();
      renderKids();
      flash(T('{name} 선수의 등록을 지웠습니다.', { name: k.name }));
    }, function (err) {
      if (user !== u) return;
      renderKids();
      flash(T('지우지 못했습니다.') + ' ' + errorText(err), true);
    });
  }

  /* ---------- 시합 소식 ----------
     협회가 넣은 시합(matches)마다 그 시합의 소식(matchPosts 가운데 matchId 가 그 시합인 글)을 묶어 보여 줍니다.
     시합을 정하지 않은 소식은 맨 아래에 따로 모읍니다. 협회가 숨기거나 지운 시합의 소식은 보여 주지 않습니다. */
  function stampOf(iso) { var n = Date.parse(text(iso)); return isNaN(n) ? 0 : n; }
  function newest(a, b) { return stampOf(b.createdAt) - stampOf(a.createdAt); }
  function dateCell(day, none) {
    if (!day) return el('span', 'row__date row__date--none', none);
    var date = el('span', 'row__date num', APP.fmtMD ? APP.fmtMD(day) : day.slice(5).replace('-', '.'));
    if (APP.weekday) date.appendChild(el('small', '', APP.weekday(day)));
    return date;
  }
  function whereText(day, place) { return [day && APP.fmtLong ? APP.fmtLong(day) : '', place].filter(Boolean).join(', '); }
  // m: 그 글이 속한 시합(시합을 정하지 않은 글이면 null). 시합 아래의 글은 날짜 칸 없이 시합 이름 아래에 맞춰 적고,
  // 시합과 같은 날짜와 장소는 되풀이하지 않습니다.
  function postRow(p, m) {
    var li = el('li', m ? 'mpost mpost--in' : 'row mpost'), main = el('div', 'row__main');
    var day = text(p.eventOn), place = text(p.place);
    if (m && day === text(m.eventOn)) day = '';
    if (m && place === text(m.place)) place = '';
    add(main, el(m ? 'h4' : 'span', 'row__title', p.title));
    var where = whereText(day, place);
    if (where) main.appendChild(el('span', 'row__sub', where));
    if (p.body) main.appendChild(el('p', 'mpost__body', p.body));
    // 사진은 앨범 주소로만 받습니다. https 주소만, 따옴표나 꺾쇠가 없을 때만 링크로 만듭니다.
    if (/^https:\/\/[^\s"'<>]+$/.test(text(p.albumUrl))) {
      var a = el('a', 'extlink', T('사진 앨범 열기'));
      a.href = p.albumUrl; a.rel = 'noopener noreferrer'; a.target = '_blank';
      a.appendChild(icon('ext'));
      main.appendChild(a);
    }
    if (m) add(li, main); else add(li, dateCell(day, T('알림')), main);
    return li;
  }
  function matchBlock(m, items) {
    var li = el('li', 'mmatch'), head = el('div', 'row mmatch__head'), main = el('div', 'row__main');
    add(main, el('h3', 'mmatch__title', m.title));
    var where = whereText(text(m.eventOn), text(m.place));
    if (where) main.appendChild(el('span', 'row__sub', where));
    add(head, dateCell(text(m.eventOn), T('날짜 미정')), main);
    li.appendChild(head);
    if (items.length) {
      var ul = el('ul', 'mmatch__posts');
      items.forEach(function (p) { ul.appendChild(postRow(p, m)); });
      li.appendChild(ul);
    } else {
      li.appendChild(el('p', 'mmatch__none', T('아직 올라온 시합 소식이 없습니다')));
    }
    return li;
  }
  function renderPosts() {
    var box = $('mem-posts'), locked = !canSeePosts() || posts === null;
    $('mem-posts-locked').hidden = !locked;
    box.textContent = '';
    if (locked) return;
    var now = today(), of = {}, loose = [];
    var shown = matches.filter(function (m) { return !m.deletedAt && m.state === 'published'; });
    shown.forEach(function (m) { of[m.id] = []; });
    posts.forEach(function (p) {
      if (p.deletedAt || p.state !== 'published') return;
      var id = text(p.matchId);
      if (!id) loose.push(p);
      else if (of[id]) of[id].push(p);
    });
    if (!shown.length && !loose.length) {
      add(box, add(el('div', 'empty'), el('p', 'empty__title', T('아직 올라온 시합 소식이 없습니다')), el('p', 'empty__text', T('시합 일정이 정해지면 이곳에 올립니다.'))));
      return;
    }
    // 다가오는 시합: 가까운 날부터. 날짜를 아직 정하지 않은 시합은 그 뒤에 둡니다. 지난 시합: 최근 것부터.
    var coming = shown.filter(function (m) { return !m.eventOn || m.eventOn >= now; }).sort(function (a, b) {
      if (!a.eventOn !== !b.eventOn) return a.eventOn ? -1 : 1;
      return a.eventOn === b.eventOn ? newest(a, b) : (a.eventOn < b.eventOn ? -1 : 1);
    });
    var past = shown.filter(function (m) { return m.eventOn && m.eventOn < now; }).sort(function (a, b) {
      return a.eventOn === b.eventOn ? newest(a, b) : (a.eventOn < b.eventOn ? 1 : -1);
    });
    var group = function (title, list) {
      if (!list.length) return;
      var ul = el('ul', 'mmatches');
      list.forEach(function (m) { ul.appendChild(matchBlock(m, of[m.id].sort(newest))); });
      add(box, el('h2', 'mposts__h', title), ul);
    };
    group(T('다가오는 시합'), coming);
    group(T('지난 시합'), past);
    if (loose.length) {
      var ul = el('ul', 'rows');
      loose.sort(function (a, b) {
        var x = a.eventOn || dayOf(a.createdAt), y = b.eventOn || dayOf(b.createdAt);
        return x === y ? newest(a, b) : (x < y ? 1 : -1);
      }).forEach(function (p) { ul.appendChild(postRow(p, null)); });
      add(box, el('h2', 'mposts__h', shown.length ? T('그 밖의 소식') : T('소식과 알림')), ul);
    }
  }

  /* ---------- 문의하기 ---------- */
  function renderInquiries() {
    var box = $('mem-inqs');
    box.textContent = '';
    if (!inquiries.length) { box.appendChild(el('p', 'mem__none', T('아직 남긴 문의가 없습니다.'))); return; }
    var wrap = el('div', 'minqs');
    inquiries.slice().sort(function (a, b) { return text(a.createdAt) < text(b.createdAt) ? 1 : -1; }).forEach(function (q) {
      var d = el('details', 'minq'), s = el('summary'), meta = el('span', 'minq__meta'), body = el('div', 'minq__body');
      var cat = CATS[q.category] || CATS.etc, st = INQ_STATE[q.status] ? q.status : 'new';
      add(meta, bib(cat[0], cat[1]), el('span', '', dots(dayOf(q.createdAt))), el('span', 'minq__state' + (st === 'done' ? ' minq__state--done' : ''), INQ_STATE[st]));
      add(s, el('span', 'minq__title', q.subject), icon('chev'), meta);
      add(body, el('p', 'minq__text', q.body));
      if (q.reply) {
        var r = el('div', 'minq__reply');
        add(r, el('h3', '', T('협회 답변') + (q.repliedAt ? ' ' + dots(dayOf(q.repliedAt)) : '')), el('p', 'minq__text', q.reply));
        body.appendChild(r);
      }
      add(d, s, body);
      wrap.appendChild(d);
    });
    box.appendChild(wrap);
  }
  function renderInquiryForm() {
    var form = $('mem-inq-form');
    $('mem-inq-staff').hidden = !staff;
    form.hidden = staff || !active();        // 직원은 문의를 남길 수 없습니다(보안 규칙도 막습니다)
  }
  function submitInquiry(ev) {
    ev.preventDefault();
    var form = $('mem-inq-form'), first = checkRequired(form), u = user;
    if (first) {
      result(form, 'err', T('빠진 항목이 있습니다'), T('표시된 항목을 채운 뒤 다시 눌러 주세요.'));
      first.focus();
      return;
    }
    var id = newId();
    var saved = {
      uid: u.uid, name: me.name, email: email(), category: $('mi-cat').value,
      subject: clean($('mi-subject').value, 100), body: text($('mi-body').value).replace(/\s+$/, '').slice(0, 3000), status: 'new'
    };
    result(form, '', '');
    busy(form, true);
    commit([wSet('inquiries', id, saved, { create: true, times: ['createdAt'] })]).then(function (res) {
      if (user !== u) return;
      busy(form, false);
      var doc = Object.create(null);
      Object.keys(saved).forEach(function (k) { doc[k] = saved[k]; });
      doc.id = id; doc.createdAt = (res && res.commitTime) || new Date().toISOString();
      inquiries.push(doc);
      form.reset();
      renderInquiries();
      result(form, 'ok', T('문의를 보냈습니다'), T('협회가 확인한 뒤 답변을 남깁니다. 답변은 아래 "내가 남긴 문의"에서 볼 수 있습니다.'));
    }, function (err) {
      if (user !== u) return;
      busy(form, false);
      result(form, 'err', T('문의를 보내지 못했습니다'), errorText(err) + ' ' + T('적은 내용은 그대로 남아 있습니다.'));
    });
  }

  /* ---------- 탭 ---------- */
  var TABS = ['profile', 'posts', 'inquiry'];
  function setTab(name, focus) {
    if (TABS.indexOf(name) < 0) name = 'profile';
    tab = name;
    TABS.forEach(function (t) {
      var on = t === name, b = $('mtab-' + t);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      $('member-' + t).hidden = !on;
      if (on && focus) b.focus();
    });
    // 주소도 맞춰 둡니다(새로 고치거나 주소를 나눠도 같은 탭이 열리게). 화면 전환은 일으키지 않습니다.
    try {
      if (/^#member(-|$)/.test(location.hash) && location.hash !== '#member-' + name) history.replaceState(null, '', '#member-' + name);
    } catch (e) { /* 주소를 못 바꿔도 화면은 그대로 씁니다 */ }
  }
  function showHome() {
    gate('home');
    closeEdit();
    closeKid();
    renderWho(); renderFacts(); renderKids(); renderPosts(); renderInquiries(); renderInquiryForm();
    $('mem-held').hidden = active();
    $('mem-staff').hidden = !staff;
    // 탈퇴는 활동 상태인 회원만 스스로 합니다(보안 규칙도 같습니다). 직원은 직원 지정을 먼저 풀어야 합니다.
    var canLeave = !staff && active();
    $('mem-leave').hidden = !canLeave;
    $('mem-leave-staff').hidden = !staff;
    $('mem-leave-held').hidden = staff || active();
    $('mem-leave-text').hidden = !canLeave;
    $('mem-kid-open').hidden = !active();
    setAdminLinks();
    applyWant();
  }
  // 밖에서 온 요청(열어 둘 탭, 미리 골라 둘 문의 분류)을 지금 화면에 맞춥니다.
  function applyWant() {
    if (state === 'signin') { $('mem-signin-why').hidden = want.tab !== 'inquiry' || !$('mem-left').hidden; return; }
    if (state !== 'home') return;
    setTab(want.tab || tab);
    if (want.inquiry && CATS[want.inquiry] && !$('mem-inq-form').hidden) $('mi-cat').value = want.inquiry;
    want.tab = ''; want.inquiry = '';
  }

  /* ---------- 탈퇴 ----------
     본인 확인(구글 로그인 창) → 등록한 자녀와 남긴 문의 삭제 → 탈퇴 기록을 남기며 내 회원 문서 삭제 → 로그인 계정 삭제 순서입니다.
     탈퇴 기록(memberExits)에는 이름, 회원 종류, 가입일, 등록했던 자녀 수, 탈퇴 시각만 남깁니다. 연락처와 출생 연월일은 남기지 않고,
     관리자만 읽을 수 있습니다. 협회는 이 기록을 1년 뒤에 지웁니다(관리자 화면이 지웁니다). */
  function leaveMsg(t) { var m = $('mem-leave-msg'); m.textContent = t || ''; m.hidden = !t; }
  function leave() {
    var u = user, btn = $('mem-leave-go'), kidCount = 0;
    if (!u || staff || !active() || !$('mem-leave-ok').checked) return;
    leaveMsg('');
    btn.disabled = true;
    var stop = function (t) { if (user !== u) return; btn.disabled = !$('mem-leave-ok').checked; leaveMsg(t); };
    u.reauthenticateWithPopup(provider()).then(function () {
      btn.textContent = T('지우는 중');
      return Promise.all([query('members', 'guardian', u.uid), query('inquiries', 'uid', u.uid)]);
    }).then(function (r) {
      kidCount = r[0].length;
      var writes = r[0].map(function (k) { return wDel('members', k.id); }).concat(r[1].map(function (q) { return wDel('inquiries', q.id); }));
      // 한 번에 조금씩 지웁니다(보안 규칙이 한 번의 쓰기 묶음에서 확인할 수 있는 양에 한도가 있습니다).
      var step = function () { return writes.length ? commit(writes.splice(0, 8)).then(step) : null; };
      return step();
    }).then(function () {
      var known = TYPES.map(function (t) { return t[0]; });
      var exit = {
        name: clean(me.name, 60) || '-', types: (me.types || []).filter(function (t) { return known.indexOf(t) >= 0; }),
        kids: Math.min(kidCount, 50), joinedOn: /^\d{4}-\d{2}-\d{2}$/.test(text(me.joinedOn)) ? me.joinedOn : dayOf(me.createdAt)
      };
      // 탈퇴 기록을 남기는 것과 회원 문서를 지우는 것을 한 번의 저장에 담습니다(둘 다 되거나 둘 다 안 됩니다).
      return commit([wSet('memberExits', u.uid, exit, { times: ['leftAt'] }), wDel('members', u.uid)]);
    }).then(function () {
      justLeft = true;
      // 로그인 계정도 지웁니다. 지우지 못하면 로그아웃만 합니다(회원 자료는 이미 지워졌습니다).
      return u['delete']().catch(function () { return auth.signOut(); });
    }).then(function () {
      btn.textContent = T('회원 탈퇴');
    }, function (err) {
      btn.textContent = T('회원 탈퇴');
      var code = (err && err.code) || '';
      if (SIGNIN_QUIET[code]) { stop(''); return; }
      stop(code.indexOf('auth/') === 0 ? signinError(code) : T('탈퇴를 끝내지 못했습니다.') + ' ' + errorText(err));
    });
  }

  function resetForms() {
    ['mem-form', 'mem-kid-form', 'mem-inq-form'].forEach(function (id) {
      var f = $(id);
      f.reset(); clearErrors(f); result(f, '', ''); busy(f, false);
    });
    $('mem-leave').open = false;
    $('mem-leave-ok').checked = false;
    $('mem-leave-go').disabled = true;
    leaveMsg('');
    syncTypeFields();
  }

  /* ---------- 시작 ---------- */
  function bind() {
    $('mem-google').addEventListener('click', signIn);
    $('mem-copy-url').addEventListener('click', copyUrl);
    $('mem-form').addEventListener('submit', submitForm);
    $('mem-form').addEventListener('change', function (ev) { if (ev.target.hasAttribute && ev.target.hasAttribute('data-mtype')) onTypeChange(ev.target); });
    fillDob('mf-birth', 90); fillDob('mc-birth', 25); fillDob('mk-birth', 25);
    $('mf-cancel').addEventListener('click', function () { closeEdit(); });
    $('mem-edit').addEventListener('click', openEdit);
    $('mem-kid-add').addEventListener('click', function () { flash(''); openKid(null); });
    $('mem-kid-form').addEventListener('submit', submitKid);
    $('mk-cancel').addEventListener('click', closeKid);
    $('mem-inq-form').addEventListener('submit', submitInquiry);
    $('mem-leave-ok').addEventListener('change', function () { $('mem-leave-go').disabled = !$('mem-leave-ok').checked; });
    $('mem-leave-go').addEventListener('click', leave);
    $('mem').addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-mem-signout],[data-mtab]') : null;
      if (!t) return;
      if (t.hasAttribute('data-mem-signout')) signOut(); else { flash(''); setTab(t.getAttribute('data-mtab')); }
    });
    $('mem').addEventListener('keydown', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-mtab]') : null;
      if (!t || (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft')) return;
      var i = TABS.indexOf(t.getAttribute('data-mtab'));
      setTab(TABS[(i + (ev.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length], true);
      ev.preventDefault();
    });
  }
  function start() {
    bind();
    gate('loading');
    var broken = function () { gate('failed'); status(T('회원 화면을 준비하지 못했습니다. 화면을 새로 고쳐 주세요.')); };
    if (!FB || !window.firebase || !window.firebase.auth) { broken(); return; }
    try {
      if (!window.firebase.apps || !window.firebase.apps.length) {
        window.firebase.initializeApp({ apiKey: FB.apiKey, authDomain: FB.authDomain, projectId: FB.projectId, appId: FB.appId });
      }
      auth = window.firebase.auth();
      auth.languageCode = APP.lang || 'ko';
    } catch (e) { broken(); return; }
    auth.onAuthStateChanged(onUser, function () { onUser(null); });
  }

  // app.js 가 회원 화면으로 올 때마다 부릅니다. o.tab: 열어 둘 탭, o.inquiry: 미리 골라 둘 문의 분류
  window.KYLA_MEMBER = {
    show: function (o) {
      o = o || {};
      if (o.tab) want.tab = o.tab;
      if (o.inquiry) want.inquiry = o.inquiry;
      if (!started) { started = true; start(); return; }
      if (state === 'failed' && user) { load(); return; }
      applyWant();
    }
  };
})();
