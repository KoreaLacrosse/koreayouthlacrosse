/* KYLA 홈페이지 동작: 화면 전환, 공지·일정·사진 목록, 신청서, 히어로 작전판 */
(function () {
  'use strict';

  var D = window.KYLA_DATA || {};
  var CFG = D.config || {};

  /* ---------- 언어 ----------
     화면 언어는 <html lang> 을 따릅니다. 한국어가 원본이고,
     영어·일본어 문구는 assets/js/i18n.js (자동 생성) 에서 옵니다. */
  var LANG = (document.documentElement.getAttribute('lang') || 'ko').slice(0, 2);
  var BASE = document.documentElement.getAttribute('data-base') || '';
  var DICT = (window.KYLA_I18N || {})[LANG] || {};
  function T(s, vars) {
    var out = Object.prototype.hasOwnProperty.call(DICT, s) ? DICT[s] : s;
    return vars ? out.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] == null ? m : vars[k]; }) : out;
  }
  // 내용 파일의 { ko: "…", en: "…", ja: "…" } 에서 화면 언어를 고릅니다. 번역이 없으면 한국어를 씁니다.
  function isLocal(v) { return !!v && typeof v === 'object' && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, 'ko'); }
  function pick(v) {
    if (isLocal(v)) return pick(v[LANG] == null || v[LANG] === '' ? v.ko : v[LANG]);
    if (Array.isArray(v)) return v.map(pick);
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).forEach(function (k) { o[k] = pick(v[k]); });
      return o;
    }
    return v;
  }
  // 제목에 번역이 없는 항목은 한국어로 보이므로 koOnly 로 표시해 둡니다.
  function localize(list) {
    return (list || []).map(function (item) {
      var o = pick(item);
      o.koOnly = LANG !== 'ko' && !(isLocal(item.title) && item.title[LANG]);
      return o;
    });
  }
  function koAttr(item) { return item && item.koOnly ? ' lang="ko"' : ''; }
  function koNote(item) { return item && item.koOnly ? '<p class="note">' + esc(T('이 글은 한국어로만 제공됩니다.')) + '</p>' : ''; }
  // 사진처럼 내용 파일에 적은 경로는 사이트 맨 위 폴더 기준입니다.
  function asset(src) { return /^(?:[a-z]+:)?\/\//i.test(src) || String(src).charAt(0) === '/' ? src : BASE + src; }

  var NOTICES = localize(D.notices).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var EVENTS = localize(D.events);
  var ALBUMS = localize(D.albums);

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var icon = function (id) { return '<svg class="ico" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; };
  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  var CAT = {
    event: { label: T('대회'), tone: 'red' },
    edu: { label: T('교육'), tone: 'orange' },
    cert: { label: T('자격'), tone: 'green' },
    intl: { label: T('국제교류'), tone: 'blue' },
    assoc: { label: T('협회'), tone: 'navy' }
  };
  var STATUS = {
    planned: { label: T('준비 중'), tone: 'line' },
    confirmed: { label: T('일정 확정'), tone: 'navy' },
    open: { label: T('접수 중'), tone: 'red' },
    closed: { label: T('접수 마감'), tone: 'line' },
    completed: { label: T('종료'), tone: 'line' }
  };
  var VIEW_NAMES = {
    home: '', about: T('협회 소개'), programs: T('유소년 교육'), schedule: T('대회·일정'), coach: T('지도자 자격'),
    international: T('국제교류'), notice: T('공지사항'), gallery: T('사진'), apply: T('신청·문의'),
    contact: T('후원·협력'), privacy: T('개인정보처리방침')
  };
  var BASE_TITLE = T('KYLA 한국유소년라크로스협회');

  /* ---------- 날짜 ---------- */
  var WD = {
    ko: ['일', '월', '화', '수', '목', '금', '토'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    ja: ['日', '月', '火', '水', '木', '金', '土']
  }[LANG] || ['일', '월', '화', '수', '목', '금', '토'];
  var WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toDate(s) {
    if (!s) return null;
    var p = String(s).split('-');
    return new Date(Number(p[0]), Number(p[1] || 1) - 1, Number(p[2] || 1));
  }
  function fmtMD(s) { var d = toDate(s); return d ? pad(d.getMonth() + 1) + '.' + pad(d.getDate()) : ''; }
  function fmtLong(s) {
    var d = toDate(s);
    if (!d) return '';
    if (LANG === 'en') return WD_EN[d.getDay()] + ', ' + MONTH_EN[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    if (LANG === 'ja') return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日(' + WD[d.getDay()] + ')';
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WD[d.getDay()] + ')';
  }
  function weekday(s) {
    var d = toDate(s);
    if (!d) return '';
    return LANG === 'en' ? WD[d.getDay()] : WD[d.getDay()] + (LANG === 'ja' ? '曜日' : '요일');
  }
  function bib(label, tone) { return '<span class="bib bib--' + tone + '">' + esc(label) + '</span>'; }
  function catBib(cat) { var c = CAT[cat] || CAT.assoc; return bib(c.label, c.tone); }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function groupByYear(list, rowFn) {
    var html = '', year = '';
    list.forEach(function (item) {
      var y = (item.date || '').slice(0, 4);
      if (y !== year) {
        if (year) html += '</ul>';
        html += '<p class="rows__year num">' + esc(y) + '</p><ul class="rows">';
        year = y;
      }
      html += rowFn(item);
    });
    return html + (year ? '</ul>' : '');
  }

  /* ---------- 공지사항 ---------- */
  function noticeRow(n) {
    return '<li><a class="row" href="#notice-' + esc(n.id) + '">' +
      '<span class="row__date num">' + fmtMD(n.date) + '</span>' +
      '<span class="row__main">' + catBib(n.cat) +
      '<span class="row__title"' + koAttr(n) + '>' + esc(n.title) + '</span>' +
      (n.summary ? '<span class="row__sub"' + koAttr(n) + '>' + esc(n.summary) + '</span>' : '') +
      '</span>' + icon('chev') + '</a></li>';
  }

  function renderHomeNotices() {
    var el = $('#home-notices');
    if (!el) return;
    el.innerHTML = NOTICES.length
      ? NOTICES.slice(0, 3).map(noticeRow).join('')
      : '<li class="empty" style="border:0"><p class="empty__title">' + esc(T('등록된 공지가 없습니다')) + '</p></li>';
  }

  var noticeFilter = 'all';
  function renderNoticeList() {
    var cats = [];
    NOTICES.forEach(function (n) { if (cats.indexOf(n.cat) < 0) cats.push(n.cat); });
    var fl = $('#notice-filters');
    if (fl) {
      fl.hidden = cats.length < 2;
      fl.innerHTML = [['all', T('전체')]].concat(cats.map(function (c) { return [c, (CAT[c] || CAT.assoc).label]; }))
        .map(function (f) {
          return '<button class="filter" type="button" data-filter="' + esc(f[0]) + '" aria-pressed="' + (noticeFilter === f[0]) + '">' + esc(f[1]) + '</button>';
        }).join('');
    }
    var list = NOTICES.filter(function (n) { return noticeFilter === 'all' || n.cat === noticeFilter; });
    $('#notice-list').innerHTML = list.length
      ? groupByYear(list, noticeRow)
      : '<div class="empty"><p class="empty__title">' + esc(T('이 분류에는 아직 공지가 없습니다')) + '</p><p class="empty__text">' + esc(T("'전체'를 누르면 모든 공지를 볼 수 있습니다.")) + '</p></div>';
  }

  function blocksToHtml(blocks) {
    return (blocks || []).map(function (b) {
      if (typeof b === 'string') return '<p>' + esc(b) + '</p>';
      if (b.h) return '<h3 class="t-3">' + esc(b.h) + '</h3>';
      if (b.list) return '<ul>' + b.list.map(function (li) { return '<li>' + esc(li) + '</li>'; }).join('') + '</ul>';
      return '';
    }).join('');
  }

  function renderNoticeDetail(n) {
    var i = NOTICES.indexOf(n), newer = NOTICES[i - 1], older = NOTICES[i + 1];
    var pager = '';
    if (newer) pager += '<a href="#notice-' + esc(newer.id) + '"><small>' + esc(T('다음 글')) + '</small><span' + koAttr(newer) + '>' + esc(newer.title) + '</span></a>';
    if (older) pager += '<a href="#notice-' + esc(older.id) + '"><small>' + esc(T('이전 글')) + '</small><span' + koAttr(older) + '>' + esc(older.title) + '</span></a>';
    $('#notice-detail').innerHTML =
      '<a class="back" href="#notice">' + icon('back') + esc(T('공지사항 목록')) + '</a>' +
      '<p class="detail__meta">' + catBib(n.cat) + '<time datetime="' + esc(n.date) + '">' + fmtLong(n.date) + '</time></p>' +
      '<h1 class="detail__title" tabindex="-1"' + koAttr(n) + '>' + esc(n.title) + '</h1>' +
      '<div class="detail__body">' + koNote(n) + '<div class="prose"' + koAttr(n) + '>' + blocksToHtml(n.body) + '</div>' +
      (n.link ? '<div class="btns"><a class="btn btn--ghost" href="' + esc(n.link.href) + '">' + esc(n.link.label) + '</a></div>' : '') +
      '</div>' + (pager ? '<nav class="pager" aria-label="' + esc(T('다른 공지')) + '">' + pager + '</nav>' : '');
  }

  /* ---------- 대회·일정 ---------- */
  function upcomingEvents() {
    return EVENTS.filter(function (e) { return e.status === 'confirmed' || e.status === 'open' || e.status === 'closed'; })
      .sort(function (a, b) { return (a.date || '9') < (b.date || '9') ? -1 : 1; });
  }
  function plannedEvents() { return EVENTS.filter(function (e) { return e.status === 'planned'; }); }
  function pastEvents() {
    return EVENTS.filter(function (e) { return e.status === 'completed'; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  function openEvents(type) {
    return EVENTS.filter(function (e) { return e.status === 'open' && (!type || (e.registration && e.registration.type === type)); });
  }

  function eventRow(e, opts) {
    opts = opts || {};
    var st = STATUS[e.status] || STATUS.planned;
    var date = e.date
      ? '<span class="row__date num">' + fmtMD(e.date) + '<small>' + weekday(e.date) + '</small></span>'
      : '<span class="row__date row__date--none">' + esc(T('날짜 미정')) + '</span>';
    var tag = e.status === 'completed' ? '' : bib(e.status === 'planned' && e.stage ? e.stage : st.label, st.tone);
    var main = '<span class="row__main">' + tag + '<span class="row__title"' + koAttr(e) + '>' + esc(e.title) + '</span>' +
      (!opts.compact && e.summary ? '<span class="row__sub"' + koAttr(e) + '>' + esc(e.summary) + '</span>' : '') + '</span>';
    if (e.status === 'planned') return '<li class="row">' + date + main + '</li>';
    return '<li><a class="row" href="#event-' + esc(e.id) + '">' + date + main + icon('chev') + '</a></li>';
  }

  var EMPTY_UPCOMING = '<div class="empty"><p class="empty__title">' + esc(T('확정된 다음 일정이 아직 없습니다')) + '</p>' +
    '<p class="empty__text">' + esc(T('날짜가 정해지면 이곳과 공지사항에 먼저 올립니다.')) + '</p></div>';

  function renderHomeSchedule() {
    var el = $('#home-schedule');
    if (!el) return;
    var up = upcomingEvents(), pl = plannedEvents();
    var html = up.length ? '<ul class="rows">' + up.map(function (e) { return eventRow(e, { compact: true }); }).join('') + '</ul>' : EMPTY_UPCOMING;
    if (pl.length) {
      html += '<h3 class="minihead">' + esc(T('준비하고 있는 일정')) + '</h3><ul class="rows">' +
        pl.map(function (e) { return eventRow(e, { compact: true }); }).join('') + '</ul>';
    }
    el.innerHTML = html;
  }

  function renderSchedule() {
    var up = upcomingEvents(), pl = plannedEvents(), past = pastEvents();
    $('#sched-upcoming').innerHTML = up.length ? '<ul class="rows">' + up.map(function (e) { return eventRow(e); }).join('') + '</ul>' : EMPTY_UPCOMING;
    $('#sched-planned').innerHTML = pl.length
      ? '<h3 class="minihead">' + esc(T('준비하고 있는 일정')) + '</h3><ul class="rows">' + pl.map(function (e) { return eventRow(e); }).join('') + '</ul>'
      : '';
    $('#sched-past').innerHTML = past.length ? groupByYear(past, function (e) { return eventRow(e); }) : '';
    var ce = $('#coach-events'), cs = $('#coach-status');
    var certs = EVENTS.filter(function (e) { return e.cat === 'cert' && e.status !== 'completed'; });
    var certHtml = certs.length
      ? '<ul class="rows">' + certs.map(function (e) { return eventRow(e); }).join('') + '</ul>'
      : '<div class="empty"><p class="empty__title">' + esc(T('확정된 연수 일정이 아직 없습니다')) + '</p><p class="empty__text">' + esc(T('일정이 정해지면 공지사항에 올립니다.')) + '</p></div>';
    if (ce) ce.innerHTML = certHtml;
    if (cs) cs.innerHTML = certHtml;
  }

  function surveyFigure(s, link, ka) {
    var marks = '';
    ka = ka || '';
    for (var i = 0; i < s.respondents; i++) marks += '<i' + (i < s.returning ? '' : ' class="is-off"') + '></i>';
    return '<figure class="survey">' +
      '<div class="survey__marks" role="img" aria-label="' + esc(T('응답자 {n}명 중 {k}명', { n: s.respondents, k: s.returning })) + '">' + marks + '</div>' +
      '<figcaption><p class="survey__say"' + ka + '>' + esc(s.say) + '</p><p class="survey__note"' + ka + '>' + esc(s.note) + '</p>' +
      (link ? '<a class="more" href="' + esc(link) + '">' + esc(T('설문 결과 자세히 보기')) + icon('chev') + '</a>' : '') +
      '</figcaption></figure>';
  }

  function renderHomeSurvey() {
    var el = $('#home-survey');
    if (!el) return;
    var e = pastEvents().filter(function (x) { return x.survey; })[0];
    el.innerHTML = e ? surveyFigure(e.survey, '#event-' + e.id, koAttr(e)) : '';
  }

  function renderEventDetail(e) {
    var st = STATUS[e.status] || STATUS.planned, ka = koAttr(e);
    var facts = (e.date ? [[T('일시'), fmtLong(e.date), '']] : []).concat((e.facts || []).map(function (f) { return [f[0], f[1], ka]; }));
    var html = '<a class="back" href="#schedule">' + icon('back') + esc(T('대회·일정')) + '</a>' +
      '<p class="detail__meta">' + catBib(e.cat) + bib(e.status === 'planned' && e.stage ? e.stage : st.label, st.tone) + '</p>' +
      '<h1 class="detail__title" tabindex="-1"' + ka + '>' + esc(e.title) + '</h1>' +
      (e.titleEn && e.titleEn !== e.title ? '<p class="detail__en" lang="en">' + esc(e.titleEn) + '</p>' : '') +
      '<div class="detail__body">' + koNote(e);
    if (e.summary) html += '<p class="lead"' + ka + '>' + esc(e.summary) + '</p>';
    if (facts.length) {
      html += '<dl class="facts">' + facts.map(function (f) { return '<div' + f[2] + '><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl>';
    }
    if (e.status === 'open') {
      html += '<div class="cta"><div><h2>' + esc(T('접수 중입니다')) + '</h2><p>' + esc(T('학교나 클럽 단위로 신청서를 제출해 주세요.')) + '</p></div>' +
        '<div class="btns"><a class="btn" href="#apply">' + esc(T('참가 신청서 쓰기')) + '</a></div></div>';
    }
    if (e.pending) html += '<p class="note"' + ka + '>' + esc(e.pending) + '</p>';
    if (e.survey) {
      var s = e.survey;
      html += '<section><h2>' + esc(T('참가자 만족도 설문')) + '</h2>' + surveyFigure(s, null, ka) +
        (s.via ? '<p style="margin-top:14px"' + ka + '>' + esc(s.via) + '</p>' : '') +
        '<div class="twocol" style="margin-top:28px">' +
        '<div><h2>' + esc(T('좋았다고 꼽은 점')) + '</h2><ul class="ticks ticks--green"' + ka + '>' + s.liked.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<div><h2>' + esc(T('다음 대회에 반영할 의견')) + '</h2><ul class="ticks ticks--orange"' + ka + '>' + s.improve.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '</div></section>';
    }
    var album = e.album && byId(ALBUMS, e.album);
    if (album) {
      var has = album.photos && album.photos.length;
      html += '<div class="cta"><div><h2>' + esc(has ? T('현장 사진 {n}장', { n: album.photos.length }) : T('현장 사진을 준비하고 있습니다')) + '</h2>' +
        '<p>' + esc(T('사진은 보호자 동의를 확인한 뒤 앨범에 올립니다.')) + '</p></div>' +
        '<div class="btns"><a class="btn btn--ink" href="#album-' + esc(album.id) + '">' + esc(T('사진 앨범 보기')) + '</a></div></div>';
    }
    $('#event-detail').innerHTML = html + '</div>';
  }

  /* ---------- 사진 ---------- */
  function renderAlbums() {
    var el = $('#album-list');
    if (!el) return;
    el.innerHTML = ALBUMS.map(function (a) {
      var n = (a.photos || []).length;
      return '<a class="album" data-tone="' + esc(a.tone || 'navy') + '" href="#album-' + esc(a.id) + '">' +
        '<div class="album__cover">' +
        (n ? '<img src="' + esc(asset(a.cover || a.photos[0].src)) + '" alt="" loading="lazy">' : '<span class="album__date num">' + fmtMD(a.date) + '</span><span class="album__state">' + bib(T('사진 준비 중'), 'line') + '</span>') +
        '</div><h2 class="album__title"' + koAttr(a) + '>' + esc(a.title) + '</h2>' +
        '<p class="album__sub">' + fmtLong(a.date) + (n ? esc(T(', 사진 {n}장', { n: n })) : '') + '</p></a>';
    }).join('');
  }

  var lbPhotos = [], lbIndex = 0, lbReturn = null;
  function renderAlbumDetail(a) {
    var photos = a.photos || [];
    var ev = null;
    EVENTS.forEach(function (e) { if (e.album === a.id) ev = e; });
    var html = '<a class="back" href="#gallery">' + icon('back') + esc(T('사진 앨범 목록')) + '</a>' +
      '<p class="detail__meta"><time datetime="' + esc(a.date) + '">' + fmtLong(a.date) + '</time></p>' +
      '<h1 class="detail__title" tabindex="-1"' + koAttr(a) + '>' + esc(a.title) + '</h1><div class="detail__body">';
    if (photos.length) {
      html += '<div class="photos">' + photos.map(function (p, i) {
        return '<button type="button" data-photo="' + i + '" aria-label="' + esc(T('사진 {n} 크게 보기', { n: i + 1 })) + '"><img src="' + esc(asset(p.src)) + '" alt="' + esc(p.alt || '') + '" loading="lazy"></button>';
      }).join('') + '</div>';
    } else {
      html += '<div class="empty"><p class="empty__title">' + esc(T('이 앨범의 사진을 준비하고 있습니다')) + '</p>' +
        '<p class="empty__text">' + esc(T('보호자 동의를 확인한 사진부터 올립니다.')) + '</p></div>';
    }
    if (ev) html += '<div class="btns"><a class="btn btn--ghost" href="#event-' + esc(ev.id) + '">' + esc(T('대회 기록 보기')) + '</a></div>';
    $('#album-detail').innerHTML = html + '</div>';
    lbPhotos = photos;
  }

  function lbShow(i) {
    if (!lbPhotos.length) return;
    lbIndex = (i + lbPhotos.length) % lbPhotos.length;
    var p = lbPhotos[lbIndex];
    $('#lb-img').src = asset(p.src);
    $('#lb-img').alt = p.alt || '';
    $('#lb-count').textContent = (lbIndex + 1) + ' / ' + lbPhotos.length;
  }
  function lbOpen(i) {
    lbReturn = document.activeElement;
    $('#lightbox').hidden = false;
    document.body.classList.add('menu-open');
    lbShow(i);
    $('#lb-close').focus();
  }
  function lbClose() {
    $('#lightbox').hidden = true;
    document.body.classList.remove('menu-open');
    if (lbReturn && lbReturn.focus) lbReturn.focus();
  }

  /* ---------- 신청·문의 ---------- */
  var TABS = ['team', 'coach', 'inquiry'];
  function setTab(name, focus) {
    if (TABS.indexOf(name) < 0) name = 'team';
    TABS.forEach(function (t) {
      var on = t === name, tab = $('#tab-' + t), panel = $('#panel-' + t);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      panel.hidden = !on;
      if (on && focus) tab.focus();
    });
  }

  var rosterCount = 0;
  function addRosterRow() {
    var n = ++rosterCount, row = document.createElement('div');
    row.className = 'roster__row';
    row.innerHTML =
      '<div class="field"><label class="field__label" for="pl-name-' + n + '">' + esc(T('선수 이름')) + '</label><input class="input" id="pl-name-' + n + '" data-roster="name" autocomplete="off"></div>' +
      '<div class="field"><label class="field__label" for="pl-birth-' + n + '">' + esc(T('출생연도')) + '</label><input class="input" id="pl-birth-' + n + '" data-roster="birth" inputmode="numeric" maxlength="4" placeholder="2015"></div>' +
      '<div class="field"><label class="field__label" for="pl-no-' + n + '">' + esc(T('등번호')) + '</label><input class="input" id="pl-no-' + n + '" data-roster="no" inputmode="numeric" maxlength="3"></div>' +
      '<button class="roster__del" type="button" data-roster-del aria-label="' + esc(T('이 선수 줄 삭제')) + '"><svg class="ico" aria-hidden="true"><use href="#i-close"/></svg></button>';
    $('#roster').appendChild(row);
    return row;
  }
  function readRoster() {
    return $$('#roster .roster__row').map(function (row) {
      return {
        row: row,
        name: $('[data-roster="name"]', row).value.trim(),
        birth: $('[data-roster="birth"]', row).value.trim(),
        no: $('[data-roster="no"]', row).value.trim()
      };
    });
  }

  function renderApply() {
    var open = openEvents('team');
    var sel = $('#team-event'), btn = $('#team-submit'), status = $('#team-status');
    if (!sel) return;
    if (open.length) {
      sel.disabled = false;
      sel.innerHTML = (open.length > 1 ? '<option value="">' + esc(T('선택')) + '</option>' : '') +
        open.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.title) + (e.date ? ' (' + fmtLong(e.date) + ')' : '') + '</option>'; }).join('');
      btn.disabled = false;
      btn.textContent = T('참가 신청서 제출');
      status.innerHTML = '<ul class="rows">' + open.map(function (e) { return eventRow(e); }).join('') + '</ul>';
    } else {
      sel.innerHTML = '<option value="">' + esc(T('접수 중인 대회가 없습니다')) + '</option>';
      sel.disabled = true;
      btn.disabled = true;
      btn.textContent = T('접수 기간에 제출할 수 있습니다');
      status.innerHTML = '<div class="empty"><p class="empty__title">' + esc(T('지금 접수 중인 대회가 없습니다')) + '</p>' +
        '<p class="empty__text">' + esc(T('접수가 열리면 아래 신청서로 학교나 클럽 단위로 신청합니다. 접수 일정은 공지사항에 먼저 올립니다. 신청서에 들어가는 항목은 미리 확인할 수 있습니다.')) + '</p></div>';
    }
    if (!$('#roster').children.length) { addRosterRow(); addRosterRow(); addRosterRow(); }
    var ig = instagramInfo((CFG.contact || {}).instagram);
    $$('[data-preview-note]').forEach(function (p) {
      var inTeam = !!p.closest('#panel-team');
      p.hidden = !!CFG.formEndpoint || (inTeam && !open.length);
      if (ig) p.innerHTML = T('온라인 접수는 연결을 준비하고 있습니다. 지금은 인스타그램 {ig} 메시지로 보내 주세요. 아래에 적은 내용은 복사해서 보낼 수 있습니다.', { ig: igLink(ig) });
      else p.textContent = T('온라인 접수는 연결을 준비하고 있어, 아직 이 양식으로는 전송되지 않습니다.');
    });
  }

  function clearErrors(form) {
    $$('.field__err', form).forEach(function (p) { if (p.id === 'roster-err') { p.hidden = true; p.textContent = ''; } else p.remove(); });
    $$('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }
  function markError(el, msg) {
    el.setAttribute('aria-invalid', 'true');
    var field = el.closest('.field') || el.parentElement;
    var p = document.createElement('p');
    p.className = 'field__err';
    p.textContent = msg;
    field.appendChild(p);
  }
  function validate(form) {
    clearErrors(form);
    var first = null;
    $$('[required]', form).forEach(function (el) {
      if (el.disabled) return;
      var ok = el.type === 'checkbox' ? el.checked : el.value.trim() !== '';
      if (!ok) { markError(el, el.getAttribute('data-msg') || T('필수 항목입니다.')); first = first || el; }
    });
    $$('input[type="email"]', form).forEach(function (el) {
      var v = el.value.trim();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !el.hasAttribute('aria-invalid')) {
        markError(el, el.getAttribute('data-msg-type') || T('이메일 주소 형식을 확인해 주세요.'));
        first = first || el;
      }
    });
    if (form.getAttribute('data-form') === 'team') {
      var rows = readRoster(), filled = rows.filter(function (r) { return r.name || r.birth || r.no; }), err = '';
      if (!filled.length) {
        err = T('선수를 한 명 이상 적어 주세요.');
        first = first || $('[data-roster="name"]', rows[0].row);
      }
      filled.forEach(function (r) {
        var nameEl = $('[data-roster="name"]', r.row), birthEl = $('[data-roster="birth"]', r.row);
        if (!r.name) { nameEl.setAttribute('aria-invalid', 'true'); err = err || T('선수 이름을 입력해 주세요.'); first = first || nameEl; }
        if (!/^(19|20)\d{2}$/.test(r.birth)) { birthEl.setAttribute('aria-invalid', 'true'); err = err || T('출생연도를 네 자리 숫자로 입력해 주세요. 예: 2015'); first = first || birthEl; }
      });
      if (err) { var p = $('#roster-err'); p.textContent = err; p.hidden = false; }
    }
    return first;
  }

  function collect(form) {
    var out = [], seen = {};
    $$('input,select,textarea', form).forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        if (seen[el.name]) return;
        seen[el.name] = true;
        var vals = $$('input[type="checkbox"]', form).filter(function (c) { return c.name === el.name && c.checked; })
          .map(function (c) { return c.value || T('예'); });
        out.push([el.name, vals.join(', ')]);
        return;
      }
      var v = el.tagName === 'SELECT'
        ? (el.value && el.selectedOptions[0] ? el.selectedOptions[0].textContent : '')
        : el.value.trim();
      out.push([el.name, v]);
    });
    return out;
  }

  var FORM_TEXT = {
    team: { head: T('대회 참가 신청'), ok: T('참가 신청서를 제출했습니다'), okText: T('담당자가 확인한 뒤 연락드립니다.') },
    inquiry: { head: T('문의'), ok: T('문의를 보냈습니다'), okText: T('담당자가 확인한 뒤 남겨 주신 연락처로 답변드립니다.') },
    intl: { head: T('국제교류 문의'), ok: T('문의를 보냈습니다'), okText: T('이메일로 답변드립니다.') }
  };

  function toText(kind, fields, roster) {
    var lines = ['[' + FORM_TEXT[kind].head + ']'];
    fields.forEach(function (f) { if (f[1]) lines.push(f[0] + ': ' + f[1]); });
    if (roster && roster.length) {
      lines.push('', T('선수 명단 ({n}명)', { n: roster.length }));
      roster.forEach(function (r, i) {
        lines.push((i + 1) + '. ' + r.name + ' / ' + T('{y}년생', { y: r.birth }) + (r.no ? ' / ' + T('{n}번', { n: r.no }) : ''));
      });
    }
    return lines.join('\n');
  }

  function showResult(form, kind, title, text, extraHtml) {
    var box = $('.result', form);
    box.className = 'result' + (kind ? ' result--' + kind : '');
    box.innerHTML = '<p class="result__title">' + esc(title) + '</p><p class="result__text">' + esc(text) + '</p>' + (extraHtml || '');
    box.hidden = false;
    return box;
  }

  function onSubmit(ev) {
    var form = ev.target;
    if (!form.matches || !form.matches('form[data-form]')) return;
    ev.preventDefault();
    var kind = form.getAttribute('data-form'), ft = FORM_TEXT[kind];
    if (kind === 'team' && !openEvents('team').length) return;
    var first = validate(form);
    if (first) {
      showResult(form, 'err', T('빠진 항목이 있습니다'), T('표시된 항목을 채운 뒤 다시 제출해 주세요.'));
      first.focus();
      return;
    }
    var fields = collect(form);
    var roster = kind === 'team'
      ? readRoster().filter(function (r) { return r.name; }).map(function (r) { return { name: r.name, birth: r.birth, no: r.no }; })
      : null;
    var text = toText(kind, fields, roster);

    if (!CFG.formEndpoint) {
      var ig = instagramInfo((CFG.contact || {}).instagram);
      var box = showResult(form, '',
        T('온라인 접수가 아직 연결되지 않아 전송되지 않았습니다'),
        ig ? T('아래 내용을 복사해 인스타그램 메시지로 보내 주세요.') : T('적은 내용은 아래에서 복사할 수 있습니다.'),
        '<pre>' + esc(text) + '</pre><div class="result__acts"><button class="linkbtn" type="button" data-copy>' + icon('copy') + '<span>' + esc(T('내용 복사')) + '</span></button>' +
        (ig ? igLink(ig, T('인스타그램 열기')) : '') + '</div>');
      box.querySelector('[data-copy]').addEventListener('click', function (e) {
        var label = e.currentTarget.querySelector('span');
        var manual = function () { label.textContent = T('위 내용을 길게 눌러 직접 복사해 주세요'); };
        try { navigator.clipboard.writeText(text).then(function () { label.textContent = T('복사했습니다'); }, manual); }
        catch (x) { manual(); }
      });
      return;
    }

    var btn = form.querySelector('[type="submit"]'), label = btn.textContent;
    btn.disabled = true;
    btn.textContent = T('보내는 중');
    var payload = { kind: kind, lang: LANG, submittedAt: new Date().toISOString(), fields: fields, roster: roster, text: text };
    fetch(CFG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.reset();
        showResult(form, 'ok', ft.ok, ft.okText);
      })
      .catch(function () {
        showResult(form, 'err', T('전송하지 못했습니다'), T('인터넷 연결을 확인하고 다시 제출해 주세요. 입력한 내용은 그대로 남아 있습니다.'));
      })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  }

  /* ---------- 히어로: 최근 대회 표 ---------- */
  function renderTicket() {
    var el = $('#hero-ticket');
    if (!el) return;
    var open = openEvents()[0], next = upcomingEvents()[0], past = pastEvents()[0];
    var e = open || next || past;
    if (!e) { el.hidden = true; return; }
    el.href = '#event-' + e.id;
    el.innerHTML = '<span class="ticket__date num">' + (e.date ? fmtMD(e.date) : '') + '</span>' +
      '<span><span class="ticket__label">' + (open ? T('접수 중') : next ? T('다음 일정') : T('최근 대회')) + '</span>' +
      '<span class="ticket__title"' + koAttr(e) + '>' + esc(e.title) + '</span></span>' + icon('chev');
  }

  // "@kyla", "kyla", "https://www.instagram.com/kyla/" 어느 형태로 적어도 받습니다.
  function instagramInfo(value) {
    var v = String(value || '').trim();
    if (!v) return null;
    var m = v.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    var id = m ? m[1] : v.replace(/^@/, '').replace(/\/+$/, '');
    if (!/^[A-Za-z0-9._]{1,30}$/.test(id)) return null;
    return { id: id, url: 'https://www.instagram.com/' + id + '/' };
  }

  // 미리보기 틀 안에서는 새 창을 열 수 없어 일반 링크로 두고, 실제 사이트에서는 새 탭으로 엽니다.
  function isFramed() {
    try { return window.top !== window.self; } catch (e) { return true; }
  }
  function igLink(ig, label) {
    return '<a class="extlink" href="' + esc(ig.url) + '" rel="noopener"' + (isFramed() ? '' : ' target="_blank"') + '>' +
      esc(label || '@' + ig.id) + icon('ext') + '</a>';
  }

  function renderContact() {
    var c = CFG.contact || {}, ig = instagramInfo(c.instagram);
    $$('[data-instagram]').forEach(function (a) {
      if (!ig) { a.hidden = true; return; }
      var label = a.getAttribute('data-instagram');
      a.href = ig.url;
      if (!isFramed()) a.target = '_blank';
      a.innerHTML = esc(label ? label + ' @' + ig.id : '@' + ig.id) + icon('ext');
      a.setAttribute('aria-label', T('KYLA 인스타그램 @{id} 열기', { id: ig.id }));
      a.hidden = false;
    });
    // data-when-connected: 접수가 연결된 뒤에만 보이는 안내 (연결 전에는 위쪽 안내문이 같은 링크를 담고 있음)
    $$('[data-instagram-wrap]').forEach(function (el) {
      el.hidden = !ig || (el.hasAttribute('data-when-connected') && !CFG.formEndpoint);
    });
    $$('[data-email]').forEach(function (el) { el.textContent = c.email || ''; });
    $$('[data-email-wrap]').forEach(function (el) { el.hidden = !c.email; });
  }

  /* ---------- 히어로 작전판 ---------- */
  function createBoard(canvas, host) {
    var noop = { setActive: function () {} };
    if (!canvas || !canvas.getContext || !host) return noop;
    var ctx = canvas.getContext('2d');
    var COL = { red: '#E8303A', orange: '#F5921E', green: '#3CBB62', blue: '#3B9BE0', white: '#FFFFFF', ball: '#F6C92F', deep: '#06162E' };
    var LOOP = 8.4, FADE0 = 6.0, FADE1 = 6.7, HOME = 7.8, GOAL_T = 4.12;
    var G = [0.5, 0.2];
    // 선수별 [시각(초), x, y] — 0~1 좌표. 골대는 위쪽 가운데.
    var KF = {
      red: [[0, .17, .50], [1.6, .17, .50], [3.6, .26, .66]],
      orange: [[0, .83, .50], [2.2, .83, .50], [3.0, .76, .45]],
      green: [[0, .29, .86], [1.0, .29, .86], [2.6, .41, .77]],
      blue: [[0, .71, .86], [1.25, .71, .86], [1.9, .79, .76], [2.3, .79, .76], [3.6, .63, .80]],
      white: [[0, .50, .66], [1.7, .50, .66], [2.5, .39, .54], [3.3, .40, .37], [4.3, .40, .37], [5.3, .33, .41]]
    };
    var ORDER = ['red', 'orange', 'green', 'blue', 'white'];
    var ease = function (u) { return u * u * (3 - 2 * u); };
    function last(name) { var k = KF[name], a = k[k.length - 1]; return [a[1], a[2]]; }
    function at(name, t) {
      var k = KF[name], i, a, b, u;
      if (t >= FADE1) {
        u = ease(Math.min(1, (t - FADE1) / (HOME - FADE1)));
        a = k[k.length - 1]; b = k[0];
        return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
      }
      for (i = k.length - 1; i >= 0; i--) {
        if (t >= k[i][0]) {
          b = k[i + 1];
          if (!b) return [k[i][1], k[i][2]];
          u = ease((t - k[i][0]) / (b[0] - k[i][0]));
          return [k[i][1] + (b[1] - k[i][1]) * u, k[i][2] + (b[2] - k[i][2]) * u];
        }
      }
      return [k[0][1], k[0][2]];
    }
    var PASS = [
      { t0: .6, t1: 1.25, from: 'green', to: 'blue' },
      { t0: 1.9, t1: 2.5, from: 'blue', to: 'orange' },
      { t0: 2.9, t1: 3.5, from: 'orange', to: 'white' },
      { t0: 3.8, t1: GOAL_T, from: 'white', to: null }
    ];
    PASS.forEach(function (p) { p.a = at(p.from, p.t0); p.b = p.to ? at(p.to, p.t1) : G; });
    var HOLD = [[0, 'green'], [1.25, 'blue'], [2.5, 'orange'], [3.5, 'white']];

    function ballAt(t) {
      var i, p, u;
      if (t >= FADE1) return t >= HOME ? { p: at('green', t), off: 1 } : null;
      for (i = 0; i < PASS.length; i++) {
        p = PASS[i];
        if (t >= p.t0 && t < p.t1) {
          u = (t - p.t0) / (p.t1 - p.t0);
          return { p: [p.a[0] + (p.b[0] - p.a[0]) * u, p.a[1] + (p.b[1] - p.a[1]) * u], off: Math.max(1 - u / .25, p.to ? (u - .75) / .25 : 0, 0) };
        }
      }
      if (t >= GOAL_T) return { p: G, off: 0, goal: true };
      var h = 'green';
      for (i = 0; i < HOLD.length; i++) if (t >= HOLD[i][0]) h = HOLD[i][1];
      return { p: at(h, t), off: 1 };
    }

    var W = 0, H = 0, dpr = 1, box = { x: 0, y: 0, w: 1, h: 1 };
    function X(v) { return box.x + v * box.w; }
    function Y(v) { return box.y + v * box.h; }
    function rgba(hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function measure() {
      var r = host.getBoundingClientRect(), cs = window.getComputedStyle(host);
      var pt = parseFloat(cs.getPropertyValue('--play-top')) || 0;
      var pb = parseFloat(cs.getPropertyValue('--play-bottom')) || 0;
      var pl = parseFloat(cs.getPropertyValue('--play-left')) || 0;
      W = Math.round(r.width); H = Math.round(r.height);
      if (W < 2 || H < 2) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      box = { x: pl, y: pt, w: W - pl, h: Math.max(60, H - pt - pb) };
      return true;
    }

    function draw(t, still) {
      if (W < 2) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var u = Math.min(box.w, box.h), pr = Math.max(9, Math.min(18, u * .036)), cr = u * .125;
      var fade = still ? 1 : (t < FADE0 ? 1 : t < FADE1 ? 1 - (t - FADE0) / (FADE1 - FADE0) : 0);
      var gx = X(G[0]), gy = Y(G[1]), gw = cr * .44;
      var hit = !still && t >= GOAL_T && t < GOAL_T + 1.5;

      // 경기장 선
      ctx.lineWidth = 2;
      ctx.lineJoin = 'miter';
      ctx.strokeStyle = 'rgba(255,255,255,.2)';
      ctx.setLineDash([]);
      ctx.strokeRect(X(.04), Y(.04), X(.96) - X(.04), Y(.985) - Y(.04));
      ctx.beginPath(); ctx.arc(gx, gy, cr, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([3, 9]);
      ctx.beginPath(); ctx.arc(gx, gy, Math.min(cr * 3.2, box.w * .44), Math.PI * .1, Math.PI * .9); ctx.stroke();
      ctx.setLineDash([]);
      // 골대
      ctx.strokeStyle = hit ? rgba(COL.ball, .95) : 'rgba(255,255,255,.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(gx - gw, gy); ctx.lineTo(gx + gw, gy); ctx.lineTo(gx, gy - gw * 1.5); ctx.closePath();
      ctx.stroke();

      // 골이 들어간 순간
      if (hit) {
        [0, .28].forEach(function (d) {
          var p = (t - GOAL_T - d) / 1.1;
          if (p <= 0 || p >= 1) return;
          ctx.strokeStyle = rgba(COL.ball, (1 - p) * .9);
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(gx, gy, cr * (1 + 1.7 * p), 0, Math.PI * 2); ctx.stroke();
        });
      }

      if (fade > 0) {
        // 이동: 실선
        ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 2.6;
        ORDER.forEach(function (name) {
          var k = KF[name], tt = still ? 99 : Math.min(t, FADE1), pts = [[k[0][1], k[0][2]]], i;
          for (i = 1; i < k.length; i++) {
            if (tt >= k[i][0]) pts.push([k[i][1], k[i][2]]);
            else { if (tt > k[i - 1][0]) pts.push(at(name, tt)); break; }
          }
          var e = pts[pts.length - 1];
          if (Math.abs(e[0] - pts[0][0]) + Math.abs(e[1] - pts[0][1]) < .004) return;
          ctx.strokeStyle = rgba(COL[name], .75 * fade);
          ctx.beginPath();
          pts.forEach(function (p, j) { if (j) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); });
          ctx.stroke();
        });
        // 패스: 점선, 슛: 노란 실선
        PASS.forEach(function (p) {
          var tt = still ? 99 : t;
          if (tt < p.t0) return;
          var v = Math.min(1, (tt - p.t0) / (p.t1 - p.t0));
          var ax = X(p.a[0]), ay = Y(p.a[1]);
          if (p.to) { ctx.setLineDash([7, 8]); ctx.strokeStyle = 'rgba(255,255,255,' + (.8 * fade) + ')'; ctx.lineWidth = 2.2; }
          else { ctx.setLineDash([]); ctx.strokeStyle = rgba(COL.ball, .95 * fade); ctx.lineWidth = 3; }
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (X(p.b[0]) - ax) * v, ay + (Y(p.b[1]) - ay) * v); ctx.stroke();
        });
        ctx.setLineDash([]);
      }

      // 선수
      ORDER.forEach(function (name) {
        var p = still ? last(name) : at(name, t), x = X(p[0]), y = Y(p[1]);
        ctx.beginPath(); ctx.arc(x, y, pr + 3, 0, Math.PI * 2); ctx.fillStyle = COL.deep; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.fillStyle = COL[name]; ctx.fill();
      });

      // 공
      var b = still ? { p: G, off: 0, goal: true } : ballAt(t);
      if (b) {
        var bx = X(b.p[0]) + pr * .95 * b.off, by = Y(b.p[1]) - pr * .95 * b.off - (b.goal ? gw * .55 : 0);
        ctx.beginPath(); ctx.arc(bx, by, pr * .5, 0, Math.PI * 2);
        ctx.fillStyle = COL.ball; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = COL.deep; ctx.stroke();
      }
    }

    var raf = 0, t0 = 0, active = false, seen = true, lastT = 0;
    function frame(now) {
      if (!t0) t0 = now;
      lastT = ((now - t0) / 1000) % LOOP;
      draw(lastT, false);
      raf = window.requestAnimationFrame(frame);
    }
    function stop() { if (raf) window.cancelAnimationFrame(raf); raf = 0; }
    function sync() {
      stop();
      if (!active) return;
      if (!measure()) return;
      if (reduceMotion.matches) { draw(0, true); return; }
      draw(lastT, false);
      if (seen && !document.hidden) raf = window.requestAnimationFrame(frame);
    }
    if (window.ResizeObserver) new ResizeObserver(sync).observe(host);
    else window.addEventListener('resize', sync);
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) { seen = es[0].isIntersecting; sync(); }).observe(host);
    }
    document.addEventListener('visibilitychange', sync);
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', sync);
    return { setActive: function (on) { active = on; sync(); } };
  }

  /* ---------- 화면 전환 ---------- */
  var VIEWS = Object.keys(VIEW_NAMES);
  function parseHash() {
    var h = '';
    try { h = decodeURIComponent(location.hash.replace(/^#/, '')); } catch (e) { h = ''; }
    if (!h) return { view: 'home' };
    if (VIEWS.indexOf(h) >= 0) return { view: h };
    var m;
    if ((m = h.match(/^notice-(.+)$/))) return { view: 'notice', id: m[1] };
    if ((m = h.match(/^event-(.+)$/))) return { view: 'schedule', id: m[1] };
    if ((m = h.match(/^album-(.+)$/))) return { view: 'gallery', id: m[1] };
    if ((m = h.match(/^apply-(team|coach|inquiry)$/))) return { view: 'apply', tab: m[1] };
    return { view: 'home' };
  }

  var board = null, firstRoute = true, pendingInquiry = null;
  function closeMenu() {
    var m = $('#mnav'), b = $('#menu-btn');
    if (!m || m.hidden) return;
    m.hidden = true;
    b.setAttribute('aria-expanded', 'false');
    $('#menu-label').textContent = T('메뉴');
    $('#menu-ico').setAttribute('href', '#i-menu');
    document.body.classList.remove('menu-open');
  }

  function route() {
    var r = parseHash(), title = VIEW_NAMES[r.view], item;
    $$('.view').forEach(function (v) { v.classList.toggle('is-active', v.getAttribute('data-view') === r.view); });

    if (r.view === 'notice') {
      item = r.id ? byId(NOTICES, r.id) : null;
      $('#notice-main').hidden = !!item;
      $('#notice-detail').hidden = !item;
      if (item) { renderNoticeDetail(item); title = item.title; }
    }
    if (r.view === 'schedule') {
      item = r.id ? byId(EVENTS, r.id) : null;
      $('#schedule-main').hidden = !!item;
      $('#event-detail').hidden = !item;
      if (item) { renderEventDetail(item); title = item.title; }
    }
    if (r.view === 'gallery') {
      item = r.id ? byId(ALBUMS, r.id) : null;
      $('#gallery-main').hidden = !!item;
      $('#album-detail').hidden = !item;
      if (item) { renderAlbumDetail(item); title = item.title; }
    }
    if (r.view === 'apply') {
      setTab(pendingInquiry ? 'inquiry' : (r.tab || 'team'));
      if (pendingInquiry) { var sel = $('#inq-cat'); if (sel) sel.value = pendingInquiry; }
    }
    pendingInquiry = null;

    $$('.nav a, .tabbar a, .mnav__link').forEach(function (a) {
      if (a.getAttribute('href') === '#' + r.view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = title ? title + ' | KYLA' : BASE_TITLE;
    closeMenu();
    if (board) board.setActive(r.view === 'home');

    if (!firstRoute) {
      window.scrollTo(0, 0);
      var active = $('.view.is-active');
      var h = active && $$('h1[tabindex="-1"]', active).filter(function (x) { return x.offsetParent !== null; })[0];
      if (h) { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
    }
    firstRoute = false;
  }

  /* ---------- 이벤트 연결 ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target, el;

    if ((el = t.closest('[data-skip]'))) {
      ev.preventDefault();
      $('#main').focus();
      return;
    }
    if ((el = t.closest('[data-lang-link]'))) {
      // 보고 있던 화면 그대로 다른 언어로 넘어갑니다.
      el.setAttribute('href', el.getAttribute('href').split('#')[0] + location.hash);
      return;
    }
    if ((el = t.closest('a[href^="#"]'))) {
      var href = el.getAttribute('href');
      if (el.hasAttribute('data-inquiry')) pendingInquiry = el.getAttribute('data-inquiry');
      if (href === location.hash || (href === '#home' && !location.hash)) { ev.preventDefault(); route(); window.scrollTo(0, 0); }
      return;
    }
    if ((el = t.closest('#menu-btn'))) {
      var m = $('#mnav');
      if (m.hidden) {
        // 맨 위 언어 선택 줄이 보이는 동안에는 머리말이 그만큼 내려와 있으므로, 메뉴를 머리말 바로 아래에 맞춥니다.
        m.style.top = Math.round($('.hdr').getBoundingClientRect().bottom) + 'px';
        m.hidden = false;
        el.setAttribute('aria-expanded', 'true');
        $('#menu-label').textContent = T('닫기');
        $('#menu-ico').setAttribute('href', '#i-close');
        document.body.classList.add('menu-open');
      } else closeMenu();
      return;
    }
    if ((el = t.closest('[data-jump]'))) {
      var target = document.getElementById(el.getAttribute('data-jump'));
      if (target) target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if ((el = t.closest('[data-filter]'))) {
      noticeFilter = el.getAttribute('data-filter');
      renderNoticeList();
      var again = $('[data-filter="' + noticeFilter + '"]');
      if (again) again.focus();
      return;
    }
    if ((el = t.closest('.tab'))) { setTab(el.getAttribute('data-tab')); return; }
    if (t.closest('#roster-add')) {
      var row = addRosterRow();
      $('[data-roster="name"]', row).focus();
      return;
    }
    if ((el = t.closest('[data-roster-del]'))) {
      var rows = $$('#roster .roster__row'), mine = el.closest('.roster__row');
      if (rows.length > 1) mine.remove();
      else $$('input', mine).forEach(function (i) { i.value = ''; });
      return;
    }
    if ((el = t.closest('[data-photo]'))) { lbOpen(Number(el.getAttribute('data-photo'))); return; }
    if (t.closest('#lb-close')) { lbClose(); return; }
    if (t.closest('#lb-prev')) { lbShow(lbIndex - 1); return; }
    if (t.closest('#lb-next')) { lbShow(lbIndex + 1); return; }
  });

  document.addEventListener('keydown', function (ev) {
    var lb = $('#lightbox');
    if (lb && !lb.hidden) {
      if (ev.key === 'Escape') lbClose();
      if (ev.key === 'ArrowLeft') lbShow(lbIndex - 1);
      if (ev.key === 'ArrowRight') lbShow(lbIndex + 1);
      return;
    }
    if (ev.key === 'Escape') { var open = !$('#mnav').hidden; closeMenu(); if (open) $('#menu-btn').focus(); }
    var tab = ev.target.closest && ev.target.closest('.tab');
    if (tab && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
      var i = TABS.indexOf(tab.getAttribute('data-tab'));
      setTab(TABS[(i + (ev.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length], true);
      ev.preventDefault();
    }
  });

  var touchX = null;
  document.addEventListener('touchstart', function (ev) { if (ev.target.closest('#lightbox')) touchX = ev.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (ev) {
    if (touchX === null) return;
    var dx = ev.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 48) lbShow(lbIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });

  document.addEventListener('submit', onSubmit);
  window.addEventListener('hashchange', route);

  /* ---------- 시작 ---------- */
  renderHomeNotices();
  renderHomeSchedule();
  renderHomeSurvey();
  renderTicket();
  renderNoticeList();
  renderSchedule();
  renderAlbums();
  renderApply();
  renderContact();
  board = createBoard($('#playboard'), $('#board'));
  route();
})();
