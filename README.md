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

## 메뉴와 조직도

| 상단 메뉴 | 펼치면 나오는 항목 |
|---|---|
| 협회 소개 | 협회 안내, 조직도, 유소년 교육, 후원·협력 |
| 대회·일정 | 누르면 바로 이동 |
| 지도자 자격 | 누르면 바로 이동 |
| 국제교류 | 국제교류 안내, 2027 제주 교류전 |
| 커뮤니티 | 공지사항, 문의사항, 포토갤러리 |

- 메뉴는 `index.html` 에 PC용(`<nav class="nav">`)과 휴대폰용(`<nav class="mnav">`)이 따로 적혀 있습니다.
  항목을 바꿀 때는 두 곳을 같은 순서로 함께 고칩니다. 휴대폰 화면 아래의 바로가기 5개는 `<nav class="tabbar">` 입니다.
- 조직도는 `index.html` 의 `id="about-org"` 부분입니다. 사람이나 위원회가 바뀌면 해당 칸의 글자를 고치고,
  이름의 영문·일문 표기를 `i18n/catalog.json` 에 넣은 뒤 `python3 tools/build_i18n.py` 를 실행합니다.
  회장·부회장 표기는 바로 아래 단체 정보(`id="about-info"`)에도 있으니 함께 고칩니다. 점선 칸은 공석이라는 뜻입니다.
- 조직도로 바로 가는 주소는 https://koreayouthlacrosse.com/#about-org 입니다.
  `#화면-구역` 꼴의 주소는 그 화면을 열고 해당 구역까지 내려갑니다. 예: `#about-info`(단체 정보), `#jeju2027-form`(회신서).

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
- 제출된 회신은 협회의 Firebase 에 저장되고, 관리자 화면에서 봅니다. 아래 항목을 보세요.

## DB와 관리자 화면 (Firebase)

참가 의향 회신과 회원 명부는 협회의 Firebase 프로젝트 `kyla-homepage` 의 Cloud Firestore(서울 리전)에 저장됩니다.
관리자 화면 주소는 https://koreayouthlacrosse.com/admin/ 입니다(한국어만 있고, 검색에 나오지 않게 해 두었습니다).

| Firestore 컬렉션 | 내용 | 누가 무엇을 |
|---|---|---|
| `eoiReplies` | 2027 제주 교류전 참가 의향 회신 | 방문자는 회신서로 제출만. 관리자는 보기·추가·수정·삭제 |
| `members` | 회원 명부 | 관리자만 보기·추가·수정·삭제 |
| `admins` | 관리자 명단. 문서 ID 가 구글 계정 이메일(소문자), `role` 이 `master` 또는 `admin` | 마스터만 고침. 누구나 자기 권한만 확인 |

관리자 화면의 메뉴는 네 가지입니다.

| 메뉴 | 주소 | 하는 일 |
|---|---|---|
| 대시보드 | `/admin/#home` | 주요 숫자, 확인이 필요한 일, 간단한 통계 |
| 회원 | `/admin/#members` | 명부를 표로 보기, 필터, 통계, 추가·수정·삭제, 내려받기 |
| 참가 의향 회신 | `/admin/#eoi` | 회신을 표로 보기(회신별·디비전별), 필터, 통계, 추가·수정·삭제, 내려받기 |
| 관리자 | `/admin/#admins` | 마스터만 보임. 관리자 계정을 더하고 빼기 |

- **처음 한 번**: Firebase 콘솔 → Firestore Database → `admins` 컬렉션에 문서를 하나 만듭니다. 문서 ID 는 마스터가 될 구글 계정
  이메일(소문자), 필드는 `role` = `master`. 그 뒤로는 관리자 화면의 "관리자" 메뉴에서 더하고 뺍니다.
  관리자 이메일은 이 저장소의 어떤 파일에도 적지 않습니다. 이 저장소는 누구나 볼 수 있습니다.
- **보안 규칙**: `tools/firestore.rules` 의 내용을 Firebase 콘솔 → Firestore Database → 규칙에 통째로 붙여 넣고 게시해야
  적용됩니다. 파일만 고쳐서는 바뀌지 않습니다. 누가 무엇을 할 수 있는지는 화면이 아니라 이 규칙이 지킵니다.
- **고친 기록**: 관리자가 추가하거나 고친 문서에는 고친 시각(`updatedAt`, 서버 시각)과 고친 사람(`updatedBy`)이 남습니다.
  두 사람이 같은 문서를 동시에 고치면 나중에 저장한 쪽이 실패하고 새로 고치라는 안내가 나옵니다.
- **삭제**: 수정 창의 "휴지통으로 옮기기"는 문서에 `deletedAt` 표시만 붙입니다. 목록과 통계에서는 빠지고, 휴지통에서 되돌릴 수 있습니다.
  DB 에서 실제로 지우려면 휴지통에서 "완전히 삭제"를 누릅니다. 개인정보 삭제 요청은 여기까지 해야 끝납니다.
