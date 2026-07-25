// Reference data for synthetic dataset generation. Coordinates are
// approximate district-centroid coordinates (public geography, not sourced
// from any government dataset) — good enough to plot realistic-looking
// points on a Karnataka map for the prototype.

export interface DistrictSeed {
  name: string;
  code: string;
  latitude: number;
  longitude: number;
}

export const DISTRICTS: DistrictSeed[] = [
  { name: 'Bengaluru Urban', code: 'BLR', latitude: 12.9716, longitude: 77.5946 },
  { name: 'Mysuru', code: 'MYS', latitude: 12.2958, longitude: 76.6394 },
  { name: 'Dakshina Kannada', code: 'DKK', latitude: 12.9141, longitude: 74.856 },
  { name: 'Belagavi', code: 'BLG', latitude: 15.8497, longitude: 74.4977 },
  { name: 'Kalaburagi', code: 'KLB', latitude: 17.3297, longitude: 76.8343 },
  { name: 'Ballari', code: 'BLR2', latitude: 15.1394, longitude: 76.9214 },
  { name: 'Dharwad', code: 'DWD', latitude: 15.4589, longitude: 75.0078 },
  { name: 'Shivamogga', code: 'SHV', latitude: 13.9299, longitude: 75.5681 },
  { name: 'Tumakuru', code: 'TMK', latitude: 13.3379, longitude: 77.1173 },
  { name: 'Davanagere', code: 'DVG', latitude: 14.4644, longitude: 75.9218 },
  { name: 'Udupi', code: 'UDP', latitude: 13.3409, longitude: 74.7421 },
  { name: 'Chikkamagaluru', code: 'CKM', latitude: 13.3161, longitude: 75.772 },
  { name: 'Kolar', code: 'KLR', latitude: 13.1362, longitude: 78.1298 },
  { name: 'Mandya', code: 'MDY', latitude: 12.5242, longitude: 76.8958 },
  { name: 'Bidar', code: 'BDR', latitude: 17.9104, longitude: 77.5199 },
];

export const STATION_SUFFIXES = ['Town', 'Rural'];

export interface CrimeCategorySeed {
  name: string;
  // 1 (least severe) – 10 (most severe): a policy weight feeding Milestone
  // 7's risk scoring, not a learned value. Ordering follows conventional
  // offense-severity ranking; open to being tuned by the Bureau, which is
  // exactly why it's a data column rather than hardcoded in application code.
  severityWeight: number;
}

export const CRIME_CATEGORIES: CrimeCategorySeed[] = [
  { name: 'Murder', severityWeight: 10 },
  { name: 'Kidnapping', severityWeight: 9 },
  { name: 'Robbery', severityWeight: 8 },
  { name: 'Assault', severityWeight: 7 },
  { name: 'Narcotics (NDPS)', severityWeight: 7 },
  { name: 'Cyber Crime', severityWeight: 6 },
  { name: 'Burglary', severityWeight: 5 },
  { name: 'Fraud / Cheating', severityWeight: 5 },
  { name: 'Theft', severityWeight: 4 },
  { name: 'Vandalism', severityWeight: 3 },
];

export const VEHICLE_TYPES = ['Two-Wheeler', 'Car', 'Auto Rickshaw', 'Truck', 'Tempo'];

export const WEAPON_TYPES = [
  'Knife',
  'Country-made Pistol',
  'Licensed Firearm',
  'Blunt Object',
  'Sickle',
  'Iron Rod',
];

export const FIRST_NAMES_MALE = [
  'Arjun', 'Vijay', 'Suresh', 'Ramesh', 'Manjunath', 'Prakash', 'Naveen', 'Kiran',
  'Anand', 'Deepak', 'Ravi', 'Santosh', 'Girish', 'Mahesh', 'Nagesh', 'Shankar',
  'Harish', 'Rajesh', 'Sunil', 'Basavaraj',
];

export const FIRST_NAMES_FEMALE = [
  'Priya', 'Lakshmi', 'Kavya', 'Deepa', 'Anitha', 'Sunitha', 'Shweta', 'Pooja',
  'Divya', 'Nandini', 'Radha', 'Geetha', 'Savitha', 'Meena', 'Asha', 'Rekha',
  'Vidya', 'Sowmya', 'Bhavya', 'Manasa',
];

export const LAST_NAMES = [
  'Gowda', 'Reddy', 'Naidu', 'Shetty', 'Rao', 'Kumar', 'Hegde', 'Naik',
  'Patil', 'Iyer', 'Bhat', 'Achar', 'Poojary', 'Kulkarni', 'Desai', 'Urs',
];
