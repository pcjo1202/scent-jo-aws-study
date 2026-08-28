import base from '../eslint.config.base.mjs'

// scripts는 레이어가 없어 import 정렬을 걸지 않는다 (docs/10 「import 정렬」).
export default [{ ignores: ['node_modules'] }, ...base]
