import { Module } from '@nestjs/common'

import { CatalogModule } from '../catalog/catalog.module'
import { AttemptsController } from './attempts.controller'
import { AttemptsRepository } from './attempts.repository'
import { AttemptsService } from './attempts.service'

@Module({
  imports: [CatalogModule],
  controllers: [AttemptsController],
  providers: [AttemptsService, AttemptsRepository],
})
export class AttemptsModule {}
