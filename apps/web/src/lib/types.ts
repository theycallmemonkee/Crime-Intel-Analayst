export type Role = 'ADMIN' | 'ANALYST' | 'OFFICER';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type InvestigationStatus = 'REPORTED' | 'UNDER_INVESTIGATION' | 'CHARGESHEETED' | 'CLOSED';
export type CrimePersonRole = 'SUSPECT' | 'VICTIM' | 'WITNESS';
export type VehicleInvolvementRole = 'USED_IN_CRIME' | 'GETAWAY' | 'STOLEN';
export type EvidenceType = 'PHOTO' | 'DOCUMENT' | 'DIGITAL' | 'PHYSICAL_OBJECT' | 'OTHER';

export interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  districtId: string | null;
  stationId: string | null;
}

export interface District {
  id: string;
  name: string;
  code: string;
}

export interface PoliceStation {
  id: string;
  name: string;
  code: string;
  districtId: string;
  district?: District;
  latitude: number;
  longitude: number;
}

export interface CrimeCategory {
  id: string;
  name: string;
}

export interface Person {
  id: string;
  fullName: string;
  alias: string | null;
  gender: Gender;
  dateOfBirth: string | null;
  phoneNumber: string | null;
  addressLine: string | null;
  createdAt: string;
}

export interface PersonDetail extends Person {
  crimeLinks: Array<{
    id: string;
    role: CrimePersonRole;
    crime: Crime;
  }>;
  ownedVehicles: Vehicle[];
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  type: string;
  color: string | null;
  ownerPersonId: string | null;
}

export interface VehicleDetail extends Vehicle {
  ownerPerson: Person | null;
  crimeLinks: Array<{ id: string; role: VehicleInvolvementRole; crime: Crime }>;
}

export interface Weapon {
  id: string;
  type: string;
  description: string | null;
  serialNumber: string | null;
}

export interface Fir {
  id: string;
  firNumber: string;
  narrative: string;
  dateFiled: string;
  filedBy: { id: string; username: string; fullName: string };
}

export interface Crime {
  id: string;
  categoryId: string;
  category?: CrimeCategory;
  districtId: string;
  district?: District;
  stationId: string;
  station?: PoliceStation;
  occurredAt: string;
  reportedAt: string;
  status: InvestigationStatus;
  description: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  fir?: Fir;
}

export interface CrimeDetail extends Crime {
  personLinks: Array<{ id: string; role: CrimePersonRole; person: Person }>;
  vehicleLinks: Array<{ id: string; role: VehicleInvolvementRole; vehicle: Vehicle }>;
  weaponLinks: Array<{ id: string; weapon: Weapon }>;
  evidenceItems: Array<{
    id: string;
    type: EvidenceType;
    description: string;
    collectedAt: string;
    collectedBy: { id: string; username: string; fullName: string };
  }>;
}

export interface Paginated<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface DashboardSummary {
  totalCrimes: number;
  activeInvestigations: number;
  closedCases: number;
  chargesheeted: number;
  growth: { currentMonthCount: number; previousMonthCount: number; percentChange: number | null };
}

export interface CategoryCount {
  categoryId: string;
  name: string;
  count: number;
}

export interface DistrictCount {
  districtId: string;
  name: string;
  count: number;
}

export interface StationCount {
  stationId: string;
  name: string;
  count: number;
}

export interface StatusCount {
  status: InvestigationStatus;
  count: number;
}

export interface MonthlyPoint {
  month: string;
  count: number;
}

export interface YearlyPoint {
  year: number;
  count: number;
  growthPct: number | null;
}

export interface GeoCrimePoint {
  id: string;
  latitude: number;
  longitude: number;
  category: string;
  status: InvestigationStatus;
  station: string;
  occurredAt: string;
}

export interface HotspotClusterApi {
  clusterId: number;
  pointCount: number;
  latitude: number;
  longitude: number;
}

export interface RepeatOffender {
  personId: string;
  fullName: string;
  crimeCount: number;
  crimes: Array<{
    id: string;
    firNumber: string | null;
    category: string;
    station: string;
    occurredAt: string;
    status: InvestigationStatus;
  }>;
}

export interface HiddenAssociation {
  person1: { id: string; fullName: string };
  person2: { id: string; fullName: string };
  via: 'ADDRESS' | 'PHONE' | 'VEHICLE';
  sharedValue: string;
}

export interface GangNetwork {
  communityId: number;
  size: number;
  members: Array<{ id: string; fullName: string }>;
  edges: Array<{ source: string; target: string; weight: number }>;
}

export interface EgoGraph {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ source: string; target: string; label: string }>;
}

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TrendPrediction {
  historical: Array<{ month: string; count: number }>;
  predicted: Array<{ month: string; predictedCount: number; lowerBound: number; upperBound: number }>;
  slope: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  method: string;
}

export interface HighRiskArea {
  id: string;
  name: string;
  recentCount: number;
  priorCount: number;
  growthRatePct: number;
  avgSeverity: number;
  riskScore: number;
  band: RiskBand;
}

export interface CrimeAnomaly {
  areaId: string;
  areaName: string;
  month: string;
  actualCount: number;
  expectedCount: number;
  zScore: number;
  direction: 'SPIKE' | 'DROP';
}

export interface PatternData {
  dayLabels: string[];
  periodLabels: string[];
  dayOfWeek: Array<{ category: string; counts: number[] }>;
  timeOfDay: Array<{ category: string; counts: number[] }>;
  summary: Array<{ category: string; peakDay: string; peakPeriod: string }>;
}

export interface PersonRiskScore {
  personId: string;
  fullName: string;
  crimeCount: number;
  avgSeverity: number;
  mostRecentCrime: string;
  riskScore: number;
  band: RiskBand;
}

export interface ReportMeta {
  generatedAt: string;
  generatedBy: string;
}

export interface IntelligenceReport extends ReportMeta {
  summary: DashboardSummary;
  byCategory: CategoryCount[];
  byDistrict: DistrictCount[];
  byStatus: StatusCount[];
  repeatOffenders: RepeatOffender[];
  largestNetworks: Array<{ communityId: number; size: number; members: Array<{ id: string; fullName: string }> }>;
  totalNetworksDetected: number;
  highRiskDistricts: HighRiskArea[];
  recentAnomalies: CrimeAnomaly[];
  trend: TrendPrediction;
}

export interface CrimeTrendReport extends ReportMeta {
  filters: { districtId?: string; categoryId?: string };
  monthly: MonthlyPoint[];
  yearly: YearlyPoint[];
  byCategory: CategoryCount[];
  trend: TrendPrediction;
}

export interface DistrictReport extends ReportMeta {
  district: District;
  summary: DashboardSummary;
  byStation: StationCount[];
  byCategory: CategoryCount[];
  byStatus: StatusCount[];
  monthly: MonthlyPoint[];
  stationRisk: HighRiskArea[];
}

export interface InvestigationReport extends ReportMeta {
  crime: CrimeDetail;
}
