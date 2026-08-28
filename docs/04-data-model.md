# 04. 데이터 모델 (정적 데이터)

CDN에 올라가는 불변 데이터의 스키마다. 가변 데이터(진도·시도)는 `05-database.md`를 본다.

## manifest.json

모든 데이터 접근의 진입점. 여기만 짧은 캐시(`max-age=300`)를 갖는다.

```ts
type Manifest = {
  version: string          // "v1"
  generatedAt: string      // ISO 8601
  base: string             // "https://static-cdn.scent-jo.dev/aws-saa/v1"
  questions: {
    total: number          // 1019
    chunkSize: number      // 100
    chunks: number         // 11
  }
  files: Record<string, { bytes: number; sha256: string }>
}
```

클라이언트는 manifest를 먼저 읽고 `base`를 기준으로 나머지를 받는다. 버전을 올릴 때 `version`과 `base`만 바뀐다.

**클라이언트는 앱 진입 시 manifest를 한 번 읽고 그 페이지 세션 동안 `version`·`base`를 고정한다.** 주기적으로 다시 조회하지 않으며, 새 버전은 새로고침·재진입에서 반영된다 (2026-08-28 결정, SJO-30).

index와 chunk는 같은 버전 안에서만 정합하다 — 문항 id ↔ 청크 매핑도, 정답도. 세션 도중 `base`가 바뀌면 이미 받아 둔 index와 새로 받은 chunk가 어긋나고, 풀던 문항이 사라지는 경로까지 설계해야 한다. 데이터 버전은 몇 달에 한 번 바뀐다. `max-age=300`은 "새로고침하면 5분 안에 새 버전을 본다"를 보장하는 값이지 폴링 주기가 아니다.

**서버(`catalog`)는 반대로 5분마다 manifest를 확인한다** (`05-database.md`). 비대칭이 의도된 것이다 — 서버는 낡은 정답으로 채점하면 안 되고, 클라이언트는 세션 중간에 데이터가 갈리면 안 된다.

`sha256`은 `data:verify`가 배포 후 무결성을 확인하는 데 쓴다.

## 문제

### Question

```ts
type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

type Question = {
  id: number                    // 1..1019
  stem: string                  // 지문
  choices: Array<{ key: ChoiceKey; text: string }>
  answer: ChoiceKey[]           // 1~3개
  requirements: string[]        // 원본의 "요구사항/조건" 불릿
  explanation: string           // 정답 해설
  rebuttals: Array<{ key: ChoiceKey; text: string }>   // 선택지별 오답 해설
  categories: string[]          // 파생. 1~3개
  services: string[]            // 파생. 매칭된 서비스명
}
```

**`requirements`를 보존하는 이유**: 원본이 각 문항을 조건 3~5개로 미리 분해해 뒀다. 해부서 PART 3의 "출제자가 묻는 축 하나만 고른다"와 같은 사고 단계다. v1에서 별도 기능으로 쓰지는 않지만, 채점 화면에서 해설보다 먼저 보여주고, 버리면 다시 만들 수 없다.

**`rebuttals`가 `choices`보다 짧을 수 있다**: 원본이 정답 선택지에 대한 오답 해설을 두지 않기 때문이다. 정답 개수만큼 항목이 비는 것이 정상이다.

### 파서가 원본에서 복원할 수 없는 것

세 가지는 원본 PDF에 정보가 남아 있지 않다. 추정하거나 계약으로 못박는다 — 조용히 틀리게 두지 않는다.

| | 실제 | 근거 |
|---|---|---|
| **줄 이음매의 공백** | 코퍼스 빈도로 추정. 정확도 **95.5%**, 단어를 쪼개는 오류 **0건** | PDF 텍스트 레이어에 공백 문자가 없다 — `pdftotext`가 글자 간격을 보고 만든다. 줄 끝에는 간격이 없어 복원 불가. 같은 어절 조합이 다른 줄 **안쪽**에 온전히 나타나는 것을 근거로 삼는다 |
| **`requirements`의 항목 경계** | **인쇄된 줄 하나 = 항목 하나.** 접힌 불릿은 두 항목이 된다 (1019 중 7문항) | 글머리 기호가 없고 접힌 줄의 들여쓰기가 앞줄과 같다. 줄 폭은 문항마다 본문 상자가 달라(107~115칸) 임계값이 서지 않고, 불릿이 "집계"·"보유"·"것" 같은 명사형으로 끝나 종결형으로도 못 가른다 |
| **코드 블록의 줄 구조** | `stem`·`choices`에 `\n`이 들어올 수 있다 | IAM 정책 JSON이 든 문항이 7개다. 한 줄로 접으면 읽을 수 없다. `{`·`}`·`[`·`]`·`"`로 시작하는 줄은 줄바꿈을 유지하고 상대 들여쓰기만 남긴다 |

