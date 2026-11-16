/* ==========================================================================
   관리자 화면 : 회원
   Firestore 의 members 컬렉션(회원 명부)을 표로 보고, 거르고, 집계하고, 추가·수정·삭제합니다.
   선수는 대부분 미성년이라 생년월일과 집 주소는 받지 않습니다. 연락처는 보호자 것을 적습니다.
   아래 구분·상태 값은 tools/firestore.rules 의 허용 값과 같아야 합니다.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.KYLA_ADMIN, el = A.el, add = A.add, num = A.num, text = A.text;
  var COL = 'members';

  var TYPES = [['player', '선수'], ['parent', '학부모'], ['coach', '지도자'], ['staff', '임원·운영진'], ['other', '기타']];
  var STATUSES = [['active', '활동'], ['pending', '승인 대기'], ['paused', '휴면'], ['left', '탈퇴']];
  var DIVISIONS = [['u10', 'U10'], ['u12', 'U12'], ['u14', 'U14'], ['u16', 'U16'], ['adult', '성인']];
  var GENDERS = [['m', '남'], ['f', '여']];
  function name(list, code) { var hit = list.filter(function (p) { return p[0] === code; })[0]; return hit ? hit[1] : ''; }
  function withAll(list, first) { return [['', first]].concat(list); }

  var state = { tab: 'list', q: '', type: '', status: '', division: '', gender: '', team: '', trash: false, sort: { key: 'joined', dir: 'desc' }, page: 1 };

  function model(d) {
    return {
      id: d.id, doc: d, name: text(d.name), type: text(d.type), status: text(d.status), team: text(d.team), division: text(d.division), gender: text(d.gender),
      contactName: text(d.contactName), email: text(d.email), phone: text(d.phone), joinedOn: text(d.joinedOn), note: text(d.note),
      created: A.time(text(d.createdAt) || d._createTime), deleted: !!d.deletedAt
    };
  }
  function all() { return A.store.all(COL).map(model); }
  // 가입한 달(YYYY-MM): 가입일이 비어 있으면 명부에 올린 날로 봅니다.
  function joinedMonth(m) { return m.joinedOn ? m.joinedOn.slice(0, 7) : (m.created ? m.created.ym : ''); }

  function matches(m) {
    if (m.deleted !== state.trash) return false;
    if (state.type && m.type !== state.type) return false;
    if (state.status && m.status !== state.status) return false;
    if (state.division && m.division !== state.division) return false;
    if (state.gender && m.gender !== state.gender) return false;
    if (state.team && m.team !== state.team) return false;
    if (state.q) {
      var hay = [m.name, m.team, m.contactName, m.email, m.phone, m.note].join('\n').toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) < 0) return false;
    }
    return true;
  }
  function filtersOn() { return !!(state.q || state.type || state.status || state.division || state.gender || state.team); }

  var COLUMNS = [
    { key: 'name', label: '이름', cls: 'adm-col-name', head: true, text: function (m) { return m.name; }, node: function (m) { return el('span', 'adm-strong', m.name || '(이름 없음)'); } },
    { key: 'type', label: '구분', cls: 'adm-col-nowrap', sort: function (m) { return TYPES.map(function (t) { return t[0]; }).indexOf(m.type); }, text: function (m) { return name(TYPES, m.type); } },
    { key: 'team', label: '소속', cls: 'adm-col-wide', text: function (m) { return m.team; } },
    { key: 'division', label: '연령 구분', cls: 'adm-col-nowrap', sort: function (m) { var i = DIVISIONS.map(function (t) { return t[0]; }).indexOf(m.division); return i < 0 ? null : i; }, text: function (m) { return name(DIVISIONS, m.division); } },
    { key: 'gender', label: '성별', cls: 'adm-col-nowrap', text: function (m) { return name(GENDERS, m.gender); } },
    { key: 'contact', label: '보호자·연락 담당', cls: 'adm-col-text', text: function (m) { return m.contactName; } },
    { key: 'phone', label: '전화', cls: 'adm-col-nowrap', text: function (m) { return m.phone; } },
    { key: 'email', label: '이메일', cls: 'adm-col-email', text: function (m) { return m.email; }, node: function (m) { return A.ui.email(m.email); } },
    { key: 'status', label: '상태', sort: function (m) { return STATUSES.map(function (t) { return t[0]; }).indexOf(m.status); },
      node: function (m) { return A.ui.tag(name(STATUSES, m.status) || m.status, m.status === 'pending' ? 'red' : (m.status === 'active' ? 'green' : 'muted')); } },
    { key: 'joined', label: '가입일', cls: 'adm-col-date', sort: function (m) { return m.joinedOn || (m.created ? m.created.ymd : ''); }, text: function (m) { return m.joinedOn ? m.joinedOn.replace(/-/g, '.') : ''; } }
  ];

  var results = null;
  function render(root) {
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
      A.ui.select('구분', withAll(TYPES, '전체'), state.type, set('type')),
      A.ui.select('상태', withAll(STATUSES, '전체'), state.status, set('status')),
      A.ui.select('연령 구분', withAll(DIVISIONS, '전체'), state.division, set('division')),
      A.ui.select('성별', withAll(GENDERS, '전체'), state.gender, set('gender')),
      A.ui.select('소속', [['', '전체']].concat(teams.map(function (t) { return [t, t]; })), state.team, set('team')));
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
      state.q = ''; state.type = ''; state.status = ''; state.division = ''; state.gender = ''; state.team = ''; state.page = 1; A.render();
    }) : null;
    add(results, A.ui.tiles([
      { label: state.trash ? '휴지통의 회원' : (filtersOn() ? '걸러 낸 회원' : '전체 회원'), value: list.length, unit: '명' },
      { label: '활동', value: n('active'), unit: '명' },
      { label: '승인 대기', value: n('pending'), unit: '명' },
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

  function stats(list) {
    var box = el('div', 'adm-cards');
    var by = function (key, order) {
      var m = A.countBy(list, function (x) { return x[key]; });
      return order.map(function (p) { return { label: p[1], value: m[p[0]] || 0 }; });
    };
    add(box, A.ui.card('구분별 회원', A.ui.bars(by('type', TYPES), { unit: '명' })));
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
    A.ui.download('KYLA-회원명부', ['이름', '구분', '상태', '소속', '연령 구분', '성별', '보호자·연락 담당', '전화', '이메일', '가입일', '메모', '명부에 올린 날', '문서 ID'],
      list.map(function (m) {
        return [m.name, name(TYPES, m.type), name(STATUSES, m.status), m.team, name(DIVISIONS, m.division), name(GENDERS, m.gender), m.contactName, m.phone, m.email,
          m.joinedOn, m.note, m.created ? m.created.ymd : '', m.id];
      }));
  }

  function edit(m) {
    var isNew = !m, d = m ? m.doc : {};
    var fields = [
      { key: 'name', label: '이름', required: true, max: 60 },
      { key: 'type', label: '구분', type: 'select', options: TYPES },
      { key: 'status', label: '상태', type: 'select', options: STATUSES },
      { key: 'team', label: '소속', max: 80, placeholder: '팀, 클럽 또는 학교' },
      { key: 'division', label: '연령 구분', type: 'select', options: withAll(DIVISIONS, '해당 없음') },
      { key: 'gender', label: '성별', type: 'select', options: withAll(GENDERS, '적지 않음') },
      { key: 'contactName', label: '보호자·연락 담당 이름', max: 60, hint: '선수는 보호자 이름을 적습니다.' },
      { key: 'phone', label: '전화번호', type: 'tel', max: 40 },
      { key: 'email', label: '이메일', type: 'email', max: 200 },
      { key: 'joinedOn', label: '가입일', type: 'date' },
      { key: 'note', label: '메모', type: 'textarea', max: 1000, wide: true }
    ];
    var values = isNew ? { type: 'player', status: 'active', joinedOn: A.today() } : {
      name: m.name, type: name(TYPES, m.type) ? m.type : 'other', status: name(STATUSES, m.status) ? m.status : 'active', team: m.team, division: m.division, gender: m.gender,
      contactName: m.contactName, phone: m.phone, email: m.email, joinedOn: m.joinedOn, note: m.note
    };
    var form = A.ui.form(fields, values), body = el('div');
    add(body, el('p', 'adm-dlg__lead', '생년월일과 집 주소는 적지 않습니다. 선수의 연락처 칸에는 보호자 연락처를 적어 주세요.'), form.node);
    if (!isNew) {
      var meta = el('dl', 'adm-meta');
      var row = function (k, v) { if (v) add(meta, add(el('div'), el('dt', '', k), el('dd', '', v))); };
      row('명부에 올린 날', m.created ? m.created.date + ' ' + m.created.clock : '');
      row('마지막 수정', A.stampText(d.updatedAt, text(d.updatedBy)));
      add(body, meta);
    }
    var save = function () {
      var got = form.read();
      if (!got.ok) { A.ui.dialogError('표시된 칸을 고친 뒤 다시 저장해 주세요.'); return; }
      A.ui.dialogError(''); A.ui.busy(true);
      var data = A.stamp(got.data), id = isNew ? A.newId() : m.id, times = isNew ? ['createdAt', 'updatedAt'] : ['updatedAt'];
      var write = isNew ? A.write.set(COL, id, data, { create: true, times: times }) : A.write.set(COL, id, data, { mask: Object.keys(data), times: times, base: d._updateTime });
      A.api.commit([write]).then(function (res) {
        var doc = isNew ? { id: id } : d;
        Object.keys(data).forEach(function (k) { doc[k] = data[k]; });
        A.store.put(COL, id, A.committed(doc, res, times));
        A.ui.busy(false); A.ui.close(true);
        A.ui.toast(isNew ? '회원을 추가했습니다.' : '고친 내용을 저장했습니다.');
        A.render();
      }, function (err) { A.ui.busy(false); A.ui.dialogError('저장하지 못했습니다. ' + A.errorText(err)); });
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

  function trash(m) {
    A.ui.busy(true);
    A.trash.move(COL, m.doc).then(function () {
      A.ui.busy(false); A.ui.close(true);
      A.ui.toast('휴지통으로 옮겼습니다. 휴지통에서 되돌릴 수 있습니다.');
      A.render();
    }, function (err) { A.ui.busy(false); A.ui.dialogError('옮기지 못했습니다. ' + A.errorText(err)); });
  }
  function restore(m) {
    A.trash.restore(COL, m.doc).then(function () { A.ui.toast('목록으로 되돌렸습니다.'); A.render(); },
      function (err) { A.ui.toast('되돌리지 못했습니다. ' + A.errorText(err), true); });
  }
  function purge(m) {
    A.ui.ask({ title: '완전히 삭제할까요?', text: m.name + ' 회원을 DB에서 지웁니다. 되돌릴 수 없습니다.', yes: '완전히 삭제', danger: true }).then(function (yes) {
      if (!yes) return;
      A.trash.purge(COL, m.doc).then(function () { A.ui.toast('완전히 삭제했습니다.'); A.render(); },
        function (err) { A.ui.toast('삭제하지 못했습니다. ' + A.errorText(err), true); });
    });
  }

  // 다른 화면(대시보드)에서 쓰는 것
  A.members = { all: all, TYPES: TYPES, STATUSES: STATUSES, months: months,
    open: function (o) { state.q = ''; state.type = ''; state.division = ''; state.gender = ''; state.team = ''; state.trash = false; state.tab = 'list'; state.page = 1; state.status = (o && o.status) || ''; A.go('members'); } };

  A.section({
    id: 'members', title: '회원', needs: [COL], render: render,
    badge: function () { return all().filter(function (m) { return !m.deleted && m.status === 'pending'; }).length; }
  });
})();
