/**
 * 해설 블록 ① — 원본이 문제를 조건 3~5개로 미리 분해해 둔 것이다. **해설보다 먼저 온다**
 * (`DESIGN.md` 「해설 블록」). 해부서 PART 3의 "출제자가 묻는 축 하나만 고른다"와 같은
 * 사고 단계이기 때문이다.
 */
export function RequirementList({ requirements }: { requirements: string[] }) {
  if (requirements.length === 0) return null

  return (
    <section className="rounded-corner-medium bg-surface-container px-4 py-3 text-body-medium">
      <h3>요구사항</h3>
      <ul className="list-disc pl-6">
        {requirements.map((requirement) => (
          <li key={requirement}>{requirement}</li>
        ))}
      </ul>
    </section>
  )
}
