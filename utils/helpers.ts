
import { addDays, addMonths, differenceInCalendarDays, differenceInYears, differenceInMonths, differenceInDays, format, isValid } from 'date-fns';

// Using native Date constructor instead of parseISO to resolve compatibility issues with the date-fns import
export const calculatePregnancyCheckDate = (inseminationDate: string, category?: string) => {
  const date = new Date(inseminationDate);
  if (!isValid(date)) return null;
  // If category is Heifer, check is at 40 days. Otherwise (Milking/Cattle), it's 45 days.
  const days = category === 'Heifer' ? 40 : 45;
  return addDays(date, days);
};

export const calculateCalvingDate = (inseminationDate: string) => {
  const date = new Date(inseminationDate);
  if (!isValid(date)) return null;
  return addDays(date, 283);
};

export const calculateReInseminationDate = (calvingDate: string) => {
  const date = new Date(calvingDate);
  if (!isValid(date)) return null;
  return addDays(date, 45);
};

export const getDaysToPregnancyCheck = (inseminationDate: string, category?: string) => {
  const checkDate = calculatePregnancyCheckDate(inseminationDate, category);
  if (!checkDate) return null;
  return differenceInCalendarDays(checkDate, new Date());
};

export const getDaysToCalving = (expectedCalvingDate: string) => {
  const date = new Date(expectedCalvingDate);
  if (!isValid(date)) return null;
  return differenceInCalendarDays(date, new Date());
};

export const getDaysSinceCalving = (calvingDate: string) => {
  const date = new Date(calvingDate);
  if (!isValid(date)) return null;
  return differenceInCalendarDays(new Date(), date);
};

export const getGestationDays = (inseminationDate: string) => {
  const date = new Date(inseminationDate);
  if (!isValid(date)) return null;
  return differenceInCalendarDays(new Date(), date);
};

export const getDaysSinceLastUpdate = (lastUpdated: string) => {
  const date = new Date(lastUpdated);
  if (!isValid(date)) return null;
  return differenceInCalendarDays(new Date(), date);
};

export const formatDate = (dateString: string) => {
  if (!dateString) return '--';
  const date = new Date(dateString);
  if (!isValid(date)) return '--';
  return format(date, 'dd/MM/yyyy');
};

export const calculateAge = (dateOfBirth?: string | null): string => {
  if (!dateOfBirth) return '--';
  const dob = new Date(dateOfBirth);
  if (!isValid(dob)) return '--';
  
  const now = new Date();
  const years = differenceInYears(now, dob);
  const totalMonths = differenceInMonths(now, dob);
  const months = totalMonths % 12;

  if (years > 0) {
    if (months === 0) return `${years}y`;
    return `${years}y ${months}m`;
  }
  
  if (months > 0) {
    const dobPlusMonths = addMonths(dob, totalMonths);
    const days = differenceInDays(now, dobPlusMonths);
    if (days === 0) return `${months}m`;
    return `${months}m ${days}d`;
  }
  
  const days = differenceInDays(now, dob);
  return `${Math.max(0, days)}d`;
};

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

import { Animal, ReproductiveStatus } from '../types';

export const getSireInfo = (animal: Animal, allAnimals: Animal[]): string | null => {
  if (!animal) return null;
  // 1. Database-level permanently saved Sire
  if (animal.sireName && animal.sireName !== 'Unknown') return animal.sireName;

  // 2. Direct check in Child's History logs
  const birthEvent = animal.history?.find(h => (h.details || '').includes('Born to'));
  if (birthEvent && birthEvent.semen && birthEvent.semen !== 'Unknown') return birthEvent.semen;

  // 3. Mother Deep Track (Cross-referencing parent records)
  let mother = animal.motherId ? allAnimals.find(a => a.id === animal.motherId) : undefined;
  
  // If motherId link is broken/missing, attempt to parse the Mother's Tag from the birth history
  if (!mother && birthEvent && birthEvent.details) {
    const tagMatch = birthEvent.details.match(/Tag:\s*([a-zA-Z0-9-]+)/i);
    if (tagMatch && tagMatch[1]) {
      mother = allAnimals.find(a => a.tagNumber.toUpperCase() === tagMatch[1].toUpperCase());
    }
  }

  if (mother && mother.history) {
    // A. Search mother's exact CALVING event corresponding to this child
    const birthLog = mother.history.find(h => h.type === 'CALVING' && (h.calfId === animal.id || h.details.includes(animal.tagNumber)));
    
    if (birthLog) {
      if (birthLog.semen && birthLog.semen !== 'Unknown') return birthLog.semen;
      // Parse details text to extract "Semen ___ used" if not in the proper column
      const match = birthLog.details.match(/Semen\s+([a-zA-Z0-9-\s]+)\s+used/i) || birthLog.details.match(/(?:Semen|Sire)(?: Name)?[:\s]+(.*?)(?:\s+used|;|\.|$)/i);
      if (match && match[1] && match[1] !== 'Unknown') return match[1].trim();
    }

    // B. Fallback: Search Mother's Insemination history based on gestation timeline
    const birthDateStr = birthEvent?.date || (animal.history && animal.history.length > 0 ? animal.history[animal.history.length - 1].date : animal.lastUpdated);

    if (birthDateStr) {
      const birthDate = new Date(birthDateStr);
      if (isValid(birthDate)) {
        // Gestation ~283 days. Look for insemination 240-310 days before birth
        const possibleInsems = mother.history.filter(h => h.type === 'INSEMINATION' && new Date(h.date) < birthDate);
        if (possibleInsems.length > 0) {
          possibleInsems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          for (const insem of possibleInsems) {
            const conceptionDate = new Date(insem.date);
            const daysDiff = differenceInCalendarDays(birthDate, conceptionDate);
            if (daysDiff >= 240 && daysDiff <= 310) {
              const sem = insem.semen || (insem.details.match(/Inseminated with (.*)/)?.[1]);
              if (sem && sem !== 'Unknown') return sem.trim();
            }
          }
        }
      }
    }
  }
  return null;
};
