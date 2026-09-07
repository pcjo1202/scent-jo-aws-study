import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AppController } from './app.controller'
import { AttemptsModule } from './attempts/attempts.module'
import { AuthModule } from './auth/auth.module'
import { CatalogModule } from './catalog/catalog.module'
import { DbModule } from './db/db.module'
import { validateEnv } from './env'
import { ProgressModule } from './progress/progress.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DbModule,
    AuthModule,
    CatalogModule,
    AttemptsModule,
    ProgressModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
