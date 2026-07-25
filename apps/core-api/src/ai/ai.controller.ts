import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { AiService } from './ai.service';
import { QueryAreaLevelDto, QueryTrendDto } from './dto/query-ai.dto';

// AI Intelligence is an Analyst/Admin capability — Milestone 1's role table
// lists "AI predictions" as an explicit SCRB Analyst responsibility,
// alongside network analysis (Milestone 6, same restriction, same reasoning).
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ANALYST)
export class AiController {
  constructor(private aiService: AiService) {}

  @Get('trend-prediction')
  trendPrediction(@Query() query: QueryTrendDto) {
    return this.aiService.trendPrediction(query, query.monthsAhead ? Number(query.monthsAhead) : 3);
  }

  @Get('high-risk-areas')
  highRiskAreas(@Query() query: QueryAreaLevelDto) {
    return this.aiService.highRiskAreas(query.level ?? 'DISTRICT', query.limit ? Number(query.limit) : 10);
  }

  @Get('anomalies')
  anomalies(@Query() query: QueryAreaLevelDto) {
    return this.aiService.anomalies(query.level ?? 'STATION', query.limit ? Number(query.limit) : 15);
  }

  @Get('patterns')
  patterns() {
    return this.aiService.patterns();
  }

  @Get('risk-scores')
  riskScores(@Query('limit') limit?: string, @Query('minCrimes') minCrimes?: string) {
    return this.aiService.personRiskScores(limit ? Number(limit) : 25, minCrimes ? Number(minCrimes) : 2);
  }
}
