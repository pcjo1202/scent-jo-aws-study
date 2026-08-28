/**
 * `pdftotext -layout` 출력에 섞여 나오는 페이지 장식과 열 경계.
 *
 * 원본 세 종(문제은행·PC판 노트·모바일 노트)이 같은 장식을 갖는다. 각 파서가
 * 따로 지우면 한 곳을 고칠 때 나머지가 남는다.
 */

/**
 * pdftotext가 페이지 경계에 끼워 넣는 개행 문자.
 *
 * **다음 페이지 첫 줄 앞에 붙어 나온다.** 지우지 않으면 페이지 첫 줄이 `^…` 패턴에
 * 걸리지 않아, 결손처럼 보이는 그럴듯한 숫자가 나온다 (`LESSONS.md` 2026-08-28).
 */
const PAGE_BREAK = /\f/g
/** 노트 원본(파일 2·3)의 페이지 푸터. 저작권 표시 한 줄이다. */
const NOTE_FOOTER = /^\s*©/

/** 표·2열 레이아웃의 열 경계. 한글이 두 칸을 차지해 문자 위치로는 자를 수 없다. */
export const COLUMN_GAP = / {2,}/

export function stripPageBreaks(rawText: string): string {
  return rawText.replace(PAGE_BREAK, '')
}

/** 노트 원본의 줄 목록. 장식을 걷어내고 뒤쪽 여백만 다듬는다 — 앞 공백은 열 경계다. */
export function cleanNoteLines(rawText: string): string[] {
  return stripPageBreaks(rawText)
    .split('\n')
    .filter((line) => !NOTE_FOOTER.test(line))
    .map((line) => line.trimEnd())
}
