'use client'

import { useId, useState } from 'react'

import { Chip } from '@/shared/ui/chip'
import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'

/**
 * 해설 블록 ④ — **이것이 이 앱의 핵심 가치다.** 문제를 풀다 "EFS가 뭐였지"에서 흐름이
 * 끊기지 않게 한다 (`DESIGN.md` 「해설 블록 · ④ 등장 서비스」). 다른 화면으로 보내지 않고
 * 한줄노트를 그 자리에 펼치는 이유가 그것이다.
 *
 * 한 번에 하나만 펼친다. 여럿이 동시에 열리면 해설 아래가 다시 길어져서 ③에서 아코디언을
 * 쓴 이유가 무너진다.
 *
 * 펼침을 색으로 표시하지 않는다. `secondary-container`는 **선택된 선택지와 선택된 필터
 * 칩에만** 배정돼 있고 (`DESIGN.md` 「Color · 역할 목록」), 이 칩은 필터가 아니라 노트
 * 토글이다. 상태는 마커 회전과 `aria-expanded`가 나른다.
 */
export function ServiceChips({ services }: { services: Array<{ name: string; note: string }> }) {
  const noteId = useId()
  const [openName, setOpenName] = useState<string | null>(null)

  if (services.length === 0) return null

  const openService = services.find((service) => service.name === openName)

  return (
    <section>
      <h3>등장 서비스</h3>
      <ul className="flex flex-wrap gap-2">
        {services.map((service) => (
          <li key={service.name}>
            <Chip
              aria-expanded={service.name === openName}
              aria-controls={noteId}
              onClick={() => setOpenName(service.name === openName ? null : service.name)}
            >
              {service.name}
              <MaterialSymbol
                name="expand_more"
                className={`size-4 ${service.name === openName ? 'rotate-180' : ''}`}
              />
            </Chip>
          </li>
        ))}
      </ul>

      {/* 닫혀 있어도 비워 둔 채로 남긴다 — `aria-controls`가 가리킬 요소가 있어야 한다.
          빈 문단은 패딩이 없어 높이 0이다. */}
      <p
        id={noteId}
        className={
          openService
            ? 'mt-2 rounded-corner-medium bg-surface-container-low px-4 py-3 text-body-medium'
            : ''
        }
      >
        {openService?.note}
      </p>
    </section>
  )
}
