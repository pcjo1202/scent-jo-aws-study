# 디자인 시스템

브랜드 아이덴티티 문서가 아니다. **가독성 명세**다.

이 앱의 화면은 텍스트 밀도가 극단적이다. 긴 한국어 지문 + 선택지 5개 + 정답 해설 + 선택지별 오답 해설. 한 문항이 화면 3~4개 분량이고, 그걸 **1019번 본다.** 행간 하나가 학습 지속 시간을 좌우한다.

문서 구조는 [Material Design 3](https://m3.material.io/)의 정보 구조를 그대로 따른다 — **Foundations · Styles · Components**.

## 원칙

1. **본문 가독성이 다른 모든 것을 이긴다.** 예뻐 보이려고 글자를 줄이지 않는다
2. **색에 의미를 최소한만 싣는다.** 색을 많이 쓸수록 각 색의 의미가 약해진다
3. **정보를 색 단독으로 전달하지 않는다.** 아이콘·텍스트를 병기한다
4. **모션은 방해다.** 1019번 반복할 화면에 애니메이션을 넣지 않는다

## Material Design 3에서 무엇을 가져오는가

M3를 **구조로 쓰고 스킨으로 쓰지 않는다.** 토큰 아키텍처·색 역할·타입 스케일 같은 *체계*는 검증된 자산이라 그대로 쓰고, 값과 표현은 이 앱의 목적에 맞춘다.

M3 Expressive는 특히 조심해서 걸러야 한다. 그쪽 목표는 **"감정적 임팩트"** 인데 이 앱의 목표는 **읽기**다. 정면으로 충돌한다.

### 채택

| 개념 | 왜 |
|---|---|
| **3계층 토큰** (ref → sys → comp) | 팔레트 값과 의미를 분리한다. 색을 바꿔도 규칙이 안 무너진다 |
| **색 역할 + `on-` 접두사** | `surface`/`on-surface`가 **쌍으로 정의**되므로 대비가 구조적으로 보장된다 |
| **surface container 5단계** | 해설 블록·아코디언·칩이 겹치는 화면에 정확히 맞는다 |
| **타입 스케일** (5역할 × 3크기) | 15개 스타일로 고정. 임의 크기를 만들 여지를 없앤다 |
| **shape scale** | `none`~`full` 토큰. "작은 라운드"를 고르지 값을 고르지 않는다 |
| **interaction states** | 선택지 카드가 클릭 타겟이라 hover/focus/pressed 정의가 필요하다 |
| **tonal elevation** | 그림자 대신 surface 색조로 높이를 표현한다. 다크모드에서 훨씬 안정적 |
| **window size class** | 반응형 분기의 공용 어휘 |

### 조정

**행간.** M3 `body-large`는 16sp/24sp = **1.5**다. 우리는 **1.75**를 쓴다. 이탈이 아니라 M3 준수다 — Google 자신의 가이드가 이렇게 말한다.

> CJK는 글자가 크고 조밀해서 영문과 같은 디자인 의도를 달성하려면 행간을 영문보다 키워야 하고, 그러지 않으면 두 줄 사이에서 글자가 잘릴 수 있다.

**Dynamic Color를 쓰지 않는다.** 벽지에서 색을 추출하는 안드로이드 기능이라 웹에 의미가 없다. 고정 팔레트 하나만 쓴다.

**의미색을 확장한다.** M3에는 `error`가 있지만 **"정답"에 해당하는 역할이 없다.** `correct` / `on-correct` / `correct-container`를 M3 명명 규칙 그대로 추가한다.

### 거부

| | 왜 |
|---|---|
| Material Web Components 라이브러리 | 토큰 개념만 가져오고 구현은 우리가 한다. Next.js에 컴포넌트 라이브러리를 얹을 이유가 없다 |
| M3 Expressive의 shape morphing·표현적 모션 | 원칙 4와 정면 충돌한다 |
| FAB, Navigation rail 등 | 안드로이드 전용 패턴. 대상 기기는 폰과 PC 둘뿐이다 |
| Customizing Material | Material 자체를 커스터마이즈하는 방법. 라이브러리를 안 쓰므로 무관 |

---

# Foundations

## Design tokens

토큰은 UI의 최소 단위 결정이다. M3는 3계층으로 나눈다.

```
reference  →  system  →  component
   팔레트        역할        용도
```

### 계층

| 계층 | 무엇 | 예 | 직접 쓰나 |
|---|---|---|---|
| **reference** | 원시 팔레트. 의미가 없다 | `--ref-neutral-10` | **절대 안 쓴다** |
| **system** | 역할. 의미가 있다 | `--sys-color-surface` | **여기만 쓴다** |
| **component** | 특정 컴포넌트 전용 | `--comp-choice-container-color` | 필요할 때만 |

**reference를 직접 참조하지 않는 것이 이 구조의 전부다.** `#18181b`를 쓰거나 `--ref-neutral-10`을 쓰면 그 자리가 왜 그 색인지 사라지고, 다크모드에서 뒤집을 수도 없다.

### 명명

M3 원본은 `md.sys.color.surface` 형태다. 우리는 단일 제품이라 `md` 접두사를 뺀다.

```
--ref-{palette}-{tone}          --ref-neutral-10
--sys-color-{role}              --sys-color-on-surface
--sys-typescale-{role}-{prop}   --sys-typescale-body-large-size
--sys-shape-corner-{size}       --sys-shape-corner-medium
--sys-state-{state}-opacity     --sys-state-hover-opacity
--sys-motion-duration-{step}    --sys-motion-duration-short2
--sys-motion-easing-{name}      --sys-motion-easing-standard
--comp-{component}-{prop}       --comp-choice-container-color
```

톤 번호는 M3 규약을 따른다. **0이 검정, 100이 흰색**이고 그 사이를 10 단위로 나눈다. surface container 5단계는 그 사이를 더 잘게 쓰므로 M3 확장 톤(`4 · 6 · 12 · 17 · 22 · 92 · 94 · 96 · 98`)이 함께 온다 — **톤 번호를 우리가 정하지 않는다.** M3가 그 값에 붙인 번호를 그대로 쓴다.

### 구현

CSS 커스텀 프로퍼티로 구현한다.

```css
:root {
  /* reference — 불변. 테마가 바뀌어도 그대로다 */
  --ref-neutral-6:   #141218;
  --ref-neutral-10:  #1d1b20;
  --ref-neutral-90:  #e6e0e9;
  --ref-neutral-98:  #fef7ff;

  /* system — 역할. 테마마다 다시 매핑된다 */
  --sys-color-surface:    var(--ref-neutral-98);
  --sys-color-on-surface: var(--ref-neutral-10);
}

[data-theme="dark"] {
  --sys-color-surface:    var(--ref-neutral-6);
  --sys-color-on-surface: var(--ref-neutral-90);
}
```

**다크모드에서 바뀌는 것은 system 계층뿐이다.** reference 팔레트는 그대로다. 색을 두 벌 관리하는 게 아니라 매핑을 두 벌 관리한다.

### component 계층을 남발하지 않는다

컴포넌트마다 토큰을 만들면 계층이 셋인 의미가 사라진다. **system 역할로 표현이 안 될 때만** 만든다. 우리 앱에서 실제로 필요한 것은 선택지 카드의 상태별 색 정도다.

## Interaction states

상태는 **상태 레이어**로 표현한다. 컴포넌트 위에 `on-` 색을 낮은 불투명도로 덮는 방식이라, 색 조합마다 별도 색을 정의할 필요가 없다.

### 불투명도

M3 값을 그대로 쓴다.

| 상태 | 불투명도 | 비고 |
|---|---|---|
| `enabled` | — | 기본 |
| `hover` | **0.08** | 포인터 장치만 |
| `focus` | **0.12** | 포커스 링과 함께 |
| `pressed` | **0.12** | |
| `dragged` | 0.16 | 이 앱에는 없다 |
| `disabled` | 컨테이너 0.12 · 내용 0.38 | |

```css
--sys-state-hover-opacity:   0.08;
--sys-state-focus-opacity:   0.12;
--sys-state-pressed-opacity: 0.12;
```

### 이 앱에서

**주요 인터랙티브 요소는 선택지 카드 하나다.** 나머지(버튼, 칩, 아코디언)는 부수적이다.

| 상태 | 표현 |
|---|---|
| hover | `on-surface` 0.08 레이어 |
| focus | `on-surface` 0.12 레이어 **+ 포커스 링** |
| pressed | `on-surface` 0.12 레이어 |
| **selected** | **상태 레이어가 아니다.** 색 역할 자체를 바꾼다 (`surface` → `secondary-container`) |

`selected`를 상태 레이어로 처리하지 않는 이유: 선택은 일시적 피드백이 아니라 **지속되는 의미**다. 0.08~0.12 오버레이로는 "내가 이걸 골랐다"가 충분히 보이지 않는다.

`hover`는 포인터 장치에서만 적용한다. 터치에서 hover가 남으면 이전에 누른 항목이 선택된 것처럼 보인다.

```css
@media (hover: hover) { /* hover 레이어 */ }
```

## Layout

### Window size class

M3의 분기 어휘를 쓴다. 대상 기기가 폰과 PC뿐이라 셋만 쓴다.

| 클래스 | 너비 | 대상 | 여백 |
|---|---|---|---|
| `compact` | < 600px | 폰 | 16px |
| `medium` | 600–839px | 태블릿·좁은 창 | 24px |
| `expanded` | ≥ 840px | PC | 24px |

M3에는 `large`·`extra-large`도 있지만 우리 화면은 읽기 칼럼 폭으로 상한이 걸려서 더 나눌 이유가 없다.

**이 경계에 토큰 이름을 준다.** `compact`가 기본이고 위로 둘만 이름이 필요하다.

```css
--sys-layout-breakpoint-medium:   600px;
--sys-layout-breakpoint-expanded: 840px;
```

프레임워크가 제공하는 기본 브레이크포인트를 **함께 두지 않는다.** `sm`·`md`·`lg` 같은 이름이 살아 있으면 이 표와 다른 지점에서 화면이 갈리는데, 그건 리뷰로 잡히지 않는다.

### 읽기 칼럼

```css
--sys-layout-reading-width: 42rem;   /* 672px ≈ 한글 42자 */
```

한 줄이 길어지면 다음 줄 시작점을 놓친다. **화면이 아무리 넓어도 본문은 이 폭을 넘지 않는다.**

### 화면 구성

| | compact | expanded |
|---|---|---|
| 본문 | 단일 칼럼, 전체 폭 | 읽기 칼럼 중앙 정렬 |
| 진행 표시 | 상단 고정 | 상단 고정 |
| 액션 (제출·다음) | **하단 고정** | 읽기 칼럼 하단, 흐름 안에 |
| 필터 | 전체 화면 시트 | 좌측 패널 |

`compact`에서 액션을 하단에 고정하는 이유: 긴 지문을 다 스크롤해야 버튼에 닿는 것은 1019번 반복할 동작으로 부적절하다. `env(safe-area-inset-bottom)`을 반영한다.

### 간격

M3의 **4dp 그리드**를 따른다. 임의 값을 쓰지 않는다.

```
4 · 8 · 12 · 16 · 24 · 32 · 48
```

| 위치 | 값 |
|---|---|
| 선택지 사이 | 8 |
| 선택지 내부 패딩 | 12 / 16 |
| 지문 ↔ 선택지 | 24 |
| 해설 블록 사이 | 16 |
| 섹션 사이 | 32 |
| 화면 여백 (`compact`) | 16 |
| 화면 여백 (`medium`·`expanded`) | 24 |

## Accessibility

원칙 3이 여기서 구체화된다.

| 항목 | 기준 |
|---|---|
| 본문 대비 | **4.5:1** 이상 (WCAG AA) |
| 큰 텍스트·UI 컴포넌트 대비 | **3:1** 이상 |
| 탭 타겟 | **48 × 48px** 이상 (M3 기준) |
| 포커스 링 | 지우지 않는다. `primary` 2px · offset 2px |

링을 여기서 못 박는 이유: "지우지 않는다"만 적어두면 화면마다 각자 다시 만든다. 전역 `:focus-visible` 한 곳에서 정의하고 컴포넌트는 건드리지 않는다.

링 색이 `primary`인 것은 「색 사용 규칙」의 *"`primary`는 링크와 주 버튼에만"* 과 충돌하지 않는다. 그 규칙은 **장식으로 쓰지 말라**는 것이고, 포커스 링은 한 번에 하나만 뜨는 시스템 어포던스다.

### 색 단독 전달 금지

정오·상태를 색만으로 표현하지 않는다. **항상 아이콘과 텍스트를 함께 쓴다.**

| 상황 | 색 | 아이콘 | 텍스트 |
|---|---|---|---|
| 정답 | `correct` | ✓ | "정답" |
| 오답 | `error` | ✕ | "내 선택" |

색각 이상 대응이자, 어두운 곳에서 폰으로 볼 때의 대비 저하 대응이기도 하다.

### 키보드

**키보드는 1급 입력 수단이다.** PC에서 1019문항을 마우스로만 푸는 것은 현실적이지 않다.

- 포커스 순서가 시각적 순서와 일치해야 한다
- 선택지는 `role="radio"` / `role="checkbox"`로 노출한다
- 단축키는 Components 절에서 정의한다

### `on-` 쌍이 대비를 보장한다

색 역할을 쌍으로 정의하면 **잘못된 조합을 만들 수 없다.** `--sys-color-on-surface`는 `--sys-color-surface` 위에 쓰라고 정의된 색이고, 그 대비는 팔레트 설계 시점에 이미 검증된다. 이것이 "대비를 나중에 검사한다"보다 근본적이다.

## Content design

용어가 흔들리면 구현이 흔들린다. **화면에 나가는 말을 여기서 고정한다.**

| 개념 | 쓴다 | 쓰지 않는다 |
|---|---|---|
| 1019개 중 하나 | **문제** | 문항(문서 전용), 퀴즈 |
| 최근 시도가 오답인 것 | **오답** | 틀린 문제, 오답노트 |
| 오답만 다시 푸는 화면 | **오답 복습** | 복습 모드, 오답노트 |
| 65문제 세트 | **모의고사** | 모의시험, 테스트 |
| 진행 지점부터 계속 | **이어풀기** | 계속하기, 재개 |
| 답 제출 | **제출** | 확인, 채점하기 |
| 채점 결과 | **정답 / 오답** | 맞음 / 틀림, O / X |
| 서비스 한 줄 설명 | **한줄노트** | 요약, 치트시트 |
| 서비스 비교 | **비교노트** | 비교표 |
| 데이터를 받는 중 | **불러오는 중** | 로딩 중, 잠시만 기다려 주세요 |
| 요청 실패 | **불러오지 못했다** | 오류가 발생했습니다, 에러, 실패 |
| 실패한 요청을 다시 보냄 | **다시 시도** | 재시도, 새로고침 |
| 아직 못 보낸 제출 | **저장 대기 N건** | 동기화 대기, 미전송 |

아래 넷은 **화면마다 갈리기 가장 쉬운 문구**다. 로딩·오류는 어느 화면에나 있는데 도메인 용어가 아니라서 그때그때 새로 쓰게 된다. 「불러오지 못했다」는 무엇을 못 했는지를 말하고 「오류가 발생했습니다」는 아무것도 말하지 않는다.

"오답노트"를 버리는 이유: 이 앱에는 **노트를 적는 기능이 없다.** 틀린 문제를 다시 푸는 것이므로 "오답 복습"이 정확하다. 이름이 없는 기능을 기대하게 만들지 않는다.

문서에서는 `문항`을, UI에서는 `문제`를 쓴다. 데이터 스키마의 `questionId`가 문항 번호이므로 문서 쪽 용어를 바꾸면 코드와 어긋난다.

---

# Styles

절 순서는 Google과 동일하다 — **color · elevation · icons · motion · shape · typography**. 알파벳 순이라 Typography가 마지막이지만, 순서가 예측 가능한 편이 찾기 쉽다.

## Color

### 역할 목록

M3의 색 역할을 그대로 쓴다. 명명은 `--sys-color-<role>`이고, **강조색·의미색 역할에는 대응하는 `on-` 짝이 있다.**

| 그룹 | 역할 |
|---|---|
| Primary | `primary` · `primary-container` |
| Secondary | `secondary-container` |
| Error | `error` · `error-container` |
| **Correct** *(확장)* | `correct` · `correct-container` |
| Neutral | `surface` · `surface-variant` |
| Surface container | `surface-container-lowest` · `-low` · `(기본)` · `-high` · `-highest` |
| Outline | `outline` · `outline-variant` |

**Tertiary를 쓰지 않는다.** 세 번째 강조색이 필요한 화면이 없다. 역할을 정의해두면 결국 아무 데나 쓰이게 된다.

**같은 이유로 bare `secondary`도 두지 않는다.** 이 앱에서 secondary 계열이 쓰이는 곳은 선택된 선택지와 선택된 필터 칩뿐이고 둘 다 `secondary-container` / `on-secondary-container` 쌍이다. 강조색으로서의 `secondary`는 쓸 자리가 없다.

surface container 계열의 내용색은 전부 `on-surface` 또는 `on-surface-variant`를 쓴다. M3 규약 그대로다.

### Correct 역할을 추가한 이유

M3에는 `error`가 있지만 **"정답"에 해당하는 역할이 없다.** 채점 결과를 표시하는 것이 이 앱의 핵심 화면이므로 M3 명명 규칙을 그대로 따라 확장한다.

```
--sys-color-correct            --sys-color-on-correct
--sys-color-correct-container  --sys-color-on-correct-container
```

`success`가 아니라 `correct`인 이유: 이 앱에서 초록은 "작업 성공"이 아니라 "답이 맞음"이다. Content design 용어표의 **정답**과 일치시킨다.

### 팔레트

**scent-jo 시그니처 주황 `#E68236`에서 재생성했다.** 소스는 `scent-jo-blog` 레포 `DESIGN.md`의 `signatureStart`다. Material 기본 스킴(보라 `#6750A4`)으로 시작했다가 이 값으로 갈아끼웠고, **`--ref-*` 계층만 바꿔 라이트·다크가 함께 이동했다.** 3계층 토큰을 쓴 대가가 여기서 돌아왔다.

**`#E68236`은 소스이지 `primary` 값이 아니다.** 흰 글자 대비 2.76:1이라 UI 최소 3:1도 못 넘는다 — M3 톤으로 64라 검은 글자를 얹는 밝은 면적색이다. `primary` 역할은 톤 40이므로 재생성 결과인 `#964900`이 정본이고 원본 hex는 입력으로만 쓰인다. 블로그도 이 색을 면적색으로 쓰지 않는다(`background-clip: text`).

생성기는 `@material/material-color-utilities` 0.4.0이고 계열마다 다르게 뽑았다.

| 계열 | 생성 |
|---|---|
| `primary` · `neutral` · `neutral-variant` | `CorePalette.of('#E68236')` |
| `secondary` | `TonalPalette.fromHueAndChroma(67.48, 16)` |
| `error` · `correct` | **재생성하지 않는다.** Material 기본값 유지 |

`secondary`만 hue를 옮긴 이유는 색역이다. 주황은 톤 90에서 sRGB가 chroma 14.06까지만 허용해, 같은 hue의 `primary`(chroma 52.91)와 `secondary`(16)가 **같은 경계값으로 눌려 한 색이 된다.** 보라에서는 20.24/16.10으로 갈려 안 나던 문제다. hue 67.48은 임의값이 아니라 M3 `SchemeVibrant`가 이 소스의 secondary에 쓰는 값(소스 52.48 + 회전 15.00)이고, chroma 16은 baseline secondary 값이다. Vibrant를 통째로 쓰지 않은 것은 그쪽 neutral chroma가 10으로 baseline(4)의 2.5배라 배경이 복숭아색이 되기 때문이다 — 1019문항을 읽는 표면이 색을 나르면 원칙 2와 충돌한다.

**`error`·`correct`는 브랜드가 아니라 의미색이다.** 정답 초록·오답 빨강을 브랜드에 맞춰 흔들지 않는다.

키 컬러를 다시 바꾸려면 위 두 줄의 소스만 갈고 `--ref-*`를 재생성한다. **`--sys-*` 계층은 손대지 않는다.**

#### Light

| 역할 | 값 | 역할 | 값 |
|---|---|---|---|
| `primary` | `#964900` | `on-primary` | `#FFFFFF` |
| `primary-container` | `#FFDCC7` | `on-primary-container` | `#311300` |
| `secondary-container` | `#FDDDBD` | `on-secondary-container` | `#281805` |
| `error` | `#B3261E` | `on-error` | `#FFFFFF` |
| `error-container` | `#F9DEDC` | `on-error-container` | `#410E0B` |
| `correct` | `#2E6B33` | `on-correct` | `#FFFFFF` |
| `correct-container` | `#B0F0B4` | `on-correct-container` | `#00210A` |
| `surface` | `#FFF8F5` | `on-surface` | `#201A17` |
| `surface-variant` | `#F4DED3` | `on-surface-variant` | `#52443C` |
| `surface-container-lowest` | `#FFFFFF` | `surface-container-low` | `#FEF1EB` |
| `surface-container` | `#F8EBE6` | `surface-container-high` | `#F2E6E0` |
| `surface-container-highest` | `#ECE0DA` | | |
| `outline` | `#84746A` | `outline-variant` | `#D7C3B8` |

#### Dark

| 역할 | 값 | 역할 | 값 |
|---|---|---|---|
| `primary` | `#FFB787` | `on-primary` | `#502400` |
| `primary-container` | `#723600` | `on-primary-container` | `#FFDCC7` |
| `secondary-container` | `#58432C` | `on-secondary-container` | `#FDDDBD` |
| `error` | `#F2B8B5` | `on-error` | `#601410` |
| `error-container` | `#8C1D18` | `on-error-container` | `#F9DEDC` |
| `correct` | `#95D89A` | `on-correct` | `#00390F` |
| `correct-container` | `#145223` | `on-correct-container` | `#B0F0B4` |
| `surface` | `#18120F` | `on-surface` | `#ECE0DA` |
| `surface-variant` | `#52443C` | `on-surface-variant` | `#D7C3B8` |
| `surface-container-lowest` | `#120D0A` | `surface-container-low` | `#201A17` |
| `surface-container` | `#241E1B` | `surface-container-high` | `#2F2925` |
| `surface-container-highest` | `#3A3330` | | |
| `outline` | `#9F8D83` | `outline-variant` | `#52443C` |

### 대비 검증

**`on-` 쌍 전부와, 배경 위에 단독으로 놓이는 유채 역할을 실측했다.** WCAG 기준은 본문 4.5:1, 큰 텍스트·UI 컴포넌트 3:1이다. 표면끼리의 대비(`surface-container-*` 단계 간)는 tonal elevation이라 기준 적용 대상이 아니므로 넣지 않는다.

| 조합 | Light | Dark |
|---|---|---|
| `on-surface` / `surface` | 16.37 | 14.34 |
| `on-surface-variant` / `surface` | 8.88 | 10.94 |
| `on-surface` / `surface-container` | 14.75 | 12.72 |
| `on-primary` / `primary` | 6.46 | 7.77 |
| `on-primary-container` / `primary-container` | 13.33 | 7.27 |
| `on-secondary-container` / `secondary-container` | 13.29 | 7.21 |
| `on-error` / `error` | 6.54 | 7.66 |
| `error` / `surface` | 6.22 | 10.86 |
| `on-error-container` / `error-container` | 12.77 | 7.17 |
| `on-correct` / `correct` | 6.43 | 7.89 |
| `correct` / `surface` | 6.12 | 11.10 |
| `on-correct-container` / `correct-container` | 13.07 | 7.06 |
| `outline` / `surface` | 4.27 † | 5.84 |
| `primary` / `surface` | 6.15 ‡ | 10.93 |
| `outline-variant` / `surface` | 1.61 § | 1.99 § |

† `outline`은 테두리·구분선이므로 UI 컴포넌트 기준 3:1이 적용된다. 통과.
‡ `primary`는 링크·아이콘으로 배경 위에 직접 놓이므로 3:1이 적용된다. 통과.
§ **3:1 미달이지만 기준 적용 대상이 아니다.** `outline-variant`는 필수 정보를 나르지 않는 장식 구분선이고, 의미가 걸린 경계(선택지 카드 테두리 등)는 `outline`(4.27 / 5.84)을 쓴다. 보라 시절도 1.62 / 1.99로 같아 이번 교체의 회귀가 아니다. `surface-container-low`가 `surface` 대비 1.05라 카드 경계가 사실상 이 선 하나에 의존하므로, **카드 테두리에는 `outline-variant`를 쓰지 않는다.**

**팔레트를 바꾸면 이 표를 다시 계산한다.** 값만 바꾸고 표를 방치하면 문서가 거짓말이 된다. 계산은 `tokens.css`를 파싱해 `--sys-color-*` → `--ref-*` → hex로 해석한 값으로 하고, 손으로 옮겨 적지 않는다. 계산 방식 자체는 교체 전 표의 알려진 값을 재현하는지로 검증한다.

### 색으로만 갈리지 않는 쌍

**팔레트가 전부 따뜻한 색이 되면서 적록색약에서 붙는 쌍이 생겼다.** 색각 이상에서는 색상환이 청–황 축으로 눌리므로, 주황·빨강·초록이 모두 노란 쪽으로 모인다. 보라 시절에는 `secondary`가 차가운 쪽에 있어 생기지 않던 문제다.

유채 역할 7개의 전 조합 42쌍을 Light·Dark × 3개 모델(Machado 2009 deutan/protan, Viénot 1999 deutan)로 실측했다. ΔE는 CIE76, 식별 한계(JND)는 2.3. "색각 최악"은 세 모델 중 최솟값이다.

| 쌍 | 정상 | 색각 최악 | 보라 시절 |
|---|---|---|---|
| `primary` / `error` (Light) | 28.0 | **2.0** | 73.4 |
| `secondary-container` / `correct-container` (Dark) | 36.9 | **2.2** | 30.3 |
| `secondary-container` / `correct-container` (Light) | 38.0 | 2.6 | 31.5 |
| `primary-container` / `error-container` (Dark) | 23.6 | 2.9 | 67.8 |
| `error` / `correct` (Light) | 88.8 | 10.3 | 10.3 |
| `error` / `correct` (Dark) | 55.8 | 9.9 | 9.9 |
| `error-container` / `correct-container` (Light) | 44.5 | 15.3 | 15.3 |
| `error-container` / `correct-container` (Dark) | 77.1 | 8.8 | 8.8 |

**42쌍 중 JND 미만이 2건이다.** `error` × `correct`는 재생성 대상이 아니어서 보라 시절과 값이 같다 — 정오 판정 자체는 팔레트 교체로 나빠지지 않았다.

**팔레트를 고쳐서 풀지 않는다.** 색각 이상에서 따뜻한 색끼리 벌리려면 `secondary`를 차가운 쪽으로 보내야 하는데, 그러면 브랜드에서 파생시킨다는 전제가 무너진다. 대신 **원칙 3이 이미 무조건 강제하는 것**으로 받는다 — 정보를 색 단독으로 전달하지 않는다.

이 팔레트에서 구속력이 생기는 지점은 둘이다.

- **`primary`는 정오를 나르지 않는다.** 「색 사용 규칙」이 `primary`를 링크와 주 버튼에만 묶어두므로 `error`와 의미가 경쟁하지 않는다. 형태·위치도 다르다(알약 버튼 vs 전체 폭 배너). 이 잠금이 풀리면 위 2.0이 바로 문제가 된다
- **정답 선택지를 `correct-container` 채움으로만 표시하지 않는다.** 선택된 선택지가 `secondary-container`라서, 적록색약 사용자에게 "내가 고른 것"과 "정답"이 같은 면색이 된다. 아이콘·텍스트 병기가 필수이고, 면 채움 대신 `correct` 테두리를 쓰면 색으로도 갈린다(색각 최악 14.2)

두 번째는 채점 결과 컴포넌트를 만들 때 지켜야 한다.

### surface container를 화면에 매핑

M3에서 container 단계가 높을수록 강조도가 높다. 우리 화면에 이렇게 배정한다.

| 요소 | 역할 |
|---|---|
| 페이지 배경 | `surface` |
| 선택지 카드 (기본) | `surface-container-low` |
| 선택지 카드 (선택됨) | `secondary-container` |
| 해설 블록 | `surface-container` |
| 하단 액션 바 | `surface-container` |
| 칩 | `surface-container-high` |
| 아코디언 펼침 영역 | `surface-container-low` |

선택된 선택지만 container 계열을 벗어나 `secondary-container`로 간다. **선택은 강조도가 아니라 의미**이므로 색상 자체가 달라야 한다.

### 색 사용 규칙

- **`primary`는 링크와 주 버튼에만.** 헤더·강조에 남발하면 선택 상태가 묻힌다
- **`correct` / `error`는 채점 결과에만.** 다른 곳에 초록·빨강을 쓰지 않는다
- **카테고리 11개에 색을 배정하지 않는다**

11색 팔레트는 예외 없이 실패한다. 서로 구분되지 않고, 다크모드에서 무너지고, 색각 이상에서 절반이 겹친다. 무엇보다 **카테고리 색은 정오 색과 경쟁한다.** 카테고리는 `surface-container-high` 칩에 `on-surface-variant` 라벨로만 표시한다.

**예외 하나**: 대시보드의 카테고리별 정답률 막대는 값에 따라 `error`↔`correct` 사이를 간다. 여기서 색은 카테고리가 아니라 **값**을 나타내므로 의미가 충돌하지 않는다.

비교노트의 ★ 중요도도 색을 쓰지 않는다. ★ 문자 그대로 1~3개를 보여준다.

### 테마 전환

`prefers-color-scheme`을 기본으로 하고 수동 토글을 둔다. 상태는 `system` / `light` / `dark` 셋이며 `localStorage`에 저장한다. 밤에 폰으로 공부하는 시나리오가 실재하므로 선택 기능이 아니다.

## Elevation

M3는 **그림자가 아니라 색조로 높이를 표현한다.** surface container 단계가 곧 높이다.

| 레벨 | dp | 우리 용도 |
|---|---|---|
| `level0` | 0 | 기본. 대부분의 요소 |
| `level1` | 1 | 선택지 카드 |
| `level2` | 3 | 하단 액션 바, 상단 진행 바 |
| `level3` | 6 | 다이얼로그 |
| `level4` | 8 | 안 씀 |
| `level5` | 12 | 안 씀 |

**그림자를 쓰지 않는다.** 다크모드에서 그림자는 배경과 구분되지 않아 무의미해지고, 텍스트가 빽빽한 화면에서 시각적 소음만 늘린다. 높이는 `surface-container-*` 배정으로 표현한다.

예외는 **하단 고정 액션 바** 하나다. 스크롤되는 본문 위에 떠 있다는 신호가 필요하므로 얇은 상단 `outline-variant` 선을 둔다. 그림자가 아니라 선이다.

## Icons

[Material Symbols](https://fonts.google.com/icons)를 쓴다. Google 아이콘 세트이고 Apache 2.0이다.

**단, 가변 폰트로 불러오지 않고 개별 SVG를 인라인한다.** 필요한 아이콘이 11개뿐인데 폰트 파일을 받는 것은 낭비다. 폰트 로딩 전 아이콘이 사라지는 구간(FOIT)도 없앨 수 있다.

| 용도 | 아이콘 | 채움 |
|---|---|---|
| 정답 | `check_circle` | **filled** |
| 오답 | `cancel` | **filled** |
| 아코디언 펼침 | `expand_more` | outlined |
| 이전 / 다음 | `chevron_left` · `chevron_right` | outlined |
| 필터 | `filter_list` | outlined |
| 테마 전환 | `light_mode` · `dark_mode` | outlined |
| 뒤로 | `arrow_back` | outlined |
| 요청 실패 | `error` | outlined |
| 저장 대기 | `cloud_off` | outlined |

**로딩에는 아이콘을 두지 않는다.** Material Symbols의 `progress_activity`는 회전을 전제한 글리프인데 원칙 4가 그 회전을 금지하므로, 멈춰 있는 호(弧) 하나만 남아 아무 의미도 나르지 않는다. 로딩 배너는 문구만 쓴다.

기본 축값은 optical size 24 · weight 400 · grade 0 · fill 0이다. **정오 아이콘만 fill 1**을 쓴다 — 채점 결과는 이 화면에서 가장 중요한 정보이므로 시각적 무게가 더 필요하다.

아이콘은 항상 텍스트와 함께 간다 (Foundations · Accessibility). 아이콘 단독 버튼에는 `aria-label`을 붙인다.

## Motion

### 토큰

M3 값을 그대로 쓴다.

| 구분 | 토큰 | 값 |
|---|---|---|
| duration | `short1`~`short4` | 50 · 100 · 150 · 200ms |
| | `medium1`~`medium4` | 250 · 300 · 350 · 400ms |
| | `long1`~`long4` | 450 · 500 · 550 · 600ms |
| easing | `standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| | `standard-decelerate` | `cubic-bezier(0, 0, 0, 1)` |
| | `standard-accelerate` | `cubic-bezier(0.3, 0, 1, 1)` |
| | `emphasized` | `cubic-bezier(0.2, 0, 0, 1)` |

### 이 앱에서 쓰는 것

**`short2`(100ms)와 `short4`(200ms), `easing-standard` 셋뿐이다.**

| 대상 | 값 |
|---|---|
| 상태 레이어 (hover·pressed) | `short2` · `standard` |
| 아코디언 펼침 | `short4` · `standard` |
| 문항 전환 (opacity) | `short4` · `standard` |
| **채점 결과 등장** | **없음. 즉시 표시** |

`medium` 이상과 `emphasized` 계열은 쓰지 않는다. M3 Expressive의 표현적 모션은 감정적 임팩트를 위한 것인데, 이 앱은 같은 동작을 1019번 반복한다. **200ms를 1019번 기다리면 3분 24초다.**

채점 결과에 전환을 넣지 않는 이유도 같다. 답을 제출한 직후가 집중이 가장 높은 순간이고, 거기에 애니메이션을 끼우면 매번 흐름이 끊긴다.

`prefers-reduced-motion: reduce`에서는 위 전환을 전부 제거한다.

## Shape

M3 shape scale을 그대로 쓴다.

| 토큰 | 값 |
|---|---|
| `corner-none` | 0px |
| `corner-extra-small` | 4px |
| `corner-small` | 8px |
| `corner-medium` | 12px |
| `corner-large` | 16px |
| `corner-extra-large` | 28px |
| `corner-full` | 9999px |

**값이 아니라 토큰을 고른다.** "12px"이 아니라 "medium"을 지정한다.

| 요소 | 토큰 |
|---|---|
| 선택지 카드 | `medium` |
| 해설 블록 | `medium` |
| 칩 | `full` |
| 버튼 | `full` |
| 입력 필드 | `extra-small` |
| 다이얼로그 · 시트 | `extra-large` |
| 하단 액션 바 | `none` (화면 폭 전체) |

## Typography

### M3 타입 스케일

5개 역할 × 3개 크기 = 15개 스타일. **이 15개 밖의 크기를 만들지 않는다.**

| 역할 | 크기 | 행간 | 굵기 | tracking |
|---|---|---|---|---|
| `display-large` | 57px | 64px | 400 | -0.25px |
| `display-medium` | 45px | 52px | 400 | 0 |
| `display-small` | 36px | 44px | 400 | 0 |
| `headline-large` | 32px | 40px | 400 | 0 |
| `headline-medium` | 28px | 36px | 400 | 0 |
| `headline-small` | 24px | 32px | 400 | 0 |
| `title-large` | 22px | 28px | 400 | 0 |
| `title-medium` | 16px | 24px | 500 | 0.15px |
| `title-small` | 14px | 20px | 500 | 0.1px |
| `body-large` | 16px | 24px | 400 | 0.5px |
| `body-medium` | 14px | 20px | 400 | 0.25px |
| `body-small` | 12px | 16px | 400 | 0.4px |
| `label-large` | 14px | 20px | 500 | 0.1px |
| `label-medium` | 12px | 16px | 500 | 0.5px |
| `label-small` | 11px | 16px | 500 | 0.5px |

### 한국어 조정

두 가지를 바꾼다. 둘 다 Google 자신의 CJK 가이드에 근거한다.

> CJK는 글자가 크고 조밀해서 영문과 같은 디자인 의도를 달성하려면 행간을 영문보다 키워야 하고, 그러지 않으면 두 줄 사이에서 글자가 잘릴 수 있다. Title~Caption은 폰트 크기도 영문보다 1px 크게 잡는다.

**1. 행간을 키운다.** `body-large`는 24px(1.5) → **28px(1.75)**. 긴 지문에서 1.5는 벽처럼 보인다. 이 앱에서 가장 중요한 단일 수치다.

**2. tracking을 0으로 만든다.** M3의 tracking 값은 Roboto와 라틴 문자에 맞춰 튜닝된 것이다. **한글은 이미 글자마다 고정폭에 가깝게 배치되므로 양수 자간을 주면 오히려 단어 덩어리가 흩어진다.** 한글 본문에는 tracking 0을 쓴다.

크기는 **16px 미만 역할에만 +1px** 한다. 작은 크기에서 한글 획이 뭉개지는 것을 막기 위함이고, `body-large` 16px은 이미 편안한 하한이라 그대로 둔다. 16px은 iOS에서 입력 요소 자동 확대를 막는 경계이기도 하다.

### 우리 스케일

| 역할 | 크기 | 행간 | 굵기 | tracking | 용도 |
|---|---|---|---|---|---|
| `headline-small` | 24px | 32px | 400 | 0 | 화면 제목 |
| `title-medium` | 17px | 26px | 500 | 0 | 섹션 제목, 해부서 절 제목 |
| `title-small` | 15px | 22px | 500 | 0 | 카드 제목 |
| **`body-large`** | **16px** | **28px** | **400** | **0** | **지문 · 선택지 · 정답 해설** |
| `body-medium` | 15px | 26px | 400 | 0 | 오답 해설, 보조 설명 |
| `body-small` | 13px | 22px | 400 | 0 | 메타 정보 |
| `label-large` | 15px | 20px | 500 | 0 | 버튼 |
| `label-medium` | 13px | 18px | 500 | 0 | 칩, 카테고리 라벨 |

**쓰지 않는 역할**: `display-*` 전부, `headline-large`·`headline-medium`, `title-large`, `label-small`. 이 앱에 24px보다 큰 글자가 필요한 화면이 없다.

### 폰트

M3는 `plain`과 `brand` 두 타입페이스를 둔다. **우리는 brand 타입페이스가 없으므로 둘을 같은 값으로 둔다.**

```css
--ref-typeface-plain: system-ui, -apple-system, "Apple SD Gothic Neo",
                      "Noto Sans KR", "Malgun Gothic", sans-serif;
--ref-typeface-brand: var(--ref-typeface-plain);

/* 화면은 reference를 직접 참조하지 않는다 (「Design tokens · 계층」). 타입페이스도 예외가 아니다. */
--sys-typescale-font-plain: var(--ref-typeface-plain);
```

**Roboto를 불러오지 않는다.** M3 기본 타입페이스지만 한글 글리프가 없어 어차피 폴백으로 넘어간다. 시스템 폰트만 쓰면 네트워크 비용이 0이고 첫 렌더가 즉시다. Apple에서는 SF Pro + Apple SD Gothic Neo, Android/Chrome에서는 Roboto + Noto Sans KR로 붙는다.

굵기는 400(regular)과 500(medium) 둘만 쓴다. 700은 쓰지 않는다 — 시스템 한글 폰트의 700은 기기마다 편차가 크고, 텍스트가 빽빽한 화면에서 과하다.

> Pretendard를 자체 CDN에 올려 쓰는 선택지가 있다. **v1에서는 하지 않는다.** 시스템 폰트로 1019문항을 읽어본 뒤 실제로 불편하면 그때 넣는다.

### 읽기 칼럼

Foundations · Layout의 `--sys-layout-reading-width: 42rem`을 본문에 적용한다. 672px는 16px 한글로 약 42자다.

---

# Components

M3 컴포넌트 라이브러리를 쓰지 않으므로, 이 앱에 실제로 있는 여섯 개만 정의한다. 전부 위에서 정한 토큰으로 조립한다.

## 선택지

이 앱에서 가장 많이 보고 가장 많이 누르는 요소다. M3에 정확히 대응하는 컴포넌트가 없어 list-item과 card 사이에서 직접 정의한다.

### 기본

| 속성 | 값 |
|---|---|
| shape | `corner-medium` |
| 배경 | `surface-container-low` |
| 테두리 | `outline` 1px |
| 글자 | `on-surface` · `body-large` |
| 최소 높이 | **48px** |
| 패딩 | 12px / 16px |
| 간격 | 8px |

**카드 전체가 클릭 영역이다.** 라디오 점만 누르게 하지 않는다.

테두리가 `outline-variant`가 아닌 이유는 「대비 검증」의 § 각주에 있다 — `surface-container-low`는 `surface` 대비 1.05라 **카드 경계가 사실상 이 선 하나에 의존한다.** 선택 여부는 테두리가 아니라 배경이 나른다 (아래 「상태」).

### 선택지 키를 반드시 보여준다

좌측에 **A · B · C · D · E · F**를 표시한다. 선택 사항이 아니다.

원본 해설이 선택지를 문자로 참조한다 — 오답 해설이 `B. 각 부서에 대해 조직 단위(OU)를…` 형식이다. 키가 화면에 없으면 해설을 읽을 때 어느 선택지 얘기인지 매칭할 수 없다.

**선택지 개수는 문항마다 4~6개다** — 4개 896 · 5개 109 · 6개 14문항이고 정답에 `F`가 든 문항이 8개 있다 (`01-requirements.md` 「문제은행」). 키 목록을 화면이 갖고 있지 않고 문항의 `choices`를 그대로 그린다.

### 단일정답 / 복수정답

**123문항이 복수정답**이므로 예외가 아니라 일상이다. 시각적으로 구분한다.

| | 단일정답 | 복수정답 |
|---|---|---|
| 표식 | 원형 | **사각형** |
| ARIA | `role="radio"` | `role="checkbox"` |
| 안내 | 없음 | **"정답 2개를 고르세요"** |
| 제출 버튼 | 1개 선택 시 활성 | **필요 개수를 다 골라야 활성** |

실제 시험도 `Choose TWO`로 알려주므로 숨기는 것은 시험 환경과 다르다.

안내는 **선택지 목록 바로 위**에 `body-medium` · `on-surface-variant`로 둔다. 위치가 강조를 대신하므로 색이나 굵기를 더하지 않는다.

표식은 **네이티브 `input`을 그대로 쓴다** — `radio`가 원형, `checkbox`가 사각이라 모양이 이미 맞고, 키보드 조작과 스크린리더 노출을 직접 구현하지 않아도 된다. 카드는 그 `input`을 감싸는 `label`이다.

### 상태

| 상태 | 표현 |
|---|---|
| hover | `on-surface` 0.08 상태 레이어 · `@media (hover: hover)` |
| focus | `on-surface` 0.12 상태 레이어 + 포커스 링 |
| pressed | `on-surface` 0.12 상태 레이어 |
| **selected** | 배경 `secondary-container` · 글자 `on-secondary-container` · 테두리 `outline` |

`selected`만 상태 레이어가 아니라 색 역할이 바뀐다 (Foundations · Interaction states).

### 키보드

| 키 | 동작 |
|---|---|
| `1`~`6` | 선택지 A~F 토글 (위 「단일정답 / 복수정답」의 선택 규칙을 따른다) |
| `Enter` | 제출 / 다음 |
| `←` `→` | 이전 / 다음 문제 |
| `?` | 단축키 도움말 |

**숫자는 키가 아니라 순서에 붙는다.** `1`이 A인 것은 A가 첫 번째이기 때문이고, 선택지가 6개면 `6`이 F를 고른다. 문항에 없는 번호는 아무 일도 하지 않는다.

`expanded`에서만 키 힌트를 선택지 우측에 `label-medium` · `on-surface-variant`로 표시한다. 터치 기기에는 숨긴다.

## 채점 결과

### 선택지 표시

네 가지 경우가 서로 구분돼야 한다. **배경 채움은 "내가 관여했다", 테두리는 "정답인데 안 골랐다"** 를 뜻한다.

| 경우 | 배경 | 테두리 | 아이콘 | 라벨 |
|---|---|---|---|---|
| 내가 고른 **정답** | `correct-container` | — | `check_circle` (fill) | **정답** |
| 내가 고른 **오답** | `error-container` | — | `cancel` (fill) | **내 선택** |
| 안 고른 **정답** | `surface-container-low` | `correct` 2px | `check_circle` (fill) | **정답** |
| 안 고른 오답 | `surface-container-low` | `outline` | — | — |

마지막 경우는 글자를 `on-surface-variant`로 낮춰 시선에서 물러나게 한다. **테두리로 물러나게 하지 않는다** — 미채점 카드와 같은 이유로 `outline`이다 (「선택지 · 기본」).

앞의 두 경우는 면색이 경계를 대신하므로 테두리를 **투명하게** 둔다. 지우지 않는다 — 폭이 0이 되면 그 두 줄만 옆으로 벌어진다.

**색·아이콘·텍스트가 항상 함께 간다.** 셋 중 하나만으로는 전달하지 않는다 (Foundations · Accessibility).

### 결과 배너

선택지 위에 한 줄.

| | 배경 | 글자 | 아이콘 |
|---|---|---|---|
| 정답 | `correct-container` | `on-correct-container` | `check_circle` |
| 오답 | `error-container` | `on-error-container` | `cancel` |

shape `corner-medium`, 글자 `title-small`. **전환 애니메이션 없이 즉시 나타난다** (Styles · Motion).

## 해설 블록

순서를 고정한다. 임의로 바꾸지 않는다.

```
① 요구사항/조건
② 정답 해설
③ 오답 해설
④ 등장 서비스
```

### ① 요구사항/조건

원본이 문제를 조건 3~5개로 미리 분해해 둔 것이다. **해설보다 먼저 온다** — 해부서 PART 3의 "출제자가 묻는 축 하나만 고른다"와 같은 사고 단계이기 때문이다.

배경 `surface-container` · shape `corner-medium` · 글자 `body-medium` · 불릿 목록.

### ② 정답 해설

좌측 `correct` 4px 보더 · 배경 `surface-container-low` · 글자 `body-large`.

가장 중요한 텍스트이므로 본문과 같은 크기를 쓴다. 해설이라고 작게 만들지 않는다.

### ③ 오답 해설

**아코디언이다. 전부 펼쳐두지 않는다.**

- 헤더에 선택지 키와 첫 문장 앞부분을 보여준다
- **내가 고른 오답만 기본 펼침**
- 나머지는 접어둔다
- 펼침 영역 배경 `surface-container-low` · 글자 `body-medium`
- 전환 `short4` · `easing-standard`

오답 해설 4개가 한꺼번에 펼쳐지면 화면이 두 배로 길어지고 정작 필요한 하나를 못 찾는다.

### ④ 등장 서비스

이 문제에 매칭된 서비스명을 칩으로 나열한다. 누르면 **한줄노트가 인라인으로 펼쳐진다.**

**이것이 이 앱의 핵심 가치다.** 문제를 풀다 "EFS가 뭐였지"에서 흐름이 끊기지 않게 한다. 다른 화면으로 이동시키지 않는 이유가 그것이다.

아래에 관련 해부서 절 링크를 `body-small`로 덧붙인다. 자동 매핑이라 정확하지 않을 수 있으므로 **"관련 있을 수 있는 절"** 로 약하게 제시한다. 단정하지 않는다.

## 하단 액션 바

`compact`에서만 화면 하단에 고정한다. `expanded`에서는 읽기 칼럼 하단, 문서 흐름 안에 둔다.

| 속성 | 값 |
|---|---|
| 배경 | `surface-container` |
| 상단 경계 | `outline-variant` 1px |
| shape | `corner-none` |
| 높이 | 64px + `env(safe-area-inset-bottom)` |
| 주 버튼 | `primary` / `on-primary` · `corner-full` · `label-large` |
| 보조 버튼 | 텍스트 버튼 · `primary` |

**그림자를 쓰지 않는다.** 떠 있다는 신호는 상단 경계선이 담당한다 (Styles · Elevation).

고정하는 이유: 긴 지문을 다 스크롤해야 버튼에 닿는 것은 1019번 반복할 동작으로 부적절하다.

## 칩

카테고리 라벨, 등장 서비스, 필터에 쓴다.

| 속성 | 값 |
|---|---|
| shape | `corner-full` |
| 배경 | `surface-container-high` |
| 글자 | `on-surface-variant` · `label-medium` |
| 시각 높이 | 32px |
| **터치 영역** | **48px** |
| 선택됨 (필터) | `secondary-container` / `on-secondary-container` |

### 시각 높이와 터치 영역이 다르다

M3 칩 높이는 32dp인데 탭 타겟 최소는 48dp다. 충돌하는 게 아니라 **분리하는 것이 정답이다.** 가상 요소로 터치 영역만 48px로 넓힌다.

```css
.chip { min-height: 32px; position: relative; }
.chip::after {
  content: ""; position: absolute; inset: -8px;
}
```

칩을 48px로 키우면 카테고리 라벨이 본문을 밀어낸다.

**카테고리 칩에 색을 쓰지 않는다** (Styles · Color).

## 상태 배너

로딩·오류·"저장 대기 N건"을 한 줄로 알린다. 채점 결과의 「결과 배너」와 **다른 컴포넌트다** — 그쪽은 정오 전용이고 화면당 하나뿐이다.

| 속성 | 값 |
|---|---|
| shape | `corner-medium` |
| 배경 | `surface-container` |
| 글자 | `on-surface-variant` · `body-medium` |
| 아이콘 | `on-surface-variant` · 24px |
| 패딩 | 12px / 16px |
| 최소 높이 | 48px |

| 종류 | 아이콘 | 문구 | 액션 |
|---|---|---|---|
| 로딩 | 없음 | **불러오는 중…** | 없음 |
| 오류 | `error` | **불러오지 못했다** + 무엇을 못 했는지 | **호출부가 정한다** |
| 저장 대기 | `cloud_off` | **저장 대기 N건** | 없음 |

### `correct`·`error` 색을 쓰지 않는다

시스템 상태는 채점 결과가 아니다 (Styles · Color 「색 사용 규칙」). 오류 배너를 빨갛게 칠하면 "빨강 = 오답"이 화면당 두 의미가 되고, 「색으로만 갈리지 않는 쌍」이 *`primary`는 정오를 나르지 않는다*로 잠가 둔 것과 같은 종류의 잠금이 하나 풀린다. 세 종류는 **문구와 아이콘으로 갈린다.**

### 라이브 리전은 배너보다 먼저 있어야 한다

**배너 자신은 라이브 리전이 아니다.** `aria-live`가 붙은 요소는 변경 시점에 이미 DOM에 있어야 낭독되는데, 배너는 상태가 바뀌는 그 순간에 마운트되므로 늦다. 상태를 표시하는 쪽(`QueryBoundary` 등)이 **`aria-live="polite"` 컨테이너를 항상 렌더**하고 세 배너는 그 안에서 교체된다.

`role="alert"`는 삽입 시점에도 동작하지만 그 하나만 다른 경로를 타게 되고, 그러면 어느 배너가 왜 낭독되는지가 코드에서 사라진다. **오류도 같은 컨테이너를 쓴다** — 이 앱의 오류는 사용자의 다른 작업을 끊어야 할 만큼 급하지 않다.

### 오류 문구에 기술 문자열을 넣지 않는다

`Failed to fetch` 같은 예외 메시지를 화면에 옮기지 않는다. 무엇을 못 했는지와 다음에 무엇을 할 수 있는지만 적는다.

**액션을 배너가 스스로 붙이지 않는다.** `docs/02-features.md` 「API 오류의 화면 표현」이 응답마다 다른 것을 요구한다 — 403은 재시도를 유도하지 않고, 404는 목록으로 돌려보낸다. 배너가 「다시 시도」를 기본값으로 갖고 있으면 그 분기가 불가능해진다.

일러스트를 쓰지 않는다 (「결정하지 않은 것」).

---

# 결정하지 않은 것

| | 왜 |
|---|---|
| 로고 · 파비콘 | 개인용에 불필요. 필요해지면 그때 |
| 일러스트 · 빈 상태 그래픽 | 텍스트로 충분 |
| 커스텀 폰트 (Pretendard) | 시스템 폰트로 1019문항을 읽어본 뒤 판단 |

키 컬러는 **결정됐다** — scent-jo 시그니처 주황 `#E68236`에서 재생성한 팔레트를 쓴다 (「팔레트」). 시그니처 그라데이션(`#E68236 → #F7A863`)은 아직 도입하지 않는다. 블로그는 로고타입·GNB 강조 링크·CTA 배너에 쓰는데 이 앱 화면 9개엔 셋 다 없다 — 칠할 표면이 생기면(= 위 표의 로고를 결정하면) 그때 연다.

가장 바뀌기 쉬운 것은 **팔레트**다. 실제 화면을 보고 조정한다. **토큰 아키텍처 · 색 역할 · 타입 스케일 체계는 바꾸지 않는다.**
