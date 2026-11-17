/* ==========================================================================
   관리자 화면 : 문의
   회원이 회원 화면(#member)의 문의하기로 남긴 글(Firestore 의 inquiries 컬렉션)을 보고, 처리 상태와 답변을 적습니다.

   - 문의는 가입한 활동 회원만 남깁니다. 직원(관리자)은 남길 수 없습니다(보안 규칙이 막습니다). 그래서 이 화면에는 '문의 추가'가 없습니다.
   - 회원이 적은 내용(분류, 제목, 내용)은 관리자도 고칠 수 없습니다. 바꿀 수 있는 것은 처리 상태와 답변뿐입니다.
   - 답변은 그 회원의 회원 화면 "내가 남긴 문의"에 그대로 보입니다. 회원은 자기 문의 문서를 읽을 수 있으므로,
     회원에게 보이면 안 되는 내부 메모 칸은 두지 않았습니다.
   - 분류와 상태 값은 tools/firestore.rules, assets/js/member.js 의 값과 같아야 합니다.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.KYLA_ADMIN, el = A.el, add = A.add, num = A.num, text = A.text;
  var COL = 'inquiries', MEMBERS = 'members';

  var CATS = [['member', '회원·가입'], ['program', '교육 프로그램'], ['event', '대회·시합'], ['cert', '지도자 자격 신청'], ['docs', '증빙 서류 요청'],
    ['intl', '국제교류'], ['sponsor', '후원·협력'], ['etc', '그 밖의 문의']];
  var STATUSES = [['new', '새 문의'], ['read', '확인함'], ['done', '답변 완료']];
  var TONE = { 'new': 'red', read: 'blue', done: 'green' };
  function name(list, code) { var hit = list.filter(function (p) { return p[0] === code; })[0]; return hit ? hit[1] : ''; }
  function withAll(list, first) { return [['', first]].concat(list); }

  var state = { q: '', cat: '', status: '', trash: false, sort: { key: 'at', dir: 'desc' }, page: 1 };

  function model(d) {
    return {
      id: d.id, doc: d, at: A.time(text(d.createdAt) || d._createTime), uid: text(d.uid), name: text(d.name), email: text(d.email),
      cat: text(d.category), subject: text(d.subject), body: text(d.body), status: name(STATUSES, text(d.status)) ? text(d.status) : 'new',
      reply: text(d.reply), replied: A.time(text(d.repliedAt)), deleted: !!d.deletedAt
    };
  }
  function all() { return A.store.all(COL).map(model); }
  // 보낸 회원의 지금 명부 내용(전화번호, 소속). 탈퇴했으면 없습니다.
  function sender(q) { return A.store.all(MEMBERS).filter(function (m) { return m.id === q.uid; })[0] || null; }

  function matches(q) {
    if (q.deleted !== state.trash) return false;
    if (state.cat && q.cat !== state.cat) return false;
    if (state.status && q.status !== state.status) return false;
    if (state.q) {
      var hay = [q.subject, q.body, q.name, q.email, q.reply].join('\n').toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) < 0) return false;
    }
    return true;
  }
  function filtersOn() { return !!(state.q || state.cat || state.status); }

  var COLUMNS = [
    { key: 'at', label: '접수', cls: 'adm-col-date', sort: function (q) { return q.at ? q.at.iso : ''; }, text: function (q) { return q.at ? q.at.date : ''; },
      node: function (q) { return q.at ? [q.at.date, el('small', 'adm-sub', q.at.clock)] : ''; } },
    { key: 'subject', label: '제목', cls: 'adm-col-main', head: true, text: function (q) { return q.subject; }, node: function (q) { return el('span', 'adm-strong', q.subject || '(제목 없음)'); } },
    { key: 'cat', label: '분류', cls: 'adm-col-nowrap', sort: function (q) { return CATS.map(function (c) { return c[0]; }).indexOf(q.cat); }, text: function (q) { return name(CATS, q.cat) || q.cat; } },
    { key: 'name', label: '보낸 회원', cls: 'adm-col-text', text: function (q) { return q.name; },
      node: function (q) { return [q.name, el('small', 'adm-sub', q.email)]; } },
    { key: 'status', label: '상태', cls: 'adm-col-nowrap', sort: function (q) { return STATUSES.map(function (s) { return s[0]; }).indexOf(q.status); },
      node: function (q) { return A.ui.tag(name(STATUSES, q.status), TONE[q.status]); } },
    { key: 'replied', label: '답변한 날', cls: 'adm-col-date', sort: function (q) { return q.replied ? q.replied.iso : ''; }, text: function (q) { return q.reply && q.replied ? q.replied.date : ''; } }
  ];

  var results = null;
  function render(root) {
    var list = all(), trashCount = list.filter(function (q) { return q.deleted; }).length;
    var head = el('div', 'adm-head'), tools = el('div', 'adm-tools');
    add(tools,
      A.button('btn btn--sm btn--ghost', '엑셀용 파일 내려받기', download, 'tool:csv'),
      A.button('linkbtn', '새로 고침', function () { A.reload(); }, 'tool:reload'));
    add(head, add(el('div'), el('h1', 't-2', state.trash ? '문의: 휴지통' : '문의'), el('p', 'adm-head__sub', '회원이 회원 화면에서 남긴 문의')), tools);
    add(root, head);

    var bar = el('div', 'adm-filters'), set = function (key) { return function (v) { state[key] = v; state.page = 1; update(); }; };
    add(bar,
      A.ui.search('제목, 내용, 이름, 이메일', state.q, set('q')),
      A.ui.select('분류', withAll(CATS, '전체'), state.cat, set('cat')),
      A.ui.select('상태', withAll(STATUSES, '전체'), state.status, set('status')));
    add(root, bar);

    var line = el('div', 'adm-viewline');
    add(line, A.button('linkbtn adm-viewline__end', state.trash ? '목록으로 돌아가기' : '휴지통 (' + num(trashCount) + ')', function () { state.trash = !state.trash; state.page = 1; A.render(); }, 'tool:trash'));
    add(root, line);

    results = el('div', 'adm-results');
    add(root, results);
    if (A.store.capped(COL)) add(root, el('p', 'adm-foot', '문의가 너무 많아 가장 최근 것부터 일부만 불러왔습니다.'));
    add(root, el('p', 'adm-foot', '문의는 가입한 회원만 남길 수 있고, 직원(관리자)은 남길 수 없습니다. 회원이 적은 내용은 고칠 수 없고, 처리 상태와 답변만 적습니다. 답변은 그 회원의 회원 화면에 그대로 보입니다. 회원이 탈퇴하면 그 회원의 문의도 함께 지워집니다.'));
    update();
  }

  function update() {
    if (!results) return;
    var list = all().filter(matches);
    results.textContent = '';
    var n = function (code) { return list.filter(function (q) { return q.status === code; }).length; };
    var clear = filtersOn() ? A.button('linkbtn', '필터 지우기', function () { state.q = ''; state.cat = ''; state.status = ''; state.page = 1; A.render(); }) : null;
    add(results, A.ui.tiles([
      { label: state.trash ? '휴지통의 문의' : (filtersOn() ? '걸러 낸 문의' : '전체 문의'), value: list.length, unit: '건' },
      { label: '새 문의', value: n('new'), unit: '건' },
      { label: '확인함', value: n('read'), unit: '건' },
      { label: '답변 완료', value: n('done'), unit: '건' }
    ]), clear ? add(el('p', 'adm-filternote'), '필터를 걸어 본 결과입니다. ', clear) : null);

    add(results, A.ui.table({
      caption: '문의 목록', columns: COLUMNS, rows: A.ui.sortRows(list, COLUMNS, state.sort.key, state.sort.dir), sort: state.sort, page: state.page,
      rowKey: function (q) { return q.id; },
      onSort: function (key) { state.sort = { key: key, dir: state.sort.key === key && state.sort.dir === 'asc' ? 'desc' : 'asc' }; A.keepFocus(update); },
      onPage: function (p) { state.page = p; A.keepFocus(update); results.scrollIntoView({ block: 'start' }); },
      onOpen: state.trash ? null : open,
      actions: function (q) {
        if (!state.trash) { var b = A.button('adm-rowbtn', q.reply ? '보기' : '답변', function () { open(q); }); b.setAttribute('aria-label', q.subject + ' ' + (q.reply ? '보기' : '답변')); return [b]; }
        return [A.button('adm-rowbtn', '되돌리기', function () { restore(q); }), A.button('adm-rowbtn adm-rowbtn--danger', '완전히 삭제', function () { purge(q); })];
      },
      empty: state.trash ? { title: '휴지통이 비어 있습니다', text: '' }
        : (filtersOn() ? { title: '조건에 맞는 문의가 없습니다', text: '필터를 줄이거나 지워 보세요.' }
          : { title: '아직 받은 문의가 없습니다', text: '회원이 회원 화면의 문의하기로 글을 남기면 여기에 쌓입니다.' })
    }));
  }

  function download() {
    var list = A.ui.sortRows(all().filter(matches), COLUMNS, state.sort.key, state.sort.dir);
    if (!list.length) { A.ui.toast('내려받을 문의가 없습니다.', true); return; }
    A.ui.download('KYLA-문의', ['접수 시각(한국 시간)', '분류', '제목', '내용', '보낸 회원', '이메일', '상태', '답변', '답변 시각(한국 시간)', '문서 ID'],
      list.map(function (q) {
        return [q.at ? q.at.date + ' ' + q.at.clock : '', name(CATS, q.cat) || q.cat, q.subject, q.body, q.name, q.email, name(STATUSES, q.status), q.reply,
          q.reply && q.replied ? q.replied.date + ' ' + q.replied.clock : '', q.id];
      }));
  }

  /* ---------- 보기·답변 창 ---------- */
  function open(q) {
    var d = q.doc, m = sender(q);
    var fields = [
      { key: 'status', label: '처리 상태', type: 'select', options: STATUSES },
      { key: 'reply', label: '답변', type: 'textarea', max: 3000, rows: 6, wide: true,
        hint: '회원 화면의 "내가 남긴 문의"에 그대로 보입니다. 답변을 적어 저장하면 처리 상태가 "답변 완료"로 바뀝니다. 전화나 메일로 답했다면 비워 두고 상태만 바꿔도 됩니다.' }
    ];
    var form = A.ui.form(fields, { status: q.status, reply: q.reply }), body = el('div');
    var read = el('div', 'adm-read');
    add(read, add(el('p', 'adm-read__top'), A.ui.tag(name(CATS, q.cat) || q.cat), el('span', '', q.at ? q.at.date + ' ' + q.at.clock : '')),
      el('h3', 'adm-read__title', q.subject), el('p', 'adm-read__text', q.body));
    var who = el('dl', 'adm-meta');
    var row = function (k, v) { if (v) add(who, add(el('div'), el('dt', '', k), el('dd', '', v))); };
    row('보낸 회원', q.name);
    row('이메일', q.email);
    row('전화', m ? text(m.phone) : '');
    row('소속', m ? text(m.team) : '');
    if (!m) row('회원 명부', '명부에서 찾을 수 없습니다(탈퇴했거나 지워진 회원).');
    row('답변한 때', q.reply && q.replied ? q.replied.date + ' ' + q.replied.clock : '');
    row('마지막 수정', A.stampText(d.updatedAt, A.byText(d.updatedBy, null)));
    add(body, read, who, form.node);

    var save = function () {
      var got = form.read();
      if (!got.ok) { A.ui.dialogError('표시된 칸을 고친 뒤 다시 저장해 주세요.'); return; }
      var g = got.data, changed = g.reply !== q.reply;
      // 문의 문서는 보낸 회원이 읽습니다. 고친 사람은 이메일 대신 uid 로 남깁니다.
      var data = A.stampUid({ status: g.status }), mask = ['status', 'updatedBy'], times = ['updatedAt'];
      // 답변을 새로 적거나 고쳤는데 상태를 그대로 두었다면 '답변 완료'로 바꿉니다.
      if (changed && g.reply && g.status === q.status && g.status !== 'done') data.status = 'done';
      if (changed) {
        mask.push('reply');
        if (g.reply) { data.reply = g.reply; times.push('repliedAt'); }     // 답변한 때는 서버 시각으로 남깁니다
        else mask.push('repliedAt');                                         // 답변을 지우면 답변한 때도 함께 지웁니다
      }
      A.ui.dialogError(''); A.ui.busy(true);
      A.api.commit([A.write.set(COL, q.id, data, { mask: mask, times: times, base: d._updateTime })]).then(function (res) {
        d.status = data.status; d.updatedBy = data.updatedBy;
        if (changed) { if (g.reply) d.reply = g.reply; else { delete d.reply; delete d.repliedAt; } }
        A.store.put(COL, q.id, A.committed(d, res, times));
        A.ui.busy(false); A.ui.close(true);
        A.ui.toast(changed && g.reply ? '답변을 저장했습니다. 회원 화면에 보입니다.' : '고친 내용을 저장했습니다.');
        A.render();
      }, function (err) { A.ui.busy(false); A.ui.dialogError('저장하지 못했습니다. ' + A.errorText(err)); });
    };
    A.ui.open({
      title: '문의 보기', body: body, dirty: form.dirty, focus: function () { var t = body.querySelector('textarea'); if (t && !q.reply) t.focus(); },
      actions: [
        { label: '휴지통으로 옮기기', cls: 'linkbtn linkbtn--danger', left: true, onClick: function () { trash(q); } },
        { label: '취소', cls: 'linkbtn', onClick: function () { A.ui.close(); } },
        { label: '저장', cls: 'btn btn--sm', onClick: save }
      ]
    });
  }

  /* ---------- 휴지통 ---------- */
  function trash(q) {
    A.ui.busy(true);
    A.trash.move(COL, q.doc, true).then(function () {
      A.ui.busy(false); A.ui.close(true);
      A.ui.toast('휴지통으로 옮겼습니다. 휴지통에서 되돌릴 수 있습니다.');
      A.render();
    }, function (err) { A.ui.busy(false); A.ui.dialogError('옮기지 못했습니다. ' + A.errorText(err)); });
  }
  function restore(q) {
    A.trash.restore(COL, q.doc, true).then(function () { A.ui.toast('목록으로 되돌렸습니다.'); A.render(); },
      function (err) { A.ui.toast('되돌리지 못했습니다. ' + A.errorText(err), true); });
  }
  function purge(q) {
    A.ui.ask({ title: '완전히 삭제할까요?', text: '"' + q.subject + '" 문의를 DB에서 지웁니다. 회원 화면에서도 사라지고 되돌릴 수 없습니다.', yes: '완전히 삭제', danger: true }).then(function (yes) {
      if (!yes) return;
      A.trash.purge(COL, q.doc).then(function () { A.ui.toast('완전히 삭제했습니다.'); A.render(); },
        function (err) { A.ui.toast('삭제하지 못했습니다. ' + A.errorText(err), true); });
    });
  }

  // 다른 화면(대시보드)에서 쓰는 것
  A.inquiries = { all: all, CATS: CATS, STATUSES: STATUSES,
    open: function (o) { state.q = ''; state.cat = ''; state.trash = false; state.page = 1; state.status = (o && o.status) || ''; A.go('inquiries'); } };

  A.section({
    id: 'inquiries', title: '문의', needs: [COL, MEMBERS], render: render,
    badge: function () { return all().filter(function (q) { return !q.deleted && q.status === 'new'; }).length; }
  });
})();
