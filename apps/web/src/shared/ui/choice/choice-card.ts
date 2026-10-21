/**
 * 선택지 카드의 상자. 미채점·채점 후 카드가 같은 상자를 써야 채점 순간에 목록의 리듬이 안
 * 흔들린다 (`DESIGN.md` 「채점 결과 · 선택지 표시」 — 카드의 상자는 같다).
 *
 * `'use client'` 파일에 두지 않는다. 그 파일의 export는 서버 그래프에서 값이 아니라 클라이언트
 * 참조가 된다.
 */
export const CHOICE_CARD_CLASS = 'flex items-start gap-3 rounded-3 px-4 py-3 text-t5'
