/* ==========================================================================
   관리자 화면 : 시합 관리
   시합(Firestore 의 matches 컬렉션)을 여러 개 넣어 두고, 시합 하나를 고르면 그 시합의 소식(matchPosts 컬렉션)을
   올리고 고치는 화면이 열립니다. 시합 일정, 집합 장소, 준비물, 사진 앨범 주소처럼 참가자끼리만 볼 내용을 적는 곳입니다.

   - 주소: #matches 가 시합 목록, #matches-시합ID 가 그 시합의 소식 화면, #matches-none 이 시합을 정하지 않은 소식입니다.
   - 회원 화면(#member)의 '시합 소식' 탭에 시합별로 묶여 보입니다. 회원 메뉴에서 '시합 참가 권한'을 켠 활동 회원만 볼 수 있습니다.
   - '공개'인 시합과 '공개'인 글만 회원에게 보입니다. '숨김'은 관리자만 봅니다(준비해 두었다가 나중에 공개할 때).
     숨김인 시합의 글은 공개로 둘 수 없습니다. 시합을 숨기거나 휴지통으로 옮기면 그 시합의 공개된 글도 함께 숨깁니다.
     (보안 규칙은 글이 어느 시합의 것인지까지 따져 주지 않으므로, 이 약속은 이 화면이 지킵니다.)
   - 휴지통으로 옮기면 함께 '숨김'이 되고, 되돌려도 '숨김'으로 남습니다.
   - 사진 파일은 올리지 않습니다. 구글 포토 같은 곳에 만든 앨범의 주소(https)만 적습니다.
   - 누구나 보는 공지사항·일정·사진첩은 여기가 아니라 사이트 파일(assets/js/data.js)에서 고칩니다.
   - 시합과 글은 회원이 읽는 문서입니다. 고친 사람은 이메일 대신 로그인 계정의 고유 번호(uid)로 남깁니다.
   - 상태 값과 항목은 tools/firestore.rules, assets/js/member.js 의 것과 같아야 합니다.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.KYLA_ADMIN, el = A.el, add = A.add, num = A.num, text = A.text;
  var MATCHES = 'matches', POSTS = 'matchPosts', MEMBERS = 'members';
  var NONE = 'none';                         // #matches-none : 시합을 정하지 않은 소식

  var STATES = [['published', '공개'], ['draft', '숨김']];
  function name(list, code) { var hit = list.filter(function (p) { return p[0] === code; })[0]; return hit ? hit[1] : ''; }
  function dots(ymd) { return ymd ? ymd.replace(/-/g, '.') : ''; }

  // 화면마다의 보기 상태: 시합 목록, 고른 시합의 소식
  var listState = { q: '', state: '', trash: false, sort: { key: 'event', dir: 'desc' }, page: 1 };
  var postState = { of: '', q: '', state: '', trash: false, sort: { key: 'created', dir: 'desc' }, page: 1 };

  /* ---------- 자료 모양 ---------- */
  function matchModel(d) {
    return {
      id: d.id, doc: d, title: text(d.title), eventOn: text(d.eventOn), place: text(d.place),
      state: text(d.state) === 'published' ? 'published' : 'draft', created: A.time(text(d.createdAt) || d._createTime), deleted: !!d.deletedAt
    };
  }
  function postModel(d) {
    return {
      id: d.id, doc: d, matchId: text(d.matchId), title: text(d.title), body: text(d.body), eventOn: text(d.eventOn), place: text(d.place), albumUrl: text(d.albumUrl),
      state: text(d.state) === 'published' ? 'published' : 'draft', created: A.time(text(d.createdAt) || d._createTime), deleted: !!d.deletedAt
    };
  }
  function allMatches() { return A.store.all(MATCHES).map(matchModel); }
  function allPosts() { return A.store.all(POSTS).map(postModel); }
  // 그 시합의 글. key 가 NONE 이면 시합을 정하지 않은 글(가리키는 시합이 없어진 글도 여기에 모읍니다).
  function postsOf(key) {
    if (key !== NONE) return allPosts().filter(function (p) { return p.matchId === key; });
    var known = {};
    A.store.all(MATCHES).forEach(function (d) { known[d.id] = 1; });
    return allPosts().filter(function (p) { return !p.matchId || !known[p.matchId]; });
  }
  // 시합 소식을 볼 수 있는 회원: 로그인 계정이 있고(직접 가입), 활동 중이며, 시합 참가 권한이 켜진 회원
  function viewers() {
    return A.store.all(MEMBERS).filter(function (m) { return text(m.source) === 'self' && m.matchAccess === true && text(m.status) === 'active' && !m.deletedAt; }).length;
  }
  function viewersTile() {
    return { label: '볼 수 있는 회원', value: viewers(), unit: '명', note: '시합 참가 권한이 켜진 로그인 회원', go: '회원에서 보기', onGo: function () { A.go('members'); } };
  }
  // 저장 결과에서 i 번째 쓰기의 시각을 화면 자료에 옮깁니다.
  function applied(doc, data, res, i, times) {
    var t = (res && res.commitTime) || new Date().toISOString(), wr = res && res.writeResults && res.writeResults[i];
    Object.keys(data).forEach(function (k) { doc[k] = data[k]; });
    (times || ['updatedAt']).forEach(function (k) { doc[k] = t; });
    doc._updateTime = (wr && wr.updateTime) || t;
    if (!doc._createTime) doc._createTime = t;
    return doc;
  }
  // 그 시합의 공개된 글을 숨김으로 바꾸는 쓰기들. 시합을 숨기거나 휴지통으로 옮길 때 함께 보냅니다.
  function hideWrites(matchId) {
    return A.store.all(POSTS).filter(function (d) { return text(d.matchId) === matchId && text(d.state) === 'published' && !d.deletedAt; }).map(function (d) {
      var data = A.stampUid({ state: 'draft' });
      return { col: POSTS, doc: d, data: data, times: ['updatedAt'], write: A.write.set(POSTS, d.id, data, { mask: Object.keys(data), times: ['updatedAt'], base: d._updateTime }) };
    });
  }
  // 여러 쓰기를 한 번에 5개씩 차례로 보냅니다(보안 규칙이 한 번의 저장에서 따져 볼 수 있는 양에 한도가 있습니다).
  // items: [{ col, doc, data, times, write }]. 앞 묶음이 실패하면 거기서 멈춥니다.
  function commitAll(items) {
    var rest = items.slice();
    var step = function () {
      var part = rest.splice(0, 5);
      if (!part.length) return Promise.resolve();
      return A.api.commit(part.map(function (x) { return x.write; })).then(function (res) {
        part.forEach(function (x, i) { A.store.put(x.col, x.doc.id, applied(x.doc, x.data, res, i, x.times)); });
        return step();
      });
    };
    return step();
  }

  /* ==========================================================================
     화면 1 : 시합 목록
     ========================================================================== */
  function listMatches(m) {
    var s = listState;
    if (m.deleted !== s.trash) return false;
    if (s.state && m.state !== s.state) return false;
    if (s.q && [m.title, m.place].join('\n').toLowerCase().indexOf(s.q.toLowerCase()) < 0) return false;
    return true;
  }
  function counts() {       // { 시합 ID: { all: 휴지통 밖의 글 수, open: 그 가운데 공개 } }
    var map = {};
    allPosts().forEach(function (p) {
      if (p.deleted || !p.matchId) return;
      var c = map[p.matchId] || (map[p.matchId] = { all: 0, open: 0 });
      c.all++; if (p.state === 'published') c.open++;
    });
    return map;
  }
  function open(m) { A.go('matches-' + m.id); }

  var listResults = null;
  function renderList(root) {
    var s = listState, list = allMatches(), trashCount = list.filter(function (m) { return m.deleted; }).length;
    var head = el('div', 'adm-head'), tools = el('div', 'adm-tools');
    add(tools,
      A.button('btn btn--sm', '시합 추가', function () { editMatch(null); }, 'tool:add'),
      A.button('linkbtn', '새로 고침', function () { A.reload(); }, 'tool:reload'));
    add(head, add(el('div'), el('h1', 't-2', s.trash ? '시합 관리: 휴지통' : '시합 관리'),
      el('p', 'adm-head__sub', '시합을 넣어 두고, 시합을 고르면 그 시합의 소식을 올리고 고칩니다')), tools);
    add(root, head);

    var bar = el('div', 'adm-filters'), set = function (key) { return function (v) { s[key] = v; s.page = 1; updateList(); }; };
    add(bar, A.ui.search('시합 이름, 장소', s.q, set('q')), A.ui.select('공개', [['', '전체']].concat(STATES), s.state, set('state')));
    add(root, bar);

    var line = el('div', 'adm-viewline');
    add(line, A.button('linkbtn adm-viewline__end', s.trash ? '목록으로 돌아가기' : '휴지통 (' + num(trashCount) + ')', function () { s.trash = !s.trash; s.page = 1; A.render(); }, 'tool:trash'));
    add(root, line);

    listResults = el('div', 'adm-results');
    add(root, listResults);
    add(root, el('p', 'adm-foot', '시합 이름을 누르면 그 시합의 소식을 올리고 고치는 화면이 열립니다. 공개인 시합과 공개인 글만 회원 화면의 "시합 소식"에 보이며, 회원 메뉴에서 시합 참가 권한을 켠 활동 회원만 볼 수 있습니다. 자녀 선수는 보호자 계정으로 봅니다. 누구나 보는 공지사항과 일정은 사이트 파일에서 고칩니다.'));
    updateList();
  }
  function updateList() {
    if (!listResults) return;
    var s = listState, n = counts(), list = allMatches().filter(listMatches), today = A.today();
    var filtered = !!(s.q || s.state);
    var COLUMNS = [
      { key: 'event', label: '시합 날짜', cls: 'adm-col-date', sort: function (m) { return m.eventOn; }, text: function (m) { return m.eventOn ? dots(m.eventOn) : '미정'; } },
      { key: 'title', label: '시합', cls: 'adm-col-main', head: true, text: function (m) { return m.title; }, node: function (m) { return el('span', 'adm-strong', m.title || '(이름 없음)'); } },
      { key: 'place', label: '장소', cls: 'adm-col-text', text: function (m) { return m.place; } },
      { key: 'posts', label: '소식', cls: 'adm-col-nowrap', sort: function (m) { return n[m.id] ? n[m.id].all : 0; },
        text: function (m) { var c = n[m.id]; return c ? '공개 ' + num(c.open) + ' / 전체 ' + num(c.all) : '없음'; } },
      { key: 'state', label: '공개', cls: 'adm-col-nowrap', sort: function (m) { return m.state === 'published' ? 0 : 1; },
        node: function (m) { return A.ui.tag(name(STATES, m.state), m.state === 'published' ? 'green' : 'muted'); } },
      { key: 'created', label: '넣은 날', cls: 'adm-col-date', sort: function (m) { return m.created ? m.created.iso : ''; }, text: function (m) { return m.created ? m.created.date : ''; } }
    ];
    listResults.textContent = '';
    var clear = filtered ? A.button('linkbtn', '필터 지우기', function () { s.q = ''; s.state = ''; s.page = 1; A.render(); }) : null;
    add(listResults, A.ui.tiles([
      { label: s.trash ? '휴지통의 시합' : (filtered ? '걸러 낸 시합' : '전체 시합'), value: list.length, unit: '건' },
      { label: '공개', value: list.filter(function (m) { return m.state === 'published'; }).length, unit: '건' },
      { label: '다가오는 시합', value: list.filter(function (m) { return m.state === 'published' && m.eventOn && m.eventOn >= today; }).length, unit: '건', note: '공개된 시합 가운데 오늘 이후' },
      viewersTile()
    ]), clear ? add(el('p', 'adm-filternote'), '필터를 걸어 본 결과입니다. ', clear) : null);

    add(listResults, A.ui.table({
      caption: '시합 목록', columns: COLUMNS, rows: A.ui.sortRows(list, COLUMNS, s.sort.key, s.sort.dir), sort: s.sort, page: s.page,
      rowKey: function (m) { return m.id; },
      onSort: function (key) { s.sort = { key: key, dir: s.sort.key === key && s.sort.dir === 'asc' ? 'desc' : 'asc' }; A.keepFocus(updateList); },
      onPage: function (p) { s.page = p; A.keepFocus(updateList); listResults.scrollIntoView({ block: 'start' }); },
      onOpen: open,
      actions: function (m) {
        if (s.trash) return [A.button('adm-rowbtn', '되돌리기', function () { restoreMatch(m); }), A.button('adm-rowbtn adm-rowbtn--danger', '완전히 삭제', function () { purgeMatch(m); })];
        var go = A.button('adm-rowbtn', '소식 관리', function () { open(m); }), fix = A.button('adm-rowbtn', '수정', function () { editMatch(m); });
        go.setAttribute('aria-label', m.title + ' 소식 관리'); fix.setAttribute('aria-label', m.title + ' 시합 정보 수정');
        return [go, fix];
      },
      empty: s.trash ? { title: '휴지통이 비어 있습니다', text: '' }
        : (filtered ? { title: '조건에 맞는 시합이 없습니다', text: '필터를 줄이거나 지워 보세요.' }
          : { title: '아직 넣은 시합이 없습니다', text: '"시합 추가"로 시합을 넣으면, 그 시합의 일정 안내와 사진 앨범 주소를 올릴 수 있습니다.' })
    }));

    // 시합을 정하지 않은 글(시합 관리가 생기기 전에 올린 글)이 있으면 알려 줍니다.
    var loose = postsOf(NONE).length;
    if (!s.trash && loose) {
      add(listResults, add(el('p', 'adm-filternote'), '시합을 정하지 않은 소식이 ' + num(loose) + '건 있습니다. ',
        A.button('linkbtn', '보기', function () { A.go('matches-' + NONE); }, 'tool:loose')));
    }
  }

  /* ---------- 시합 추가·수정 창 ---------- */
  function editMatch(m) {
    var isNew = !m, d = m ? m.doc : {};
    var fields = [
      { key: 'title', label: '시합 이름', required: true, max: 120, wide: true, placeholder: '예) 유소년 리그 3라운드' },
      { key: 'eventOn', label: '시합 날짜', type: 'date', hint: '아직 정해지지 않았으면 비워 둡니다. 회원 화면에는 "날짜 미정"으로 나옵니다.' },
      { key: 'place', label: '장소', max: 120 },
      { key: 'published', label: '공개', type: 'toggle', text: '시합 참가 권한이 있는 회원에게 이 시합을 보여 줍니다', wide: true,
        hint: '꺼 두면 관리자만 봅니다. 숨김인 시합은 그 소식도 회원에게 보이지 않습니다.' }
    ];
    var values = isNew ? { published: true } : { title: m.title, eventOn: m.eventOn, place: m.place, published: m.state === 'published' };
    var form = A.ui.form(fields, values), body = el('div');
    add(body, form.node);
    if (!isNew) {
      var meta = el('dl', 'adm-meta');
      var row = function (k, v) { if (v) add(meta, add(el('div'), el('dt', '', k), el('dd', '', v))); };
      row('넣은 날', m.created ? m.created.date + ' ' + m.created.clock : '');
      row('마지막 수정', A.stampText(d.updatedAt, A.byText(d.updatedBy, null)));
      add(body, meta);
    }
    var send = function (g, hidden) {
      A.ui.dialogError(''); A.ui.busy(true);
      var id = isNew ? A.newId() : m.id, times = isNew ? ['createdAt', 'updatedAt'] : ['updatedAt'];
      var data = A.stampUid({ title: g.title, eventOn: g.eventOn, place: g.place, state: g.published ? 'published' : 'draft' });
      var doc = isNew ? { id: id } : d;
      var write = isNew ? A.write.set(MATCHES, id, data, { create: true, times: times }) : A.write.set(MATCHES, id, data, { mask: Object.keys(data), times: times, base: d._updateTime });
      // 숨길 때는 글을 먼저 숨기고 시합을 마지막에 고칩니다(중간에 멈춰도 숨김인 시합에 공개 글이 남지 않게).
      commitAll(hidden.concat([{ col: MATCHES, doc: doc, data: data, times: times, write: write }])).then(function () {
        A.ui.busy(false); A.ui.close(true);
        A.ui.toast(isNew ? '시합을 넣었습니다. 이제 이 시합의 소식을 올릴 수 있습니다.'
          : '고친 내용을 저장했습니다.' + (hidden.length ? ' 이 시합의 공개된 소식 ' + num(hidden.length) + '건도 함께 숨겼습니다.' : (g.published ? '' : ' 숨김 상태라 회원에게는 보이지 않습니다.')));
        if (isNew) A.go('matches-' + id); else A.render();
      }, function (err) { A.ui.busy(false); A.ui.dialogError('저장하지 못했습니다. ' + A.errorText(err)); });
    };
    var save = function () {
      var got = form.read();
      if (!got.ok) { A.ui.dialogError('표시된 칸을 고친 뒤 다시 저장해 주세요.'); return; }
      var g = got.data, hidden = !isNew && m.state === 'published' && !g.published ? hideWrites(m.id) : [];
      if (!hidden.length) { send(g, hidden); return; }
      A.ui.ask({ title: '이 시합을 숨길까요?', text: '이 시합의 공개된 소식 ' + num(hidden.length) + '건도 함께 숨깁니다. 시합을 다시 공개해도 소식은 숨김으로 남으니, 그때 필요한 글의 공개를 다시 켜 주세요.', yes: '숨기기' })
        .then(function (yes) { if (yes) send(g, hidden); });
    };
    A.ui.open({
      title: isNew ? '시합 추가' : '시합 정보 수정', body: body, dirty: form.dirty, focus: form.focus,
      actions: [
        isNew ? null : { label: '휴지통으로 옮기기', cls: 'linkbtn linkbtn--danger', left: true, onClick: function () { trashMatch(m); } },
        { label: '취소', cls: 'linkbtn', onClick: function () { A.ui.close(); } },
        { label: '저장', cls: 'btn btn--sm', onClick: save }
      ].filter(Boolean)
    });
  }

  /* ---------- 시합의 휴지통 ----------
     휴지통으로 옮기면 시합이 '숨김'이 되고, 그 시합의 공개된 글도 함께 숨깁니다. 글은 휴지통으로 가지 않고 시합에 그대로 붙어 있습니다. */
  function trashMatch(m) {
    var hidden = hideWrites(m.id);
    var go = function () {
      var d = m.doc, data = A.stampUid({ deletedBy: A.user.uid, state: 'draft' }), times = ['deletedAt', 'updatedAt'];
      A.ui.busy(true);
      commitAll(hidden.concat([{ col: MATCHES, doc: d, data: data, times: times, write: A.write.set(MATCHES, m.id, data, { mask: Object.keys(data), times: times, base: d._updateTime }) }])).then(function () {
        A.ui.busy(false); A.ui.close(true);
        A.ui.toast('시합을 휴지통으로 옮겼습니다. 회원에게는 더 보이지 않습니다.' + (hidden.length ? ' 공개된 소식 ' + num(hidden.length) + '건도 함께 숨겼습니다.' : ''));
        if (A.sub) A.go('matches'); else A.render();
      }, function (err) { A.ui.busy(false); A.ui.dialogError('옮기지 못했습니다. ' + A.errorText(err)); });
    };
    if (!hidden.length) { go(); return; }
    A.ui.ask({ title: '시합을 휴지통으로 옮길까요?', text: '이 시합의 공개된 소식 ' + num(hidden.length) + '건도 함께 숨깁니다. 휴지통에서 되돌려도 시합과 소식은 숨김으로 남습니다.', yes: '휴지통으로 옮기기', danger: true })
      .then(function (yes) { if (yes) go(); });
  }
  function restoreMatch(m) {
    A.trash.restore(MATCHES, m.doc, true).then(function () { A.ui.toast('숨김 상태로 되돌렸습니다. 다시 보이게 하려면 수정에서 공개를 켜 주세요.'); A.render(); },
      function (err) { A.ui.toast('되돌리지 못했습니다. ' + A.errorText(err), true); });
  }
  function purgeMatch(m) {
    var left = postsOf(m.id).length;
    if (left) {
      A.ui.toast('이 시합에 소식이 ' + num(left) + '건 남아 있어(휴지통의 글 포함) 완전히 삭제할 수 없습니다. 시합 이름을 눌러 남은 소식을 다른 시합으로 옮기거나 완전히 삭제한 뒤 다시 해 주세요.', true);
      return;
    }
    A.ui.ask({ title: '완전히 삭제할까요?', text: '"' + m.title + '" 시합을 DB에서 지웁니다. 되돌릴 수 없습니다.', yes: '완전히 삭제', danger: true }).then(function (yes) {
      if (!yes) return;
      A.trash.purge(MATCHES, m.doc).then(function () { A.ui.toast('완전히 삭제했습니다.'); A.render(); },
        function (err) { A.ui.toast('삭제하지 못했습니다. ' + A.errorText(err), true); });
    });
  }

  /* ==========================================================================
     화면 2 : 시합 하나의 소식 (m 이 null 이면 시합을 정하지 않은 소식)
     ========================================================================== */
  function listPosts(p) {
    var s = postState;
    if (p.deleted !== s.trash) return false;
    if (s.state && p.state !== s.state) return false;
    if (s.q && [p.title, p.body, p.place].join('\n').toLowerCase().indexOf(s.q.toLowerCase()) < 0) return false;
    return true;
  }
  var POST_COLUMNS = [
    { key: 'created', label: '올린 날', cls: 'adm-col-date', sort: function (p) { return p.created ? p.created.iso : ''; }, text: function (p) { return p.created ? p.created.date : ''; } },
    { key: 'title', label: '제목', cls: 'adm-col-main', head: true, text: function (p) { return p.title; }, node: function (p) { return el('span', 'adm-strong', p.title || '(제목 없음)'); } },
    { key: 'event', label: '날짜', cls: 'adm-col-date', sort: function (p) { return p.eventOn; }, text: function (p) { return dots(p.eventOn); } },
    { key: 'place', label: '장소', cls: 'adm-col-text', text: function (p) { return p.place; } },
    { key: 'album', label: '사진 앨범', cls: 'adm-col-nowrap', sort: function (p) { return p.albumUrl ? 0 : 1; }, text: function (p) { return p.albumUrl ? '있음' : ''; } },
    { key: 'state', label: '공개', cls: 'adm-col-nowrap', sort: function (p) { return p.state === 'published' ? 0 : 1; },
      node: function (p) { return A.ui.tag(name(STATES, p.state), p.state === 'published' ? 'green' : 'muted'); } }
  ];

  var postResults = null, shown = null;
  function renderPosts(root, m) {
    var s = postState, key = m ? m.id : NONE;
    if (s.of !== key) { s.of = key; s.q = ''; s.state = ''; s.trash = false; s.page = 1; }      // 다른 시합으로 옮겨 오면 보기 상태를 처음으로
    shown = m;
    var mine = postsOf(key), trashCount = mine.filter(function (p) { return p.deleted; }).length;

    add(root, add(el('p', 'adm-back'), A.button('linkbtn', '‹ 시합 목록', function () { A.go('matches'); }, 'tool:back')));

    var head = el('div', 'adm-head'), tools = el('div', 'adm-tools'), titleBox = el('div');
    if (m && !m.deleted) {
      add(tools, A.button('btn btn--sm', '소식 올리기', function () { editPost(null, m); }, 'tool:add'),
        A.button('linkbtn', '시합 정보 수정', function () { editMatch(m); }, 'tool:match'));
    }
    add(tools, A.button('linkbtn', '새로 고침', function () { A.reload(); }, 'tool:reload'));
    add(titleBox, el('h1', 't-2', (m ? (m.title || '(이름 없음)') : '시합을 정하지 않은 소식') + (s.trash ? ': 휴지통' : '')));
    if (m) {
      var sub = el('p', 'adm-head__sub adm-match');
      add(sub, el('span', '', [m.eventOn ? dots(m.eventOn) : '날짜 미정', m.place].filter(Boolean).join(' · ')), ' ',
        A.ui.tag(m.deleted ? '휴지통' : name(STATES, m.state), !m.deleted && m.state === 'published' ? 'green' : 'muted'));
      add(titleBox, sub);
    } else {
      add(titleBox, el('p', 'adm-head__sub', '시합 관리가 생기기 전에 올린 글입니다. 글을 열어 시합을 골라 주면 그 시합으로 옮겨집니다'));
    }
    add(head, titleBox, tools);
    add(root, head);

    if (m && m.deleted) add(root, el('p', 'note', '이 시합은 휴지통에 있습니다. 회원에게 보이지 않습니다. 시합 목록의 휴지통에서 되돌릴 수 있고, 남은 소식을 모두 옮기거나 완전히 삭제하면 시합도 완전히 삭제할 수 있습니다.'));
    else if (m && m.state !== 'published') add(root, el('p', 'note', '이 시합은 숨김 상태입니다. 회원에게는 이 시합과 그 소식이 보이지 않습니다. 보이게 하려면 "시합 정보 수정"에서 공개를 켜 주세요.'));

    var bar = el('div', 'adm-filters'), set = function (k) { return function (v) { s[k] = v; s.page = 1; updatePosts(); }; };
    add(bar, A.ui.search('제목, 내용, 장소', s.q, set('q')), A.ui.select('공개', [['', '전체']].concat(STATES), s.state, set('state')));
    add(root, bar);

    var line = el('div', 'adm-viewline');
    add(line, A.button('linkbtn adm-viewline__end', s.trash ? '소식 목록으로 돌아가기' : '휴지통 (' + num(trashCount) + ')', function () { s.trash = !s.trash; s.page = 1; A.render(); }, 'tool:trash'));
    add(root, line);

    postResults = el('div', 'adm-results');
    add(root, postResults);
    add(root, el('p', 'adm-foot', '이 글은 회원 화면의 "시합 소식"에서 이 시합 아래에 보입니다. 사진 파일은 올리지 않고 앨범 주소만 적습니다. 앨범에는 보호자 동의를 확인한 사진만 올려 주세요.'));
    updatePosts();
  }
  function updatePosts() {
    if (!postResults) return;
    var s = postState, m = shown, list = postsOf(s.of).filter(listPosts), filtered = !!(s.q || s.state);
    postResults.textContent = '';
    var clear = filtered ? A.button('linkbtn', '필터 지우기', function () { s.q = ''; s.state = ''; s.page = 1; A.render(); }) : null;
    add(postResults, A.ui.tiles([
      { label: s.trash ? '휴지통의 글' : (filtered ? '걸러 낸 글' : '전체 글'), value: list.length, unit: '건' },
      { label: '공개', value: list.filter(function (p) { return p.state === 'published'; }).length, unit: '건' },
      viewersTile()
    ]), clear ? add(el('p', 'adm-filternote'), '필터를 걸어 본 결과입니다. ', clear) : null);

    add(postResults, A.ui.table({
      caption: '시합 소식 목록', columns: POST_COLUMNS, rows: A.ui.sortRows(list, POST_COLUMNS, s.sort.key, s.sort.dir), sort: s.sort, page: s.page,
      rowKey: function (p) { return p.id; },
      onSort: function (key) { s.sort = { key: key, dir: s.sort.key === key && s.sort.dir === 'asc' ? 'desc' : 'asc' }; A.keepFocus(updatePosts); },
      onPage: function (p) { s.page = p; A.keepFocus(updatePosts); postResults.scrollIntoView({ block: 'start' }); },
      onOpen: s.trash ? null : function (p) { editPost(p, m); },
      actions: function (p) {
        if (!s.trash) { var b = A.button('adm-rowbtn', '수정', function () { editPost(p, m); }); b.setAttribute('aria-label', p.title + ' 수정'); return [b]; }
        return [A.button('adm-rowbtn', '되돌리기', function () { restorePost(p); }), A.button('adm-rowbtn adm-rowbtn--danger', '완전히 삭제', function () { purgePost(p); })];
      },
      empty: s.trash ? { title: '휴지통이 비어 있습니다', text: '' }
        : (filtered ? { title: '조건에 맞는 글이 없습니다', text: '필터를 줄이거나 지워 보세요.' }
          : { title: '아직 올린 소식이 없습니다', text: m ? '"소식 올리기"로 집합 시간, 준비물, 사진 앨범 주소를 올릴 수 있습니다.' : '' })
    }));
  }

  /* ---------- 소식 올리기·수정 창 ---------- */
  function editPost(p, m) {
    var isNew = !p, d = p ? p.doc : {};
    // 고를 수 있는 시합: 휴지통에 없는 시합(지금 시합은 휴지통에 있어도 넣어 줍니다). 날짜가 늦은 순.
    var options = allMatches().filter(function (x) { return !x.deleted || (m && x.id === m.id); })
      .sort(function (a, b) { return a.eventOn === b.eventOn ? 0 : (a.eventOn < b.eventOn ? 1 : -1); })
      .map(function (x) { return [x.id, x.title + (x.eventOn ? ' (' + dots(x.eventOn) + ')' : '') + (x.state === 'published' && !x.deleted ? '' : ' · 숨김')]; });
    if (!m) options.unshift(['', '시합을 정하지 않음']);
    var fields = [
      { key: 'matchId', label: '시합', type: 'select', options: options, wide: true, hint: m ? '다른 시합을 고르면 이 글이 그 시합으로 옮겨집니다.' : '시합을 고르면 이 글이 그 시합으로 옮겨집니다.' },
      { key: 'title', label: '제목', required: true, max: 120, wide: true },
      { key: 'eventOn', label: '날짜', type: 'date', hint: '시합 날짜와 다른 날의 안내일 때만 적습니다(예: 전날 연습). 비워 두면 시합 날짜를 따릅니다.' },
      { key: 'place', label: '장소', max: 120, hint: '시합 장소와 다를 때만 적습니다.' },
      { key: 'body', label: '내용', type: 'textarea', max: 5000, rows: 8, wide: true, hint: '집합 시간, 준비물, 주차 같은 안내를 적습니다. 줄을 바꾼 대로 보입니다.' },
      { key: 'albumUrl', label: '사진 앨범 주소', max: 500, wide: true, placeholder: 'https://',
        hint: '구글 포토 같은 곳에 만든 앨범의 공유 주소를 적으면 회원 화면에 "사진 앨범 열기" 링크가 나옵니다. 보호자 동의를 확인한 사진만 올린 앨범이어야 합니다.',
        check: function (v) { return !v || /^https:\/\/[^\s"'<>]+$/.test(v) ? '' : 'https:// 로 시작하는 주소를 빈칸이나 따옴표 없이 적어 주세요.'; } },
      { key: 'published', label: '공개', type: 'toggle', text: '시합 참가 권한이 있는 회원에게 보이게 합니다', wide: true,
        hint: '꺼 두면 관리자만 봅니다. 써 두었다가 나중에 공개할 수 있습니다. 시합이 숨김이면 글도 공개할 수 없습니다.' }
    ];
    var openNow = !!m && m.state === 'published' && !m.deleted;
    var values = isNew ? { matchId: m ? m.id : '', published: openNow }
      : { matchId: m ? m.id : '', title: p.title, eventOn: p.eventOn, place: p.place, body: p.body, albumUrl: p.albumUrl, published: p.state === 'published' };
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
      var g = got.data, target = g.matchId ? allMatches().filter(function (x) { return x.id === g.matchId; })[0] : null;
      if (g.matchId && !target) { A.ui.dialogError('고른 시합을 찾지 못했습니다. 새로 고침한 뒤 다시 해 주세요.'); return; }
      // 숨김인 시합의 글은 공개로 둘 수 없습니다(회원 화면에는 안 나와도 문서는 내려가기 때문입니다).
      if (g.published && target && (target.state !== 'published' || target.deleted)) {
        A.ui.dialogError('고른 시합이 숨김 상태라 이 글을 공개할 수 없습니다. 공개를 끄고 저장하거나, 시합 정보 수정에서 시합을 먼저 공개해 주세요.');
        return;
      }
      A.ui.dialogError(''); A.ui.busy(true);
      var id = isNew ? A.newId() : p.id, times = isNew ? ['createdAt', 'updatedAt'] : ['updatedAt'];
      var data = A.stampUid({ title: g.title, eventOn: g.eventOn, place: g.place, body: g.body, albumUrl: g.albumUrl, state: g.published ? 'published' : 'draft' });
      var mask = Object.keys(data).concat(['matchId']);            // 시합을 정하지 않은 글은 matchId 항목 없이 둡니다(있던 것은 지웁니다)
      if (g.matchId) data.matchId = g.matchId;
      var write = isNew ? A.write.set(POSTS, id, data, { create: true, times: times }) : A.write.set(POSTS, id, data, { mask: mask, times: times, base: d._updateTime });
      A.api.commit([write]).then(function (res) {
        if (!g.matchId) delete d.matchId;
        A.store.put(POSTS, id, applied(isNew ? { id: id } : d, data, res, 0, times));
        A.ui.busy(false); A.ui.close(true);
        var moved = !isNew && !!target && g.matchId !== (m ? m.id : '');
        A.ui.toast(isNew ? '소식을 올렸습니다.' + (g.published ? '' : ' 숨김 상태라 회원에게는 보이지 않습니다.')
          : (moved ? '"' + target.title + '" 시합으로 옮겼습니다.' : '고친 내용을 저장했습니다.' + (g.published ? '' : ' 숨김 상태라 회원에게는 보이지 않습니다.')));
        A.render();
      }, function (err) { A.ui.busy(false); A.ui.dialogError('저장하지 못했습니다. ' + A.errorText(err)); });
    };
    // 시합 화면에서 연 창은 시합이 이미 골라져 있으니 제목 칸에서 시작합니다.
    var toTitle = function () { var i = form.node.querySelector('input:not([type=checkbox])'); if (i) i.focus(); };
    A.ui.open({
      title: isNew ? '시합 소식 올리기' : '시합 소식 수정', body: body, dirty: form.dirty, focus: m ? toTitle : form.focus,
      actions: [
        isNew ? null : { label: '휴지통으로 옮기기', cls: 'linkbtn linkbtn--danger', left: true, onClick: function () { trashPost(p); } },
        { label: '취소', cls: 'linkbtn', onClick: function () { A.ui.close(); } },
        { label: '저장', cls: 'btn btn--sm', onClick: save }
      ].filter(Boolean)
    });
  }

  /* ---------- 글의 휴지통 ----------
     휴지통으로 옮기면 회원에게 보이지 않게 '숨김'으로도 바꿉니다(보안 규칙이 휴지통의 글은 숨김이어야 한다고 정합니다). */
  function trashPost(p) {
    var d = p.doc, data = A.stampUid({ deletedBy: A.user.uid, state: 'draft' }), times = ['deletedAt', 'updatedAt'];
    A.ui.busy(true);
    A.api.commit([A.write.set(POSTS, p.id, data, { mask: Object.keys(data), times: times, base: d._updateTime })]).then(function (res) {
      A.store.put(POSTS, p.id, applied(d, data, res, 0, times));
      A.ui.busy(false); A.ui.close(true);
      A.ui.toast('휴지통으로 옮겼습니다. 회원에게는 더 보이지 않습니다.');
      A.render();
    }, function (err) { A.ui.busy(false); A.ui.dialogError('옮기지 못했습니다. ' + A.errorText(err)); });
  }
  function restorePost(p) {
    A.trash.restore(POSTS, p.doc, true).then(function () { A.ui.toast('숨김 상태로 되돌렸습니다. 다시 보이게 하려면 수정에서 공개를 켜 주세요.'); A.render(); },
      function (err) { A.ui.toast('되돌리지 못했습니다. ' + A.errorText(err), true); });
  }
  function purgePost(p) {
    A.ui.ask({ title: '완전히 삭제할까요?', text: '"' + p.title + '" 글을 DB에서 지웁니다. 되돌릴 수 없습니다.', yes: '완전히 삭제', danger: true }).then(function (yes) {
      if (!yes) return;
      A.trash.purge(POSTS, p.doc).then(function () { A.ui.toast('완전히 삭제했습니다.'); A.render(); },
        function (err) { A.ui.toast('삭제하지 못했습니다. ' + A.errorText(err), true); });
    });
  }

  /* ---------- 어느 화면을 그릴지 ---------- */
  function render(root) {
    var sub = A.sub || '';
    listResults = null; postResults = null; shown = null;
    if (sub === NONE && postsOf(NONE).length) { renderPosts(root, null); return; }
    if (sub && sub !== NONE) {
      var m = allMatches().filter(function (x) { return x.id === sub; })[0];
      if (m) { renderPosts(root, m); return; }
    }
    // 없는 시합의 주소이거나 시합을 정하지 않은 글이 더 없으면 목록을 보여 주고, 주소도 목록의 것으로 맞춥니다.
    if (sub) {
      A.sub = '';
      try { window.history.replaceState(null, '', '#matches'); } catch (e) { /* 주소를 못 바꿔도 화면은 목록입니다 */ }
    }
    renderList(root);
  }

  A.section({ id: 'matches', title: '시합 관리', needs: [MATCHES, POSTS, MEMBERS], render: render });
})();
