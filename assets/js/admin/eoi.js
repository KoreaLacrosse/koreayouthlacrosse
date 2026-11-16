/* ==========================================================================
   관리자 화면 : 참가 의향 회신 (2027 제주 국제 유소년 라크로스 교류전)
   Firestore 의 eoiReplies 컬렉션을 표로 보고, 거르고, 집계하고, 추가·수정·삭제합니다.
   회신서(index.html #form-eoi)의 보기와 tools/firestore.rules 의 허용 값이 아래 이름표와 같아야 합니다.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.KYLA_ADMIN, el = A.el, add = A.add, num = A.num, text = A.text;
  var COL = 'eoiReplies';

  // 저장된 값(화면 언어와 상관없는 코드)과 한국어 이름
  var LABEL = {
    lang: { ko: '한국어', en: '영어', ja: '일본어' },
    intent: { active: '적극 검토', internal: '내부 협의 후 결정', undecided: '미정', unable: '현재 참가 어려움' },
    period: { '2027-06': '2027년 6월', other: '다른 기간 제안' },
    fee: { ok: '검토 가능', discuss: '협의 필요', hold: '판단 유보' },
    method: { whatsapp: 'WhatsApp', line: 'LINE', kakaotalk: 'KakaoTalk', instagram: 'Instagram', other: '기타' },
    status: { 'new': '새 회신', contacting: '협의 중', confirmed: '참가 확정', declined: '불참' }
  };
  var INTENTS = ['active', 'internal', 'undecided', 'unable'], STATUSES = ['new', 'contacting', 'confirmed', 'declined'];
  var TONE = { active: 'green', internal: 'blue', undecided: 'orange', unable: 'muted' };
  var DIVISIONS = [
    ['u10mixed', 'U10 혼성'], ['u12boys', 'U12 남자부'], ['u12girls', 'U12 여자부'], ['u14boys', 'U14 남자부'],
    ['u14girls', 'U14 여자부'], ['u16boys', 'U16 남자부'], ['u16girls', 'U16 여자부']
  ];
  var NUMS = [['teams', '팀'], ['players', '선수'], ['staff', '인솔자']];
  function label(group, code) { return code ? (LABEL[group][code] || String(code)) : ''; }
  function options(group, order, first) {
    var list = (order || Object.keys(LABEL[group])).map(function (k) { return [k, LABEL[group][k]]; });
    return first ? [['', first]].concat(list) : list;
  }

  var state = { tab: 'list', view: 'reply', q: '', intent: '', status: '', country: '', period: '', lang: '', divs: [], trash: false, sort: { key: 'at', dir: 'desc' }, page: 1 };

  /* ---------- 문서 → 화면에서 쓰는 꼴 ---------- */
  function model(d) {
    var dv = d.divisions && typeof d.divisions === 'object' ? d.divisions : {}, divisions = [];
    DIVISIONS.forEach(function (p) {
      var one = dv[p[0]];
      if (!one || typeof one !== 'object') return;
      divisions.push({ code: p[0], name: p[1], teams: A.count(one.teams), players: A.count(one.players), staff: A.count(one.staff) });
    });
    return {
      id: d.id, doc: d, at: A.time(text(d.submittedAt) || d._createTime),
      lang: text(d.lang), org: text(d.org), country: text(d.country), contactName: text(d.contactName), role: text(d.role), email: text(d.email),
      methods: (Array.isArray(d.contactMethods) ? d.contactMethods : []).map(text), contactDetail: text(d.contactDetail), divisions: divisions,
      period: text(d.period), dates: text(d.dates), intent: text(d.intent), fee: text(d.fee), note: text(d.note), text: text(d.text),
      status: STATUSES.indexOf(d.status) >= 0 ? d.status : 'new', phone: text(d.phone), adminNote: text(d.adminNote), manual: d.source === 'manual', deleted: !!d.deletedAt
    };
  }
  function all() { return A.store.all(COL).map(model); }
  function sum(divs, key) {
    var t = null;
    divs.forEach(function (d) { if (d[key] !== null) t = (t || 0) + d[key]; });
    return t;
  }
  // 디비전 필터가 켜져 있으면 그 디비전만, 아니면 고른 디비전 전부
  function shown(r) { return state.divs.length ? r.divisions.filter(function (d) { return state.divs.indexOf(d.code) >= 0; }) : r.divisions; }

  function matches(r) {
    if (r.deleted !== state.trash) return false;
    if (state.intent && r.intent !== state.intent) return false;
    if (state.status && r.status !== state.status) return false;
    if (state.country && r.country !== state.country) return false;
    if (state.period && r.period !== state.period) return false;
    if (state.lang && r.lang !== state.lang) return false;
    if (state.divs.length && !shown(r).length) return false;
    if (state.q) {
      var hay = [r.org, r.country, r.contactName, r.role, r.email, r.contactDetail, r.phone, r.note, r.adminNote].join('\n').toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) < 0) return false;
    }
    return true;
  }
  function filtersOn() { return !!(state.q || state.intent || state.status || state.country || state.period || state.lang || state.divs.length); }
  // 표의 한 줄. 회신별 보기에서는 회신 한 건, 디비전별 보기에서는 회신의 디비전 하나
  function rowsOf(list) {
    var rows = [];
    list.forEach(function (r) {
      var divs = shown(r);
      if (state.view === 'division' && divs.length) {
        divs.forEach(function (d) { rows.push({ r: r, divs: [d], teams: d.teams, players: d.players, staff: d.staff }); });
      } else {
        rows.push({ r: r, divs: divs, teams: sum(divs, 'teams'), players: sum(divs, 'players'), staff: sum(divs, 'staff') });
      }
    });
    return rows;
  }
  function totals(list) {
    var t = { replies: list.length, teams: 0, players: 0, staff: 0 };
    list.forEach(function (r) { var d = shown(r); t.teams += sum(d, 'teams') || 0; t.players += sum(d, 'players') || 0; t.staff += sum(d, 'staff') || 0; });
    return t;
  }

  /* ---------- 표의 열 ---------- */
  function intentTag(r) { return A.ui.tag(label('intent', r.intent) || '의향 없음', TONE[r.intent] || 'muted'); }
  // 주 연락처: 연락 수단 이름과 그 ID·링크를 한 줄로
  function reach(r) { return [r.methods.map(function (m) { return label('method', m); }).join(', '), r.contactDetail].filter(Boolean).join(' · '); }
  var COLUMNS = [
    { key: 'at', label: '접수', cls: 'adm-col-date', sort: function (x) { return x.r.at ? x.r.at.iso : ''; },
      node: function (x) { var s = el('span', 'adm-when', x.r.at ? x.r.at.date : ''); if (x.r.at) add(s, el('small', '', x.r.at.clock)); return s; } },
    { key: 'org', label: '단체', cls: 'adm-col-main', head: true, text: function (x) { return x.r.org; },
      node: function (x) { var s = el('span', 'adm-strong', x.r.org || '(이름 없음)'); return x.r.manual ? [s, ' ', el('small', 'adm-mark', '직접 입력')] : s; } },
    { key: 'country', label: '국가·지역', cls: 'adm-col-text', text: function (x) { return x.r.country; } },
    { key: 'contact', label: '담당자', cls: 'adm-col-text', text: function (x) { return x.r.contactName; },
      node: function (x) { return x.r.role ? [x.r.contactName, el('small', 'adm-sub', x.r.role)] : x.r.contactName; } },
    { key: 'intent', label: '참가 의향', sort: function (x) { return INTENTS.indexOf(x.r.intent); }, node: function (x) { return intentTag(x.r); } },
    { key: 'division', label: '디비전', sort: function (x) { return x.divs.length ? DIVISIONS.map(function (d) { return d[0]; }).indexOf(x.divs[0].code) : null; },
      cls: 'adm-col-wide',
      node: function (x) {
        if (!x.divs.length) return el('span', 'adm-faint', '고른 디비전 없음');
        return x.divs.map(function (d, i) { return [i ? ', ' : '', el('span', 'adm-nb', d.name)]; });      // 이름 가운데에서 줄이 바뀌지 않게
      } },
    { key: 'teams', label: '팀', num: true, text: function (x) { return x.teams; } },
    { key: 'players', label: '선수', num: true, text: function (x) { return x.players; } },
    { key: 'staff', label: '인솔자', num: true, text: function (x) { return x.staff; } },
    { key: 'status', label: '진행 상태', sort: function (x) { return STATUSES.indexOf(x.r.status); },
      node: function (x) { return A.ui.tag(label('status', x.r.status), x.r.status === 'new' ? 'red' : ''); } },
    { key: 'memo', label: '비고', cls: 'adm-col-wide', text: function (x) { return x.r.adminNote; },
      node: function (x) { if (!x.r.adminNote) return ''; var s = el('span', 'adm-clip', x.r.adminNote); s.title = x.r.adminNote; return s; } },
    // 담당자 연락처. 표가 넓어 옆으로 밀어야 보일 수 있어, 참가 내용 뒤에 둡니다.
    { key: 'email', label: '이메일', cls: 'adm-col-email', text: function (x) { return x.r.email; }, node: function (x) { return A.ui.email(x.r.email); } },
    { key: 'reach', label: '주 연락처', cls: 'adm-col-text', text: function (x) { return reach(x.r); },
      node: function (x) {
        var names = x.r.methods.map(function (m) { return label('method', m); }).join(', ');
        if (!names) return x.r.contactDetail;
        return x.r.contactDetail ? [el('span', 'adm-nb', names), el('small', 'adm-sub', x.r.contactDetail)] : el('span', 'adm-nb', names);
      } },
    { key: 'phone', label: '전화번호', cls: 'adm-col-nowrap', text: function (x) { return x.r.phone; } }
  ];

  /* ---------- 그리기 ---------- */
  var results = null;
  function render(root) {
    var list = all(), trashCount = list.filter(function (r) { return r.deleted; }).length;
    var head = el('div', 'adm-head'), tools = el('div', 'adm-tools');
    add(tools,
      A.button('btn btn--sm', '회신 추가', function () { edit(null); }, 'tool:add'),
      A.button('btn btn--sm btn--ghost', '엑셀용 파일 내려받기', download, 'tool:csv'),
      A.button('linkbtn', '새로 고침', function () { A.reload(); }, 'tool:reload'));
    add(head, add(el('div'), el('h1', 't-2', state.trash ? '참가 의향 회신: 휴지통' : '참가 의향 회신'), el('p', 'adm-head__sub', '2027 제주 국제 유소년 라크로스 교류전')), tools);
    add(root, head);

    var countries = Object.keys(A.countBy(list.filter(function (r) { return r.deleted === state.trash; }), function (r) { return r.country; })).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
    if (state.country && countries.indexOf(state.country) < 0) state.country = '';
    var bar = el('div', 'adm-filters'), set = function (key) { return function (v) { state[key] = v; state.page = 1; update(); }; };
    add(bar,
      A.ui.search('단체, 담당자, 연락처, 비고', state.q, set('q')),
      A.ui.select('참가 의향', options('intent', INTENTS, '전체'), state.intent, set('intent')),
      A.ui.select('진행 상태', options('status', STATUSES, '전체'), state.status, set('status')),
      A.ui.select('국가·지역', [['', '전체']].concat(countries.map(function (c) { return [c, c]; })), state.country, set('country')),
      A.ui.select('희망 시기', options('period', null, '전체'), state.period, set('period')),
      A.ui.select('작성 언어', options('lang', null, '전체'), state.lang, set('lang')));
    add(root, bar, A.ui.chips('디비전', DIVISIONS, state.divs, function () { state.page = 1; update(); }));

    var line = el('div', 'adm-viewline');
    add(line,
      A.ui.tabs('보기', [['list', '목록'], ['stats', '통계']], state.tab, function (v) { state.tab = v; A.render(); }),
      state.tab === 'list' ? A.ui.tabs('줄 나누기', [['reply', '회신별'], ['division', '디비전별']], state.view, function (v) { state.view = v; state.page = 1; A.render(); }) : null,
      A.button('linkbtn adm-viewline__end', state.trash ? '목록으로 돌아가기' : '휴지통 (' + num(trashCount) + ')', function () { state.trash = !state.trash; state.page = 1; A.render(); }, 'tool:trash'));
    add(root, line);

    results = el('div', 'adm-results');
    add(root, results);
    if (A.store.capped(COL)) add(root, el('p', 'adm-foot', '회신이 너무 많아 가장 최근 것부터 일부만 불러왔습니다.'));
    add(root, el('p', 'adm-foot', '내려받은 파일에는 담당자 이름과 연락처가 들어 있으니 필요한 사람과만 나눠 주세요.'));
    update();
  }

  function update() {
    if (!results) return;
    var list = all().filter(matches), t = totals(list);
    results.textContent = '';
    var clear = filtersOn() ? A.button('linkbtn', '필터 지우기', function () {
      state.q = ''; state.intent = ''; state.status = ''; state.country = ''; state.period = ''; state.lang = ''; state.divs.length = 0; state.page = 1; A.render();
    }) : null;
    var scope = state.divs.length ? '팀, 선수, 인솔자는 ' + DIVISIONS.filter(function (d) { return state.divs.indexOf(d[0]) >= 0; }).map(function (d) { return d[1]; }).join(', ') + '만 센 숫자입니다. ' : '';
    add(results, A.ui.tiles([
      { label: state.trash ? '휴지통의 회신' : (filtersOn() ? '걸러 낸 회신' : '회신'), value: t.replies, unit: '건' },
      { label: '예상 팀', value: t.teams, unit: '팀' },
      { label: '예상 선수', value: t.players, unit: '명' },
      { label: '예상 인솔자', value: t.staff, unit: '명' }
    ]), clear ? add(el('p', 'adm-filternote'), '필터를 걸어 본 결과입니다. ' + scope, clear) : null);
    if (state.tab === 'stats') { add(results, stats(list)); return; }

    var rows = A.ui.sortRows(rowsOf(list), COLUMNS, state.sort.key, state.sort.dir);
    add(results, A.ui.table({
      caption: '참가 의향 회신', columns: COLUMNS, rows: rows, sort: state.sort, page: state.page,
      rowKey: function (x) { return x.r.id + (state.view === 'division' && x.divs.length ? ':' + x.divs[0].code : ''); },
      onSort: function (key) { state.sort = { key: key, dir: state.sort.key === key && state.sort.dir === 'asc' ? 'desc' : 'asc' }; A.keepFocus(update); },
      onPage: function (n) { state.page = n; A.keepFocus(update); results.scrollIntoView({ block: 'start' }); },
      actions: function (x) {
        if (!state.trash) { var b = A.button('adm-rowbtn', '수정', function () { edit(x.r); }); b.setAttribute('aria-label', x.r.org + ' 수정'); return [b]; }
        return [A.button('adm-rowbtn', '되돌리기', function () { restore(x.r); }), A.button('adm-rowbtn adm-rowbtn--danger', '완전히 삭제', function () { purge(x.r); })];
      },
      onOpen: state.trash ? null : function (x) { edit(x.r); },
      foot: rows.length > 1 ? COLUMNS.map(function (c) { return c.key === 'org' ? '합계' : (c.key === 'teams' || c.key === 'players' || c.key === 'staff' ? t[c.key] : ''); }) : null,
      empty: state.trash ? { title: '휴지통이 비어 있습니다', text: '' }
        : (filtersOn() ? { title: '조건에 맞는 회신이 없습니다', text: '필터를 줄이거나 지워 보세요.' }
          : { title: '아직 받은 회신이 없습니다', text: '참가 의향 회신서가 제출되면 여기에 최근 것부터 쌓입니다. 이메일로 받은 회신은 "회신 추가"로 직접 넣을 수 있습니다.' })
    }));
  }

  /* ---------- 통계 ---------- */
  function stats(list) {
    var box = el('div', 'adm-cards');
    var codes = state.divs.length ? DIVISIONS.filter(function (d) { return state.divs.indexOf(d[0]) >= 0; }) : DIVISIONS;
    var rows = codes.map(function (p) {
      var hit = list.filter(function (r) { return r.divisions.some(function (d) { return d.code === p[0]; }); });
      var ds = hit.map(function (r) { return r.divisions.filter(function (d) { return d.code === p[0]; })[0]; });
      return { name: p[1], orgs: hit.length, teams: sum(ds, 'teams') || 0, players: sum(ds, 'players') || 0, staff: sum(ds, 'staff') || 0 };
    });
    var max = Math.max.apply(null, rows.map(function (r) { return r.players; }).concat([1]));
    var total = rows.reduce(function (t, r) { return { teams: t.teams + r.teams, players: t.players + r.players, staff: t.staff + r.staff }; }, { teams: 0, players: 0, staff: 0 });
    var table = A.ui.table({
      caption: '디비전별 집계', size: 20, rows: rows,
      columns: [
        { key: 'name', label: '디비전', node: function (r) { return el('span', 'adm-strong', r.name); } },
        { key: 'orgs', label: '단체', num: true, text: function (r) { return r.orgs; } },
        { key: 'teams', label: '팀', num: true, text: function (r) { return r.teams; } },
        { key: 'players', label: '선수', num: true, text: function (r) { return r.players; } },
        { key: 'staff', label: '인솔자', num: true, text: function (r) { return r.staff; } },
        { key: 'bar', label: '선수 수 비교', cls: 'adm-col-bar', node: function (r) {
          var track = el('span', 'adm-bars__track'), b = el('span', 'adm-bars__bar');
          b.style.width = (r.players / max * 100) + '%';
          if (r.players > 0) track.appendChild(b);
          track.setAttribute('data-tip', r.name + ': 선수 ' + num(r.players) + '명'); track.tabIndex = 0;
          return track;
        } }
      ],
      foot: ['합계', list.length, total.teams, total.players, total.staff, '']
    });
    add(box, A.ui.card('디비전별 집계', table, '한 단체가 여러 디비전을 고를 수 있어, 합계의 단체 수는 회신 건수입니다. 숫자 없이 디비전만 고른 회신은 단체 수에만 들어갑니다.'));

    var by = function (key, order, group) {
      var m = A.countBy(list, function (r) { return r[key]; });
      return order.map(function (k) { return { label: label(group, k), value: m[k] || 0 }; });
    };
    add(box, A.ui.card('참가 의향별 회신', A.ui.bars(by('intent', INTENTS, 'intent'), { unit: '건' })));
    add(box, A.ui.card('진행 상태별 회신', A.ui.bars(by('status', STATUSES, 'status'), { unit: '건' })));
    var cm = A.countBy(list, function (r) { return r.country || '(적지 않음)'; });
    var countries = Object.keys(cm).map(function (k) { return { label: k, value: cm[k] }; }).sort(function (a, b) { return b.value - a.value || a.label.localeCompare(b.label, 'ko'); });
    if (countries.length > 8) {
      var rest = countries.slice(7).reduce(function (t, c) { return t + c.value; }, 0);
      countries = countries.slice(0, 7).concat([{ label: '그 밖', value: rest }]);
    }
    add(box, A.ui.card('국가·지역별 회신', A.ui.bars(countries, { unit: '건', none: '조건에 맞는 회신이 없습니다.' }), '회신자가 적은 그대로 묶습니다. 같은 곳이 다르게 적혀 있으면 수정에서 표기를 맞춰 주세요.'));
    return box;
  }

  /* ---------- 내려받기: 지금 걸러 본 결과 그대로 ---------- */
  function download() {
    var list = all().filter(matches);
    if (!list.length) { A.ui.toast('내려받을 회신이 없습니다.', true); return; }
    var when = function (r) { return r.at ? r.at.ymd + ' ' + r.at.clock : ''; };
    if (state.view === 'division' && state.tab === 'list') {
      var head = ['접수 시각(한국 시간)', '소속 단체', '국가·지역', '담당자', '직책', '이메일', '주 연락처', '전화번호', '참가 의향', '진행 상태', '디비전', '팀 수', '선수 수', '인솔자 수', '비고', '문서 ID'];
      A.ui.download('KYLA-제주2027-참가의향회신-디비전별', head, rowsOf(list).map(function (x) {
        var r = x.r;
        return [when(r), r.org, r.country, r.contactName, r.role, r.email, reach(r), r.phone, label('intent', r.intent), label('status', r.status),
          x.divs.map(function (d) { return d.name; }).join(', '), x.teams, x.players, x.staff, r.adminNote, r.id];
      }));
      return;
    }
    var h = ['접수 시각(한국 시간)', '작성 언어', '입력 경로', '소속 단체', '국가·지역', '담당자', '직책', '이메일', '주 연락 수단', '주 연락처 ID·링크', '전화번호', '참가 가능 디비전'];
    DIVISIONS.forEach(function (d) { h.push(d[1] + ' 팀 수', d[1] + ' 선수 수', d[1] + ' 인솔자 수'); });
    h.push('팀 수 합계', '선수 수 합계', '인솔자 수 합계', '희망 시기', '희망 날짜', '참가 의향', '예상 참가비', '기타 의견', '진행 상태', '비고', '문서 ID');
    A.ui.download('KYLA-제주2027-참가의향회신', h, list.map(function (r) {
      var by = {}, row = [when(r), label('lang', r.lang), r.manual ? '직접 입력' : '회신서', r.org, r.country, r.contactName, r.role, r.email,
        r.methods.map(function (m) { return label('method', m); }).join(', '), r.contactDetail, r.phone, r.divisions.map(function (d) { return d.name; }).join(', ')];
      r.divisions.forEach(function (d) { by[d.code] = d; });
      DIVISIONS.forEach(function (d) { NUMS.forEach(function (n) { row.push(by[d[0]] && by[d[0]][n[0]] !== null ? by[d[0]][n[0]] : ''); }); });
      row.push(sum(r.divisions, 'teams'), sum(r.divisions, 'players'), sum(r.divisions, 'staff'), label('period', r.period), r.dates,
        label('intent', r.intent), label('fee', r.fee), r.note, label('status', r.status), r.adminNote, r.id);
      return row;
    }));
  }

  /* ---------- 추가·수정 창 ---------- */
  // 디비전마다: 고름 여부와 팀·선수·인솔자 수
  function divisionField(values) {
    var fs = el('fieldset', 'adm-form__set'), grid = el('div', 'adm-divgrid'), rows = [];
    add(fs, el('legend', 'field__label', '디비전별 예상 인원'));
    add(grid, el('span', 'adm-divgrid__h', '디비전'));
    NUMS.forEach(function (n) { add(grid, el('span', 'adm-divgrid__h', n[1])); });
    DIVISIONS.forEach(function (p) {
      var cur = values[p[0]], lab = el('label', 'check'), cb = el('input'), inputs = [];
      cb.type = 'checkbox'; cb.checked = !!cur;
      add(lab, cb, el('span', '', p[1])); grid.appendChild(lab);
      NUMS.forEach(function (n) {
        var i = el('input', 'input');
        i.type = 'number'; i.min = 0; i.max = 9999; i.inputMode = 'numeric';
        i.value = cur && cur[n[0]] !== null && cur[n[0]] !== undefined ? cur[n[0]] : '';
        i.disabled = !cb.checked;
        i.setAttribute('aria-label', p[1] + ' ' + n[1] + ' 수');
        inputs.push(i); grid.appendChild(i);
      });
      cb.addEventListener('change', function () { inputs.forEach(function (i) { i.disabled = !cb.checked; }); if (cb.checked) inputs[0].focus(); });
      rows.push({ code: p[0], cb: cb, inputs: inputs });
    });
    var err = el('p', 'field__err'); err.hidden = true;
    add(fs, grid, err);
    return {
      node: fs,
      read: function (out) {
        var map = {}, bad = null;
        rows.forEach(function (r) {
          if (!r.cb.checked) return;
          var one = {};
          r.inputs.forEach(function (i, n) {
            var v = i.value.trim();
            if (v === '') return;
            if (!/^\d{1,4}$/.test(v)) { if (!bad) bad = i; return; }
            one[NUMS[n][0]] = parseInt(v, 10);
          });
          map[r.code] = one;
        });
        err.textContent = bad ? '인원은 0부터 9999까지의 숫자로 적어 주세요.' : ''; err.hidden = !bad;
        out.divisions = map;
        return bad;
      }
    };
  }

  function edit(r) {
    var isNew = !r, d = r ? r.doc : {};
    var dv = {};
    (r ? r.divisions : []).forEach(function (x) { dv[x.code] = x; });
    var fields = [
      { key: 'org', label: '소속 단체 또는 참가팀 이름', required: true, max: 200, wide: true },
      { key: 'country', label: '국가·지역', max: 120 },
      { key: 'contactName', label: '담당자 이름', max: 120 },
      { key: 'role', label: '직책', max: 120 },
      { type: 'heading', label: '담당자 연락처' },
      { key: 'email', label: '이메일', type: 'email', max: 200 },
      { key: 'phone', label: '전화번호', type: 'tel', max: 40, hint: '협회가 따로 받아 적는 칸입니다. 회신서에는 이 칸이 없습니다.' },
      { key: 'contactMethods', label: '주 연락 수단', type: 'checks', options: options('method'), wide: true },
      { key: 'contactDetail', label: '주 연락처 ID 또는 링크', max: 300, wide: true, hint: '회신서의 "연락 ID, 링크 또는 전화번호" 칸에 적힌 내용입니다.' },
      { type: 'heading', label: '참가 계획' },
      { key: 'divisions', type: 'custom', wide: true, build: function () { return divisionField(dv); } },
      { key: 'period', label: '희망 시기', type: 'select', options: options('period', null, '고르지 않음') },
      { key: 'dates', label: '참가 가능한 주말이나 희망 날짜', max: 300 },
      { key: 'intent', label: '참가 의향', type: 'select', options: options('intent', INTENTS) },
      { key: 'fee', label: '예상 참가비', type: 'select', options: options('fee', null, '고르지 않음') },
      { key: 'note', label: '기타 의견', type: 'textarea', max: 3000, wide: true },
      { type: 'heading', label: '협회 관리용' },
      { key: 'status', label: '진행 상태', type: 'select', options: options('status', STATUSES) },
      { key: 'adminNote', label: '비고', type: 'textarea', max: 2000, wide: true, hint: '회신자에게는 보이지 않습니다. 통화 내용이나 다음에 할 일을 적어 두세요. 목록의 비고 열에 보입니다.' }
    ];
    var values = isNew ? { intent: 'undecided', status: 'new', contactMethods: [] } : {
      org: r.org, country: r.country, contactName: r.contactName, role: r.role, email: r.email, phone: r.phone, contactMethods: r.methods, contactDetail: r.contactDetail,
      period: r.period, dates: r.dates, intent: INTENTS.indexOf(r.intent) >= 0 ? r.intent : 'undecided', fee: r.fee, note: r.note, status: r.status, adminNote: r.adminNote
    };
    var form = A.ui.form(fields, values), body = el('div');
    if (isNew) add(body, el('p', 'adm-dlg__lead', '이메일이나 메신저로 받은 회신을 직접 넣을 때 씁니다. 접수 시각은 저장하는 지금으로 기록됩니다.'));
    add(body, form.node);
    if (!isNew) {
      var meta = el('dl', 'adm-meta');
      var row = function (k, v) { if (v) add(meta, add(el('div'), el('dt', '', k), el('dd', '', v))); };
      row('접수 시각', r.at ? r.at.date + ' ' + r.at.clock + ' (한국 시간)' : '');
      row('입력 경로', r.manual ? '관리자가 직접 입력' : '회신서 (' + (label('lang', r.lang) || '언어 모름') + ' 화면)');
      row('마지막 수정', A.stampText(d.updatedAt, text(d.updatedBy)));
      add(body, meta);
      if (r.text) {
        var raw = el('details', 'adm-raw');
        add(raw, el('summary', '', '회신서로 보낸 내용 원문 보기'), el('pre', '', r.text));
        add(body, raw);
      }
    }
    var save = function () {
      var got = form.read();
      if (!got.ok) { A.ui.dialogError('표시된 칸을 고친 뒤 다시 저장해 주세요.'); return; }
      A.ui.dialogError(''); A.ui.busy(true);
      var data = A.stamp(got.data), id = isNew ? A.newId() : r.id, write, times;
      if (isNew) {
        data.kind = 'eoi'; data.v = 1; data.lang = 'ko'; data.consent = false; data.text = ''; data.source = 'manual';
        times = ['submittedAt', 'updatedAt'];
        write = A.write.set(COL, id, data, { create: true, times: times });
      } else {
        times = ['updatedAt'];
        write = A.write.set(COL, id, data, { mask: Object.keys(data), times: times, base: d._updateTime });
      }
      A.api.commit([write]).then(function (res) {
        var doc = isNew ? { id: id } : d;
        Object.keys(data).forEach(function (k) { doc[k] = data[k]; });
        A.store.put(COL, id, A.committed(doc, res, times));
        A.ui.busy(false); A.ui.close(true);
        A.ui.toast(isNew ? '회신을 추가했습니다.' : '고친 내용을 저장했습니다.');
        A.render();
      }, function (err) { A.ui.busy(false); A.ui.dialogError('저장하지 못했습니다. ' + A.errorText(err)); });
    };
    A.ui.open({
      title: isNew ? '회신 추가' : '회신 수정', body: body, dirty: form.dirty, focus: form.focus,
      actions: [
        isNew ? null : { label: '휴지통으로 옮기기', cls: 'linkbtn linkbtn--danger', left: true, onClick: function () { trash(r); } },
        { label: '취소', cls: 'linkbtn', onClick: function () { A.ui.close(); } },
        { label: '저장', cls: 'btn btn--sm', onClick: save }
      ].filter(Boolean)
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
    A.ui.ask({ title: '완전히 삭제할까요?', text: r.org + ' 회신을 DB에서 지웁니다. 되돌릴 수 없습니다.', yes: '완전히 삭제', danger: true }).then(function (yes) {
      if (!yes) return;
      A.trash.purge(COL, r.doc).then(function () { A.ui.toast('완전히 삭제했습니다.'); A.render(); },
        function (err) { A.ui.toast('삭제하지 못했습니다. ' + A.errorText(err), true); });
    });
  }

  // 다른 화면(대시보드)에서 쓰는 것
  A.eoi = { all: all, label: label, sum: sum, INTENTS: INTENTS, STATUSES: STATUSES, DIVISIONS: DIVISIONS, TONE: TONE,
    open: function (o) { state.q = ''; state.intent = ''; state.country = ''; state.period = ''; state.lang = ''; state.divs.length = 0; state.trash = false; state.tab = 'list'; state.page = 1; state.status = (o && o.status) || ''; A.go('eoi'); } };

  A.section({
    id: 'eoi', title: '참가 의향 회신', needs: [COL], render: render,
    badge: function () { return all().filter(function (r) { return !r.deleted && r.status === 'new'; }).length; }
  });
})();
