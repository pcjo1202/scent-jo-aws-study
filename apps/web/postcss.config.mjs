// Tailwind v4는 PostCSS 플러그인 하나로 동작한다. 별도 tailwind.config는 없다 —
// 테마는 src/shared/styles/global.css의 @theme이 소유한다 (docs/10 「스타일 저작」).
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