첫 번째의 정확도는 **라벨 1638건**으로 측정했다. 오답 해설이 각 선택지 원문을 **다른 폭으로 다시 렌더링**하므로, 두 렌더링의 줄바꿈 위치가 달라 서로의 정답지가 된다.

### chunk-NNN.json

```ts
type Chunk = {
  chunk: number          // 1..11
  from: number           // 첫 문항 id
  to: number             // 마지막 문항 id
  questions: Question[]
}
```

100문항 단위, 파일당 약 180KB. 마지막 청크(011)만 19문항이다.

### index.json

```ts
type IndexEntry = {
  id: number
  chunk: number          // 이 문항이 든 청크 번호
  categories: string[]
  services: string[]
  answer: ChoiceKey[]    // 채점용
  choiceCount: number    // 4~6. 범위 밖 선택지 키 제출을 서버가 거르는 데 쓴다
}

type QuestionIndex = { entries: IndexEntry[] }
```

1019개, 약 66KB. **필터·목록 렌더링을 전부 이 파일만으로 처리한다.** 모의고사 추첨은 서버 `catalog`가 한다 (`05-database.md`). 실제로 문제를 풀 때만 해당 청크를 받는다.

`chunk`를 인덱스에 넣어 두면 문항 id에서 청크 번호를 계산하지 않아도 되고, 나중에 청크 크기를 바꿔도 클라이언트 코드가 안 깨진다.

`answer`를 인덱스에 넣는 이유는 **NestJS가 이 파일만 캐시하면 서버에서 채점할 수 있기 때문**이다. 클라이언트가 보낸 정오 판정을 믿지 않아도 되고, 통계가 신뢰할 수 있는 값이 된다 (`05-database.md`의 `catalog` 모듈). 단, 정답은 인덱스·청크를 통해 **클라이언트에도 내려간다** — 서버 채점의 목적은 부정행위 방지가 아니라 통계 무결성이며, 시험 중 "정오 미표시"는 UI 차원의 규칙이다. 이 위에 시험 무결성 기능을 쌓지 않는다.

`choiceCount`를 넣는 이유는 **존재하지 않는 선택지 키가 조용히 오답으로 기록되는 경로를 막기 위해서**다. 선택지가 4개인 문항에 `'E'`가 제출되면 `grade()`는 그냥 `false`를 돌려주고, 기록에는 "틀린 답 1건"이 남는다. 화면은 멀쩡하고 통계만 오염된다 — `08-testing.md`가 테스트 대상을 고르는 기준으로 삼은 바로 그 형태다. 정수 1019개(약 6KB)를 더해 이 경로를 400으로 만든다 (2026-08-28 결정, SJO-30).

정답을 인덱스에 노출하는 것이 모의고사의 정답 은닉을 깨지는 않는다. 어차피 청크 파일에 해설과 함께 들어 있어 클라이언트는 이미 알 수 있다. 개인 학습용이므로 은닉은 UI 수준의 배려일 뿐이다.

## 노트

### oneliners.json

```ts
type OneLiner = {
  service: string        // "Amazon EC2"
  category: string       // "컴퓨트"
  note: string           // 한줄 설명
}

type OneLiners = { items: OneLiner[] }   // 203개
```

카테고리 분포: 네트워크 35 · 보안 34 · 스토리지 33 · 데이터베이스 24 · 컴퓨트 22 · 메시징 14 · 모니터링 11 · 분석 9 · 운영 8 · AI/ML 7 · 마이그레이션 6

