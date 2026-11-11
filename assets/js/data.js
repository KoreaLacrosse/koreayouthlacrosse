/*
  KYLA 홈페이지 내용 파일
  ------------------------------------------------------------------
  공지사항, 대회·일정, 사진 앨범은 이 파일만 고치면 한국어·영어·일본어 화면에 모두 반영됩니다.

  ■ 글자를 적는 두 가지 방법
      title: "한국어로만 적기"
          영어·일본어 화면에도 한국어가 그대로 나옵니다. 급할 때는 이렇게 올리고 번역은 나중에 채워도 됩니다.
      title: { ko: "한국어", en: "English", ja: "日本語" }
          화면 언어에 맞춰 나옵니다. en 이나 ja 를 빼면 그 언어 화면에는 한국어가 나옵니다.

  ■ 공지 하나 올리기
      아래 덩어리를 복사해 notices: [ 바로 아랫줄에 붙이고 내용을 바꿉니다. 맨 끝 쉼표(,)까지 함께 복사합니다.

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

      · id 는 영문 소문자·숫자·하이픈(-)으로, 다른 공지와 겹치지 않게 적습니다. 공지 주소가 됩니다.
      · 날짜는 "2026-10-25" 형식으로 적습니다.
      · 분류(cat):  event 대회 / edu 교육 / cert 자격 / intl 국제교류 / assoc 협회
      · 본문(body)에는 문단 말고도 { h: "소제목" } 과 { list: ["항목 1", "항목 2"] } 를 넣을 수 있습니다.
      · 글자는 큰따옴표(" ")로 감싸고, 항목 사이에는 쉼표(,)를 넣습니다. 본문 안에 큰따옴표가 필요하면 작은따옴표(' ')로 바꿔 씁니다.

  ■ 일정 상태(status)
      planned    준비 중 (날짜 미정, 신청 받지 않음)
      confirmed  일정 확정 (접수 전)
      open       접수 중 (신청·문의 화면에 신청서가 열림)
      closed     접수 마감
      completed  종료 (지난 대회 기록으로 이동)

  ■ 확정되지 않은 날짜·장소·참가비는 적지 않습니다.
*/
window.KYLA_DATA = {

  config: {
    // 신청서와 문의가 모이는 접수 주소입니다. 비어 있는 동안에는 전송하지 않고, 적은 내용을 복사해 인스타그램으로 보내도록 안내합니다.
    formEndpoint: "",
    // 인스타그램 아이디(@ 없이)나 프로필 주소를 적으면 푸터, 모바일 메뉴, 문의 화면에 링크가 나옵니다.
    // 전화번호는 싣지 않습니다. 비어 있는 항목은 화면에 나오지 않습니다.
    contact: { instagram: "korea_youth_lacrosse", email: "" }
  },

  /* ---------------- 공지사항 ---------------- */
  notices: [
    {
      id: "championship-survey",
      date: "2026-11-09",
      cat: "event",
      title: {
        ko: "제1회 KYLA 챔피언십 만족도 조사 결과",
        en: "1st KYLA Championship: satisfaction survey results",
        ja: "第1回KYLAチャンピオンシップ 満足度調査の結果"
      },
      summary: {
        ko: "설문에 답한 21명 가운데 20명이 다음 대회에도 다시 참여하겠다고 답했습니다.",
        en: "Of the 21 people who answered the survey, 20 said they would take part again in the next event.",
        ja: "アンケートに回答した21人のうち20人が、次の大会にもまた参加すると答えました。"
      },
      body: {
        ko: [
          "10월 25일에 열린 제1회 KYLA 유소년 라크로스 챔피언십의 학부모와 참가자를 대상으로 만족도 조사를 했습니다. 모두 21명이 답해 주셨습니다.",
          { h: "다시 참여하겠다는 응답" },
          "응답자 21명 중 20명(95.2%)이 다음 대회에 '무조건 다시 참여'하겠다고 답했습니다. 응답자 모두 소속 클럽이나 학교팀을 통해 대회에 참가했습니다.",
          { h: "좋았다고 꼽은 점" },
          { list: [
            "아이들이 웃으며 경기를 즐기는 모습",
            "메달과 대회 출전이 주는 성취감",
            "경기와 팀워크를 통해 배우는 규칙과 협력",
            "두 경기장 동시 진행과 알맞은 휴식 시간",
            "안전한 장비와 세심한 현장 운영"
          ] },
          { h: "다음 대회에 반영할 의견" },
          { list: [
            "더 많은 학교와 클럽 초청",
            "심판과 스태프를 위한 그늘막과 휴식 공간",
            "관중도 볼 수 있는 경기 타이머",
            "대기 중에 연습할 수 있는 별도 공간",
            "함께 식사하는 자리 같은 참가자 교류 행사"
          ] },
          "보내 주신 의견은 다음 대회 준비에 반영하겠습니다. 설문에 참여해 주신 모든 분께 감사드립니다."
        ],
        en: [
          "We surveyed parents and participants of the 1st KYLA Youth Lacrosse Championship, held on October 25. A total of 21 people responded.",
          { h: "Would take part again" },
          "Of the 21 respondents, 20 (95.2%) said they would 'definitely take part again' in the next event. All respondents took part through their club or school team.",
          { h: "What people liked" },
          { list: [
            "Seeing the children smile and enjoy their games",
            "The sense of achievement from medals and playing in a tournament",
            "Learning rules and cooperation through games and teamwork",
            "Games on two fields at once, with well-judged rest time",
            "Safe equipment and attentive running of the day"
          ] },
          { h: "Suggestions for the next event" },
          { list: [
            "Invite more schools and clubs",
            "Shade and a rest area for referees and staff",
            "A game timer that spectators can see too",
            "A separate space to practise while waiting",
            "Social events for participants, such as a shared meal"
          ] },
          "We will reflect your feedback in preparing the next event. Thank you to everyone who took part in the survey."
        ],
        ja: [
          "10月25日に開催した第1回KYLAユースラクロスチャンピオンシップの保護者と参加者を対象に、満足度調査を行いました。合計21人の方にご回答いただきました。",
          { h: "また参加したいという回答" },
          "回答者21人のうち20人（95.2%）が、次の大会に「必ずまた参加する」と答えました。回答者は全員、所属するクラブまたは学校のチームを通じて大会に参加しました。",
          { h: "良かった点" },
          { list: [
            "子どもたちが笑顔で試合を楽しむ姿",
            "メダルと大会出場がもたらす達成感",
            "試合とチームワークを通じて学ぶルールと協力",
            "2面同時進行と適度な休憩時間",
            "安全な用具と行き届いた現場運営"
          ] },
          { h: "次の大会に反映するご意見" },
          { list: [
            "より多くの学校とクラブの招待",
            "審判とスタッフのための日よけと休憩スペース",
            "観客にも見える試合タイマー",
            "待ち時間に練習できる別スペース",
            "食事会など参加者同士の交流イベント"
          ] },
          "お寄せいただいたご意見は、次の大会の準備に反映します。アンケートにご協力くださった皆さまに感謝申し上げます。"
        ]
      },
      link: { label: { ko: "대회 기록 보기", en: "See event record", ja: "大会の記録を見る" }, href: "#event-2026-championship" }
    },
    {
      id: "championship-2026",
      date: "2026-10-25",
      cat: "event",
      title: {
        ko: "제1회 KYLA 유소년 라크로스 챔피언십을 마쳤습니다",
        en: "The 1st KYLA Youth Lacrosse Championship has been held",
        ja: "第1回KYLAユースラクロスチャンピオンシップを終えました"
      },
      summary: {
        ko: "학교·클럽팀이 연령별로 나뉘어 두 개 경기장에서 경기했습니다.",
        en: "School and club teams played in age divisions on two fields.",
        ja: "学校・クラブチームが年齢別に分かれ、2面のフィールドで試合を行いました。"
      },
      body: {
        ko: [
          "10월 25일, 제1회 KYLA 유소년 라크로스 챔피언십(1st KYLA Youth Lacrosse Championship)을 열었습니다. 학교와 클럽팀이 참가해 연령별로 경기를 치렀고, 두 개 경기장에서 동시에 경기를 진행했습니다.",
          "현장에는 시상과 기념품, 포토존, 선수 휴식 공간을 마련했습니다.",
          "경기 결과와 시상 내역, 현장 사진은 기록 정리가 끝나는 대로 대회 기록과 사진 화면에 올리겠습니다. 함께해 주신 선수와 지도자, 학부모께 감사드립니다."
        ],
        en: [
          "On October 25 we held the 1st KYLA Youth Lacrosse Championship. School and club teams took part and played in age divisions, with games running on two fields at the same time.",
          "On the day there were awards, souvenirs, a photo zone and a rest area for players.",
          "Results, awards and photos from the day will be posted on the event record and Photos pages as soon as the records are in order. Thank you to the players, coaches and parents who joined us."
        ],
        ja: [
          "10月25日、第1回KYLAユースラクロスチャンピオンシップ（1st KYLA Youth Lacrosse Championship）を開催しました。学校とクラブのチームが参加して年齢別に試合を行い、2面のフィールドで同時に試合を進めました。",
          "会場には、表彰と記念品、フォトゾーン、選手の休憩スペースを用意しました。",
          "試合結果と表彰内容、当日の写真は、記録の整理が終わり次第、大会の記録と写真のページに掲載します。ご参加くださった選手、指導者、保護者の皆さまに感謝申し上げます。"
        ]
      },
      link: { label: { ko: "대회 기록 보기", en: "See event record", ja: "大会の記録を見る" }, href: "#event-2026-championship" }
    },
    {
      id: "coach-cert-registered",
      date: "2026-10-08",
      cat: "cert",
      title: {
        ko: "'유소년라크로스지도자' 민간자격이 등록되었습니다",
        en: "'Youth Lacrosse Coach' has been registered as a private qualification",
        ja: "民間資格「ユースラクロス指導者」が登録されました"
      },
      summary: {
        ko: "등록번호 2026-007637, 문화체육관광부 소관 등록 민간자격입니다.",
        en: "Registration no. 2026-007637, a registered private qualification under the Ministry of Culture, Sports and Tourism.",
        ja: "登録番号 2026-007637、文化体育観光部所管の登録民間資格です。"
      },
      body: {
        ko: [
          "한국유소년라크로스협회가 관리하는 '유소년라크로스지도자' 자격이 2026년 10월 8일 등록 민간자격으로 등록되었습니다. 등록번호는 2026-007637, 소관 부처는 문화체육관광부입니다.",
          "등급은 일반과 마스터 두 가지이며, 일반등급 연수를 먼저 준비하고 있습니다. 교육 일정과 신청 방법은 확정되는 대로 공지하겠습니다.",
          "이 자격은 자격기본법 규정에 따라 등록한 민간자격으로, 국가로부터 인정받은 공인자격이 아닙니다."
        ],
        en: [
          "The 'Youth Lacrosse Coach' qualification (유소년라크로스지도자), managed by the Korea Youth Lacrosse Association, was registered as a private qualification on October 8, 2026. The registration number is 2026-007637 and the competent ministry is the Ministry of Culture, Sports and Tourism.",
          "There are two grades, General and Master, and we are preparing the General grade course first. Course dates and how to apply will be announced as soon as they are confirmed.",
          "This is a private qualification registered under the Framework Act on Qualifications. It is not a qualification accredited by the state."
        ],
        ja: [
          "韓国ユースラクロス協会が管理する「ユースラクロス指導者」（유소년라크로스지도자）資格が、2026年10月8日に登録民間資格として登録されました。登録番号は2026-007637、所管官庁は文化体育観光部です。",
          "等級は一般とマスターの2つで、まず一般等級の研修を準備しています。教育日程と申込方法は、確定次第お知らせします。",
          "この資格は、資格基本法の規定に基づいて登録した民間資格であり、国が認めた公認資格ではありません。"
        ]
      },
      link: { label: { ko: "지도자 자격 안내 보기", en: "See coach education", ja: "指導者資格のご案内を見る" }, href: "#coach" }
    },
    {
      id: "festival-2026",
      date: "2026-05-31",
      cat: "event",
      title: {
        ko: "제1회 유소년 라크로스 페스티벌을 열었습니다",
        en: "The 1st Youth Lacrosse Festival has been held",
        ja: "第1回ユースラクロスフェスティバルを開催しました"
      },
      summary: {
        ko: "학교와 클럽의 유소년 선수들이 함께한 첫 참여·교류형 행사입니다.",
        en: "Our first participation and exchange event, bringing together young players from schools and clubs.",
        ja: "学校とクラブのユース選手が集まった、初めての参加・交流型イベントです。"
      },
      body: {
        ko: [
          "5월 31일, 제1회 유소년 라크로스 페스티벌을 열었습니다. 학교와 클럽에서 라크로스를 배우는 유소년 선수들이 모여 안전한 입문형 경기로 첫 대회를 경험했습니다.",
          "이번 페스티벌은 KYLA가 정기 행사를 운영해 나가는 출발점입니다."
        ],
        en: [
          "On May 31 we held the 1st Youth Lacrosse Festival. Young players learning lacrosse at schools and clubs came together and experienced their first tournament through safe, entry-level games.",
          "This festival is the starting point for the regular events KYLA will go on to run."
        ],
        ja: [
          "5月31日、第1回ユースラクロスフェスティバルを開催しました。学校やクラブでラクロスを学ぶユース選手が集まり、安全な入門形式の試合で初めての大会を経験しました。",
          "今回のフェスティバルは、KYLAが定期イベントを運営していくうえでの出発点です。"
        ]
      },
      link: { label: { ko: "대회 기록 보기", en: "See event record", ja: "大会の記録を見る" }, href: "#event-2026-festival" }
    }
  ],

  /* ---------------- 대회·일정 ---------------- */
  events: [
    {
      id: "winter-indoor",
      cat: "event",
      status: "planned",
      stage: { ko: "검토 중", en: "Under review", ja: "検討中" },
      title: { ko: "겨울 유소년 인도어리그", en: "Winter youth indoor league", ja: "冬季ユースインドアリーグ" },
      summary: {
        ko: "겨울에도 경기 경험과 팀 교류가 이어지도록 실내 리그를 검토하고 있습니다. 개최일과 장소, 경기규정, 모집 방법은 정해지는 대로 공지합니다.",
        en: "We are looking at an indoor league so that game experience and team exchange can continue through the winter. Dates, venue, rules and how to enter will be announced once they are decided.",
        ja: "冬の間も試合経験とチーム交流が続くよう、屋内リーグを検討しています。開催日と会場、競技規則、募集方法は、決まり次第お知らせします。"
      },
      registration: { type: "team" }
    },
    {
      id: "coach-general",
      cat: "cert",
      status: "planned",
      stage: { ko: "준비 중", en: "In preparation", ja: "準備中" },
      title: { ko: "유소년라크로스지도자 일반등급 연수", en: "Youth Lacrosse Coach: General grade course", ja: "ユースラクロス指導者 一般等級研修" },
      summary: {
        ko: "일반등급 첫 연수를 준비하고 있습니다. 교육 일정과 장소, 비용은 등록된 운영규정에 맞춰 확정한 뒤 공지합니다.",
        en: "We are preparing the first General grade course. Dates, venue and fees will be announced once they are confirmed in line with the registered operating rules.",
        ja: "一般等級の最初の研修を準備しています。教育日程と会場、費用は、登録された運営規程に沿って確定した後にお知らせします。"
      },
      registration: { type: "person" }
    },
    {
      id: "2026-championship",
      cat: "event",
      status: "completed",
      date: "2026-10-25",
      title: { ko: "제1회 KYLA 유소년 라크로스 챔피언십", en: "1st KYLA Youth Lacrosse Championship", ja: "第1回KYLAユースラクロスチャンピオンシップ" },
      titleEn: "1st KYLA Youth Lacrosse Championship",
      summary: {
        ko: "학교·클럽팀이 연령별로 나뉘어 두 개 경기장에서 동시에 경기했습니다.",
        en: "School and club teams played in age divisions on two fields at the same time.",
        ja: "学校・クラブチームが年齢別に分かれ、2面のフィールドで同時に試合を行いました。"
      },
      facts: {
        ko: [
          ["참가", "학교·클럽 유소년팀"],
          ["경기", "연령별 경기, 두 개 경기장 동시 진행"],
          ["현장", "시상, 기념품, 포토존, 선수 휴식 공간"]
        ],
        en: [
          ["Teams", "School and club youth teams"],
          ["Games", "Age-division games, two fields running at once"],
          ["On the day", "Awards, souvenirs, photo zone, rest area for players"]
        ],
        ja: [
          ["参加", "学校・クラブのユースチーム"],
          ["試合", "年齢別の試合、2面同時進行"],
          ["会場", "表彰、記念品、フォトゾーン、選手の休憩スペース"]
        ]
      },
      pending: {
        ko: "경기 결과와 참가팀, 시상 내역은 최종 기록지를 확인한 뒤 올립니다.",
        en: "Results, participating teams and awards will be posted once the final score sheets have been checked.",
        ja: "試合結果と参加チーム、表彰内容は、最終の記録用紙を確認した後に掲載します。"
      },
      survey: {
        respondents: 21,
        returning: 20,
        say: {
          ko: "설문에 답한 21명 중 20명이 다음 대회에도 '무조건 다시 참여'하겠다고 답했습니다.",
          en: "Of the 21 people who answered the survey, 20 said they would 'definitely take part again' in the next event.",
          ja: "アンケートに回答した21人のうち20人が、次の大会にも「必ずまた参加する」と答えました。"
        },
        note: {
          ko: "제1회 KYLA 챔피언십 학부모·참가자 만족도 설문. 응답 21명 가운데 20명(95.2%)이며, 전체 참가자의 재참여율은 아닙니다.",
          en: "Satisfaction survey of parents and participants at the 1st KYLA Championship. This is 20 of 21 respondents (95.2%), not a return rate for all participants.",
          ja: "第1回KYLAチャンピオンシップの保護者・参加者満足度アンケート。回答21人のうち20人（95.2%）であり、参加者全体の再参加率ではありません。"
        },
        via: {
          ko: "응답자 모두 소속 클럽이나 학교팀을 통해 참가했습니다.",
          en: "All respondents took part through their club or school team.",
          ja: "回答者は全員、所属するクラブまたは学校のチームを通じて参加しました。"
        },
        liked: {
          ko: [
            "아이들이 웃으며 경기를 즐기는 모습",
            "메달과 대회 출전이 주는 성취감",
            "경기와 팀워크를 통해 배우는 규칙과 협력",
            "두 경기장 동시 진행과 알맞은 휴식 시간",
            "처음 라크로스를 본 학부모의 흥미",
            "다른 팀 경기를 보며 생긴 '더 잘하고 싶다'는 마음",
            "안전한 장비와 세심한 현장 운영"
          ],
          en: [
            "Seeing the children smile and enjoy their games",
            "The sense of achievement from medals and playing in a tournament",
            "Learning rules and cooperation through games and teamwork",
            "Games on two fields at once, with well-judged rest time",
            "The interest of parents seeing lacrosse for the first time",
            "Wanting to 'get better' after watching other teams play",
            "Safe equipment and attentive running of the day"
          ],
          ja: [
            "子どもたちが笑顔で試合を楽しむ姿",
            "メダルと大会出場がもたらす達成感",
            "試合とチームワークを通じて学ぶルールと協力",
            "2面同時進行と適度な休憩時間",
            "初めてラクロスを見た保護者の関心",
            "ほかのチームの試合を見て芽生えた「もっとうまくなりたい」という気持ち",
            "安全な用具と行き届いた現場運営"
          ]
        },
        improve: {
          ko: [
            "더 많은 학교와 클럽 초청",
            "심판과 스태프를 위한 그늘막과 휴식 공간",
            "알맞은 선수 보호장비",
            "관중도 볼 수 있는 경기 타이머",
            "대기 중에 연습할 수 있는 별도 공간",
            "선수가 많은 팀의 교체 운영 검토",
            "함께 식사하는 자리 같은 참가자 교류 행사"
          ],
          en: [
            "Invite more schools and clubs",
            "Shade and a rest area for referees and staff",
            "Suitable protective equipment for players",
            "A game timer that spectators can see too",
            "A separate space to practise while waiting",
            "Review how substitutions work for teams with many players",
            "Social events for participants, such as a shared meal"
          ],
          ja: [
            "より多くの学校とクラブの招待",
            "審判とスタッフのための日よけと休憩スペース",
            "選手に合った防具",
            "観客にも見える試合タイマー",
            "待ち時間に練習できる別スペース",
            "選手の多いチームの交代運用の検討",
            "食事会など参加者同士の交流イベント"
          ]
        }
      },
      album: "2026-championship"
    },
    {
      id: "2026-festival",
      cat: "event",
      status: "completed",
      date: "2026-05-31",
      title: { ko: "제1회 유소년 라크로스 페스티벌", en: "1st Youth Lacrosse Festival", ja: "第1回ユースラクロスフェスティバル" },
      summary: {
        ko: "학교와 클럽의 유소년 선수들이 함께한 첫 참여·교류형 행사입니다.",
        en: "Our first participation and exchange event, bringing together young players from schools and clubs.",
        ja: "学校とクラブのユース選手が集まった、初めての参加・交流型イベントです。"
      },
      facts: {
        ko: [
          ["대상", "학교·클럽 유소년 선수"],
          ["성격", "참여·교류형 행사, 안전한 입문형 경기"],
          ["의미", "KYLA 정기 행사의 출발점"]
        ],
        en: [
          ["For", "Young players from schools and clubs"],
          ["Format", "Participation and exchange event, safe entry-level games"],
          ["Significance", "Starting point for KYLA's regular events"]
        ],
        ja: [
          ["対象", "学校・クラブのユース選手"],
          ["形式", "参加・交流型イベント、安全な入門形式の試合"],
          ["意義", "KYLA定期イベントの出発点"]
        ]
      },
      pending: {
        ko: "참가팀과 경기 기록은 자료를 확인한 뒤 올립니다.",
        en: "Participating teams and game records will be posted once the materials have been checked.",
        ja: "参加チームと試合記録は、資料を確認した後に掲載します。"
      },
      album: "2026-festival"
    }
  ],

  /* ---------------- 사진 ----------------
     photos 에 { src: "assets/photos/앨범폴더/01.jpg", alt: "사진 설명" } 을 추가하면 앨범이 열립니다.
     보호자 동의를 확인한 사진만 올립니다.
  */
  albums: [
    {
      id: "2026-championship",
      title: { ko: "제1회 KYLA 유소년 라크로스 챔피언십", en: "1st KYLA Youth Lacrosse Championship", ja: "第1回KYLAユースラクロスチャンピオンシップ" },
      date: "2026-10-25",
      tone: "red",
      photos: []
    },
    {
      id: "2026-festival",
      title: { ko: "제1회 유소년 라크로스 페스티벌", en: "1st Youth Lacrosse Festival", ja: "第1回ユースラクロスフェスティバル" },
      date: "2026-05-31",
      tone: "orange",
      photos: []
    }
  ]
};
