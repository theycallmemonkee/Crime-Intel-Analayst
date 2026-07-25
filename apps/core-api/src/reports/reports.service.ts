import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardsService } from '../dashboards/dashboards.service';
import { NetworkService } from '../network/network.service';
import { AiService } from '../ai/ai.service';
import { CrimesService } from '../crimes/crimes.service';
import { assertCanReadDistrict, districtScopeFilter, RequestUser } from '../common/jurisdiction.util';

interface AiFilters {
  districtId?: string;
  stationId?: string;
  categoryId?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private dashboards: DashboardsService,
    private network: NetworkService,
    private ai: AiService,
    private crimes: CrimesService,
  ) {}

  // AiService/NetworkService methods take plain filters, not a `user` — they
  // self-scope nowhere, because their *controllers* are Admin/Analyst-only
  // (Milestones 6/7) so an Officer never reaches them directly. Reports calls
  // them as a library, bypassing that controller gate, so this report has to
  // enforce district scoping itself wherever it touches AiService with an
  // Officer's request — this helper is that enforcement, in one place.
  private effectiveAiFilters(user: RequestUser, requested: AiFilters): AiFilters {
    const scope = districtScopeFilter(user);
    return {
      districtId: scope?.districtId ?? requested.districtId,
      stationId: requested.stationId,
      categoryId: requested.categoryId,
    };
  }

  // --- Intelligence Report (Admin/Analyst only — enforced at the controller,
  // since it embeds Network/AI findings that are Analyst-specialty data per
  // the Milestone 1 role table) ---------------------------------------------
  async intelligenceReport(user: RequestUser) {
    const [summary, byCategory, byDistrict, byStatus, repeatOffenders, gangs, highRiskDistricts, anomalies, trend] =
      await Promise.all([
        this.dashboards.summary(user, {}),
        this.dashboards.byCategory(user, {}),
        this.dashboards.byDistrict(user, {}),
        this.dashboards.byStatus(user, {}),
        this.network.repeatOffenders(3, 10),
        this.network.gangs(3),
        this.ai.highRiskAreas('DISTRICT', 5),
        this.ai.anomalies('STATION', 5),
        this.ai.trendPrediction({}, 3),
      ]);

    return {
      generatedAt: new Date(),
      generatedBy: user.username,
      summary,
      byCategory: byCategory.slice(0, 5),
      byDistrict: byDistrict.slice(0, 5),
      byStatus,
      repeatOffenders,
      largestNetworks: gangs.slice(0, 5).map((g) => ({ communityId: g.communityId, size: g.size, members: g.members.slice(0, 8) })),
      totalNetworksDetected: gangs.length,
      highRiskDistricts,
      recentAnomalies: anomalies,
      trend,
    };
  }

  // --- Crime Trend Report ----------------------------------------------------
  async crimeTrendReport(user: RequestUser, filters: { districtId?: string; categoryId?: string }) {
    const now = new Date();
    const [monthly, yearly, byCategory, trend] = await Promise.all([
      this.dashboards.monthlyTrend(user, filters, now.getFullYear()),
      this.dashboards.yearlyTrend(user, filters),
      this.dashboards.byCategory(user, filters),
      this.ai.trendPrediction(this.effectiveAiFilters(user, filters), 3),
    ]);

    return { generatedAt: new Date(), generatedBy: user.username, filters, monthly, yearly, byCategory, trend };
  }

  // --- District Report ---------------------------------------------------
  async districtReport(user: RequestUser, districtId: string) {
    assertCanReadDistrict(user, districtId);
    const district = await this.prisma.district.findUnique({ where: { id: districtId } });
    if (!district) throw new NotFoundException('District not found');

    const query = { districtId };
    const [summary, byStation, byCategory, byStatus, monthly] = await Promise.all([
      this.dashboards.summary(user, query),
      this.dashboards.byStation(user, query),
      this.dashboards.byCategory(user, query),
      this.dashboards.byStatus(user, query),
      this.dashboards.monthlyTrend(user, query, new Date().getFullYear()),
    ]);

    // Station-level AI risk scoped down to just this district's stations —
    // assertCanReadDistrict above already confirmed this user may see this
    // district, so surfacing this district's own station risk ranking here
    // (even for an Officer, who can't reach the full AI Intelligence page)
    // is a deliberate, scoped exposure, not a gap.
    const stationIds = new Set(byStation.map((s) => s.stationId));
    const allStationRisk = await this.ai.highRiskAreas('STATION', 200);
    const stationRisk = allStationRisk.filter((r) => stationIds.has(r.id)).slice(0, 10);

    return { generatedAt: new Date(), generatedBy: user.username, district, summary, byStation, byCategory, byStatus, monthly, stationRisk };
  }

  // --- Investigation (case file) Report -------------------------------------
  async investigationReport(user: RequestUser, crimeId: string) {
    // Reuses CrimesService's own jurisdiction check (404s outside scope) —
    // a report is just a formatted export of data the requester can already see.
    const crime = await this.crimes.findOne(user, crimeId);
    return { generatedAt: new Date(), generatedBy: user.username, crime };
  }
}