`service`는 유일하지 않다. 고유 서비스명은 **202개**이고, 한 서비스가 카테고리를 달리해 두 번 실린다.

### comparisons.json

```ts
type ComparisonMember = {
  name: string           // "ECS (Elastic Container Service)"
  selectSignals: string  // 선택 신호
  rejectSignals: string  // 탈락 신호
  keyDifference: string  // ★ 결정적 차이
}

type Comparison = {
  title: string          // "ECS vs EKS". 48개 중 유일해 식별자로 쓴다
  importance: 1 | 2 | 3  // 원본 ★ 개수
  members: ComparisonMember[]
}

type Comparisons = { items: Comparison[] }   // 48쌍 · 구성원 145명
```

**`id`를 두지 않는다** (2026-08-28 결정, SJO-5). 48개 제목 중 상당수가 한글이라 ASCII 슬러그는 원본에 없는 값을 지어내는 일이 되고, `/notes`는 목록 한 화면이라 라우트 식별자가 필요 없다 (`02` 「비교노트」). `title`이 48개 중 유일하다.

**`importance`는 PC판(파일 2)에서 온다.** 모바일 판본에는 제목 뒤 `[★…]` 표기가 없다 — 모바일의 ★는 전부 「★ 결정적 차이」 라벨이다. 분포는 ★3 36 · ★2 10 · ★1 2.

## 해부서

**v1은 구조화하지 않는다.** 원본 61페이지를 이미지 자산(`anatomy/pages/001..061.webp`)으로 올리고, 수동 목차 하나만 만든다 (2026-08-26 리뷰 D8 — 판독 20~40시간의 학습 ROI 없음, 이미지화는 반나절).

```ts
type AnatomyToc = { entries: Array<{ id: string; title: string; page: number }> }  // 21항목 수동 작성, anatomy/toc.json
```

아래 구조화 스키마는 **시험 후 과제**로 보존한다. 재개 시 유일한 재현 불가 산출물이 된다.

### part1-patterns.json

```ts
type Pattern = {
  id: string             // "1-1"
  title: string          // "비용 최적화 문제"
  firstSignals: string[]     // "가장 먼저 판단해야 할 신호"
  eliminations: Array<{      // "무조건 배제해야 하는 선택들"
    rule: string             // "비용 최소화가 보이면, 고급 옵션은 오답일 가능성이 높습니다"
    why: string              // "왜 바로 탈락하는가"
    examples: Array<{ subject: string; reason: string }>
    verdict: string          // "👉 ..." 로 강조된 결론 한 줄
  }>
}

type Part1 = { patterns: Pattern[] }   // 6개
```

### part2-services.json

```ts
type ServiceGuide = {
  id: string             // "2-5"
  title: string          // "Lambda"
  subtitle: string       // "'서버 없이' 이벤트/짧은 작업을 실행하는 컴퓨팅 트리거"
  correctSignals: string[]
  rejectSignals: string[]
  examContexts: string[]     // "시험에서 자주 사용하는 맥락"
  relatedCategories: string[]   // 문항 연결용. 판독 시 수동 지정
}

type Part2 = { guides: ServiceGuide[] }   // 21개
```

`relatedCategories`를 수동으로 넣는 이유: 문항 자동 태깅과 달리 해부서 절은 21개뿐이라 손으로 지정하는 편이 정확하고 빠르다.

### part3-method.json

```ts
type MethodSection = {
  id: string             // "3-1"
  title: string          // "문제를 읽자마자 할 일 3가지"
  blocks: Array<{
    heading: string
    items: string[]      // 중첩 불릿은 "  " 들여쓰기로 평탄화
  }>
}

type Part3 = { sections: MethodSection[] }
```

PART 3은 서술 위주라 구조를 얕게 잡는다. 과도한 구조화는 판독 비용만 늘린다.

## 자동 태깅

문제은행에는 주제 태그가 없다. 노트의 고유 서비스명 202개를 사전으로 삼아 파생시킨다.

### 절차

1. **지문 + 정답 선택지 텍스트**만 스캔한다
   오답 선택지를 포함하면 "Redshift가 오답으로 등장하는 Athena 문제"가 분석 카테고리로 잘못 분류된다
