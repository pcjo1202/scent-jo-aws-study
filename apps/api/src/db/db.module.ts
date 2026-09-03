import { Global, Module } from '@nestjs/common'

import { DB, dbProvider } from './db.provider'

// 전역인 이유는 커넥션이 하나이기 때문이다 — 도메인 모듈 넷이 각자 import하면
// 같은 것을 네 번 적게 되고, 빠뜨린 모듈은 부팅이 아니라 첫 쿼리에서 드러난다
@Global()
@Module({
  providers: [dbProvider],
  exports: [DB],
})
export class DbModule {}
