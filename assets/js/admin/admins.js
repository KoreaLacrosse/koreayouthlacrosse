/* ==========================================================================
   관리자 화면 : 관리자 (마스터만 봅니다)
   Firestore 의 admins 컬렉션이 관리자 명단입니다. 문서 ID 가 구글 계정 이메일(소문자)이고, role 이 master 또는 admin 입니다.
   협회에서는 관리자를 '직원'이라고 부릅니다. 회원 화면에서 어떤 회원을 직원으로 지정하면 그 이메일이 이 명단에 올라옵니다.
   처음 마스터 한 명은 Firebase 콘솔에서 직접 만들고, 그 뒤로는 이 화면에서 더하고 뺍니다.
   본인 계정은 여기서 고치거나 뺄 수 없습니다(보안 규칙도 막습니다). 실수로 권한을 잃지 않게 하려는 것입니다.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.KYLA_ADMIN, el = A.el, add = A.add, text = A.text;
  var COL = 'admins';
  var ROLES = [['admin', '관리자'], ['master', '마스터']];
  function roleName(code) { return code === 'master' ? '마스터' : '관리자'; }

  function all() {
    return A.store.all(COL).map(function (d) {
      return { id: d.id, doc: d, email: d.id, role: d.role === 'master' ? 'master' : 'admin', memo: text(d.memo), self: d.id === A.email };
    }).sort(function (a, b) { return (a.role === b.role ? 0 : (a.role === 'master' ? -1 : 1)) || a.email.localeCompare(b.email); });
  }

  function render(root) {
    var list = all(), head = el('div', 'adm-head'), tools = el('div', 'adm-tools');
    add(tools, A.button('btn btn--sm', '관리자 추가', function () { edit(null); }, 'tool:add'), A.button('linkbtn', '새로 고침', function () { A.reload(); }, 'tool:reload'));
    add(head, add(el('div'), el('h1', 't-2', '관리자'), el('p', 'adm-head__sub', '직원(관리자): 이 화면에 들어올 수 있는 구글 계정')), tools);
    add(root, head);
    add(root, A.ui.table({
      caption: '관리자 명단', rows: list, size: 100, rowKey: function (a) { return a.id; },
      columns: [
        { key: 'email', label: '구글 계정', cls: 'adm-col-main', head: true, node: function (a) { return a.self ? [el('span', 'adm-strong', a.email), ' ', el('small', 'adm-mark', '본인')] : el('span', 'adm-strong', a.email); } },
        { key: 'role', label: '권한', node: function (a) { return A.ui.tag(roleName(a.role), a.role === 'master' ? 'blue' : ''); } },
        { key: 'memo', label: '메모', text: function (a) { return a.memo; } },
        { key: 'updated', label: '마지막 수정', text: function (a) { return A.stampText(a.doc.updatedAt, text(a.doc.updatedBy)) || '콘솔에서 만듦'; } }
      ],
      actions: function (a) {
        if (a.self) return [el('span', 'adm-faint', '바꿀 수 없음')];
        var b = A.button('adm-rowbtn', '수정', function () { edit(a); });
        b.setAttribute('aria-label', a.email + ' 수정');
        return [b];
      }
    }));
    add(root, el('p', 'adm-foot', '관리자(직원)는 회원과 참가 의향 회신을 보고 고칠 수 있습니다. 마스터는 거기에 더해 이 명단을 고칠 수 있습니다. 회원 화면에서 직원으로 지정한 회원의 이메일도 여기에 올라옵니다. 본인 계정은 여기서 바꿀 수 없으니, 마스터를 바꾸려면 먼저 다른 계정을 마스터로 올려 주세요.'));
  }

  function edit(a) {
    var isNew = !a;
    var fields = [
      isNew ? { key: 'email', label: '구글 계정 이메일', type: 'email', required: true, max: 200, wide: true, hint: '이 주소의 구글 계정으로 로그인한 사람만 들어올 수 있습니다.',
        check: function (v) { return v.toLowerCase() === A.email ? '본인 계정은 이미 명단에 있습니다.' : (/[\/\s]/.test(v) ? '이메일 주소 형식을 확인해 주세요.' : ''); } }
        : { key: 'email', label: '구글 계정', type: 'static', wide: true },
      { key: 'role', label: '권한', type: 'select', options: ROLES },
      { key: 'memo', label: '메모', max: 200, placeholder: '이름이나 맡은 일' }
    ];
    var form = A.ui.form(fields, isNew ? { role: 'admin' } : { email: a.email, role: a.role, memo: a.memo });
    var save = function () {
      var got = form.read();
      if (!got.ok) { A.ui.dialogError('표시된 칸을 고친 뒤 다시 저장해 주세요.'); return; }
      var id = isNew ? got.data.email.toLowerCase() : a.id;
      if (isNew && A.store.all(COL).some(function (d) { return d.id === id; })) { A.ui.dialogError('이미 명단에 있는 계정입니다.'); return; }
      A.ui.dialogError(''); A.ui.busy(true);
      var data = A.stamp({ role: got.data.role, memo: got.data.memo }), times = ['updatedAt'];
      // 명단 문서는 고칠 때도 통째로 바꿉니다. 콘솔에서 손으로 넣은 다른 항목이 남아 규칙에 걸리는 일이 없게 하려는 것입니다.
      var write = isNew ? A.write.set(COL, id, data, { create: true, times: times }) : A.write.set(COL, id, data, { times: times, base: a.doc._updateTime });
      A.api.commit([write]).then(function (res) {
        var doc = { id: id };
        Object.keys(data).forEach(function (k) { doc[k] = data[k]; });
        A.store.put(COL, id, A.committed(doc, res, times));
        A.ui.busy(false); A.ui.close(true);
        A.ui.toast(isNew ? id + ' 계정을 관리자로 더했습니다.' : '고친 내용을 저장했습니다.');
        A.render();
      }, function (err) { A.ui.busy(false); A.ui.dialogError('저장하지 못했습니다. ' + A.errorText(err)); });
    };
    var remove = function () {
      A.ui.ask({ title: '명단에서 뺄까요?', text: a.email + ' 계정은 더 이상 관리자 화면에 들어올 수 없게 됩니다.', yes: '명단에서 빼기', danger: true }).then(function (yes) {
        if (!yes) return;
        A.ui.busy(true);
        A.api.commit([A.write.del(COL, a.id, a.doc._updateTime)]).then(function () {
          A.store.put(COL, a.id, null);
          A.ui.busy(false); A.ui.close(true);
          A.ui.toast(a.email + ' 계정을 명단에서 뺐습니다.');
          A.render();
        }, function (err) { A.ui.busy(false); A.ui.dialogError('빼지 못했습니다. ' + A.errorText(err)); });
      });
    };
    A.ui.open({
      title: isNew ? '관리자 추가' : '관리자 수정', body: form.node, dirty: form.dirty, focus: form.focus,
      actions: [
        isNew ? null : { label: '명단에서 빼기', cls: 'linkbtn linkbtn--danger', left: true, onClick: remove },
        { label: '취소', cls: 'linkbtn', onClick: function () { A.ui.close(); } },
        { label: '저장', cls: 'btn btn--sm', onClick: save }
      ].filter(Boolean)
    });
  }

  A.section({ id: 'admins', title: '관리자', masterOnly: true, needs: [COL], render: render });
})();
