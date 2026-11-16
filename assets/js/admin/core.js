/* ==========================================================================
   KYLA 관리자 화면 (/admin/) : 공통 부분
   로그인, Firestore 와 주고받기, 화면 전환, 그리고 각 화면이 함께 쓰는 부품(표, 수정 창, 막대 그림, 내려받기).

   - 화면 하나는 파일 하나입니다: home.js(대시보드), members.js(회원), eoi.js(참가 의향 회신), admins.js(관리자).
     각 파일이 KYLA_ADMIN.section({...}) 으로 자기를 등록하고, start.js 가 마지막에 시작시킵니다.
   - 누가 무엇을 할 수 있는지는 Firebase 보안 규칙(tools/firestore.rules)이 정합니다. 이 화면의 확인은 안내용입니다.
   - 관리자 이메일은 Firestore 의 admins 컬렉션에만 있습니다. 저장소의 어떤 파일에도 적지 않습니다.
   - DB 에서 온 글(방문자·관리자가 적은 내용)은 textContent 로만 화면에 넣습니다. innerHTML 은 쓰지 않습니다.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = (window.KYLA_DATA && window.KYLA_DATA.config) || {};
  var FB = CFG.firebase && CFG.firebase.projectId && CFG.firebase.apiKey ? CFG.firebase : null;
  var API = 'https://firestore.googleapis.com/v1/';
  var DOCS = FB ? 'projects/' + FB.projectId + '/databases/(default)/documents' : '';
  var LIMIT = 5000;                 // 한 컬렉션에서 한 번에 읽는 최대 건수

  var A = window.KYLA_ADMIN = { sections: [], user: null, email: '', role: '', ui: {}, api: {}, write: {}, store: {} };
  var auth = null;

  /* ---------- 작은 도구 ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  // 부모에 자식들을 붙입니다. 글자는 글자 그대로(textNode), 배열은 풀어서, 빈 값은 건너뜁니다.
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false || c === '') continue;
      if (Array.isArray(c)) { c.forEach(function (x) { add(parent, x); }); continue; }
      parent.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return parent;
  }
  // fk: 화면을 다시 그린 뒤에도 초점을 돌려받을 이름표(keepFocus 참고)
  function button(cls, text, onClick, fk) {
    var b = el('button', cls, text);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    if (fk) b.setAttribute('data-fk', fk);
    return b;
  }
  function num(n) { return (n || 0).toLocaleString('ko-KR'); }
  function svg(cls, d) {
    var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    s.setAttribute('class', cls); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    p.setAttribute('d', d); s.appendChild(p);
    return s;
  }
  // 화면을 다시 그리면 누르던 단추가 사라집니다. 같은 이름표(data-fk)를 가진 새 단추로 초점을 돌려줍니다.
  function keepFocus(fn) {
    var a = document.activeElement, key = a && a.getAttribute ? a.getAttribute('data-fk') : null;
    fn();
    if (!key) return;
    var again = Array.prototype.filter.call(document.querySelectorAll('[data-fk]'), function (n) { return n.getAttribute('data-fk') === key && !n.closest('[hidden]'); })[0];
    if (!again) { again = document.querySelector('.adm-sec:not([hidden]) h1'); if (again) again.tabIndex = -1; }   // 그 단추가 사라졌으면(지운 줄 등) 화면 제목으로
    if (again) again.focus({ preventScroll: true });
  }
  A.$ = $; A.el = el; A.add = add; A.button = button; A.num = num; A.keepFocus = keepFocus;

  /* ---------- 시각: 보는 사람의 시간대와 상관없이 한국 시간으로 ---------- */
  var KST = null;
  try {
    KST = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
  } catch (e) { KST = null; }
  A.time = function (iso) {
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
    return {
      iso: iso, date: p.year + '.' + p.month + '.' + p.day, clock: p.hour + ':' + p.minute,
      ymd: p.year + '-' + p.month + '-' + p.day, ym: p.year + '-' + p.month
    };
  };
  A.today = function () { return A.time(new Date().toISOString()).ymd; };
  A.stampText = function (iso, by) {
    var t = A.time(iso);
    return t ? t.date + ' ' + t.clock + (by ? ', ' + by : '') : '';
  };

  /* ---------- Firestore 값 바꾸기 ---------- */
  function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Math.floor(v) === v ? { integerValue: String(v) } : { doubleValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    if (typeof v === 'object') return { mapValue: { fields: encFields(v) } };
    return { stringValue: String(v) };
  }
  function encFields(o) {
    var f = {};
    Object.keys(o).forEach(function (k) { f[k] = enc(o[k]); });
    return f;
  }
  function dec(v) {
    if (!v || typeof v !== 'object') return null;
    if ('stringValue' in v) return String(v.stringValue);
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('booleanValue' in v) return !!v.booleanValue;
    if ('timestampValue' in v) return String(v.timestampValue);
    if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(dec);
    if ('mapValue' in v) return decFields((v.mapValue && v.mapValue.fields) || {});
    return null;
  }
  function decFields(f) {
    var o = Object.create(null);
    Object.keys(f).forEach(function (k) { o[k] = dec(f[k]); });
    return o;
  }
  // 문서 하나를 평범한 값으로. 항목은 그대로 두고, id 와 판(_updateTime)을 붙입니다.
  function decDoc(doc) {
    var o = decFields(doc.fields || {});
    o.id = String(doc.name || '').split('/').pop();
    o._updateTime = doc.updateTime || '';
    o._createTime = doc.createTime || '';
    return o;
  }
  A.text = function (x) { return typeof x === 'string' ? x : (x === null || x === undefined ? '' : String(x)); };
  A.count = function (x) { return typeof x === 'number' && isFinite(x) && x >= 0 ? Math.floor(x) : null; };

  /* ---------- Firestore 에 묻고 쓰기 (로그인한 사람의 권한으로) ---------- */
  function fail(status, code, message) {
    var e = new Error(message || code || ('HTTP ' + status));
    e.status = status; e.code = code || '';
    return e;
  }
  function call(method, path, body) {
    var u = A.user;
    if (!u) return Promise.reject(fail(401, 'UNAUTHENTICATED'));
    return u.getIdToken().then(function (token) {
      var headers = { Authorization: 'Bearer ' + token };
      if (body) headers['Content-Type'] = 'text/plain';        // Firebase 가 쓰는 방식 그대로
      return fetch(API + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        var er = Array.isArray(data) ? (data.filter(function (x) { return x && x.error; })[0] || {}).error : (data && data.error);
        if (!res.ok || er) throw fail(er && er.code ? Number(er.code) : res.status, er && er.status, er && er.message);
        return data;
      });
    }, function (err) {
      if (err && err.status !== undefined) throw err;
      throw fail(0, 'NETWORK');
    });
  }
  // 문서 하나. 없으면 null
  A.api.get = function (col, id) {
    return call('GET', DOCS + '/' + col + '/' + encodeURIComponent(id)).then(decDoc, function (err) {
      if (err.status === 404) return null;
      throw err;
    });
  };
  // 컬렉션 전체. order 가 있으면 그 항목으로 정렬해서(그 항목이 없는 문서는 빠집니다)
  A.api.list = function (col, order, desc) {
    var q = { from: [{ collectionId: col }], limit: LIMIT };
    if (order) q.orderBy = [{ field: { fieldPath: order }, direction: desc ? 'DESCENDING' : 'ASCENDING' }];
    return call('POST', DOCS + ':runQuery', { structuredQuery: q }).then(function (data) {
      if (!Array.isArray(data)) throw fail(0, 'BAD_RESPONSE');
      return data.filter(function (x) { return x && x.document; }).map(function (x) { return decDoc(x.document); });
    });
  };
  A.api.commit = function (writes) { return call('POST', DOCS + ':commit', { writes: writes }); };

  A.newId = function () {
    var abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', buf = new Uint8Array(20), id = '';
    window.crypto.getRandomValues(buf);
    for (var i = 0; i < buf.length; i++) id += abc.charAt(buf[i] % abc.length);
    return id;
  };
  // 쓰기 한 건 만들기.
  //   data  : 넣을 항목들.  opt.mask : 이번에 바꿀 항목 이름(여기 있고 data 에 없으면 그 항목을 지웁니다). 없으면 문서 전체를 data 로 둡니다.
  //   opt.times : 서버 시각으로 채울 항목 이름.  opt.create : 새 문서(이미 있으면 실패).  opt.base : 읽어 온 판(_updateTime). 그 사이 바뀌었으면 실패
  A.write.set = function (col, id, data, opt) {
    opt = opt || {};
    var w = { update: { name: DOCS + '/' + col + '/' + id, fields: encFields(data) } };
    if (opt.mask) w.updateMask = { fieldPaths: opt.mask };
    if (opt.create) w.currentDocument = { exists: false };
    else if (opt.base) w.currentDocument = { updateTime: opt.base };
    if (opt.times && opt.times.length) {
      w.updateTransforms = opt.times.map(function (f) { return { fieldPath: f, setToServerValue: 'REQUEST_TIME' }; });
    }
    return w;
  };
  A.write.del = function (col, id, base) {
    var w = { delete: DOCS + '/' + col + '/' + id };
    if (base) w.currentDocument = { updateTime: base };
    return w;
  };
  A.errorText = function (err) {
    var code = (err && err.code) || '', status = err && err.status;
    if (code === 'NETWORK' || status === 0) return '인터넷에 연결하지 못했습니다. 연결을 확인한 뒤 다시 해 주세요.';
    if (code === 'FAILED_PRECONDITION' || code === 'ABORTED' || code === 'NOT_FOUND' || code === 'ALREADY_EXISTS' || status === 409 || status === 404) {
      return '그 사이에 다른 관리자가 이 내용을 고쳤거나 지웠습니다. 새로 고친 뒤 다시 해 주세요.';
    }
    if (status === 403) return '이 작업을 할 권한이 없거나, 보안 규칙이 이 내용을 받아 주지 않습니다.';
    if (status === 401) return '로그인이 끝났습니다. 다시 로그인해 주세요.';
    if (status === 429 || code === 'RESOURCE_EXHAUSTED') return '오늘 쓸 수 있는 무료 사용량을 넘었습니다. 내일 다시 해 주세요.';
    return '처리하지 못했습니다. 잠시 뒤 다시 해 주세요.';
  };

  /* ---------- 읽어 온 자료 보관 (화면을 오갈 때 다시 읽지 않게) ---------- */
  var ORDER = { eoiReplies: ['submittedAt', true], members: ['createdAt', true], admins: null };
  var cache = {};
  A.store.load = function (col, force) {
    var c = cache[col];
    if (c && c.list && !force) return Promise.resolve(c.list);
    if (c && c.pending) return c.pending;
    var o = ORDER[col], u = A.user;
    var p = A.api.list(col, o && o[0], o && o[1]).then(function (list) {
      if (A.user !== u) throw fail(401, 'UNAUTHENTICATED');
      cache[col] = { list: list, capped: list.length >= LIMIT, at: Date.now() };
      return list;
    }, function (err) {
      if (cache[col] && cache[col].pending === p) delete cache[col].pending;
      throw err;
    });
    cache[col] = { list: c && c.list, pending: p };
    return p;
  };
  A.store.all = function (col) { return (cache[col] && cache[col].list) || []; };
  A.store.capped = function (col) { return !!(cache[col] && cache[col].capped); };
  // 저장한 뒤 화면의 자료도 같이 바꿉니다. doc 이 null 이면 목록에서 뺍니다.
  A.store.put = function (col, id, doc) {
    var c = cache[col];
    if (!c || !c.list) return;
    var i = -1;
    c.list.forEach(function (x, n) { if (x.id === id) i = n; });
    if (doc === null) { if (i >= 0) c.list.splice(i, 1); return; }
    if (i >= 0) c.list[i] = doc; else c.list.unshift(doc);
  };
  A.store.clear = function () { cache = {}; };

  // 관리자가 고친 문서에 남기는 표시: 고친 사람(서버 시각은 쓰기에서 따로 채웁니다)
  A.stamp = function (data) { data.updatedBy = A.email; return data; };
  // 저장 결과의 시각을 화면 자료에 반영
  A.committed = function (doc, result, times) {
    var t = (result && result.commitTime) || new Date().toISOString();
    (times || []).forEach(function (k) { doc[k] = t; });
    doc._updateTime = (result && result.writeResults && result.writeResults[0] && result.writeResults[0].updateTime) || t;
    if (!doc._createTime) doc._createTime = t;
    return doc;
  };

  /* ---------- 휴지통: 옮기기, 되돌리기, 완전히 삭제 (회원과 회신이 함께 씁니다) ----------
     옮기면 문서에 deletedAt(서버 시각), deletedBy 가 붙고, 되돌리면 그 두 항목을 지웁니다. */
  A.trash = {
    move: function (col, doc) {
      var data = A.stamp({ deletedBy: A.email }), times = ['deletedAt', 'updatedAt'];
      return A.api.commit([A.write.set(col, doc.id, data, { mask: ['deletedBy', 'updatedBy'], times: times, base: doc._updateTime })]).then(function (res) {
        doc.deletedBy = data.deletedBy; doc.updatedBy = data.updatedBy;
        A.store.put(col, doc.id, A.committed(doc, res, times));
      });
    },
    restore: function (col, doc) {
      var data = A.stamp({});
      return A.api.commit([A.write.set(col, doc.id, data, { mask: ['deletedAt', 'deletedBy', 'updatedBy'], times: ['updatedAt'], base: doc._updateTime })]).then(function (res) {
        delete doc.deletedAt; delete doc.deletedBy; doc.updatedBy = data.updatedBy;
        A.store.put(col, doc.id, A.committed(doc, res, ['updatedAt']));
      });
    },
    purge: function (col, doc) {
      return A.api.commit([A.write.del(col, doc.id, doc._updateTime)]).then(function () { A.store.put(col, doc.id, null); });
    }
  };

  /* ---------- 알림, 되묻기 ---------- */
  var toastTimer = 0;
  A.ui.toast = function (text, isError) {
    var t = $('adm-toast');
    t.textContent = text || '';
    t.classList.toggle('is-error', !!isError);
    t.classList.toggle('is-on', !!text);
    clearTimeout(toastTimer);
    if (text) toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, isError ? 9000 : 5000);
  };
  var askDone = null;
  A.ui.ask = function (o) {
    var d = $('adm-ask'), yes = $('adm-ask-yes');
    $('adm-ask-title').textContent = o.title;
    $('adm-ask-text').textContent = o.text || '';
    yes.textContent = o.yes || '확인';
    yes.className = 'btn btn--sm' + (o.danger ? '' : ' btn--ink');
    return new Promise(function (resolve) {
      askDone = function (v) { askDone = null; if (d.open) d.close(); resolve(v); };
      d.showModal();
      $('adm-ask-no').focus();
    });
  };

  /* ---------- 추가·수정 창 ---------- */
  var dlg = { dirty: null, busy: false };
  A.ui.open = function (o) {
    var d = $('adm-dlg'), foot = $('adm-dlg-foot'), body = $('adm-dlg-body');
    $('adm-dlg-title').textContent = o.title;
    body.textContent = ''; foot.textContent = '';
    add(body, o.body);
    var left = el('div', 'adm-dlg__left'), right = el('div', 'adm-dlg__right');
    (o.actions || []).forEach(function (a) {
      var b = button(a.cls || 'btn btn--sm', a.label, a.onClick);
      (a.left ? left : right).appendChild(b);
    });
    add(foot, left, right);
    dlg.dirty = o.dirty || null;
    A.ui.dialogError('');
    A.ui.busy(false);
    d.showModal();
    body.scrollTop = 0;
    if (o.focus) o.focus();
  };
  A.ui.close = function (force) {
    var d = $('adm-dlg');
    if (!d.open || dlg.busy) return;
    if (!force && dlg.dirty && dlg.dirty()) {
      A.ui.ask({ title: '저장하지 않고 닫을까요?', text: '고친 내용이 사라집니다.', yes: '닫기', danger: true }).then(function (yes) {
        if (yes) { dlg.dirty = null; d.close(); }
      });
      return;
    }
    dlg.dirty = null;
    d.close();
  };
  A.ui.dialogError = function (text) { var m = $('adm-dlg-msg'); m.textContent = text || ''; m.hidden = !text; };
  A.ui.busy = function (on) {
    dlg.busy = !!on;
    Array.prototype.forEach.call($('adm-dlg').querySelectorAll('button'), function (b) { b.disabled = !!on; });
  };

  /* ---------- 입력 양식 ----------
     fields: [{ key, label, type, options, required, max, hint, wide, min, placeholder, build }]
     type: text(기본) | email | tel | date | number | textarea | select | checks | static | custom(build 가 직접 만듦) */
  var fieldSerial = 0;
  A.ui.form = function (fields, values) {
    var node = el('div', 'adm-form'), readers = [];
    fields.forEach(function (f) {
      if (f.type === 'heading') { node.appendChild(el('h3', 'adm-form__h', f.label)); return; }
      var id = 'adm-f-' + (++fieldSerial), wrap = el('div', 'field' + (f.wide ? ' adm-form__wide' : '')), v = values[f.key];
      var input = null, err = el('p', 'field__err');
      err.hidden = true;
      if (f.type === 'custom') {
        var made = f.build(values, id);
        add(wrap, made.node);
        if (made.read) readers.push(function (out) { return made.read(out); });
        node.appendChild(wrap);
        return;
      }
      if (f.type === 'checks') {
        var fs = el('fieldset', 'adm-form__set'), boxes = [];
        add(fs, el('legend', 'field__label', f.label));
        var row = el('div', 'checks');
        f.options.forEach(function (o) {
          var lab = el('label', 'check'), cb = el('input');
          cb.type = 'checkbox'; cb.value = o[0]; cb.checked = Array.isArray(v) && v.indexOf(o[0]) >= 0;
          add(lab, cb, el('span', '', o[1])); row.appendChild(lab); boxes.push(cb);
        });
        add(fs, row); add(wrap, fs);
        readers.push(function (out) { out[f.key] = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); return null; });
        node.appendChild(wrap);
        return;
      }
      var lab2 = el('label', 'field__label');
      lab2.htmlFor = id;
      add(lab2, el('span', '', f.label), f.required ? el('em', '', '필수') : null);
      if (f.type === 'static') {
        var st = el('p', 'adm-form__static', A.text(v));
        add(wrap, el('span', 'field__label', f.label), st);
        node.appendChild(wrap);
        return;
      }
      if (f.type === 'select') {
        input = el('select', 'input');
        f.options.forEach(function (o) { var op = el('option', '', o[1]); op.value = o[0]; input.appendChild(op); });
        input.value = A.text(v);
        if (input.selectedIndex < 0) input.selectedIndex = 0;
      } else if (f.type === 'textarea') {
        input = el('textarea', 'input');
        input.rows = f.rows || 3;
        input.value = A.text(v);
      } else {
        input = el('input', 'input');
        input.type = f.type || 'text';
        if (f.type === 'number') { input.inputMode = 'numeric'; input.min = f.min !== undefined ? f.min : 0; if (f.maxValue) input.max = f.maxValue; }
        input.value = v === null || v === undefined ? '' : String(v);
        if (f.placeholder) input.placeholder = f.placeholder;
      }
      input.id = id;
      if (f.max) input.maxLength = f.max;
      if (f.required) input.required = true;
      input.setAttribute('aria-describedby', id + '-e' + (f.hint ? ' ' + id + '-h' : ''));
      err.id = id + '-e';
      add(wrap, lab2, input);
      if (f.hint) { var h = el('p', 'field__hint', f.hint); h.id = id + '-h'; wrap.appendChild(h); }
      wrap.appendChild(err);
      readers.push(function (out) {
        var val = input.value;
        if (f.type !== 'textarea') val = val.trim(); else val = val.replace(/\s+$/, '');
        var msg = '';
        if (f.required && !val) msg = f.label + '을(를) 적어 주세요.';
        else if (f.max && val.length > f.max) msg = f.max + '자까지 적을 수 있습니다.';
        else if (f.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) msg = '이메일 주소 형식을 확인해 주세요.';
        else if (f.type === 'date' && val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) msg = '날짜를 다시 골라 주세요.';
        else if (f.check) msg = f.check(val) || '';
        err.textContent = msg; err.hidden = !msg;
        if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
        out[f.key] = val;
        return msg ? input : null;
      });
      node.appendChild(wrap);
    });
    function read() {
      var out = {}, first = null;
      readers.forEach(function (r) { var bad = r(out); if (bad && !first) first = bad; });
      if (first) first.focus();
      return { ok: !first, data: out };
    }
    function snapshot() {
      var out = {};
      Array.prototype.forEach.call(node.querySelectorAll('input,select,textarea'), function (i, n) {
        out[n] = i.type === 'checkbox' ? i.checked : i.value;
      });
      return JSON.stringify(out);
    }
    var first = snapshot();
    return {
      node: node, read: read,
      dirty: function () { return snapshot() !== first; },
      focus: function () { var i = node.querySelector('input:not([type=checkbox]),select,textarea'); if (i) i.focus(); }
    };
  };

  /* ---------- 걸러 보기에 쓰는 부품 ---------- */
  A.ui.search = function (label, value, onInput) {
    var wrap = el('label', 'adm-filter adm-filter--search'), i = el('input', 'input');
    i.type = 'search'; i.value = value || ''; i.placeholder = label;
    var timer = 0;
    i.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { onInput(i.value.trim()); }, 120); });
    add(wrap, el('span', 'adm-filter__label', '찾기'), i);
    return wrap;
  };
  A.ui.select = function (label, options, value, onChange) {
    var wrap = el('label', 'adm-filter'), s = el('select', 'input');
    add(wrap, el('span', 'adm-filter__label', label));
    options.forEach(function (o) { var op = el('option', '', o[1]); op.value = o[0]; s.appendChild(op); });
    s.value = value || '';
    if (s.selectedIndex < 0) s.selectedIndex = 0;
    s.addEventListener('change', function () { onChange(s.value); });
    add(wrap, s);
    return wrap;
  };
  // 여러 개를 켜고 끄는 단추들. selected 는 켜진 값의 배열
  A.ui.chips = function (label, options, selected, onChange) {
    var wrap = el('div', 'adm-chips');
    wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', label);
    add(wrap, el('span', 'adm-filter__label', label));
    options.forEach(function (o) {
      var b = button('adm-chip', o[1], function () {
        var i = selected.indexOf(o[0]);
        if (i >= 0) selected.splice(i, 1); else selected.push(o[0]);
        b.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true');
        onChange(selected);
      });
      b.setAttribute('aria-pressed', selected.indexOf(o[0]) >= 0 ? 'true' : 'false');
      wrap.appendChild(b);
    });
    return wrap;
  };
  // 두세 가지 보기 가운데 하나 고르기
  A.ui.tabs = function (label, options, value, onChange) {
    var wrap = el('div', 'adm-tabs');
    wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', label);
    options.forEach(function (o) {
      var b = button('adm-tab', o[1], function () { onChange(o[0]); });
      b.setAttribute('aria-pressed', o[0] === value ? 'true' : 'false');
      b.setAttribute('data-fk', 'tab:' + label + ':' + o[0]);
      wrap.appendChild(b);
    });
    return wrap;
  };
  // 이메일은 줄이 모자라면 @ 앞에서 바뀌게 합니다.
  A.ui.email = function (v) {
    var i = v.indexOf('@');
    return i < 1 ? v : [v.slice(0, i), el('wbr'), v.slice(i)];
  };
  A.ui.tag = function (text, tone) {
    var t = el('span', 'adm-tag');
    if (tone) add(t, el('i', 'adm-dot adm-dot--' + tone));
    add(t, text);
    return t;
  };

  /* ---------- 표 ----------
     columns: [{ key, label, text(row), node(row), sort(row), num, cls, head }]   actions(row) 는 맨 오른쪽 칸에 들어갈 단추들
     head 인 열이 그 줄의 이름입니다(없으면 첫 열). 좁은 화면에서 옆으로 밀어도 이 열은 남고, onOpen 이 있으면 눌러서 열 수 있습니다. */
  A.ui.sortRows = function (rows, columns, key, dir) {
    var col = columns.filter(function (c) { return c.key === key; })[0];
    if (!col) return rows;
    var get = col.sort || col.text, m = dir === 'desc' ? -1 : 1;
    return rows.map(function (r, i) { return [get(r), i, r]; }).sort(function (a, b) {
      var x = a[0], y = b[0];
      if (x === null || x === undefined || x === '') return (y === null || y === undefined || y === '') ? a[1] - b[1] : 1;   // 빈 값은 늘 아래
      if (y === null || y === undefined || y === '') return -1;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * m || a[1] - b[1];
      return String(x).localeCompare(String(y), 'ko') * m || a[1] - b[1];
    }).map(function (t) { return t[2]; });
  };
  A.ui.table = function (o) {
    var wrap = el('div', 'adm-tablewrap'), table = el('table', 'adm-table'), thead = el('thead'), tbody = el('tbody'), hr = el('tr');
    var headAt = 0;
    o.columns.forEach(function (c, i) { if (c.head) headAt = i; });
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', o.caption);
    add(table, el('caption', 'adm-sr', o.caption));
    o.columns.forEach(function (c, ci) {
      var th = el('th', (c.num ? 'is-num ' : '') + (ci === headAt ? 'is-rowhead ' : '') + (c.cls || ''));
      th.scope = 'col';
      if (o.onSort && (c.sort || c.text)) {
        var on = o.sort && o.sort.key === c.key;
        var b = button('adm-th', c.label, function () { o.onSort(c.key); });
        b.setAttribute('data-fk', 'sort:' + o.caption + ':' + c.key);
        if (on) { th.setAttribute('aria-sort', o.sort.dir === 'desc' ? 'descending' : 'ascending'); add(b, svg('adm-th__dir', o.sort.dir === 'desc' ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6')); }
        th.appendChild(b);
      } else {
        th.textContent = c.label;
      }
      hr.appendChild(th);
    });
    if (o.actions) { var ta = el('th', 'adm-table__act'); ta.scope = 'col'; add(ta, el('span', 'adm-sr', '작업')); hr.appendChild(ta); }
    thead.appendChild(hr);
    var size = o.size || 50, page = Math.max(1, Math.min(o.page || 1, Math.ceil(o.rows.length / size) || 1));
    o.rows.slice((page - 1) * size, page * size).forEach(function (r) {
      var tr = el('tr');
      if (o.rowClass) { var rc = o.rowClass(r); if (rc) tr.className = rc; }
      o.columns.forEach(function (c, i) {
        var td = el(i === headAt ? 'th' : 'td', (c.num ? 'is-num ' : '') + (i === headAt ? 'is-rowhead ' : '') + (c.cls || '')), into = td;
        if (i === headAt) {
          td.scope = 'row';
          if (o.onOpen) { into = button('adm-rowlink', null, function () { o.onOpen(r); }, o.rowKey ? 'open:' + o.caption + ':' + o.rowKey(r) : null); td.appendChild(into); }
        }
        if (c.node) add(into, c.node(r)); else { var t = c.text(r); into.textContent = t === null || t === undefined ? '' : (typeof t === 'number' ? num(t) : t); }
        tr.appendChild(td);
      });
      if (o.actions) {
        var act = el('td', 'adm-table__act');
        o.actions(r).forEach(function (a, n) {
          if (o.rowKey && a.setAttribute) a.setAttribute('data-fk', 'act' + n + ':' + o.caption + ':' + o.rowKey(r));
          add(act, n ? ' ' : '', a);
        });
        tr.appendChild(act);
      }
      tbody.appendChild(tr);
    });
    add(table, thead, tbody);
    if (o.foot) {
      var tfoot = el('tfoot'), fr = el('tr');
      o.foot.forEach(function (v, i) {
        var td = el(i === headAt ? 'th' : 'td', (o.columns[i] && o.columns[i].num ? 'is-num ' : '') + (i === headAt ? 'is-rowhead' : ''));
        if (i === headAt) td.scope = 'row';
        td.textContent = typeof v === 'number' ? num(v) : (v || '');
        fr.appendChild(td);
      });
      if (o.actions) fr.appendChild(el('td', 'adm-table__act'));
      tfoot.appendChild(fr); table.appendChild(tfoot);
    }
    wrap.appendChild(table);
    var out = el('div', 'adm-tablebox');
    if (!o.rows.length) {
      var empty = el('div', 'adm-empty');
      add(empty, el('strong', '', (o.empty && o.empty.title) || '보여 줄 내용이 없습니다'), el('span', '', (o.empty && o.empty.text) || ''));
      add(out, empty);
      return out;
    }
    add(out, wrap);
    if (o.rows.length > size && o.onPage) {
      var pager = el('div', 'adm-pager'), last = Math.ceil(o.rows.length / size);
      var prev = button('linkbtn', '이전', function () { o.onPage(page - 1); }), next = button('linkbtn', '다음', function () { o.onPage(page + 1); });
      prev.setAttribute('data-fk', 'page:prev'); next.setAttribute('data-fk', 'page:next');
      prev.disabled = page <= 1; next.disabled = page >= last;
      add(pager, prev, el('span', '', num((page - 1) * size + 1) + '–' + num(Math.min(page * size, o.rows.length)) + ' / ' + num(o.rows.length)), next);
      out.appendChild(pager);
    }
    return out;
  };

  /* ---------- 숫자와 그림 ---------- */
  // 주요 숫자 줄. items: [{ label, value, note, href }]
  A.ui.tiles = function (items) {
    var dl = el('dl', 'adm-tiles');
    items.forEach(function (t) {
      var box = el('div', 'adm-tile'), dd = el('dd', '', typeof t.value === 'number' ? num(t.value) : t.value);
      if (t.unit) add(dd, el('small', '', t.unit));
      add(box, el('dt', '', t.label), dd);
      if (t.note) add(box, el('dd', 'adm-tile__note', t.note));
      if (t.onGo) add(box, add(el('dd', 'adm-tile__note'), button('linkbtn', t.go || '보기', t.onGo)));
      dl.appendChild(box);
    });
    return dl;
  };
  A.ui.card = function (title, body, note) {
    var c = el('section', 'adm-card');
    add(c, el('h3', 'adm-card__h', title), note ? el('p', 'adm-card__note', note) : null, body);
    return c;
  };
  // 가로 막대 목록: 이름, 막대, 숫자. items: [{ label, value, sub }]  한 계열이라 색은 하나만 씁니다.
  A.ui.bars = function (items, o) {
    o = o || {};
    var ul = el('ul', 'adm-bars'), max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1])), unit = o.unit || '';
    if (!items.length) return el('p', 'adm-none', o.none || '아직 자료가 없습니다.');
    items.forEach(function (it) {
      var li = el('li', 'adm-bars__row'), track = el('span', 'adm-bars__track'), bar = el('span', 'adm-bars__bar');
      bar.style.width = (it.value / max * 100) + '%';
      if (it.value > 0) track.appendChild(bar);
      li.tabIndex = 0;
      li.setAttribute('data-tip', it.label + ': ' + num(it.value) + unit + (it.sub ? ' (' + it.sub + ')' : ''));
      add(li, el('span', 'adm-bars__name', it.label), track, el('span', 'adm-bars__val', num(it.value) + unit));
      ul.appendChild(li);
    });
    return ul;
  };
  // 세로 막대(시간 흐름). items: [{ label, value, long }]  값은 가장 큰 것과 마지막 것만 막대 위에 적고, 나머지는 가리키면 보입니다.
  A.ui.columns = function (items, o) {
    o = o || {};
    var box = el('div', 'adm-colchart'), plot = el('div', 'adm-colchart__plot'), unit = o.unit || '';
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1])), peak = -1;
    items.forEach(function (it, i) { if (it.value === max && it.value > 0 && peak < 0) peak = i; });
    plot.style.gridTemplateColumns = 'repeat(' + items.length + ', minmax(0, 1fr))';
    items.forEach(function (it, i) {
      var col = el('div', 'adm-colchart__col'), bar = el('span', 'adm-colchart__bar');
      col.tabIndex = 0;
      col.setAttribute('data-tip', (it.long || it.label) + ': ' + num(it.value) + unit);
      bar.style.height = (it.value / max * 100) + '%';
      var stack = el('span', 'adm-colchart__stack');
      if (it.value > 0 && (i === peak || i === items.length - 1)) add(stack, el('span', 'adm-colchart__val', num(it.value)));
      if (it.value > 0) stack.appendChild(bar);
      add(col, stack, el('span', 'adm-colchart__x', it.label));
      plot.appendChild(col);
    });
    box.appendChild(plot);
    var det = el('details', 'adm-colchart__table'), tb = el('table', 'adm-table adm-table--mini'), body = el('tbody');
    add(det, el('summary', '', '표로 보기'));
    items.forEach(function (it) { var tr = el('tr'); add(tr, el('th', '', it.long || it.label), el('td', 'is-num', num(it.value) + unit)); body.appendChild(tr); });
    add(tb, body); add(det, tb); box.appendChild(det);
    return box;
  };
  // 값별로 세기. list 의 각 항목에서 key(item) 이 돌려준 값(또는 값들)마다 건수를 셉니다.
  A.countBy = function (list, key) {
    var m = Object.create(null);
    list.forEach(function (x) {
      var k = key(x);
      (Array.isArray(k) ? k : [k]).forEach(function (v) { if (v !== null && v !== undefined && v !== '') m[v] = (m[v] || 0) + 1; });
    });
    return m;
  };

  /* ---------- 가리키면 나오는 설명 ---------- */
  function tipShow(target) {
    var tip = $('adm-tip');
    tip.textContent = target.getAttribute('data-tip');
    tip.hidden = false;
    var r = target.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    var x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, document.documentElement.clientWidth - w - 8));
    var y = r.top - h - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function tipTarget(ev) { return ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null; }
  document.addEventListener('pointerover', function (ev) { var t = tipTarget(ev); if (t) tipShow(t); });
  document.addEventListener('pointerout', function (ev) { if (tipTarget(ev)) $('adm-tip').hidden = true; });
  document.addEventListener('focusin', function (ev) { var t = tipTarget(ev); if (t) tipShow(t); });
  document.addEventListener('focusout', function (ev) { if (tipTarget(ev)) $('adm-tip').hidden = true; });
  window.addEventListener('scroll', function () { $('adm-tip').hidden = true; }, true);

  /* ---------- 엑셀용 파일(CSV) ---------- */
  // 엑셀이 수식으로 읽을 수 있는 글자로 시작하면 앞에 작은따옴표를 붙여 글자로만 읽히게 합니다.
  function cell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  A.ui.download = function (name, head, rows) {
    var file = name + '-' + A.today().replace(/-/g, '') + '.csv';
    var lines = [head.map(cell).join(',')].concat(rows.map(function (r) { return r.map(cell).join(','); }));
    var url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
    var a = el('a');
    a.href = url; a.download = file; a.hidden = true;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    A.ui.toast(num(rows.length) + '건을 ' + file + ' 파일로 내려받았습니다. 엑셀이나 구글 스프레드시트에서 열 수 있습니다.');
    return file;
  };

  /* ---------- 화면 등록과 전환 ----------
     section({ id, title, masterOnly, needs: [컬렉션], badge(): 숫자, render(root) }) */
  A.section = function (def) { A.sections.push(def); };
  var current = null;
  function visibleSections() { return A.sections.filter(function (s) { return !s.masterOnly || A.role === 'master'; }); }
  function buildNav() {
    var nav = $('adm-nav'), ul = el('ul');
    nav.textContent = '';
    visibleSections().forEach(function (s) {
      var li = el('li'), a = el('a', 'adm-nav__a', s.title);
      a.href = '#' + s.id;
      if (current && current.id === s.id) a.setAttribute('aria-current', 'page');
      var n = s.badge ? s.badge() : 0;
      if (n) add(a, el('span', 'adm-nav__n', num(n)));
      li.appendChild(a); ul.appendChild(li);
    });
    nav.appendChild(ul);
  }
  function sectionRoot(s) {
    var id = 'adm-s-' + s.id, root = $(id);
    if (!root) { root = el('section', 'adm-sec'); root.id = id; $('main').appendChild(root); }
    return root;
  }
  // 지금 화면을 다시 그립니다. 자료가 아직 없으면 먼저 읽어 옵니다.
  A.render = function (focusHeading) {
    var s = current, u = A.user;
    if (!s || !u) return;
    visibleSections().forEach(function (x) { sectionRoot(x).hidden = x.id !== s.id; });
    var root = sectionRoot(s), needs = s.needs || [];
    var ready = needs.every(function (c) { return cache[c] && cache[c].list; });
    if (!ready && root.firstChild && root.getAttribute('data-drawn')) {
      root.classList.add('is-stale');           // 새로 고침: 앞의 화면을 흐리게 둔 채 기다립니다
    } else if (!ready) {
      root.textContent = '';
      add(root, el('h1', 't-2', s.title), el('p', 'adm-loading', '자료를 불러오고 있습니다.'));
    }
    Promise.all(needs.map(function (c) { return A.store.load(c); })).then(function () {
      if (A.user !== u || current !== s) return;
      keepFocus(function () {
        root.textContent = '';
        root.classList.remove('is-stale');
        root.setAttribute('data-drawn', '1');
        s.render(root);
        buildNav();
      });
      if (focusHeading) { var h = root.querySelector('h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
    }).catch(function (err) {
      if (A.user !== u || current !== s) return;
      if (err && err.status === 401) { A.signOut(); return; }
      if (err && err.status === 403) { verify(); return; }
      root.textContent = '';
      root.classList.remove('is-stale'); root.removeAttribute('data-drawn');
      var p = el('p', 'adm-loading is-error', '자료를 불러오지 못했습니다. ' + A.errorText(err));
      add(root, el('h1', 't-2', s.title), p, button('btn btn--sm btn--ghost', '다시 시도', function () { A.render(); }));
    });
    buildNav();
  };
  // 모든 자료를 다시 읽어 옵니다.
  A.reload = function () {
    var s = current;
    if (!s) return;
    (s.needs || []).forEach(function (c) { if (cache[c]) delete cache[c].list; });
    A.render();
  };
  function route(focusHeading) {
    var id = (location.hash || '').replace(/^#/, ''), list = visibleSections();
    current = list.filter(function (s) { return s.id === id; })[0] || list[0];
    window.scrollTo(0, 0);
    A.render(focusHeading);
  }
  A.go = function (id) { if (location.hash === '#' + id) route(true); else location.hash = '#' + id; };
  window.addEventListener('hashchange', function () { if (A.user && A.role) route(true); });

  /* ---------- 들어오기 전 화면: 확인하는 중, 로그인, 권한 없음 ---------- */
  function gate(name, focus) {
    $('adm-gates').hidden = name === 'app';
    $('adm-app').hidden = name !== 'app';
    ['loading', 'signin', 'denied'].forEach(function (n) { $('adm-' + n).hidden = n !== name; });
    if (name === 'app' || focus === false) return;
    var h = $('adm-' + name).querySelector('h1');
    if (h) h.focus();
  }
  function loadingText(t) { $('adm-loading').querySelector('p').textContent = t; }
  // 로그인 창에서 생긴 문제 안내. 이미 다른 계정으로 들어와 있으면 권한 안내 화면 아래에 보여 줍니다.
  function signinMsg(t) {
    ['adm-signin-msg', 'adm-denied-msg'].forEach(function (id) { var m = $(id); m.textContent = t || ''; m.hidden = !t; });
  }
  function renderWho() {
    $('adm-who').hidden = !A.user;
    $('adm-email').textContent = A.user ? A.email + (A.role === 'master' ? ' (마스터)' : '') : '';
  }

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
  A.signOut = function () { if (auth) auth.signOut().catch(function () {}); };

  function setDenied(state) {
    var title = $('adm-denied-title'), body = $('adm-denied-text');
    body.textContent = '';
    signinMsg('');
    if (state === 'none') {
      title.textContent = '이 계정에는 관리자 권한이 없습니다';
      add(body, el('strong', '', A.email), ' 계정은 관리자 명단에 없습니다. 마스터 관리자에게 등록을 요청하거나, 다른 계정으로 로그인해 주세요.');
    } else if (state === 'blocked') {
      title.textContent = '관리자 권한을 확인하지 못했습니다';
      body.textContent = 'Firebase 보안 규칙이 아직 게시되지 않았을 수 있습니다. Firebase 콘솔의 Firestore > 규칙에 협회 보안 규칙을 붙여 넣고 게시한 뒤 다시 확인해 주세요.';
    } else {
      title.textContent = '관리자 권한을 확인하지 못했습니다';
      body.textContent = '인터넷 연결을 확인한 뒤 다시 확인해 주세요.';
    }
    $('adm-recheck').hidden = state === 'none';
    gate('denied');
  }
  // 관리자 명단에 있는지 확인하고, 있으면 화면을 엽니다. 명단의 문서 ID 는 소문자 이메일입니다.
  function verify() {
    var u = A.user;
    if (!u) return;
    loadingText('관리자 권한을 확인하고 있습니다.');
    gate('loading', false);
    A.api.get('admins', A.email).then(function (doc) {
      if (A.user !== u) return;                  // 그 사이에 로그아웃했거나 계정을 바꿈
      if (!doc) { A.role = ''; setDenied('none'); return; }
      A.role = doc.role === 'master' ? 'master' : 'admin';
      renderWho();
      gate('app');
      route(true);
    }, function (err) {
      if (A.user !== u) return;
      A.role = '';
      setDenied(err && err.status === 403 ? 'blocked' : 'error');
    });
  }
  function onUser(u) {
    A.user = u || null;
    A.email = u ? String(u.email || '').toLowerCase() : '';
    A.role = '';
    current = null;
    A.store.clear();
    $('main').textContent = '';
    $('adm-nav').textContent = '';
    if ($('adm-dlg').open) { dlg.busy = false; dlg.dirty = null; $('adm-dlg').close(); }
    if ($('adm-ask').open) $('adm-ask').close();
    A.ui.toast('');
    renderWho();
    if (!A.user) { loadingText('로그인 상태를 확인하고 있습니다.'); signinMsg(''); gate('signin'); return; }
    verify();
  }

  /* ---------- 시작 (start.js 가 부릅니다) ---------- */
  A.start = function () {
    $('adm-google').addEventListener('click', signIn);
    $('adm-switch').addEventListener('click', signIn);
    $('adm-recheck').addEventListener('click', verify);
    $('adm-signout').addEventListener('click', A.signOut);
    $('adm-dlg-x').addEventListener('click', function () { A.ui.close(); });
    $('adm-dlg').addEventListener('cancel', function (ev) { ev.preventDefault(); A.ui.close(); });      // Esc
    $('adm-dlg-form').addEventListener('submit', function (ev) { ev.preventDefault(); });
    $('adm-ask-yes').addEventListener('click', function () { if (askDone) askDone(true); });
    $('adm-ask-no').addEventListener('click', function () { if (askDone) askDone(false); });
    $('adm-ask').addEventListener('cancel', function (ev) { ev.preventDefault(); if (askDone) askDone(false); });

    var broken = function () {
      gate('signin');
      $('adm-google').disabled = true;
      signinMsg('관리자 화면을 준비하지 못했습니다. 화면을 새로 고쳐 주세요.');
    };
    if (!FB || !window.firebase || !window.firebase.auth || !window.HTMLDialogElement) { broken(); return; }
    try {
      window.firebase.initializeApp({ apiKey: FB.apiKey, authDomain: FB.authDomain, projectId: FB.projectId, appId: FB.appId });
      auth = window.firebase.auth();
      auth.languageCode = 'ko';
    } catch (e) { broken(); return; }
    auth.onAuthStateChanged(onUser, function () { onUser(null); });
  };
})();
