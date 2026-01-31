
import { addDays, differenceInDays, format, isValid } from 'date-fns';

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
  return differenceInDays(checkDate, new Date());
};

export const getDaysToCalving = (expectedCalvingDate: string) => {
  const date = new Date(expectedCalvingDate);
  if (!isValid(date)) return null;
  return differenceInDays(date, new Date());
};

export const getDaysSinceCalving = (calvingDate: string) => {
  const date = new Date(calvingDate);
  if (!isValid(date)) return null;
  return differenceInDays(new Date(), date);
};

export const getGestationDays = (inseminationDate: string) => {
  const date = new Date(inseminationDate);
  if (!isValid(date)) return null;
  return differenceInDays(new Date(), date);
};

export const getDaysSinceLastUpdate = (lastUpdated: string) => {
  const date = new Date(lastUpdated);
  if (!isValid(date)) return null;
  return differenceInDays(new Date(), date);
};

export const formatDate = (dateString: string) => {
  if (!dateString) return '--';
  const date = new Date(dateString);
  if (!isValid(date)) return '--';
  return format(date, 'dd/MM/yyyy');
};

export const generateId = () => Math.random().toString(36).substring(2, 9);

import { Animal, ReproductiveStatus } from '../types';

export const getSireInfo = (animal: Animal, allAnimals: Animal[]): string | null => {
  if (!animal) return null;
  const isCalf = animal.category.includes('Calf') || animal.status === ReproductiveStatus.OPEN || animal.status === ReproductiveStatus.CHILD;
  if (!isCalf) return null;

  // 1. Direct check in Child's History (for new records)
  const birthEvent = animal.history?.find(h => h.semen && (h.details.includes('Born to') || h.type === 'GENERAL'));
  if (birthEvent?.semen) return birthEvent.semen;

  // 2. Mother Check (for legacy records)
  if (animal.motherId) {
    const mother = allAnimals.find(a => a.id === animal.motherId);
    if (mother && mother.history) {
      // A. Try identifying distinct Calving Event (Checking both by ID and Tag)
      const birthLog = mother.history.find(h => h.type === 'CALVING' && (h.calfId === animal.id || h.details.includes(animal.tagNumber)));
      if (birthLog) {
        // Regex to find "Semen X used" or "Semen: X" or "Sire: X"
        const match = birthLog.details.match(/(?:Semen|Sire)(?: Name)?[:\s]+(.*?)(?:\s+used|;|\.|$)/i);
        if (match && match[1]) return match[1].trim();
      }

      // B. Fallback: Search Mother's Insemination history based on estimated conception
      // Estimate birth date from child's creation (first history event or lastUpdated if very new)
      const birthDateStr = birthEvent?.date ||
        (animal.history && animal.history.length > 0 ? animal.history[animal.history.length - 1].date : animal.lastUpdated);

      if (birthDateStr) {
        const birthDate = new Date(birthDateStr);
        if (isValid(birthDate)) {
          // Filter history for INSEMINATION events BEFORE birth date
          // Gestation ~283 days. Look for insemination 250-310 days before birth
          const possibleInsems = mother.history.filter(h => h.type === 'INSEMINATION' && new Date(h.date) < birthDate);
          if (possibleInsems.length > 0) {
            // Sort desc (latest first)
            possibleInsems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            for (const insem of possibleInsems) {
              const constceptionDate = new Date(insem.date);
              const daysDiff = differenceInDays(birthDate, constceptionDate);
              // Acceptance window: 240 to 310 days
              if (daysDiff >= 240 && daysDiff <= 310) {
                return insem.semen || (insem.details.match(/Inseminated with (.*)/)?.[1]) || null;
              }
            }
          }
        }
      }
    }
  }
  return null;
};
