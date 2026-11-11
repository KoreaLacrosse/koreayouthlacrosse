#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
한국어 원본에서 영어·일본어 페이지를 만든다.

    python3 tools/build_i18n.py            en/index.html, ja/index.html, assets/js/i18n.js 를 새로 만든다
    python3 tools/build_i18n.py --check    번역이 빠진 문구만 알려 주고 끝낸다 (파일을 쓰지 않는다)
    python3 tools/build_i18n.py --dump F   원본에서 찾은 문구 목록을 F(JSON)로 내보낸다

원본:  index.html (화면 문구), assets/js/app.js (T('...') 로 감싼 문구)
번역:  i18n/catalog.json  — 열쇠는 한국어 문구 그대로, 값은 {"en": "...", "ja": "..."}

index.html 에서는 글자를 직접 가진 가장 바깥 요소 하나가 번역 단위가 된다.
그 안의 태그는 <1>…</1>, <2/> 같은 자리표로 바뀌고 <br> 은 그대로 남는다.
번역문에서 자리표를 옮기거나 빼도 되고, 다른 HTML 을 그대로 써도 된다.
translate="no" 가 붙은 요소 안쪽은 번역하지 않는다.

en/, ja/ 폴더와 assets/js/i18n.js 는 이 스크립트가 만드는 파일이므로 직접 고치지 않는다.
표준 라이브러리만 쓴다.
"""
import io
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://koreayouthlacrosse.com/'
LANGS = ['en', 'ja']

FONTS = {
    'en': 'https://fonts.googleapis.com/css2?family=Kanit:ital,wght@0,400;0,500;0,600;0,700;1,600;1,800'
          '&family=Gothic+A1:wght@400;700;900&display=swap',
    'ja': 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900'
          '&family=Kanit:ital,wght@0,400;0,600;1,600;1,800&family=Gothic+A1:wght@400;700;900&display=swap',
}
OG_LOCALE = {'en': 'en_US', 'ja': 'ja_JP'}

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
SKIP = {'script', 'style'}        # 안쪽 글자를 번역하지 않는다
ATOMIC = {'svg'}                  # 원본 그대로 옮긴다
ATTRS = ['aria-label', 'alt', 'placeholder', 'title', 'content', 'name', 'value',
         'data-msg', 'data-msg-type', 'data-instagram']
HANGUL = re.compile('[가-힣]')


# ---------------------------------------------------------------- HTML 나무
class Text(object):
    def __init__(self, data):
        self.data = data


class Raw(object):
    def __init__(self, text):
        self.text = text


class El(object):
    def __init__(self, tag, attrs, raw):
        self.tag, self.attrs, self.raw = tag, list(attrs), raw
        self.children, self.void, self.dirty = [], tag in VOID, False

    def get(self, name):
        for k, v in self.attrs:
            if k == name:
                return v if v is not None else ''
        return None

    def set(self, name, value):
        self.dirty = True
        for i, (k, _) in enumerate(self.attrs):
            if k == name:
                self.attrs[i] = (k, value)
                return
        self.attrs.append((name, value))

    def drop(self, name):
        if self.get(name) is not None:
            self.dirty = True
            self.attrs = [(k, v) for k, v in self.attrs if k != name]


class Builder(HTMLParser):
    def __init__(self, src):
        HTMLParser.__init__(self, convert_charrefs=False)
        self.src = src
        self.root = El('#root', [], '')
        self.stack = [self.root]
        self.lines = [0] + [m.end() for m in re.finditer('\n', src)]
        self.atomic = None
        self.feed(src)
        self.close()
        if len(self.stack) != 1:
            sys.exit('닫히지 않은 태그: <%s>' % self.stack[-1].tag)

    def off(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def add(self, node):
        self.stack[-1].children.append(node)

    def text(self, data):
        if self.atomic:
            return
        ch = self.stack[-1].children
        if ch and isinstance(ch[-1], Text):
            ch[-1].data += data
        else:
            ch.append(Text(data))

    def handle_starttag(self, tag, attrs):
        if self.atomic:
            if tag == self.atomic[1]:
                self.atomic[2] += 1
            return
        if tag in ATOMIC:
            self.atomic = [self.off(), tag, 1]
            return
        el = El(tag, attrs, self.get_starttag_text())
        self.add(el)
        if not el.void:
            self.stack.append(el)

    def handle_startendtag(self, tag, attrs):
        if self.atomic:
            return
        el = El(tag, attrs, self.get_starttag_text())
        el.void = True
        self.add(el)

    def handle_endtag(self, tag):
        if self.atomic:
            if tag == self.atomic[1]:
                self.atomic[2] -= 1
                if self.atomic[2] == 0:
                    end = self.src.index('>', self.off()) + 1
                    self.add(Raw(self.src[self.atomic[0]:end]))
                    self.atomic = None
            return
        if tag in VOID:
            return
        if self.stack[-1].tag != tag:
            sys.exit('index.html %d번째 줄: </%s> 가 <%s> 와 짝이 맞지 않습니다.'
                     % (self.getpos()[0], tag, self.stack[-1].tag))
        self.stack.pop()

    def handle_data(self, data):
        self.text(data)

    def handle_entityref(self, name):
        self.text('&%s;' % name)

    def handle_charref(self, name):
        self.text('&#%s;' % name)

    def handle_comment(self, data):
        if not self.atomic:
            self.add(Raw('<!--%s-->' % data))

    def handle_decl(self, decl):
        self.add(Raw('<!%s>' % decl))


def esc_attr(v):
    return v.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')


def ser(node):
    if isinstance(node, Text):
        return node.data
    if isinstance(node, Raw):
        return node.text
    if node.tag == '#root':
        return ''.join(ser(c) for c in node.children)
    if node.dirty:
        head = '<' + node.tag + ''.join(
            ' ' + k if v is None else ' %s="%s"' % (k, esc_attr(v)) for k, v in node.attrs) + '>'
    else:
        head = node.raw
    if node.void:
        return head
    return head + ''.join(ser(c) for c in node.children) + '</%s>' % node.tag


def walk(el):
    for c in el.children:
        if isinstance(c, El):
            yield c
            for d in walk(c):
                yield d


# ---------------------------------------------------------------- 번역 단위
def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def has_own_text(el):
    return any(isinstance(c, Text) and c.data.strip() for c in el.children)


def has_any_text(el):
    return any((isinstance(c, Text) and c.data.strip()) or (isinstance(c, El) and has_any_text(c))
               for c in el.children)


def template(el, slots):
    out = []
    for c in el.children:
        if isinstance(c, Text):
            out.append(c.data)
        elif isinstance(c, El) and c.tag == 'br':
            out.append('<br>')
        else:
            slots.append(c)
            n = len(slots)
            if isinstance(c, El) and not c.void and has_any_text(c):
                out.append('<%d>%s</%d>' % (n, template(c, slots), n))
            else:
                out.append('<%d/>' % n)
    return ''.join(out)


def find_units(el, out):
    """글자를 직접 가진 가장 바깥 요소들을 문서 순서대로 모은다."""
    for c in el.children:
        if not isinstance(c, El) or c.tag in SKIP or c.get('translate') == 'no':
            continue
        if has_own_text(c):
            out.append(c)
        else:
            find_units(c, out)
    return out


def unit_key(el, slots):
    """번역 사전의 열쇠. 같은 한국어를 자리에 따라 다르게 옮겨야 하면 요소에 data-ctx="이름" 을 붙인다."""
    key = norm(template(el, slots))
    ctx = el.get('data-ctx')
    return '%s [%s]' % (key, ctx) if ctx and HANGUL.search(key) else key


PLACEHOLDER = re.compile(r'<(\d+)/>|<(\d+)>|</(\d+)>')


def rebuild(tr, slots, key):
    out, stack, opened, used = [], [], [], set()
    stack.append(out)
    pos = 0
    for m in PLACEHOLDER.finditer(tr):
        if m.start() > pos:
            stack[-1].append(Text(tr[pos:m.start()]))
        pos = m.end()
        num = m.group(1) or m.group(2) or m.group(3)
        i = int(num) - 1
        if i < 0 or i >= len(slots):
            sys.exit('자리표 <%s> 가 원문에 없습니다: %s' % (num, key))
        if m.group(3):
            if not opened or opened[-1] != num:
                sys.exit('자리표 </%s> 의 짝이 맞지 않습니다: %s' % (num, key))
            opened.pop()
            stack.pop()
            continue
        if num in used:
            sys.exit('자리표 <%s> 를 두 번 썼습니다: %s' % (num, key))
        used.add(num)
        src = slots[i]
        if m.group(1) or not isinstance(src, El):
            stack[-1].append(src)
        else:
            el = El(src.tag, src.attrs, src.raw)
            el.dirty, el.void = src.dirty, src.void
            stack[-1].append(el)
            stack.append(el.children)
            opened.append(num)
    if pos < len(tr):
        stack[-1].append(Text(tr[pos:]))
    if opened:
        sys.exit('자리표 <%s> 가 닫히지 않았습니다: %s' % (opened[-1], key))
    return out


def js_strings(src):
    """app.js 에서 T('...') 로 감싼 문구를 모은다."""
    keys = []
    for m in re.finditer(r'''\bT\(\s*(['"])((?:\\.|(?!\1).)*)\1''', src, re.S):
        s = re.sub(r'\\(.)', lambda x: {'n': '\n', 't': '\t'}.get(x.group(1), x.group(1)), m.group(2))
        if s not in keys:
            keys.append(s)
    return keys


def collect(root, js_src):
    """원본에 있는 모든 문구(한글이 들어 있는 것)를 순서대로 돌려준다."""
    keys = []

    def add(k):
        if k and HANGUL.search(k) and k not in keys:
            keys.append(k)

    for el in walk(root):
        for a in ATTRS:
            v = el.get(a)
            if v:
                add(v)
    for el in find_units(root, []):
        add(unit_key(el, []))
    for k in js_strings(js_src):
        add(k)
    return keys


# ---------------------------------------------------------------- 언어별 페이지
def localize(src, lang, catalog, missing):
    root = Builder(src).root

    def tr(key):
        if not HANGUL.search(key):
            return key
        t = (catalog.get(key) or {}).get(lang)
        if not t:
            if key not in missing:
                missing.append(key)
            return key
        return t

    # 속성
    for el in walk(root):
        for a in ATTRS:
            v = el.get(a)
            if v and HANGUL.search(v):
                el.set(a, tr(v))

    # 본문
    for el in find_units(root, []):
        slots = []
        key = unit_key(el, slots)
        if not HANGUL.search(key):
            continue
        first, last = el.children[0], el.children[-1]
        lead = re.match(r'\s*', first.data).group(0) if isinstance(first, Text) else ''
        tail = re.search(r'\s*$', last.data).group(0) if isinstance(last, Text) else ''
        el.children = rebuild(tr(key), slots, key)
        if lead:
            el.children.insert(0, Text(lead))
        if tail:
            el.children.append(Text(tail))

    # 문서 설정: 언어, 경로, 글꼴, 주소
    for el in walk(root):
        if el.tag == 'html':
            el.set('lang', lang)
            el.set('data-base', '../')
        for a in ('src', 'href'):
            v = el.get(a)
            if v and v.startswith('assets/'):
                el.set(a, '../' + v)
        if el.tag == 'link' and (el.get('href') or '').startswith('https://fonts.googleapis.com/css2'):
            el.set('href', FONTS[lang])
        if el.tag == 'link' and el.get('rel') == 'canonical':
            el.set('href', SITE + lang + '/')
        if el.tag == 'meta' and el.get('property') == 'og:url':
            el.set('content', SITE + lang + '/')
        if el.tag == 'meta' and el.get('property') == 'og:locale':
            el.set('content', OG_LOCALE[lang])
        target = el.get('data-lang-link')
        if target:
            el.set('href', './' if target == lang else ('../' if target == 'ko' else '../' + target + '/'))
            if target == lang:
                el.set('aria-current', 'true')
            else:
                el.drop('aria-current')

    # 화면 문구 사전을 app.js 앞에 싣는다
    def add_dict(parent):
        for i, c in enumerate(parent.children):
            if isinstance(c, El):
                if c.tag == 'script' and (c.get('src') or '').endswith('assets/js/data.js'):
                    parent.children[i:i] = [El('script', [('src', '../assets/js/i18n.js')],
                                               '<script src="../assets/js/i18n.js">'), Text('\n')]
                    return True
                if add_dict(c):
                    return True
        return False

    if not add_dict(root):
        sys.exit('index.html 에서 assets/js/data.js 를 싣는 script 를 찾지 못했습니다.')
    return ser(root)


def read(path):
    with io.open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


def write(path, text):
    full = os.path.join(ROOT, path)
    if not os.path.isdir(os.path.dirname(full)):
        os.makedirs(os.path.dirname(full))
    with io.open(full, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def main(argv):
    html = read('index.html')
    js = read('assets/js/app.js')
    keys = collect(Builder(html).root, js)

    if '--dump' in argv:
        out = argv[argv.index('--dump') + 1]
        with io.open(out, 'w', encoding='utf-8') as f:
            json.dump(keys, f, ensure_ascii=False, indent=0)
        print('문구 %d개를 %s 에 썼습니다.' % (len(keys), out))
        return 0

    catalog = json.loads(read('i18n/catalog.json'))
    pages, missing = {}, {}
    for lang in LANGS:
        missing[lang] = []
        pages[lang] = localize(html, lang, catalog, missing[lang])
        for k in js_strings(js):
            if HANGUL.search(k) and not (catalog.get(k) or {}).get(lang) and k not in missing[lang]:
                missing[lang].append(k)

    bad = False
    for lang in LANGS:
        if missing[lang]:
            bad = True
            print('[%s] 번역이 없는 문구 %d개:' % (lang, len(missing[lang])))
            for k in missing[lang]:
                print('  ' + k)
    stale = [k for k in catalog if k not in keys]
    if stale:
        print('원본에서 더는 쓰지 않는 번역 %d개 (지워도 됩니다):' % len(stale))
        for k in stale:
            print('  ' + k)
    if bad:
        print('\ni18n/catalog.json 에 번역을 채운 뒤 다시 실행하세요. 파일은 만들지 않았습니다.')
        return 1
    if '--check' in argv:
        print('빠진 번역이 없습니다. 문구 %d개.' % len(keys))
        return 0

    for lang in LANGS:
        write(lang + '/index.html', pages[lang])
    jskeys = [k for k in js_strings(js) if HANGUL.search(k)]
    table = dict((lang, dict((k, catalog[k][lang]) for k in jskeys)) for lang in LANGS)
    write('assets/js/i18n.js',
          '/* 자동으로 만든 파일입니다. 고치려면 i18n/catalog.json 을 고친 뒤 python3 tools/build_i18n.py 를 실행하세요. */\n'
          'window.KYLA_I18N = ' + json.dumps(table, ensure_ascii=False, indent=1, sort_keys=True) + ';\n')
    print('만들었습니다: en/index.html, ja/index.html, assets/js/i18n.js (문구 %d개)' % len(keys))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