- **회원 명부에 넣지 않는 것**: 선수는 대부분 미성년입니다. 생년월일과 집 주소 칸은 일부러 두지 않았고, 연락처는 보호자 것을 적습니다.
- **회신서의 보기나 항목을 바꿀 때**: 네 곳을 함께 고칩니다. `index.html` 의 `data-key`·`data-code`·`data-div`·`maxlength`,
  `assets/js/app.js` 의 `eoiRecord`, `assets/js/admin/eoi.js` 의 이름표·수정 창·내려받기 열, `tools/firestore.rules` 의 허용 값.
  회원의 구분·상태를 바꿀 때는 `assets/js/admin/members.js` 와 규칙을 함께 고칩니다.
  규칙을 먼저 게시하지 않으면 새 모양의 문서는 저장되지 않습니다.
- 구글 로그인은 Firebase 콘솔 → Authentication → 설정 → 승인된 도메인에 `koreayouthlacrosse.com` 이 있어야 됩니다.
- `data.js` 의 `firebase` 설정값(apiKey 등)은 공개되어도 되는 값입니다. 서비스 계정 키(JSON 파일)와 구글 계정 비밀번호는 저장소에 올리지 않습니다.
- `assets/vendor/` 의 Firebase 파일은 관리자 화면의 구글 로그인에만 씁니다. 방문자가 보는 화면에서는 불러오지 않고,
  방문 통계(Analytics)도 쓰지 않습니다. `admin/index.html` 맨 위의 보안 정책(Content-Security-Policy)에는
  Firebase 프로젝트 주소가 적혀 있어, 프로젝트를 바꾸면 그 주소도 함께 바꿉니다.
- 관리자 화면은 컬렉션을 통째로 읽어 화면에서 거르고 셉니다(컬렉션마다 최대 5,000건). 무료 요금제(Spark) 한도는
  하루 읽기 5만 건, 쓰기 2만 건, 저장 1GiB 입니다. 한도를 넘거나 저장에 실패하면 회신서에는 내용을 복사해 보내 달라는 안내가 나옵니다.
- **백업**: 관리자 화면의 "엑셀용 파일 내려받기"로 받은 파일을 보관합니다. `=`, `+`, `-`, `@` 로 시작하는 칸은 엑셀이 수식으로
  읽지 않도록 앞에 작은따옴표(')가 붙습니다. `data.js` 의 `formEndpoint` 에 구글 시트 주소를 넣으면
  회신이 올 때마다 시트에도 사본이 쌓이고 시트 주인에게 메일이 갑니다.

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
| `admin/index.html`, `assets/css/admin.css` | 관리자 화면의 틀과 모양 |
| `assets/js/admin/core.js` | 관리자 화면 공통: 로그인, Firestore 와 주고받기, 표·수정 창·막대 그림·내려받기 |
| `assets/js/admin/home.js`, `members.js`, `eoi.js`, `admins.js` | 관리자 화면의 메뉴 하나씩: 대시보드, 회원, 참가 의향 회신, 관리자 |
| `assets/vendor/` | 관리자 화면의 구글 로그인에 쓰는 Firebase 파일(Apache License 2.0) |
| `tools/firestore.rules` | Firebase 보안 규칙. 콘솔에 붙여 넣어 게시 |
| `assets/js/i18n.js` | 영어·일본어 화면 문구 (자동 생성) |
| `assets/css/site.css` | 디자인 |
| `assets/img/`, `assets/fonts/` | 로고와 아이콘, 영어 화면 글꼴(Kanit, SIL OFL) |
| `i18n/catalog.json` | 화면 문구의 영어·일본어 번역 |
| `tools/build_i18n.py` | 영어·일본어 페이지를 만드는 스크립트 |
| `tools/form-receiver.gs` | 신청서·문의·참가 의향 회신을 구글 스프레드시트로 받는 스크립트 |
| `CNAME` | 연결된 도메인. 지우면 도메인 연결이 끊깁니다 |
| `404.html`, `robots.txt`, `sitemap.xml` | 없는 주소 안내, 검색 엔진용 파일 |

## 신청서와 문의

`data.js` 의 `formEndpoint` 가 비어 있는 동안에는 대회 참가 신청서와 문의가 전송되지 않고,
적은 내용을 복사해 인스타그램 메시지로 보내도록 안내합니다. 접수 주소를 넣으면 그 주소로 전송합니다.
참가 의향 회신서는 `formEndpoint` 와 상관없이 Firebase 에 저장되며, 접수 주소가 있으면 사본이 그쪽으로도 갑니다.

구글 스프레드시트로 받으려면 `tools/form-receiver.gs` 를 씁니다. 스프레드시트의
확장 프로그램 → Apps Script 에 붙여 넣고 웹 앱으로 배포한 뒤, 나온 주소를 `formEndpoint` 에 넣습니다.
제출될 때마다 시트에 한 줄이 쌓이고 시트 주인에게 메일이 갑니다.
