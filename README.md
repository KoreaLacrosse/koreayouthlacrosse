# KYLA 한국유소년라크로스협회 홈페이지

[koreayouthlacrosse.com](https://koreayouthlacrosse.com)에 올라가는 사이트 파일입니다.
`main` 브랜치에 올라온 내용이 GitHub Pages로 그대로 게시됩니다. 저장하고 몇 분 안에 사이트에 반영됩니다.

| 언어 | 주소 |
|---|---|
| 한국어 | https://koreayouthlacrosse.com/ |
| English | https://koreayouthlacrosse.com/en/ |
| 日本語 | https://koreayouthlacrosse.com/ja/ |

## 공지 올리기 (GitHub에서 직접)

1. 이 저장소에서 `assets/js/data.js` 파일을 엽니다.
2. 오른쪽 위 연필 아이콘(Edit this file)을 누릅니다.
3. `notices: [` 라고 적힌 줄을 찾아, 바로 아랫줄에 아래 덩어리를 붙여 넣고 내용을 바꿉니다.

```js
    {
      id: "2026-12-notice",
      date: "2026-12-01",
      cat: "assoc",
      title: "제목",
      summary: "목록에 보이는 한 줄 요약",
      body: [
        "첫째 문단",
        "둘째 문단"
      ]
    },
```

4. 오른쪽 위 초록색 **Commit changes** 버튼을 누르고, 뜨는 창에서 한 번 더 **Commit changes** 를 누릅니다.
5. 몇 분 뒤 사이트의 공지사항에서 확인합니다.

적을 때 지킬 것

- `id` 는 영문 소문자·숫자·하이픈(-)으로, 다른 공지와 겹치지 않게 적습니다. 공지 주소가 됩니다.
- 날짜는 `"2026-12-01"` 형식입니다. 날짜가 늦은 공지가 위에 나옵니다.
- 분류 `cat`: `event` 대회 / `edu` 교육 / `cert` 자격 / `intl` 국제교류 / `assoc` 협회
- 글자는 큰따옴표로 감싸고, 줄 끝 쉼표를 지우지 않습니다. 본문 안에 따옴표가 필요하면 작은따옴표(' ')를 씁니다.
- 본문에는 문단 말고도 `{ h: "소제목" }` 과 `{ list: ["항목 1", "항목 2"] }` 를 넣을 수 있습니다.
- 한국어로만 적으면 영어·일본어 화면에도 한국어가 그대로 나옵니다. 번역은 나중에 채워도 됩니다.

저장한 뒤 공지 목록이 통째로 사라졌다면 쉼표나 따옴표가 하나 빠진 것입니다.
파일 화면의 **History** 에서 바로 전 상태를 확인해 되돌리면 됩니다.

## 일정과 사진

- 일정은 같은 파일의 `events: [` 아래에 있습니다. 상태(`status`)를 `open` 으로 바꾸면 신청·문의 화면에 참가 신청서가 열립니다.
- 확정되지 않은 날짜, 장소, 참가비는 적지 않습니다.
- 사진은 `assets/photos/앨범이름/` 폴더에 올린 뒤(Add file → Upload files), `albums` 의 `photos` 에
  `{ src: "assets/photos/앨범이름/01.jpg", alt: "사진 설명" }` 을 추가합니다.
  긴 변 1600px 정도로 줄인 JPG가 알맞습니다. 보호자 동의를 확인한 사진만 올립니다.

## 2027 제주 국제 교류전 참가 의향 회신

| 언어 | 주소 |
|---|---|
| 한국어 | https://koreayouthlacrosse.com/#jeju2027 |
| English | https://koreayouthlacrosse.com/en/#jeju2027 |
| 日本語 | https://koreayouthlacrosse.com/ja/#jeju2027 |

- 개최 계획(안)과 회신서 항목은 `index.html` 의 `data-view="jeju2027"` 부분에 있습니다.
  고친 뒤에는 번역을 맞추고 `python3 tools/build_i18n.py` 를 실행합니다.
- 일정 목록의 '준비하고 있는 일정'에는 `data.js` 의 `2027-jeju-exchange` 항목으로 나옵니다.
  일정이 확정되면 이 항목에 날짜를 넣고 상태를 `confirmed` 로 바꿉니다.
- 회신 이메일과 전화번호는 사이트에 싣지 않습니다. 제안서(PDF)에만 있습니다.

## 세 언어가 만들어지는 방식

한국어가 원본입니다.

| 내용 | 한국어 | 영어·일본어 |
|---|---|---|
| 공지, 일정, 사진 | `assets/js/data.js` | 같은 파일에서 `{ ko: "…", en: "…", ja: "…" }` 로 함께 적음 |
| 화면 문구 | `index.html`, `assets/js/app.js` | `i18n/catalog.json` 의 번역으로 자동 생성 |

`index.html` 이나 `app.js` 의 문구를 고쳤다면 번역을 맞춘 뒤 영어·일본어 페이지를 다시 만들어야 합니다.

```
python3 tools/build_i18n.py --check   # 번역이 빠진 문구 확인
python3 tools/build_i18n.py           # en/index.html, ja/index.html, assets/js/i18n.js 생성
```

`en/`, `ja/` 폴더와 `assets/js/i18n.js` 는 자동으로 만들어지는 파일이라 직접 고치지 않습니다.
`data.js` 만 고쳤을 때는 이 과정이 필요 없습니다.

## 파일 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 한국어 페이지. 모든 화면이 이 파일 하나에 있습니다 |
| `en/index.html`, `ja/index.html` | 영어·일본어 페이지 (자동 생성) |
| `assets/js/data.js` | 공지사항, 대회·일정, 사진 앨범, 연락처. 내용을 바꿀 때 고치는 파일 |
| `assets/js/app.js` | 화면 전환, 목록, 신청서 동작 |
| `assets/js/i18n.js` | 영어·일본어 화면 문구 (자동 생성) |
| `assets/css/site.css` | 디자인 |
| `assets/img/`, `assets/fonts/` | 로고와 아이콘, 영어 화면 글꼴(Kanit, SIL OFL) |
| `i18n/catalog.json` | 화면 문구의 영어·일본어 번역 |
| `tools/build_i18n.py` | 영어·일본어 페이지를 만드는 스크립트 |
| `tools/form-receiver.gs` | 신청서·문의·참가 의향 회신을 구글 스프레드시트로 받는 스크립트 |
| `CNAME` | 연결된 도메인. 지우면 도메인 연결이 끊깁니다 |
| `404.html`, `robots.txt`, `sitemap.xml` | 없는 주소 안내, 검색 엔진용 파일 |

## 신청서와 문의

`data.js` 의 `formEndpoint` 가 비어 있는 동안에는 신청서와 문의가 전송되지 않고,
적은 내용을 복사해 인스타그램 메시지로 보내도록 안내합니다.
접수 주소를 넣으면 그 주소로 전송합니다. 참가 의향 회신서도 같은 방식입니다.

구글 스프레드시트로 받으려면 `tools/form-receiver.gs` 를 씁니다. 스프레드시트의
확장 프로그램 → Apps Script 에 붙여 넣고 웹 앱으로 배포한 뒤, 나온 주소를 `formEndpoint` 에 넣습니다.
제출될 때마다 시트에 한 줄이 쌓이고 시트 주인에게 메일이 갑니다.
