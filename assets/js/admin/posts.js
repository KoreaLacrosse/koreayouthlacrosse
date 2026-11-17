/* ==========================================================================
   관리자 화면 : 시합 소식
   시합에 참가하는 회원에게만 보이는 글(Firestore 의 matchPosts 컬렉션)을 올리고, 고치고, 지웁니다.
   시합 일정, 집합 장소, 준비물, 사진 앨범 주소처럼 참가자끼리만 볼 내용을 적는 곳입니다.

   - 회원 화면(#member)의 '시합 소식' 탭에 보입니다. 회원 메뉴에서 '시합 참가 권한'을 켠 활동 회원만 볼 수 있습니다.
   - '공개'인 글만 회원에게 보입니다. '숨김'은 관리자만 봅니다(써 두고 나중에 공개할 때).
     휴지통으로 옮기면 함께 '숨김'이 되고, 되돌려도 '숨김'으로 남습니다.
   - 사진 파일은 올리지 않습니다. 구글 포토 같은 곳에 만든 앨범의 주소(https)만 적습니다.
   - 누구나 보는 공지사항·일정·사진첩은 여기가 아니라 사이트 파일(assets/js/data.js)에서 고칩니다.
   - 상태 값은 tools/firestore.rules, assets/js/member.js 의 값과 같아야 합니다.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.KYLA_ADMIN, el = A.el, add = A.add, num = A.num, text = A.text;
  var COL = 'matchPosts', MEMBERS = 'members';

  var STATES = [['published', '공개'], ['draft', '숨김']];
  function name(list, code) { var hit = list.filter(function (p) { return p[0] === code; })[0]; return hit ? hit[1] : ''; }

  var state = { q: '', state: '', trash: false, sort: { key: 'event', dir: 'desc' }, page: 1 };

  function model(d) {
    return {
      id: d.id, doc: d, title: text(d.title), body: text(d.body), eventOn: text(d.eventOn), place: text(d.place), albumUrl: text(d.albumUrl),
      state: text(d.state) === 'published' ? 'published' : 'draft', created: A.time(text(d.createdAt) || d._createTime), deleted: !!d.deletedAt
    };
  }
  function all() { return A.store.all(COL).map(model); }
  function matches(p) {
    if (p.deleted !== state.trash) return false;
    if (state.state && p.state !== state.state) return false;
    if (state.q) {
      var hay = [p.title, p.body, p.place].join('\n').toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) < 0) return false;
    }
    return true;
  }
  function filtersOn() { return !!(state.q || state.state); }
  // 시합 소식을 볼 수 있는 회원: 로그인 계정이 있고(직접 가입), 활동 중이며, 시합 참가 권한이 켜진 회원
  function viewers() {
    return A.store.all(MEMBERS).filter(function (m) { return text(m.source) === 'self' && m.matchAccess === true && text(m.status) === 'active' && !m.deletedAt; }).length;
  }

  var COLUMNS = [
    { key: 'event', label: '시합 날짜', cls: 'adm-col-date', sort: function (p) { return p.eventOn; }, text: function (p) { return p.eventOn ? p.eventOn.replace(/-/g, '.') : ''; } },
    { key: 'title', label: '제목', cls: 'adm-col-main', head: true, text: function (p) { return p.title; }, node: function (p) { return el('span', 'adm-strong', p.title || '(제목 없음)'); } },
    { key: 'place', label: '장소', cls: 'adm-col-text', text: function (p) { return p.place; } },
    { key: 'album', label: '사진 앨범', cls: 'adm-col-nowrap', sort: function (p) { return p.albumUrl ? 0 : 1; }, text: function (p) { return p.albumUrl ? '있음' : ''; } },
    { key: 'state', label: '공개', cls: 'adm-col-nowrap', sort: function (p) { return p.state === 'published' ? 0 : 1; },
      node: function (p) { return A.ui.tag(name(STATES, p.state), p.state === 'published' ? 'green' : 'muted'); } },
    { key: 'created', label: '올린 날', cls: 'adm-col-date', sort: function (p) { return p.created ? p.created.iso : ''; }, text: function (p) { return p.created ? p.created.date : ''; } }
  ];

  var results = null;
  function render(root) {
    var list = all(), trashCount = list.filter(function (p) { return p.deleted; }).length;
    var head = el('div', 'adm-head'), tools = el('div', 'adm-tools');
    add(tools,
      A.button('btn btn--sm', '소식 올리기', function () { edit(null); }, 'tool:add'),
      A.button('linkbtn', '새로 고침', function () { A.reload(); }, 'tool:reload'));
    add(head, add(el('div'), el('h1', 't-2', state.trash ? '시합 소식: 휴지통' : '시합 소식'), el('p', 'adm-head__sub', '시합에 참가하는 회원에게만 보이는 글')), tools);
    add(root, head);

    var bar = el('div', 'adm-filters'), set = function (key) { return function (v) { state[key] = v; state.page = 1; update(); }; };
    add(bar,
      A.ui.search('제목, 내용, 장소', state.q, set('q')),
      A.ui.select('공개', [['', '전체']].concat(STATES), state.state, set('state')));
    add(root, bar);

    var line = el('div', 'adm-viewline');
    add(line, A.button('linkbtn adm-viewline__end', state.trash ? '목록으로 돌아가기' : '휴지통 (' + num(trashCount) + ')', function () { state.trash = !state.trash; state.page = 1; A.render(); }, 'tool:trash'));
    add(root, line);

    results = el('div', 'adm-results');
    add(root, results);
    add(root, el('p', 'adm-foot', '이 글은 회원 화면의 "시합 소식"에 보이며, 회원 메뉴에서 시합 참가 권한을 켠 활동 회원만 볼 수 있습니다. 자녀 선수는 보호자 계정으로 봅니다. 사진 파일은 올리지 않고 앨범 주소만 적습니다. 앨범에는 보호자 동의를 확인한 사진만 올려 주세요. 누구나 보는 공지사항과 일정은 사이트 파일에서 고칩니다.'));
    update();
  }

  function update() {
    if (!results) return;
    var list = all().filter(matches), today = A.today();
    results.textContent = '';
    var clear = filtersOn() ? A.button('linkbtn', '필터 지우기', function () { state.q = ''; state.state = ''; state.page = 1; A.render(); }) : null;
    add(results, A.ui.tiles([
      { label: state.trash ? '휴지통의 글' : (filtersOn() ? '걸러 낸 글' : '전체 글'), value: list.length, unit: '건' },
      { label: '공개', value: list.filter(function (p) { return p.state === 'published'; }).length, unit: '건' },
      { label: '다가오는 시합', value: list.filter(function (p) { return p.state === 'published' && p.eventOn && p.eventOn >= today; }).length, unit: '건', note: '공개된 글 가운데 오늘 이후' },
      { label: '볼 수 있는 회원', value: viewers(), unit: '명', note: '시합 참가 권한이 켜진 로그인 회원', go: '회원에서 보기', onGo: function () { A.go('members'); } }
    ]), clear ? add(el('p', 'adm-filternote'), '필터를 걸어 본 결과입니다. ', clear) : null);

    add(results, A.ui.table({
      caption: '시합 소식 목록', columns: COLUMNS, rows: A.ui.sortRows(list, COLUMNS, state.sort.key, state.sort.dir), sort: state.sort, page: state.page,
      rowKey: function (p) { return p.id; },
      onSort: function (key) { state.sort = { key: key, dir: state.sort.key === key && state.sort.dir === 'asc' ? 'desc' : 'asc' }; A.keepFocus(update); },
      onPage: function (p) { state.page = p; A.keepFocus(update); results.scrollIntoView({ block: 'start' }); },
      onOpen: state.trash ? null : edit,
      actions: function (p) {
        if (!state.trash) { var b = A.button('adm-rowbtn', '수정', function () { edit(p); }); b.setAttribute('aria-label', p.title + ' 수정'); return [b]; }
        return [A.button('adm-rowbtn', '되돌리기', function () { restore(p); }), A.button('adm-rowbtn adm-rowbtn--danger', '완전히 삭제', function () { purge(p); })];
      },
      empty: state.trash ? { title: '휴지통이 비어 있습니다', text: '' }
        : (filtersOn() ? { title: '조건에 맞는 글이 없습니다', text: '필터를 줄이거나 지워 보세요.' }
          : { title: '아직 올린 시합 소식이 없습니다', text: '"소식 올리기"로 시합 일정이나 사진 앨범 주소를 올릴 수 있습니다.' })
    }));
  }

  /* ---------- 올리기·수정 창 ---------- */
  function edit(p) {
    var isNew = !p, d = p ? p.doc : {};
    var fields = [
      { key: 'title', label: '제목', required: true, max: 120, wide: true },
      { key: 'eventOn', label: '시합 날짜', type: 'date', hint: '날짜가 있는 글은 회원 화면에서 "다가오는 시합"으로 모아 보여 줍니다. 날짜가 없는 알림은 비워 둡니다.' },
      { key: 'place', label: '장소', max: 120 },
      { key: 'body', label: '내용', type: 'textarea', max: 5000, rows: 8, wide: true, hint: '집합 시간, 준비물, 주차 같은 안내를 적습니다. 줄을 바꾼 대로 보입니다.' },
      { key: 'albumUrl', label: '사진 앨범 주소', max: 500, wide: true, placeholder: 'https://',
        hint: '구글 포토 같은 곳에 만든 앨범의 공유 주소를 적으면 회원 화면에 "사진 앨범 열기" 링크가 나옵니다. 보호자 동의를 확인한 사진만 올린 앨범이어야 합니다.',
        check: function (v) { return !v || /^https:\/\/[^\s"'<>]+$/.test(v) ? '' : 'https:// 로 시작하는 주소를 빈칸이나 따옴표 없이 적어 주세요.'; } },
      { key: 'published', label: '공개', type: 'toggle', text: '시합 참가 권한이 있는 회원에게 보이게 합니다', wide: true, hint: '꺼 두면 관리자만 봅니다. 써 두었다가 나중에 공개할 수 있습니다.' }
    ];
    var values = isNew ? { published: true } : { title: p.title, eventOn: p.eventOn, place: p.place, body: p.body, albumUrl: p.albumUrl, published: p.state === 'published' };
    var form = A.ui.form(fields, values), body = el('div');
    add(body, form.node);
    if (!isNew) {
      var meta = el('dl', 'adm-meta');
      var row = function (k, v) { if (v) add(meta, add(el('div'), el('dt', '', k), el('dd', '', v))); };
      row('올린 날', p.created ? p.created.date + ' ' + p.created.clock : '');
      row('마지막 수정', A.stampText(d.updatedAt, A.byText(d.updatedBy, null)));
      add(body, meta);
    }
    var save = function () {
      var got = form.read();
      if (!got.ok) { A.ui.dialogError('표시된 칸을 고친 뒤 다시 저장해 주세요.'); return; }
      A.ui.dialogError(''); A.ui.busy(true);
      var g = got.data, id = isNew ? A.newId() : p.id, times = isNew ? ['createdAt', 'updatedAt'] : ['updatedAt'];
      // 시합 소식은 시합 참가 권한이 있는 회원이 읽습니다. 고친 사람은 이메일 대신 uid 로 남깁니다.
      var data = A.stampUid({ title: g.title, eventOn: g.eventOn, place: g.place, body: g.body, albumUrl: g.albumUrl, state: g.published ? 'published' : 'draft' });
      var write = isNew ? A.write.set(COL, id, data, { create: true, times: times }) : A.write.set(COL, id, data, { mask: Object.keys(data), times: times, base: d._updateTime });
      A.api.commit([write]).then(function (res) {
        var doc = isNew ? { id: id } : d;
        Object.keys(data).forEach(function (k) { doc[k] = data[k]; });
        A.store.put(COL, id, A.committed(doc, res, times));
        A.ui.busy(false); A.ui.close(true);
        A.ui.toast((isNew ? '소식을 올렸습니다.' : '고친 내용을 저장했습니다.') + (g.published ? '' : ' 숨김 상태라 회원에게는 보이지 않습니다.'));
        A.render();
      }, function (err) { A.ui.busy(false); A.ui.dialogError('저장하지 못했습니다. ' + A.errorText(err)); });
    };
    A.ui.open({
      title: isNew ? '시합 소식 올리기' : '시합 소식 수정', body: body, dirty: form.dirty, focus: form.focus,
      actions: [
        isNew ? null : { label: '휴지통으로 옮기기', cls: 'linkbtn linkbtn--danger', left: true, onClick: function () { trash(p); } },
        { label: '취소', cls: 'linkbtn', onClick: function () { A.ui.close(); } },
        { label: '저장', cls: 'btn btn--sm', onClick: save }
      ].filter(Boolean)
    });
  }

  /* ---------- 휴지통 ----------
     휴지통으로 옮기면 회원에게 보이지 않게 '숨김'으로도 바꿉니다(보안 규칙이 휴지통의 글은 숨김이어야 한다고 정합니다). */
  function trash(p) {
    var d = p.doc, data = A.stampUid({ deletedBy: A.user.uid, state: 'draft' }), times = ['deletedAt', 'updatedAt'];
    A.ui.busy(true);
    A.api.commit([A.write.set(COL, p.id, data, { mask: Object.keys(data), times: times, base: d._updateTime })]).then(function (res) {
      Object.keys(data).forEach(function (k) { d[k] = data[k]; });
      A.store.put(COL, p.id, A.committed(d, res, times));
      A.ui.busy(false); A.ui.close(true);
      A.ui.toast('휴지통으로 옮겼습니다. 회원에게는 더 보이지 않습니다.');
      A.render();
    }, function (err) { A.ui.busy(false); A.ui.dialogError('옮기지 못했습니다. ' + A.errorText(err)); });
  }
  function restore(p) {
    A.trash.restore(COL, p.doc, true).then(function () { A.ui.toast('숨김 상태로 되돌렸습니다. 다시 보이게 하려면 수정에서 공개를 켜 주세요.'); A.render(); },
      function (err) { A.ui.toast('되돌리지 못했습니다. ' + A.errorText(err), true); });
  }
  function purge(p) {
    A.ui.ask({ title: '완전히 삭제할까요?', text: '"' + p.title + '" 글을 DB에서 지웁니다. 되돌릴 수 없습니다.', yes: '완전히 삭제', danger: true }).then(function (yes) {
      if (!yes) return;
      A.trash.purge(COL, p.doc).then(function () { A.ui.toast('완전히 삭제했습니다.'); A.render(); },
        function (err) { A.ui.toast('삭제하지 못했습니다. ' + A.errorText(err), true); });
    });
  }

  A.section({ id: 'posts', title: '시합 소식', needs: [COL, MEMBERS], render: render });
})();
