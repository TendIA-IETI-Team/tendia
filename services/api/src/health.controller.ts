import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { config } from './config';
import { Public } from './common/auth';
import { PrismaService } from './prisma.service';
import { ScoringClient } from './scoring/scoring.client';

@ApiTags('salud')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringClient,
  ) {}

  @Get()
  async health() {
    const [db, scoring] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.scoring.health(),
    ]);
    const body = {
      status: db && scoring ? 'ok' : 'degradado',
      db,
      scoring,
      release: config().RELEASE,
    };
    if (!db) throw new ServiceUnavailableException(body);
    return body;
  }
}

@Module({ controllers: [HealthController], providers: [ScoringClient] })
export class HealthModule {}