2. 서비스명을 매칭한다. 표기 흔들림을 흡수하는 별칭을 노트의 이름에서 파생시킨다
   벤더 접두사(`Amazon EC2` → `EC2`) · 괄호(`Amazon ECR (Elastic Container Registry)` → `ECR`, `Elastic Container Registry`) · 옛 이름(`(기존 Kinesis Data Firehose)`) · 구분자(`Route 53 - Latency Routing`, `IAM User / IAM Group`)
   **최장일치**로 고른다. `EC2`가 `EC2 Spot Instance`를 먼저 먹으면 안 된다
3. 매칭된 서비스를 카테고리로 롤업한다. **롤업 표를 따로 두지 않는다** — 카테고리는 `oneliners.json`에서 그대로 읽는다
4. 문항당 카테고리 상위 1~3개를 남기되, **최상위 점수의 절반 미만은 버린다**
   점수는 그 카테고리의 서비스가 몇 번 언급됐는지다. 이 컷이 없으면 컴퓨트가 1019문항의 절반을 먹는다 — SAA 지문은 대부분 EC2 위에 시나리오를 세우고, 그 배경 언급이 주제 태그로 올라온다 (2026-08-28 결정, SJO-6)

### 노트가 빠뜨린 이름

노트는 S3·IAM·FSx 같은 서비스를 **기능 단위로만** 싣는다 (`S3 Standard`는 있고 `Amazon S3`는 없다). 지문은 맨 이름을 훨씬 자주 쓰므로, 그대로 두면 `Amazon S3`를 말하는 289문항이 통째로 미태깅이 된다.

루트 이름 8개(`S3`·`IAM`·`FSx`·`Kinesis`·`ElastiCache`·`Storage Gateway`·`Snowball`·`Shield`)를 보완하되 **카테고리는 적지 않는다.** 그 루트로 시작하는 노트 항목의 다수결로 끌어온다 — `S3 Bucket Policy` 하나가 보안이어도 나머지 17개가 스토리지라 루트는 스토리지가 된다.

한글 표기(`보안 그룹`·`NAT 게이트웨이` 등 7개)도 같은 방식으로 노트의 서비스를 가리키게만 한다. 가리키는 서비스가 노트에 없으면 던진다.

### 오분류 대응

자동 태깅은 반드시 일부 틀린다. 두 가지 방어를 둔다.

- **`services`를 인덱스에 원본 그대로 남긴다.** 카테고리가 틀려도 서비스명으로는 찾을 수 있다
- **분포를 검증한다.** `data:extract`가 카테고리 분포와 미태깅 문항 수를 출력하고, **한 카테고리가 전체 문항의 50%를 넘으면 산출을 막는다** (2026-08-28 결정, SJO-6)

50%는 조잡한 붕괴만 잡는 상한이다. 카테고리는 문항당 1~3개라 점유율의 합이 200~300%가 되고, 11종의 평균 점유율은 20~27%다. 서비스가 많은 카테고리(네트워크 35 · 보안 34)는 사전이 멀쩡해도 30%대에 이를 수 있어, 그보다 낮은 임계값은 정상 데이터에서 배포를 막는다. 반대로 별칭 사전이나 롤업이 무너지면 한 카테고리가 대부분의 문항을 삼키므로 50%로도 잡힌다. **정상 범위 안의 편중은 기계가 판정하지 않는다** — 분포 출력 전문을 사람이 읽는다.

## 추출 파이프라인

```
pnpm data:extract    SOURCE_PDF_DIR → data/   (둘 다 로컬, gitignored)
pnpm data:verify     스키마·개수·분포 검증
pnpm data:publish    manifest 생성 → S3 업로드
pnpm data:pull       CDN → data/ + tests/fixtures/   (새 기기 복구)
```

**anatomy는 optional 자산이다.** 자산화(E2)가 미완이면 `data:publish`가 anatomy를 제외하고 올리고, `data:verify`도 문제·노트만으로 통과한다. anatomy가 완성되면 다음 버전(v2 등)에 포함해 올린다. `/anatomy` 화면(E7)은 anatomy가 포함된 데이터 버전부터 동작한다 — v1 배포와 E5~E8은 판독 완료를 기다리지 않는다.

