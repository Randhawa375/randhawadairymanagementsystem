
import { addDays, differenceInDays, format, isValid } from 'date-fns';

// Using native Date constructor instead of parseISO to resolve compatibility issues with the date-fns import
export const calculatePregnancyCheckDate = (inseminationDate: string) => {
  const date = new Date(inseminationDate);
  if (!isValid(date)) return null;
  return addDays(date, 45);
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

export const getDaysToPregnancyCheck = (inseminationDate: string) => {
  const checkDate = calculatePregnancyCheckDate(inseminationDate);
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
