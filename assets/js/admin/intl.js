/* ==========================================================================
   관리자 화면 : 국제교류 의향 회신
   방문자가 신청·문의 화면의 '국제교류 의향' 회신서(index.html #form-intl)로 보낸 글(Firestore 의 intlReplies 컬렉션)을
   표로 보고, 진행 상태와 비고를 적습니다.

   - 회신은 가입하지 않아도 보낼 수 있습니다(참가 의향 회신과 같습니다). 읽는 것은 관리자뿐입니다.
   - 보낸 내용(학교·팀, 담당자, 희망하는 교류)은 이 화면에서 고치지 않습니다. 바꾸는 것은 진행 상태와 비고뿐입니다.
   - 보기(디비전, 관심 있는 방식)와 상태 값은 index.html 의 data-code, assets/js/app.js 의 intlRecord, tools/firestore.rules 와 같아야 합니다.
   - 보유 기간은 받은 날부터 3년입니다(개인정보처리방침). 지난 것은 휴지통으로 옮긴 뒤 완전히 삭제합니다.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.KYLA_ADMIN, el = A.el, add = A.add, num = A.num, text = A.text;
  var COL = 'intlReplies';

  var LANGS = [['ko', '한국어'], ['en', '영어'], ['ja', '일본어']];
  var DIVISIONS = [['u10', 'U10'], ['u12', 'U12'], ['u14', 'U14'], ['u16', 'U16']];
  var WAYS = [['visit', '한국 방문'], ['invite', '한국팀 초청'], ['friendly', '친선경기'], ['training', '합동훈련'], ['camp', '캠프'], ['tournament', '공동 대회']];
  var STATUSES = [['new', '새 회신'], ['contacting', '협의 중'], ['done', '협의 완료'], ['closed', '종료']];
  var TONE = { 'new': 'red', contacting: 'blue', done: 'green', closed: 'muted' };
  function name(list, code) { var hit = list.filter(function (p) { return p[0] === code; })[0]; return hit ? hit[1] : ''; }
  function names(list, codes) { return list.filter(function (p) { return codes.indexOf(p[0]) >= 0; }).map(function (p) { return p[1]; }); }
  function withAll(list, first) { return [['', first]].concat(list); }

  var state = { q: '', status: '', way: '', trash: false, sort: { key: 'at', dir: 'desc' }, page: 1 };

  function model(d) {
    var list = function (v) { return (Array.isArray(v) ? v : []).map(text); };
    return {
      id: d.id, doc: d, at: A.time(text(d.submittedAt) || d._createTime), lang: text(d.lang),
      team: text(d.team), country: text(d.country), city: text(d.city), contactName: text(d.contactName), email: text(d.email), contactDetail: text(d.contactDetail),
      divisions: list(d.divisions), ways: list(d.ways), players: A.count(d.players), staff: A.count(d.staff),
      when: text(d.when), note: text(d.note), text: text(d.text),
      status: name(STATUSES, text(d.status)) ? text(d.status) : 'new', adminNote: text(d.adminNote), deleted: !!d.deletedAt
    };
  }
  function all() { return A.store.all(COL).map(model); }
  function place(r) { return [r.country, r.city].filter(Boolean).join(', '); }

  function matches(r) {
    if (r.deleted !== state.trash) return false;
    if (state.status && r.status !== state.status) return false;
    if (state.way && r.ways.indexOf(state.way) < 0) return false;
    if (state.q) {
      var hay = [r.team, r.country, r.city, r.contactName, r.email, r.contactDetail, r.when, r.note, r.adminNote].join('\n').toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) < 0) return false;
    }
    return true;
  }
  function filtersOn() { return !!(state.q || state.status || state.way); }

  var COLUMNS = [
    { key: 'at', label: '접수', cls: 'adm-col-date', sort: function (r) { return r.at ? r.at.iso : ''; }, text: function (r) { return r.at ? r.at.date : ''; },
      node: function (r) { return r.at ? [r.at.date, el('small', 'adm-sub', r.at.clock)] : ''; } },
    { key: 'team', label: '학교·팀', cls: 'adm-col-main', head: true, text: function (r) { return r.team; }, node: function (r) { return el('span', 'adm-strong', r.team || '(이름 없음)'); } },
    { key: 'place', label: '국가·도시', cls: 'adm-col-text', text: place },
    { key: 'contact', label: '담당자', cls: 'adm-col-text', text: function (r) { return r.contactName; } },
    { key: 'ways', label: '관심 있는 방식', cls: 'adm-col-wide', sort: function (r) { return r.ways.length ? WAYS.map(function (w) { return w[0]; }).indexOf(r.ways[0]) : null; },
      node: function (r) {
        var list = names(WAYS, r.ways);
        if (!list.length) return el('span', 'adm-faint', '고른 방식 없음');
        return list.map(function (n, i) { return [i ? ', ' : '', el('span', 'adm-nb', n)]; });       // 이름 가운데에서 줄이 바뀌지 않게
      } },
    { key: 'divisions', label: '디비전', cls: 'adm-col-nowrap', sort: function (r) { return r.divisions.length ? DIVISIONS.map(function (d) { return d[0]; }).indexOf(r.divisions[0]) : null; },
      text: function (r) { return names(DIVISIONS, r.divisions).join(', '); } },
    { key: 'players', label: '선수', num: true, text: function (r) { return r.players; } },
    { key: 'staff', label: '지도자·스태프', num: true, text: function (r) { return r.staff; } },
    { key: 'status', label: '진행 상태', cls: 'adm-col-nowrap', sort: function (r) { return STATUSES.map(function (s) { return s[0]; }).indexOf(r.status); },
      node: function (r) { return A.ui.tag(name(STATUSES, r.status), TONE[r.status]); } },
    { key: 'memo', label: '비고', cls: 'adm-col-wide', text: function (r) { return r.adminNote; },
      node: function (r) { if (!r.adminNote) return ''; var s = el('span', 'adm-clip', r.adminNote); s.title = r.adminNote; return s; } },
    // 답변을 보낼 주소. 표가 넓어 옆으로 밀어야 보일 수 있어 맨 뒤에 둡니다(참가 의향 회신 화면과 같은 자리). 보기 창에도 있습니다.
    { key: 'email', label: '이메일', cls: 'adm-col-email', text: function (r) { return r.email; }, node: function (r) { return A.ui.email(r.email); } }
  ];

  var results = null;
  function render(root) {
    var list = all(), trashCount = list.filter(function (r) { return r.deleted; }).length;
    var head = el('div', 'adm-head'), tools = el('div', 'adm-tools');
    add(tools,
      A.button('btn btn--sm btn--ghost', '엑셀용 파일 내려받기', download, 'tool:csv'),
      A.button('linkbtn', '새로 고침', function () { A.reload(); }, 'tool:reload'));
    add(head, add(el('div'), el('h1', 't-2', state.trash ? '국제교류 의향 회신: 휴지통' : '국제교류 의향 회신'),
      el('p', 'adm-head__sub', '신청·문의 화면의 국제교류 탭에서 보낸 학교·팀 소개와 희망하는 교류')), tools);
    add(root, head);

    var bar = el('div', 'adm-filters'), set = function (key) { return function (v) { state[key] = v; state.page = 1; update(); }; };
    add(bar,
      A.ui.search('학교·팀, 국가, 담당자, 내용', state.q, set('q')),
      A.ui.select('진행 상태', withAll(STATUSES, '전체'), state.status, set('status')),
      A.ui.select('관심 있는 방식', withAll(WAYS, '전체'), state.way, set('way')));
    add(root, bar);

    var line = el('div', 'adm-viewline');
    add(line, A.button('linkbtn adm-viewline__end', state.trash ? '목록으로 돌아가기' : '휴지통 (' + num(trashCount) + ')', function () { state.trash = !state.trash; state.page = 1; A.render(); }, 'tool:trash'));
    add(root, line);

    results = el('div', 'adm-results');
    add(root, results);
    if (A.store.capped(COL)) add(root, el('p', 'adm-foot', '회신이 너무 많아 가장 최근 것부터 일부만 불러왔습니다.'));
    add(root, el('p', 'adm-foot', '가입하지 않아도 보낼 수 있는 회신입니다. 보낸 내용은 고치지 않고, 진행 상태와 비고만 적습니다. 비고는 협회만 봅니다. 답변은 담당자 이메일로 직접 보냅니다. '
      + '보유 기간은 받은 날부터 3년입니다. 지난 회신은 휴지통으로 옮긴 뒤 완전히 삭제해 주세요.'));
    update();
  }

  function update() {
    if (!results) return;
    var list = all().filter(matches);
    results.textContent = '';
    var n = function (code) { return list.filter(function (r) { return r.status === code; }).length; };
    var clear = filtersOn() ? A.button('linkbtn', '필터 지우기', function () { state.q = ''; state.status = ''; state.way = ''; state.page = 1; A.render(); }) : null;
    add(results, A.ui.tiles([
      { label: state.trash ? '휴지통의 회신' : (filtersOn() ? '걸러 낸 회신' : '전체 회신'), value: list.length, unit: '건' },
      { label: '새 회신', value: n('new'), unit: '건' },
      { label: '협의 중', value: n('contacting'), unit: '건' },
      { label: '협의 완료', value: n('done'), unit: '건' }
    ]), clear ? add(el('p', 'adm-filternote'), '필터를 걸어 본 결과입니다. ', clear) : null);

    add(results, A.ui.table({
      caption: '국제교류 의향 회신 목록', columns: COLUMNS, rows: A.ui.sortRows(list, COLUMNS, state.sort.key, state.sort.dir), sort: state.sort, page: state.page,
      rowKey: function (r) { return r.id; },
      onSort: function (key) { state.sort = { key: key, dir: state.sort.key === key && state.sort.dir === 'asc' ? 'desc' : 'asc' }; A.keepFocus(update); },
      onPage: function (p) { state.page = p; A.keepFocus(update); results.scrollIntoView({ block: 'start' }); },
      onOpen: state.trash ? null : open,
      actions: function (r) {
        if (!state.trash) { var b = A.button('adm-rowbtn', '보기', function () { open(r); }); b.setAttribute('aria-label', (r.team || '회신') + ' 보기'); return [b]; }
        return [A.button('adm-rowbtn', '되돌리기', function () { restore(r); }), A.button('adm-rowbtn adm-rowbtn--danger', '완전히 삭제', function () { purge(r); })];
      },
      empty: state.trash ? { title: '휴지통이 비어 있습니다', text: '' }
        : (filtersOn() ? { title: '조건에 맞는 회신이 없습니다', text: '필터를 줄이거나 지워 보세요.' }
          : { title: '아직 받은 회신이 없습니다', text: '신청·문의 화면의 국제교류 탭에서 "국제교류 의향"을 보내면 여기에 쌓입니다.' })
    }));
  }

  function when(r) { return r.at ? r.at.date + ' ' + r.at.clock : ''; }
  function download() {
    var list = A.ui.sortRows(all().filter(matches), COLUMNS, state.sort.key, state.sort.dir);
    if (!list.length) { A.ui.toast('내려받을 회신이 없습니다.', true); return; }
    A.ui.download('KYLA-국제교류-의향-회신',
      ['접수 시각(한국 시간)', '화면 언어', '학교·팀', '국가', '도시', '담당자', '이메일', '다른 연락 수단', '디비전', '선수 수', '지도자·스태프 수',
        '관심 있는 방식', '희망 시기·기간·장소', '그 밖에 전한 내용', '진행 상태', '비고', '문서 ID'],
      list.map(function (r) {
        return [when(r), name(LANGS, r.lang), r.team, r.country, r.city, r.contactName, r.email, r.contactDetail, names(DIVISIONS, r.divisions).join(', '),
          r.players === null ? '' : r.players, r.staff === null ? '' : r.staff, names(WAYS, r.ways).join(', '), r.when, r.note, name(STATUSES, r.status), r.adminNote, r.id];
      }));
  }

  /* ---------- 보기 창: 보낸 내용은 읽기만, 진행 상태와 비고는 고칩니다 ---------- */
  function open(r) {
    var d = r.doc;
    var fields = [
      { key: 'status', label: '진행 상태', type: 'select', options: STATUSES },
      { key: 'adminNote', label: '비고', type: 'textarea', max: 2000, rows: 4, wide: true,
        hint: '보낸 분에게는 보이지 않습니다. 답장한 날이나 다음에 할 일을 적어 두세요. 목록의 비고 열에 보입니다.' }
    ];
    var form = A.ui.form(fields, { status: r.status, adminNote: r.adminNote }), body = el('div');
    var read = el('div', 'adm-read');
    add(read, add(el('p', 'adm-read__top'), A.ui.tag(name(STATUSES, r.status), TONE[r.status]), el('span', '', when(r))),
      el('h3', 'adm-read__title', r.team || '(이름 없음)'));
    if (r.when) add(read, el('p', 'adm-read__label', '희망 시기, 기간, 장소'), el('p', 'adm-read__text', r.when));
    if (r.note) add(read, el('p', 'adm-read__label', '그 밖에 전한 내용'), el('p', 'adm-read__text', r.note));
    var who = el('dl', 'adm-meta');
    var row = function (k, v) { if (v !== '' && v !== null && v !== undefined) add(who, add(el('div'), el('dt', '', k), el('dd', '', String(v)))); };
    row('국가·도시', place(r));
    row('담당자', r.contactName);
    row('이메일', r.email);
    row('다른 연락 수단', r.contactDetail);
    row('디비전', names(DIVISIONS, r.divisions).join(', '));
    row('선수', r.players === null ? '' : num(r.players) + '명');
    row('지도자·스태프', r.staff === null ? '' : num(r.staff) + '명');
    row('관심 있는 방식', names(WAYS, r.ways).join(', '));
    row('보낸 화면', (name(LANGS, r.lang) || '언어 모름') + ' 화면');
    row('마지막 수정', A.stampText(d.updatedAt, text(d.updatedBy)));
    add(body, read, who, form.node);

    var save = function () {
      var got = form.read();
      if (!got.ok) { A.ui.dialogError('표시된 칸을 고친 뒤 다시 저장해 주세요.'); return; }
      A.ui.dialogError(''); A.ui.busy(true);
      var data = A.stamp({ status: got.data.status, adminNote: got.data.adminNote }), times = ['updatedAt'];
      A.api.commit([A.write.set(COL, r.id, data, { mask: Object.keys(data), times: times, base: d._updateTime })]).then(function (res) {
        Object.keys(data).forEach(function (k) { d[k] = data[k]; });
        A.store.put(COL, r.id, A.committed(d, res, times));
        A.ui.busy(false); A.ui.close(true);
        A.ui.toast('고친 내용을 저장했습니다.');
        A.render();
      }, function (err) { A.ui.busy(false); A.ui.dialogError('저장하지 못했습니다. ' + A.errorText(err)); });
    };
    A.ui.open({
      title: '국제교류 의향 회신 보기', body: body, dirty: form.dirty,
      actions: [
        { label: '휴지통으로 옮기기', cls: 'linkbtn linkbtn--danger', left: true, onClick: function () { trash(r); } },
        { label: '취소', cls: 'linkbtn', onClick: function () { A.ui.close(); } },
        { label: '저장', cls: 'btn btn--sm', onClick: save }
      ]
    });
  }

  /* ---------- 휴지통 ---------- */
  function trash(r) {
    A.ui.busy(true);
    A.trash.move(COL, r.doc).then(function () {
      A.ui.busy(false); A.ui.close(true);
      A.ui.toast('휴지통으로 옮겼습니다. 휴지통에서 되돌릴 수 있습니다.');
      A.render();
    }, function (err) { A.ui.busy(false); A.ui.dialogError('옮기지 못했습니다. ' + A.errorText(err)); });
  }
  function restore(r) {
    A.trash.restore(COL, r.doc).then(function () { A.ui.toast('목록으로 되돌렸습니다.'); A.render(); },
      function (err) { A.ui.toast('되돌리지 못했습니다. ' + A.errorText(err), true); });
  }
  function purge(r) {
    A.ui.ask({ title: '완전히 삭제할까요?', text: (r.team || '이') + ' 회신을 DB에서 지웁니다. 되돌릴 수 없습니다.', yes: '완전히 삭제', danger: true }).then(function (yes) {
      if (!yes) return;
      A.trash.purge(COL, r.doc).then(function () { A.ui.toast('완전히 삭제했습니다.'); A.render(); },
        function (err) { A.ui.toast('삭제하지 못했습니다. ' + A.errorText(err), true); });
    });
  }

  // 다른 화면(대시보드)에서 쓰는 것
  A.intl = { all: all, STATUSES: STATUSES,
    open: function (o) { state.q = ''; state.way = ''; state.trash = false; state.page = 1; state.status = (o && o.status) || ''; A.go('intl'); } };

  A.section({
    id: 'intl', title: '국제교류 의향 회신', needs: [COL], render: render,
    badge: function () { return all().filter(function (r) { return !r.deleted && r.status === 'new'; }).length; }
  });
})();
