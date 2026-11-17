/* ==========================================================================
   관리자 화면 : 회원
   Firestore 의 members 컬렉션(회원 명부)을 표로 보고, 거르고, 집계하고, 추가·수정·삭제합니다.

   회원 종류는 선수·학부모·지도자·직원·일반 다섯 가지이고, 한 사람이 여러 종류일 수 있습니다.
   문서의 types 에는 선수·학부모·지도자·일반만 적습니다. 직원은 곧 관리자라서 따로 적지 않고,
   관리자 명단(admins)에 그 회원의 이메일이 있으면 직원으로 봅니다. 그래서 직원 표시를 켜고 끄는 일은
   관리자 명단을 고치는 일이고, 마스터만 할 수 있습니다(보안 규칙도 그렇게 막습니다).

   가입하면 바로 활동 회원입니다(승인 단계가 없습니다). 시합에 참가하는 회원에게는 협회가 '시합 참가 권한'을
   따로 켜 줍니다. 선수는 대부분 미성년이라 생년월일과 집 주소는 받지 않고, 연락처는 보호자 것을 적습니다.
   아래 종류·상태 값은 tools/firestore.rules 의 허용 값과 같아야 합니다.

   회원 문서가 생기는 길은 세 가지입니다(문서의 source).
     · 협회 입력: 관리자가 이 화면에서 넣은 회원. source 가 없습니다.
     · 직접 가입(self): 회원 화면(#member)에서 구글 계정으로 가입한 회원. 문서 ID 가 그 계정의 uid 입니다.
     · 보호자 등록(guardian): 만 14세 미만 선수. 보호자가 회원 화면에서 등록했고, guardian 이 보호자의 uid 입니다.
   시합 소식은 로그인한 계정의 문서에 시합 참가 권한이 있어야 보입니다. 자녀는 로그인하지 않으므로,
   자녀에게 권한을 켜면 보호자 계정의 권한도 함께 켭니다(끌 때는 따로 끕니다. 다른 자녀가 참가할 수 있어서입니다).

   회원이 만든 문서(직접 가입·보호자 등록)는 그 회원이 읽을 수 있습니다. 그래서 그런 문서에는
     · 협회 메모를 적지 않고, 관리자만 읽는 memberNotes/{회원 문서 ID} 에 따로 둡니다.
     · 고친 사람을 이메일 대신 로그인 계정의 고유 번호(uid)로 남깁니다(직원 이메일이 회원에게 보이지 않게).
   보안 규칙도 그렇게만 받아 줍니다. 관리자가 넣은 회원 문서는 지금까지처럼 문서 안에 메모와 이메일을 남깁니다.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.KYLA_ADMIN, el = A.el, add = A.add, num = A.num, text = A.text;
  var COL = 'members', ADMINS = 'admins', NOTES = 'memberNotes';

  var TYPES = [['player', '선수'], ['parent', '학부모'], ['coach', '지도자'], ['staff', '직원'], ['general', '일반']];
  var OWN = ['player', 'parent', 'coach', 'general'];                 // 문서에 적는 종류(직원은 관리자 명단으로 정해집니다)
  var STATUSES = [['active', '활동'], ['paused', '휴면'], ['left', '탈퇴']];
  var ACCESS = [['yes', '있음'], ['no', '없음']];
  var DIVISIONS = [['u10', 'U10'], ['u12', 'U12'], ['u14', 'U14'], ['u16', 'U16'], ['adult', '성인']];
  var GENDERS = [['m', '남'], ['f', '여']];
  var SOURCES = [['self', '직접 가입'], ['guardian', '보호자 등록'], ['admin', '협회 입력']];
  function name(list, code) { var hit = list.filter(function (p) { return p[0] === code; })[0]; return hit ? hit[1] : ''; }
  function withAll(list, first) { return [['', first]].concat(list); }
  function typeNames(m) { return m.types.map(function (t) { return name(TYPES, t); }); }

  var state = { tab: 'list', q: '', type: '', status: '', access: '', division: '', gender: '', team: '', source: '', trash: false, sort: { key: 'joined', dir: 'desc' }, page: 1 };

  // 관리자 명단: { 소문자 이메일: 명단 문서 }
  function adminMap() { var map = {}; A.store.all(ADMINS).forEach(function (a) { map[a.id] = a; }); return map; }
  // 협회만 보는 메모: { 회원 문서 ID: 메모 문서 }
  function noteMap() { var map = {}; A.store.all(NOTES).forEach(function (n) { map[n.id] = n; }); return map; }
  function model(d, admins, notes) {
    var own = (Array.isArray(d.types) ? d.types : []).map(text), email = text(d.email), source = name(SOURCES, text(d.source)) ? text(d.source) : 'admin';
    // 회원이 만든 문서의 메모는 memberNotes 에 있습니다.
    var note = source === 'admin' ? text(d.note) : text(notes[d.id] && notes[d.id].text);
    // 보호자가 등록한 자녀의 이메일 칸에는 보호자 이메일이 들어 있습니다. 보호자가 직원이어도 자녀는 직원이 아닙니다.
    var staff = source !== 'guardian' && !!(email && admins[email.toLowerCase()]);
    return {
      id: d.id, doc: d, name: text(d.name), status: text(d.status), access: d.matchAccess === true, staff: staff, source: source, guardian: text(d.guardian),
      types: TYPES.map(function (t) { return t[0]; }).filter(function (t) { return t === 'staff' ? staff : own.indexOf(t) >= 0; }),   // 화면에 보이는 순서대로
      team: text(d.team), division: text(d.division), gender: text(d.gender),
      contactName: text(d.contactName), email: email, phone: text(d.phone), joinedOn: text(d.joinedOn), note: note,
      created: A.time(text(d.createdAt) || d._createTime), deleted: !!d.deletedAt
    };
  }
  function all() { var admins = adminMap(), notes = noteMap(); return A.store.all(COL).map(function (d) { return model(d, admins, notes); }); }
  // 가입일: 적어 둔 가입일이 없으면 명부에 올린 날(회원이 직접 가입했으면 가입한 날)로 봅니다.
  function joinedDay(m) { return m.joinedOn || (m.created ? m.created.ymd : ''); }
  // 가입한 달(YYYY-MM): 가입일이 비어 있으면 명부에 올린 날로 봅니다.
  function joinedMonth(m) { return m.joinedOn ? m.joinedOn.slice(0, 7) : (m.created ? m.created.ym : ''); }

  function matches(m) {
    if (m.deleted !== state.trash) return false;
    if (state.type && m.types.indexOf(state.type) < 0) return false;
    if (state.status && m.status !== state.status) return false;
    if (state.access && m.access !== (state.access === 'yes')) return false;
    if (state.division && m.division !== state.division) return false;
    if (state.gender && m.gender !== state.gender) return false;
    if (state.team && m.team !== state.team) return false;
    if (state.source && m.source !== state.source) return false;
    if (state.q) {
      var hay = [m.name, m.team, m.contactName, m.email, m.phone, m.note].join('\n').toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) < 0) return false;
    }
    return true;
  }
  function filtersOn() { return !!(state.q || state.type || state.status || state.access || state.division || state.gender || state.team || state.source); }

  var COLUMNS = [
    { key: 'name', label: '이름', cls: 'adm-col-name', head: true, text: function (m) { return m.name; },
      node: function (m) { return [el('span', 'adm-strong', m.name || '(이름 없음)'), m.source === 'admin' ? null : el('small', 'adm-sub', name(SOURCES, m.source))]; } },
    { key: 'types', label: '종류', cls: 'adm-col-text', sort: function (m) { return m.types.length ? TYPES.map(function (t) { return t[0]; }).indexOf(m.types[0]) : null; },
      text: function (m) { return typeNames(m).join(', '); },
      node: function (m) {
        if (!m.types.length) return el('span', 'adm-faint', '고르지 않음');
        return typeNames(m).map(function (n, i) { return [i ? ', ' : '', el('span', 'adm-nb', n)]; });
      } },
    { key: 'team', label: '소속', cls: 'adm-col-wide', text: function (m) { return m.team; } },
    { key: 'division', label: '연령 구분', cls: 'adm-col-nowrap', sort: function (m) { var i = DIVISIONS.map(function (t) { return t[0]; }).indexOf(m.division); return i < 0 ? null : i; }, text: function (m) { return name(DIVISIONS, m.division); } },
    { key: 'gender', label: '성별', cls: 'adm-col-nowrap', text: function (m) { return name(GENDERS, m.gender); } },
    { key: 'contact', label: '보호자·연락 담당', cls: 'adm-col-text', text: function (m) { return m.contactName; } },
    { key: 'phone', label: '전화', cls: 'adm-col-nowrap', text: function (m) { return m.phone; } },
    { key: 'email', label: '이메일', cls: 'adm-col-email', text: function (m) { return m.email; }, node: function (m) { return A.ui.email(m.email); } },
    { key: 'access', label: '시합 권한', cls: 'adm-col-nowrap', sort: function (m) { return m.access ? 0 : 1; },
      node: function (m) { return m.access ? A.ui.tag('있음', 'blue') : el('span', 'adm-faint', '없음'); } },
    { key: 'status', label: '상태', sort: function (m) { return STATUSES.map(function (t) { return t[0]; }).indexOf(m.status); },
      node: function (m) { return A.ui.tag(name(STATUSES, m.status) || m.status, m.status === 'active' ? 'green' : 'muted'); } },
    { key: 'joined', label: '가입일', cls: 'adm-col-date', sort: joinedDay, text: function (m) { return joinedDay(m).replace(/-/g, '.'); } }
  ];

  // 회원이 탈퇴했거나 명부에서 완전히 지워져 주인이 없어진 메모는 지웁니다(탈퇴하면 그 회원에 관한 것을 남기지 않습니다).
  // 하루가 지난 메모만 지웁니다. 이 화면을 연 사이에 막 가입한 회원의 메모를 잘못 지우지 않기 위해서입니다.
  var swept = null;
  function sweep() {
    var notes = A.store.all(NOTES);
    if (swept === notes || A.store.capped(COL) || A.store.capped(NOTES)) return;
    swept = notes;
    var ids = {}, dayAgo = Date.now() - 24 * 3600 * 1000;
    A.store.all(COL).forEach(function (d) { ids[d.id] = 1; });
    var orphans = notes.filter(function (n) { var t = Date.parse(text(n.updatedAt) || n._updateTime || ''); return !ids[n.id] && !!t && t < dayAgo; });
    var step = function () {
      var part = orphans.splice(0, 10);
      if (!part.length) return;
      A.api.commit(part.map(function (n) { return A.write.del(NOTES, n.id); })).then(function () {
        part.forEach(function (n) { A.store.put(NOTES, n.id, null); });
        step();
      }, function () { /* 다음에 이 화면을 열 때 다시 해 봅니다 */ });
    };
    step();
  }

  var results = null;
  function render(root) {
    sweep();
    var list = all(), here = list.filter(function (m) { return m.deleted === state.trash; }), trashCount = list.filter(function (m) { return m.deleted; }).length;
    var head = el('div', 'adm-head'), tools = el('div', 'adm-tools');
    add(tools,
      A.button('btn btn--sm', '회원 추가', function () { edit(null); }, 'tool:add'),
      A.button('btn btn--sm btn--ghost', '엑셀용 파일 내려받기', download, 'tool:csv'),
      A.button('linkbtn', '새로 고침', function () { A.reload(); }, 'tool:reload'));
    add(head, add(el('div'), el('h1', 't-2', state.trash ? '회원: 휴지통' : '회원'), el('p', 'adm-head__sub', '협회 회원 명부')), tools);
    add(root, head);

    var teams = Object.keys(A.countBy(here, function (m) { return m.team; })).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
    if (state.team && teams.indexOf(state.team) < 0) state.team = '';
    var bar = el('div', 'adm-filters'), set = function (key) { return function (v) { state[key] = v; state.page = 1; update(); }; };
    add(bar,
      A.ui.search('이름, 소속, 연락처, 메모', state.q, set('q')),
      A.ui.select('종류', withAll(TYPES, '전체'), state.type, set('type')),
      A.ui.select('상태', withAll(STATUSES, '전체'), state.status, set('status')),
      A.ui.select('시합 권한', withAll(ACCESS, '전체'), state.access, set('access')),
      A.ui.select('연령 구분', withAll(DIVISIONS, '전체'), state.division, set('division')),
      A.ui.select('성별', withAll(GENDERS, '전체'), state.gender, set('gender')),
      A.ui.select('소속', [['', '전체']].concat(teams.map(function (t) { return [t, t]; })), state.team, set('team')),
      A.ui.select('가입 경로', withAll(SOURCES, '전체'), state.source, set('source')));
    add(root, bar);

    var line = el('div', 'adm-viewline');
    add(line,
      A.ui.tabs('보기', [['list', '목록'], ['stats', '통계']], state.tab, function (v) { state.tab = v; A.render(); }),
      A.button('linkbtn adm-viewline__end', state.trash ? '목록으로 돌아가기' : '휴지통 (' + num(trashCount) + ')', function () { state.trash = !state.trash; state.page = 1; A.render(); }, 'tool:trash'));
    add(root, line);

    results = el('div', 'adm-results');
    add(root, results);
    if (A.store.capped(COL)) add(root, el('p', 'adm-foot', '회원이 너무 많아 가장 최근에 올린 것부터 일부만 불러왔습니다.'));
    add(root, el('p', 'adm-foot', '선수는 대부분 미성년입니다. 생년월일과 집 주소는 적지 않고, 연락처는 보호자 것을 적습니다. 내려받은 파일은 필요한 사람과만 나눠 주세요.'));
    update();
  }

  function update() {
    if (!results) return;
    var list = all().filter(matches);
    results.textContent = '';
    var n = function (code) { return list.filter(function (m) { return m.status === code; }).length; };
    var clear = filtersOn() ? A.button('linkbtn', '필터 지우기', function () {
      state.q = ''; state.type = ''; state.status = ''; state.access = ''; state.division = ''; state.gender = ''; state.team = ''; state.source = ''; state.page = 1; A.render();
    }) : null;
    add(results, A.ui.tiles([
      { label: state.trash ? '휴지통의 회원' : (filtersOn() ? '걸러 낸 회원' : '전체 회원'), value: list.length, unit: '명' },
      { label: '활동', value: n('active'), unit: '명' },
      { label: '시합 권한', value: list.filter(function (m) { return m.access; }).length, unit: '명' },
      { label: '휴면·탈퇴', value: n('paused') + n('left'), unit: '명' }
    ]), clear ? add(el('p', 'adm-filternote'), '필터를 걸어 본 결과입니다. ', clear) : null);
    if (state.tab === 'stats') { add(results, stats(list)); return; }

    add(results, A.ui.table({
      caption: '회원 명부', columns: COLUMNS, rows: A.ui.sortRows(list, COLUMNS, state.sort.key, state.sort.dir), sort: state.sort, page: state.page,
      rowKey: function (m) { return m.id; },
      onSort: function (key) { state.sort = { key: key, dir: state.sort.key === key && state.sort.dir === 'asc' ? 'desc' : 'asc' }; A.keepFocus(update); },
      onPage: function (p) { state.page = p; A.keepFocus(update); results.scrollIntoView({ block: 'start' }); },
      onOpen: state.trash ? null : edit,
      actions: function (m) {
        if (!state.trash) { var b = A.button('adm-rowbtn', '수정', function () { edit(m); }); b.setAttribute('aria-label', m.name + ' 수정'); return [b]; }
        return [A.button('adm-rowbtn', '되돌리기', function () { restore(m); }), A.button('adm-rowbtn adm-rowbtn--danger', '완전히 삭제', function () { purge(m); })];
      },
      empty: state.trash ? { title: '휴지통이 비어 있습니다', text: '' }
        : (filtersOn() ? { title: '조건에 맞는 회원이 없습니다', text: '필터를 줄이거나 지워 보세요.' }
          : { title: '아직 올린 회원이 없습니다', text: '"회원 추가"로 한 명씩 올릴 수 있습니다.' })
    }));
  }

  // 종류별 인원. 한 사람이 여러 종류일 수 있어, 더하면 회원 수보다 클 수 있습니다.
  function byType(list) { return TYPES.map(function (t) { return { label: t[1], value: list.filter(function (m) { return m.types.indexOf(t[0]) >= 0; }).length }; }); }
  var MULTI = '한 사람이 여러 종류일 수 있어, 더한 값이 회원 수보다 클 수 있습니다.';

  function stats(list) {
    var box = el('div', 'adm-cards');
    var by = function (key, order) {
      var m = A.countBy(list, function (x) { return x[key]; });
      return order.map(function (p) { return { label: p[1], value: m[p[0]] || 0 }; });
    };
    add(box, A.ui.card('종류별 회원', A.ui.bars(byType(list), { unit: '명' }), MULTI));
    add(box, A.ui.card('상태별 회원', A.ui.bars(by('status', STATUSES), { unit: '명' })));
    add(box, A.ui.card('연령 구분별 회원', A.ui.bars(by('division', DIVISIONS), { unit: '명' }), '연령 구분을 적은 회원만 셉니다.'));
    var tm = A.countBy(list, function (x) { return x.team || '(소속 없음)'; });
    var teams = Object.keys(tm).map(function (k) { return { label: k, value: tm[k] }; }).sort(function (a, b) { return b.value - a.value || a.label.localeCompare(b.label, 'ko'); });
    if (teams.length > 8) teams = teams.slice(0, 7).concat([{ label: '그 밖', value: teams.slice(7).reduce(function (t, c) { return t + c.value; }, 0) }]);
    add(box, A.ui.card('소속별 회원', A.ui.bars(teams, { unit: '명', none: '조건에 맞는 회원이 없습니다.' })));
    add(box, A.ui.card('달마다 새로 가입한 회원', A.ui.columns(months(list), { unit: '명' }), '최근 12개월, 가입일 기준입니다.'));
    return box;
  }
  // 이번 달까지 최근 12개월의 가입자 수
  function months(list) {
    var m = A.countBy(list, joinedMonth), now = A.today(), y = Number(now.slice(0, 4)), mo = Number(now.slice(5, 7)), out = [];
    for (var i = 11; i >= 0; i--) {
      var d = new Date(Date.UTC(y, mo - 1 - i, 1)), key = d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2);
      out.push({ label: String(d.getUTCMonth() + 1) + '월', long: d.getUTCFullYear() + '년 ' + (d.getUTCMonth() + 1) + '월', value: m[key] || 0 });
    }
    return out;
  }

  function download() {
    var list = A.ui.sortRows(all().filter(matches), COLUMNS, state.sort.key, state.sort.dir);
    if (!list.length) { A.ui.toast('내려받을 회원이 없습니다.', true); return; }
    A.ui.download('KYLA-회원명부', ['이름', '종류', '상태', '시합 권한', '소속', '연령 구분', '성별', '보호자·연락 담당', '전화', '이메일', '가입일', '메모', '가입 경로', '명부에 올린 날', '문서 ID'],
      list.map(function (m) {
        return [m.name, typeNames(m).join(', '), name(STATUSES, m.status), m.access ? '있음' : '없음', m.team, name(DIVISIONS, m.division), name(GENDERS, m.gender), m.contactName, m.phone, m.email,
          joinedDay(m), m.note, name(SOURCES, m.source), m.created ? m.created.ymd : '', m.id];
      }));
  }

  /* ---------- 추가·수정 창 ---------- */
  var EMAIL = /^[^@\s\/]+@[^@\s\/]+\.[^@\s\/]+$/;
  function edit(m) {
    var isNew = !m, d = m ? m.doc : {}, master = A.role === 'master';
    var wasStaff = !!(m && m.staff), oldEmail = m ? m.email.toLowerCase() : '', self = !!oldEmail && oldEmail === A.email;
    // child: 보호자가 등록한 자녀 선수.  byMember: 회원이 회원 화면에서 만든 문서(직접 가입했거나 보호자가 등록함)
    var child = !!(m && m.source === 'guardian'), byMember = !!(m && m.source !== 'admin');
    var guardianDoc = child ? A.store.all(COL).filter(function (x) { return x.id === m.guardian; })[0] : null;
    var locked = {};
    if (child) {
      // 보호자가 등록한 자녀는 선수로만 둡니다(보안 규칙도 같습니다).
      OWN.forEach(function (t) { locked[t] = '보호자가 등록한 자녀 선수의 종류는 선수로 정해져 있습니다.'; });
      locked.staff = '보호자가 등록한 자녀 선수는 직원으로 지정할 수 없습니다.';
    }
    else if (!master) locked.staff = '직원 지정은 마스터만 바꿀 수 있습니다.';
    else if (self) locked.staff = '본인의 관리자 권한은 여기서 바꿀 수 없습니다.';
    var accessHint = child
      ? '이 선수는 로그인하지 않고, 보호자 계정으로 시합 소식을 봅니다. 켜고 저장하면 보호자' + (guardianDoc ? '(' + text(guardianDoc.name) + ')' : '') + ' 계정의 시합 참가 권한도 함께 켜집니다. 끌 때는 보호자 계정을 따로 꺼 주세요.'
      : (byMember ? '시합에 참가하는 회원에게 협회가 따로 켜 주는 권한입니다. 켜면 이 회원이 회원 화면에서 시합 소식을 볼 수 있습니다.'
        : '시합에 참가하는 회원이라는 표시입니다. 협회가 넣은 회원은 로그인 계정이 없어 회원 화면을 볼 수 없습니다. 회원이 직접 가입하면 그 회원의 줄에서 켜 주세요.');
    var fields = [
      { key: 'name', label: '이름', required: true, max: 60 },
      { key: 'status', label: '상태', type: 'select', options: STATUSES },
      { key: 'types', label: '회원 종류', type: 'checks', options: TYPES, min: 1, minText: '회원 종류를 하나 이상 골라 주세요.', locked: locked, wide: true,
        hint: child ? '보호자가 등록한 자녀 선수의 종류는 선수로 정해져 있어 바꿀 수 없습니다.'
          : (master ? '여러 개를 함께 고를 수 있습니다. 직원은 관리자와 같습니다. 직원으로 지정하면 아래 이메일의 구글 계정으로 이 관리자 화면에 들어올 수 있게 됩니다.'
            : '여러 개를 함께 고를 수 있습니다. 직원은 관리자와 같아서, 직원 지정은 마스터만 바꿀 수 있습니다.') },
      { key: 'matchAccess', label: '시합 참가 권한', type: 'toggle', text: '시합 일정과 사진을 볼 수 있게 합니다', wide: true, hint: accessHint },
      { key: 'team', label: '소속', max: 80, placeholder: '팀, 클럽 또는 학교' },
      { key: 'division', label: '연령 구분', type: 'select', options: withAll(DIVISIONS, '해당 없음') },
      { key: 'gender', label: '성별', type: 'select', options: withAll(GENDERS, '적지 않음') },
      { key: 'contactName', label: '보호자·연락 담당 이름', max: 60, hint: '선수는 보호자 이름을 적습니다.' },
      { key: 'phone', label: '전화번호', type: 'tel', max: 40 },
      // 회원이 만든 문서의 이메일은 로그인한 구글 계정의 것이라 여기서 바꾸지 않습니다.
      byMember ? { key: 'emailShown', label: child ? '보호자 이메일 (로그인 계정)' : '이메일 (로그인 계정)', type: 'static' }
        : { key: 'email', label: '이메일', type: 'email', max: 200, check: function (v) { return /[\/\s]/.test(v) ? '이메일 주소 형식을 확인해 주세요.' : ''; } },
      { key: 'joinedOn', label: '가입일', type: 'date', hint: byMember ? '비워 두면 회원이 가입한 날을 가입일로 봅니다.' : '' },
      { key: 'note', label: '메모', type: 'textarea', max: 1000, wide: true, hint: '협회만 보는 메모입니다. 회원에게는 보이지 않습니다.' }
    ];
    var values = isNew ? { types: [], status: 'active', matchAccess: false, joinedOn: A.today() } : {
      name: m.name, types: m.types, status: name(STATUSES, m.status) ? m.status : 'active', matchAccess: m.access, team: m.team, division: m.division, gender: m.gender,
      contactName: m.contactName, phone: m.phone, email: m.email, emailShown: m.email, joinedOn: m.joinedOn, note: m.note
    };
    var form = A.ui.form(fields, values), body = el('div');
    var lead = '생년월일과 집 주소는 적지 않습니다. 선수의 연락처 칸에는 보호자 연락처를 적어 주세요.';
    if (child) lead = '보호자가 회원 화면에서 등록한 자녀 선수입니다. 이름·소속·연령 구분·성별은 보호자도 고칠 수 있습니다. ' + lead;
    else if (byMember) lead = '회원이 회원 화면에서 직접 가입했습니다. 이름·종류·소속·연락처는 회원도 고칠 수 있고, 상태·시합 참가 권한·메모는 협회만 바꿉니다. ' + lead;
    add(body, el('p', 'adm-dlg__lead', lead), form.node);
    if (!isNew) {
      var meta = el('dl', 'adm-meta');
      var row = function (k, v) { if (v) add(meta, add(el('div'), el('dt', '', k), el('dd', '', v))); };
      var agreed = A.time(text(d.agreedAt));
      row('가입 경로', name(SOURCES, m.source) + (child && guardianDoc ? ' (보호자 ' + text(guardianDoc.name) + ')' : ''));
      row('개인정보 동의', agreed ? agreed.date + ' ' + agreed.clock : '');
      row('명부에 올린 날', m.created ? m.created.date + ' ' + m.created.clock : '');
      row('마지막 수정', A.stampText(d.updatedAt, A.byText(d.updatedBy, d)));
      add(body, meta);
    }

    // extras: 같은 저장에 함께 보낼 쓰기들 [{ write, after(결과, 몇 번째 쓰기였는지) }]. 하나라도 안 되면 모두 안 됩니다.
    var commit = function (data, extras, done) {
      extras = (extras || []).filter(Boolean);
      A.ui.dialogError(''); A.ui.busy(true);
      var id = isNew ? A.newId() : m.id, times = isNew ? ['createdAt', 'updatedAt'] : ['updatedAt'];
      var write = isNew ? A.write.set(COL, id, data, { create: true, times: times }) : A.write.set(COL, id, data, { mask: Object.keys(data), times: times, base: d._updateTime });
      A.api.commit([write].concat(extras.map(function (x) { return x.write; }))).then(function (res) {
        var doc = isNew ? { id: id } : d;
        Object.keys(data).forEach(function (k) { doc[k] = data[k]; });
        A.store.put(COL, id, A.committed(doc, res, times));
        extras.forEach(function (x, i) { x.after(res, i + 1); });
        A.ui.busy(false); A.ui.close(true);
        A.ui.toast(done);
        A.render();
      }, function (err) { A.ui.busy(false); A.ui.dialogError('저장하지 못했습니다. ' + A.errorText(err)); });
    };
    var save = function () {
      var got = form.read();
      if (!got.ok) { A.ui.dialogError('표시된 칸을 고친 뒤 다시 저장해 주세요.'); return; }
      var g = got.data, wantStaff = g.types.indexOf('staff') >= 0, admins = adminMap();
      if (byMember) g.email = m.email;
      var email = g.email.toLowerCase();
      // 회원이 만든 문서는 그 회원이 읽습니다: 메모는 문서에 적지 않고(아래에서 따로 저장), 고친 사람은 uid 로 남깁니다.
      var data = (byMember ? A.stampUid : A.stamp)({ name: g.name, types: g.types.filter(function (t) { return OWN.indexOf(t) >= 0; }), status: g.status, matchAccess: g.matchAccess,
        team: g.team, division: g.division, gender: g.gender, contactName: g.contactName, phone: g.phone, email: g.email, joinedOn: g.joinedOn, note: byMember ? '' : g.note });
      var saved = isNew ? '회원을 추가했습니다.' : '고친 내용을 저장했습니다.';
      // 저장 결과에서 i 번째 쓰기의 시각을 화면 자료에 옮깁니다.
      var at = function (doc, res, i) {
        var t = (res && res.commitTime) || new Date().toISOString(), wr = res && res.writeResults && res.writeResults[i];
        doc.updatedAt = t; doc._updateTime = (wr && wr.updateTime) || t;
        if (!doc._createTime) doc._createTime = t;
        return doc;
      };

      // 회원이 만든 문서의 메모: 관리자만 읽는 memberNotes 에 따로 둡니다. 비우면 그 메모 문서를 지웁니다.
      var noteWrite = null;
      if (byMember && g.note !== m.note) {
        var had = noteMap()[m.id];
        if (g.note) {
          var nd = A.stamp({ text: g.note });
          noteWrite = {
            write: A.write.set(NOTES, m.id, nd, had ? { times: ['updatedAt'], base: had._updateTime } : { times: ['updatedAt'], create: true }),
            after: function (res, i) { A.store.put(NOTES, m.id, at({ id: m.id, text: nd.text, updatedBy: nd.updatedBy }, res, i)); }
          };
        } else if (had) {
          noteWrite = { write: A.write.del(NOTES, m.id, had._updateTime), after: function () { A.store.put(NOTES, m.id, null); } };
        }
      }

      // 자녀 선수에게 시합 참가 권한을 새로 켜면, 시합 소식을 실제로 보는 보호자 계정의 권한도 같은 저장에 함께 켭니다.
      var withGuardian = null;
      if (child && g.matchAccess && !m.access && guardianDoc && guardianDoc.matchAccess !== true && !guardianDoc.deletedAt) {
        var gdata = A.stampUid({ matchAccess: true });
        withGuardian = {
          write: A.write.set(COL, guardianDoc.id, gdata, { mask: Object.keys(gdata), times: ['updatedAt'], base: guardianDoc._updateTime }),
          after: function (res, i) {
            guardianDoc.matchAccess = true; guardianDoc.updatedBy = gdata.updatedBy;
            A.store.put(COL, guardianDoc.id, at(guardianDoc, res, i));
          }
        };
        saved += ' 보호자 ' + text(guardianDoc.name) + ' 계정의 시합 참가 권한도 함께 켰습니다.';
      }
      var extras = [noteWrite, withGuardian];

      // 직원 표시를 그대로 둔 경우: 관리자 명단은 건드리지 않습니다.
      if (wantStaff === wasStaff) {
        if (wasStaff && email !== oldEmail) {
          A.ui.dialogError('직원(관리자)의 이메일은 여기서 바꿀 수 없습니다. 직원 표시를 풀어 저장한 다음, 이메일을 바꾸고 다시 지정해 주세요.');
          return;
        }
        commit(data, extras, saved);
        return;
      }
      if (!master) { A.ui.dialogError('직원 지정은 마스터만 바꿀 수 있습니다.'); return; }

      if (wantStaff) {
        // 직원으로 지정: 관리자 명단에 이 이메일을 더합니다(이미 있으면 그대로 둡니다).
        if (!email || !EMAIL.test(email)) { A.ui.dialogError('직원으로 지정하려면 관리자 화면에 로그인할 구글 계정 이메일을 적어 주세요.'); return; }
        if (admins[email]) { commit(data, extras, saved); return; }
        A.ui.ask({ title: '직원(관리자)으로 지정할까요?', text: email + ' 구글 계정으로 이 관리자 화면에 들어와 회원과 회신의 모든 내용을 보고 고칠 수 있게 됩니다.', yes: '직원으로 지정' }).then(function (yes) {
          if (!yes) return;
          var ad = A.stamp({ role: 'admin', memo: g.name });
          commit(data, extras.concat([{
            write: A.write.set(ADMINS, email, ad, { create: true, times: ['updatedAt'] }),
            after: function (res, i) { A.store.put(ADMINS, email, at({ id: email, role: ad.role, memo: ad.memo, updatedBy: ad.updatedBy }, res, i)); }
          }]), g.name + ' 회원을 직원(관리자)으로 지정했습니다.');
        });
        return;
      }
      // 직원 지정 풀기: 관리자 명단에서 원래 이메일을 뺍니다.
      var hadAdmin = admins[oldEmail];
      if (!hadAdmin) { commit(data, extras, saved); return; }
      A.ui.ask({ title: '직원 지정을 풀까요?', text: oldEmail + ' 계정은 더 이상 관리자 화면에 들어올 수 없게 됩니다.' + (hadAdmin.role === 'master' ? ' 마스터 권한도 함께 사라집니다.' : ''), yes: '지정 풀기', danger: true }).then(function (yes) {
        if (!yes) return;
        commit(data, extras.concat([{ write: A.write.del(ADMINS, oldEmail, hadAdmin._updateTime), after: function () { A.store.put(ADMINS, oldEmail, null); } }]), g.name + ' 회원의 직원 지정을 풀었습니다.');
      });
    };
    A.ui.open({
      title: isNew ? '회원 추가' : '회원 수정', body: body, dirty: form.dirty, focus: form.focus,
      actions: [
        isNew ? null : { label: '휴지통으로 옮기기', cls: 'linkbtn linkbtn--danger', left: true, onClick: function () { trash(m); } },
        { label: '취소', cls: 'linkbtn', onClick: function () { A.ui.close(); } },
        { label: '저장', cls: 'btn btn--sm', onClick: save }
      ].filter(Boolean)
    });
  }

  /* ---------- 휴지통 ---------- */
  var STAFF_FIRST = '직원으로 지정된 회원입니다. 먼저 회원 수정에서 직원 표시를 풀어 주세요(마스터만 할 수 있습니다).';
  function trash(m) {
    if (m.staff) { A.ui.dialogError(STAFF_FIRST); return; }
    A.ui.busy(true);
    A.trash.move(COL, m.doc, m.source !== 'admin').then(function () {
      A.ui.busy(false); A.ui.close(true);
      A.ui.toast('휴지통으로 옮겼습니다. 휴지통에서 되돌릴 수 있습니다.');
      A.render();
    }, function (err) { A.ui.busy(false); A.ui.dialogError('옮기지 못했습니다. ' + A.errorText(err)); });
  }
  function restore(m) {
    A.trash.restore(COL, m.doc, m.source !== 'admin').then(function () { A.ui.toast('목록으로 되돌렸습니다.'); A.render(); },
      function (err) { A.ui.toast('되돌리지 못했습니다. ' + A.errorText(err), true); });
  }
  function purge(m) {
    if (m.staff) { A.ui.toast('직원으로 지정된 회원입니다. 목록으로 되돌린 뒤 회원 수정에서 직원 표시를 먼저 풀어 주세요.', true); return; }
    A.ui.ask({ title: '완전히 삭제할까요?', text: m.name + ' 회원을 DB에서 지웁니다. 되돌릴 수 없습니다.', yes: '완전히 삭제', danger: true }).then(function (yes) {
      if (!yes) return;
      // 그 회원의 협회 메모(memberNotes)도 함께 지웁니다.
      var had = noteMap()[m.id], writes = [A.write.del(COL, m.id, m.doc._updateTime)];
      if (had) writes.push(A.write.del(NOTES, m.id));
      A.api.commit(writes).then(function () {
        A.store.put(COL, m.id, null);
        if (had) A.store.put(NOTES, m.id, null);
        A.ui.toast('완전히 삭제했습니다.'); A.render();
      }, function (err) { A.ui.toast('삭제하지 못했습니다. ' + A.errorText(err), true); });
    });
  }

  // 다른 화면(대시보드)에서 쓰는 것
  A.members = { all: all, TYPES: TYPES, STATUSES: STATUSES, months: months, byType: byType, MULTI: MULTI, joinedMonth: joinedMonth,
    open: function (o) { state.q = ''; state.type = ''; state.access = ''; state.division = ''; state.gender = ''; state.team = ''; state.source = ''; state.trash = false; state.tab = 'list'; state.page = 1; state.status = (o && o.status) || ''; A.go('members'); } };

  A.section({ id: 'members', title: '회원', needs: [COL, ADMINS, NOTES], render: render });
})();
