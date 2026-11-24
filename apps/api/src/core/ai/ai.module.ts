import { Module } from '@nestjs/common';
import { AiEngine } from './ai.engine';
import { RagService } from './rag.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiEngineController } from './ai-engine.controller';
import { HashEmbeddings, MemoryVectorStore } from './memory-vector.store';
import { EvalService } from './eval.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [PermissionsModule, ProvidersModule],
  controllers: [AiController, AiEngineController],
  providers: [
    AiEngine,
    AiService,
    HashEmbeddings,
    MemoryVectorStore,
    {
      provide: RagService,
      useFactory: (embed: HashEmbeddings, store: MemoryVectorStore) => new RagService(embed, store),
      inject: [HashEmbeddings, MemoryVectorStore],
    },
    EvalService,
  ],
  exports: [AiEngine, RagService, AiService, EvalService, MemoryVectorStore],
})
export class AiModule {}
