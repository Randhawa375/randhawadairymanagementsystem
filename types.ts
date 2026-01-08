
export enum AnimalCategory {
  MILKING = 'Milking',
  CATTLE = 'Cattle', // Treated as male per user instruction
  HEIFER = 'Heifer',
  CALF_MALE = 'Male Calf',
  CALF = 'Female Calf'
}

export enum ReproductiveStatus {
  // Female Statuses
  OPEN = 'Open',
  PREGNANT = 'Pregnant',
  INSEMINATED = 'Inseminated',
  DRY = 'Dry',
  NEWLY_CALVED = 'Newly Calved',
  CHILD = 'Child',
  // Male Statuses
  BREEDING_BULL = 'Breeding Bull',
  OTHER = 'Other'
}

export enum FarmLocation {
  MILKING_FARM = 'Milking Farm',
  HEIFER_FARM = 'Cattle Farm'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  farmName?: string;
  role: 'admin' | 'staff';
}

export interface HistoryEvent {
  id: string;
  type: 'INSEMINATION' | 'PREGNANCY_CHECK' | 'CALVING' | 'MEDICATION' | 'GENERAL';
  date: string;
  details: string;
  remarks?: string;
  medications?: string;
  semen?: string;
  result?: string;
  calfId?: string;
  recordedBy?: string;
}

export interface Animal {
  id: string;
  tagNumber: string;
  category: AnimalCategory;
  status: ReproductiveStatus;
  farm: FarmLocation;
  inseminationDate?: string;
  semenName?: string;
  expectedCalvingDate?: string;
  calvingDate?: string;
  remarks?: string;
  medications?: string;
  lastUpdated: string;
  motherId?: string;
  calvesIds?: string[];
  history: HistoryEvent[];
}
