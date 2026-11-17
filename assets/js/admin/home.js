/* ==========================================================================
   관리자 화면 : 대시보드
   회원, 문의, 참가 의향 회신의 주요 숫자, 확인이 필요한 일, 간단한 통계를 한 화면에 모읍니다.
   직원(관리자) 여부를 알려면 관리자 명단이 필요해 admins 도 함께 읽습니다.
   숫자는 모두 휴지통에 있는 것을 뺀 값입니다.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.KYLA_ADMIN, el = A.el, add = A.add, num = A.num;

  function render(root) {
    var E = A.eoi, M = A.members, Q = A.inquiries;
    var newInquiries = Q.all().filter(function (q) { return !q.deleted && q.status === 'new'; });
    var replies = E.all().filter(function (r) { return !r.deleted; }), members = M.all().filter(function (m) { return !m.deleted; });
    var active = members.filter(function (m) { return m.status === 'active'; });
    var month = A.today().slice(0, 7), joined = members.filter(function (m) { return M.joinedMonth(m) === month; });
    var fresh = replies.filter(function (r) { return r.status === 'new'; });
    var likely = replies.filter(function (r) { return r.intent === 'active' || r.intent === 'internal'; });
    var players = likely.reduce(function (t, r) { return t + (E.sum(r.divisions, 'players') || 0); }, 0);

    var now = A.time(new Date().toISOString());
    add(root, add(el('div', 'adm-head'), add(el('div'), el('h1', 't-2', '대시보드'), el('p', 'adm-head__sub', now.date + ' ' + now.clock + ' 기준')),
      add(el('div', 'adm-tools'), A.button('linkbtn', '새로 고침', function () { A.reload(); }, 'tool:reload'))));

    add(root, A.ui.tiles([
      { label: '활동 회원', value: active.length, unit: '명', note: '명부 전체 ' + num(members.length) + '명' },
      { label: '이번 달 새 회원', value: joined.length, unit: '명', note: '가입일 기준' },
      { label: '답하지 않은 새 문의', value: newInquiries.length, unit: '건', go: '문의에서 보기', onGo: newInquiries.length ? function () { Q.open({ status: 'new' }); } : null },
      { label: '참가 의향 회신', value: replies.length, unit: '건', note: '적극 검토 ' + num(replies.filter(function (r) { return r.intent === 'active'; }).length) + '건' },
      { label: '아직 확인하지 않은 회신', value: fresh.length, unit: '건', go: '회신에서 보기', onGo: fresh.length ? function () { E.open({ status: 'new' }); } : null },
      { label: '예상 참가 선수', value: players, unit: '명', note: '적극 검토와 내부 협의 회신 기준' }
    ]));

    var cards = el('div', 'adm-cards');
    add(cards, A.ui.card('종류별 활동 회원', A.ui.bars(M.byType(active), { unit: '명' }), M.MULTI));
    add(cards, A.ui.card('달마다 새로 가입한 회원', A.ui.columns(M.months(members), { unit: '명' }), '최근 12개월, 가입일 기준입니다.'));

    var intentCount = A.countBy(replies, function (r) { return r.intent; });
    add(cards, A.ui.card('참가 의향별 회신', A.ui.bars(E.INTENTS.map(function (k) { return { label: E.label('intent', k), value: intentCount[k] || 0 }; }), { unit: '건' })));
    add(cards, A.ui.card('디비전별 예상 선수', A.ui.bars(E.DIVISIONS.map(function (p) {
      var ds = [];
      likely.forEach(function (r) { r.divisions.forEach(function (d) { if (d.code === p[0]) ds.push(d); }); });
      return { label: p[1], value: E.sum(ds, 'players') || 0, sub: ds.length + '개 단체' };
    }), { unit: '명' }), '적극 검토와 내부 협의 회신 기준입니다.'));

    // 최근 회신
    var recent = el('ul', 'adm-recent');
    replies.slice().sort(function (a, b) { return (b.at ? b.at.iso : '').localeCompare(a.at ? a.at.iso : ''); }).slice(0, 5).forEach(function (r) {
      var li = el('li');
      add(li, el('span', 'adm-when', r.at ? r.at.date : ''), add(el('span', 'adm-recent__main'), el('span', 'adm-strong', r.org), r.country ? el('small', '', r.country) : null),
        A.ui.tag(E.label('intent', r.intent), E.TONE[r.intent] || 'muted'));
      recent.appendChild(li);
    });
    var recentBox = el('div');
    add(recentBox, replies.length ? recent : el('p', 'adm-none', '아직 받은 회신이 없습니다.'), A.button('linkbtn', '회신 모두 보기', function () { E.open(); }));
    add(cards, A.ui.card('최근 회신', recentBox));

    // 사이트에 올라가 있는 내용 (assets/js/data.js)
    var D = window.KYLA_DATA || {}, site = el('dl', 'adm-kv');
    var kv = function (k, v) { add(site, add(el('div'), el('dt', '', k), el('dd', '', v))); };
    var notices = D.notices || [], last = notices.map(function (n) { return n.date || ''; }).sort().pop();
    kv('공지사항', num(notices.length) + '건' + (last ? ', 가장 최근 ' + last.replace(/-/g, '.') : ''));
    kv('일정', num((D.events || []).length) + '건');
    kv('사진첩', num((D.albums || []).length) + '개');
    add(cards, A.ui.card('사이트에 올라가 있는 내용', site, '공지, 일정, 사진은 이 화면이 아니라 사이트 파일에서 고칩니다. 지금처럼 요청해 주시면 올립니다.'));
    add(root, cards);
  }

  A.section({ id: 'home', title: '대시보드', needs: ['eoiReplies', 'members', 'admins', 'inquiries'], render: render });
})();
