# D&D 세션 로그 사이트

Foundry VTT 채팅 로그를 예쁘게 표시하는 웹사이트입니다.

## 🎲 기능

- **Foundry VTT 로그 스타일링**: heartbackup.exe와 동일한 스타일로 채팅 로그를 표시
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 모두 지원
- **Pretendard 폰트**: 한글에 최적화된 깔끔한 폰트 사용
- **깃헙 Pages 호스팅**: 무료로 호스팅 가능

## 📁 파일 구조

```
log/
├── index.html                    # 메인 랜딩 페이지
├── css/
│   ├── style.css                 # 랜딩 페이지 스타일
│   └── foundry-log.css           # Foundry VTT 로그 스타일 (heartbackup.exe 스타일 재현)
├── sessions/
│   ├── log-template.html         # 새 세션 로그 템플릿
│   └── session-001.html          # 예시 세션 로그
└── README.md                     # 이 파일
```

## 🚀 사용 방법

### 1. 새 세션 로그 추가하기

#### 방법 A: 템플릿 사용

1. `sessions/log-template.html`을 복사해서 새 파일 생성 (예: `session-002.html`)
2. Foundry VTT에서 채팅 로그를 HTML로 내보내기
3. 내보낸 파일에서 `<ol id="df-chat-log">...</ol>` 부분을 복사
4. 새 파일의 주석 부분에 붙여넣기
5. 헤더 정보(제목, 날짜, 참가자 등) 수정

#### 방법 B: heartbackup.exe 출력 사용

1. heartbackup.exe로 변환한 HTML 파일 준비
2. 파일에서 CSS를 제거하고 `foundry-log.css` 링크만 유지
3. `sessions/` 폴더에 저장

### 2. 인덱스 페이지에 세션 추가

`index.html`을 열어서 세션 목록에 새 카드를 추가:

```html
<div class="session-card">
    <h3>세션 #002</h3>
    <p class="session-date">2025-01-15</p>
    <p class="session-summary">세션 요약을 여기에</p>
    <a href="sessions/session-002.html" class="btn">로그 보기</a>
</div>
```

### 3. GitHub Pages로 배포

1. 이 저장소를 GitHub에 푸시
2. 저장소 Settings → Pages
3. Source를 `main` 브랜치로 설정
4. 저장하면 자동으로 배포됨

## 🎨 CSS 스타일 가이드

`css/foundry-log.css`는 다음 요소들을 스타일링합니다:

- `.message.general` - 일반 메시지
- `.message.general.system` - 시스템 메시지
- `.message.private.whisper` - 귓속말
- `.message.desc` - 설명/서술
- `.inlinerollresult` - 주사위 롤 결과
- `.hm-message` - HP 변화 메시지
- `.turn-announcer` - 턴 공지
- `.chat-card` - 카드형 메시지

## 🔧 커스터마이징

### 색상 변경

`css/foundry-log.css`에서 색상 값을 수정:

```css
.message.general.you {
    background: #dddddd;  /* 배경색 */
    color: #404040;       /* 글자색 */
}
```

### 헤더 스타일 변경

`sessions/log-template.html`의 `.session-header` 스타일 수정:

```css
.session-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

## 📝 Foundry VTT에서 로그 내보내기

1. Foundry VTT에서 채팅 로그 열기
2. 로그 내보내기 기능 사용
3. HTML 형식으로 저장
4. 저장된 파일 열어서 `<ol id="df-chat-log">` 부분 복사

## 🛠️ 분석 정보

이 CSS는 `heartbackup.exe` 프로그램을 역공학하여 추출한 스타일을 재현합니다:

- **프로그램**: heartbackup.exe (PyInstaller로 패키징된 Python 3.11 프로그램)
- **주요 라이브러리**: BeautifulSoup4, soupsieve
- **폰트**: Pretendard (한글), Fraunces (숫자)
- **스타일 방식**: Inline CSS를 외부 CSS로 변환

## 📄 라이센스

이 프로젝트는 교육 목적으로 만들어졌습니다.

## 🙋 도움말

문제가 있거나 기능 추가를 원하시면 이슈를 등록해주세요!