### data:extract

**입력은 `scripts/.env`의 `SOURCE_PDF_DIR`이 가리키는 디렉터리다.** 없으면 즉시 실패한다 (2026-08-28 결정, SJO-4).

원본 PDF는 저작권 자료라 레포에 두지 않고 기기마다 로컬 경로가 다르다 (`MEMORY.md` 「데이터」). 레포 안에 사본을 만들면 저작권 자료가 하나 더 생기고 원본과 갈라진다. 레포 내 고정 경로를 폴백으로 두지도 않는다 — 아무도 쓰지 않는 경로가 하나 늘 뿐이다.

디렉터리 안에서 파일을 고르는 기준은 `01-requirements.md` 「자료 구성」의 **번호 접두사**다 (`4.`·`5.` = 문제은행, `3.` = 모바일 노트). 그 번호가 자료를 지칭하는 정본이다.

| 대상 | 방법 |
|---|---|
| 문제 1019 | `pdftotext -layout` → `Q. NNN` 블록 분할 → 절 파싱 → `data/questions.json` |
| 노트 203 + 48 | 모바일 PDF(파일 3)를 파싱하고 PC판(파일 2)과 합친다. 두 판본이 줄을 접는 자리가 달라 이음매 공백을 복원할 수 있고, 읽어 낸 글자가 다르면 그 자리에서 실패한다. ★ 중요도는 파일 2에만 있다 |
| 해부서 | **스크립트 아님.** 페이지를 이미지로 렌더링해 수동 판독 |

### data:verify

파싱은 반드시 어딘가 깨진다. 1019개를 눈으로 볼 수 없으므로 기계가 잡는다.

- 문항 id가 1~1019 연속이고 누락·중복이 없는가
- 모든 문항에 선택지가 4개 이상 있는가
- 모든 문항에 정답이 1개 이상 있고, 정답 키가 존재하는 선택지를 가리키는가
- `answer` 길이가 1~3인가
- `explanation`이 비어 있지 않은가
- `rebuttals`의 키가 선택지에 존재하고 정답 키와 겹치지 않는가
- 카테고리 분포가 한쪽으로 쏠리지 않았는가 (출력해서 눈으로 확인)
- 태깅되지 않은 문항이 몇 개인가 (0이어야 정상은 아님. 비율을 본다)
- 노트 203개, 비교 48쌍이 다 나왔는가

검증 실패는 배포를 막는다.

**내용 정확도 검증** — 구조 검증은 오독을 못 잡는다. 카테고리 층화 표본 **50문항**을 독립 에이전트(또는 사람)가 원본 PDF와 대조한다. 허용 오류 **0건** — 발견 시 파서를 고치고 표본을 다시 뽑는다. 대조 결과는 해당 이슈 코멘트에 기록한다.

### data:publish

1. `data/`에서 청크·인덱스·노트·해부서와 테스트 픽스처(`tests/fixtures/`)를 읽는다
2. 각 파일의 sha256을 계산해 manifest를 만든다
3. `s3://<bucket>/aws-saa/<version>/` 에 업로드한다
   - `v*/**` → `Cache-Control: public, max-age=31536000, immutable`
   - `manifest.json` → `Cache-Control: public, max-age=300`
   - `v*/fixtures/` → 파서 골든 픽스처. `data:pull`이 데이터와 함께 복원한다
4. manifest는 **마지막에** 올린다. 데이터가 다 올라간 뒤에 가리켜야 한다
5. 기존 버전은 삭제하지 않는다

버전을 올릴 때는 `--version v2` 를 준다. 같은 버전에 다시 올리는 것은 기본적으로 거부하고 `--force`를 요구한다.

## 해부서 자산화 진행 방식

v1: `pdftoppm`으로 61장 렌더링 → webp 변환 → `toc.json` 21항목 수동 작성 → publish. 반나절 작업이다.

구조화 판독을 시험 후 재개할 때는 PART 1을 먼저 만들어 구조를 확인받고 PART 2·3을 채운다. 전부 읽은 뒤에 "구조가 다르다"가 나오면 손실이 크다.
