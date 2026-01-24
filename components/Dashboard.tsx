
import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  ShieldCheck,
  Timer,
  Users,
  Baby,
  Search,
  History,
  X,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Save,
  Wind,
  Beef,
  Milk,
  Sparkles,
  ChevronRight,
  Calendar,
  Clipboard,
  Bell,
  ArrowRight,
  Edit2
} from 'lucide-react';
import { Animal, ReproductiveStatus, AnimalCategory, FarmLocation, HistoryEvent } from '../types';
import AnimalFormModal from './AnimalFormModal';
import * as helpers from '../utils/helpers';

interface DashboardProps {
  animals: Animal[];
  allAnimals: Animal[];
  farmName: string;
  activeFarm: FarmLocation | 'all';
  onNavigateToReport: (status: ReproductiveStatus) => void;
  onAlertClick: (status: ReproductiveStatus) => void;
  onUpdateAnimal: (animal: Animal) => void;
  onUpdateBatch: (animals: Animal[]) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  animals,
  allAnimals,
  farmName,
  activeFarm,
  onNavigateToReport,
  onAlertClick,
  onUpdateAnimal,
  onUpdateBatch,
  searchQuery,
  setSearchQuery
}) => {
  const [viewHistoryAnimal, setViewHistoryAnimal] = useState<Animal | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Animal | undefined>(undefined);
  const profileRef = useRef<HTMLDivElement>(null);

  const [pendingCheckAnimal, setPendingCheckAnimal] = useState<Animal | null>(null);
  const [pendingCalvingAnimal, setPendingCalvingAnimal] = useState<Animal | null>(null);
  const [pendingDryAnimal, setPendingDryAnimal] = useState<Animal | null>(null);

  const [calvingDate, setCalvingDate] = useState(new Date().toISOString().split('T')[0]);
  const [calvingDescription, setCalvingDescription] = useState('');
  const [calfGender, setCalfGender] = useState<'male' | 'female'>('female');
  const [calfTag, setCalfTag] = useState('');

  const isFemaleBreeder = (a: Animal) =>
    a.category !== AnimalCategory.CALF_MALE &&
    a.category !== AnimalCategory.CATTLE;

  const total = animals.length;
  const newlyCalvedCount = animals.filter(a => a.status === ReproductiveStatus.NEWLY_CALVED && isFemaleBreeder(a)).length;
  const pregnantCount = animals.filter(a => a.status === ReproductiveStatus.PREGNANT && isFemaleBreeder(a)).length;
  const inseminatedCount = animals.filter(a => a.status === ReproductiveStatus.INSEMINATED && isFemaleBreeder(a)).length;
  const dryCount = animals.filter(a => a.status === ReproductiveStatus.DRY && isFemaleBreeder(a)).length;
  const openCount = animals.filter(a => a.status === ReproductiveStatus.OPEN && isFemaleBreeder(a)).length;
  const childStatusCount = animals.filter(a => a.status === ReproductiveStatus.CHILD && isFemaleBreeder(a)).length;

  const totalHeiferCount = animals.filter(a => a.category === AnimalCategory.HEIFER).length;
  const cattleCount = animals.filter(a => a.category === AnimalCategory.CATTLE).length;
  const calfCount = animals.filter(a => a.category === AnimalCategory.CALF).length;
  const maleCalfCount = animals.filter(a => a.category === AnimalCategory.CALF_MALE).length;

  const animalsDueForCheck = animals.filter(a => {
    if (a.status !== ReproductiveStatus.INSEMINATED || !a.inseminationDate) return false;
    const days = helpers.getDaysToPregnancyCheck(a.inseminationDate);
    return days !== null && days <= 0;
  });

  const animalsReadyForCalving = animals.filter(a => {
    if ((a.status !== ReproductiveStatus.PREGNANT && a.status !== ReproductiveStatus.DRY) || !a.expectedCalvingDate) return false;
    const days = helpers.getDaysToCalving(a.expectedCalvingDate);
    return days !== null && days <= 5;
  });

  const animalsDueForDry = animals.filter(a => {
    if (a.status !== ReproductiveStatus.PREGNANT || !a.inseminationDate) return false;
    const daysGestation = helpers.getGestationDays(a.inseminationDate);
    return daysGestation !== null && daysGestation >= 225;
  });

  const animalsReadyForInsemination = animals.filter(a => {
    // Check if animal is eligible for heat (Newly Calved or Open)
    if (a.status !== ReproductiveStatus.NEWLY_CALVED && a.status !== ReproductiveStatus.OPEN) return false;
    // Must have a calving date or be in Open status (which implies previous calving or failed insemination)
    // However, the rule is strictly "45 days after entry" which usually implies calving date for existing cows.
    if (!a.calvingDate) return false;

    const days = helpers.getDaysSinceCalving(a.calvingDate);
    // Alert if 45 days or more have passed
    return days !== null && days >= 45;
  });

  const searchedAnimal = React.useMemo(() => {
    if (searchQuery.length < 1) return null;
    return allAnimals.find(a => a.tagNumber.toLowerCase() === searchQuery.toLowerCase());
  }, [allAnimals, searchQuery]);

  const motherTag = React.useMemo(() => {
    if (!searchedAnimal?.motherId) return null;
    return allAnimals.find(a => a.id === searchedAnimal.motherId)?.tagNumber;
  }, [allAnimals, searchedAnimal]);

  useEffect(() => {
    if (searchedAnimal && profileRef.current) {
      profileRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchedAnimal]);

  const addHistoryEvent = (animal: Animal, event: Omit<HistoryEvent, 'id'>): Animal => {
    const newEvent: HistoryEvent = { ...event, id: helpers.generateId() };
    return {
      ...animal,
      history: [newEvent, ...(animal.history || [])],
      lastUpdated: new Date().toISOString()
    };
  };

  const handlePregnancyResult = (animal: Animal, result: 'pregnant' | 'open') => {
    let updatedAnimal: Animal = { ...animal, lastUpdated: new Date().toISOString() };
    if (result === 'pregnant') {
      const ecd = helpers.calculateCalvingDate(animal.inseminationDate!);
      updatedAnimal.status = ReproductiveStatus.PREGNANT;
      updatedAnimal.expectedCalvingDate = ecd?.toISOString();
      updatedAnimal = addHistoryEvent(updatedAnimal, {
        type: 'PREGNANCY_CHECK',
        date: new Date().toISOString(),
        details: `Confirmed PREGNANT after 45-day check.`,
        semen: animal.semenName,
        result: 'Positive'
      });
    } else {
      updatedAnimal.status = ReproductiveStatus.OPEN;
      updatedAnimal.inseminationDate = undefined;
      updatedAnimal.semenName = undefined;
      updatedAnimal = addHistoryEvent(updatedAnimal, {
        type: 'PREGNANCY_CHECK',
        date: new Date().toISOString(),
        details: `Marked OPEN after 45-day check.`,
        result: 'Negative'
      });
    }
    onUpdateAnimal(updatedAnimal);
    setPendingCheckAnimal(null);
  };

  const handleDryAction = (animal: Animal, confirm: boolean) => {
    if (confirm) {
      let updatedAnimal: Animal = {
        ...animal,
        status: ReproductiveStatus.DRY,
        lastUpdated: new Date().toISOString()
      };
      updatedAnimal = addHistoryEvent(updatedAnimal, {
        type: 'GENERAL',
        date: new Date().toISOString(),
        details: `Animal shifted to DRY status (خشک) after 7.5 months of gestation.`,
      });
      onUpdateAnimal(updatedAnimal);
    }
    setPendingDryAnimal(null);
  };

  const handleCalving = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingCalvingAnimal || !calfTag) return;

    const now = new Date().toISOString();
    const newCalf: Animal = {
      id: helpers.generateId(),
      tagNumber: calfTag,
      category: calfGender === 'male' ? AnimalCategory.CALF_MALE : AnimalCategory.CALF,
      status: ReproductiveStatus.CHILD,
      farm: pendingCalvingAnimal.farm,
      motherId: pendingCalvingAnimal.id,
      history: [{
        id: helpers.generateId(),
        type: 'GENERAL',
        date: calvingDate,
        details: `Born to Mother Tag: ${pendingCalvingAnimal.tagNumber}`
      }],
      lastUpdated: now
    };

    let updatedMother: Animal = {
      ...pendingCalvingAnimal,
      status: ReproductiveStatus.NEWLY_CALVED,
      calvingDate: calvingDate,
      expectedCalvingDate: undefined,
      inseminationDate: undefined,
      calvesIds: [...(pendingCalvingAnimal.calvesIds || []), newCalf.id],
      lastUpdated: now
    };

    updatedMother = addHistoryEvent(updatedMother, {
      type: 'CALVING',
      date: calvingDate,
      details: `Official Calving Recorded: Produced ${calfGender === 'male' ? 'Male Calf' : 'Female Calf'} (Tag: ${calfTag})`,
      remarks: calvingDescription,
      calfId: newCalf.id,
      semen: pendingCalvingAnimal.semenName // Store the semen name used for this pregnancy
    });

    onUpdateBatch([newCalf, updatedMother]);
    setPendingCalvingAnimal(null);
    setCalfTag('');
    setCalvingDescription('');
    setCalvingDate(new Date().toISOString().split('T')[0]);
  };

  const handleSaveEdit = (data: Partial<Animal>) => {
    if (!editTarget) return;
    let updatedAnimal: Animal = { ...editTarget, ...data, lastUpdated: new Date().toISOString() };
    if (data.status && data.status !== editTarget.status) {
      updatedAnimal = addHistoryEvent(updatedAnimal, {
        type: 'GENERAL',
        date: new Date().toISOString(),
        details: `Status manually changed to: ${data.status}`,
        remarks: data.remarks
      });
    }
    onUpdateAnimal(updatedAnimal);
    setIsEditModalOpen(false);
    setEditTarget(undefined);
  };

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 gap-4 shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-900 leading-none uppercase tracking-tight">{farmName}</h2>
          <p className="text-indigo-600 font-bold uppercase tracking-widest text-[10px] mt-2">Live Farm Intelligence (فارم کی تازہ ترین صورتحال)</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search Tag Number (نمبر تلاش کریں)..."
            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-600 font-black text-slate-900 text-lg shadow-inner"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* DASHBOARD SUMMARY SECTION */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 px-2">
          <ChevronRight size={16} className="text-indigo-600" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Breeding & Management Status (جانوروں کی حالت)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <StatCard label="Total Animals" subLabel="(کل جانور)" value={total} icon={<Users size={24} />} color="indigo" />
          <StatCard label="Newly Calved" subLabel="(تازہ سوئی)" value={newlyCalvedCount} icon={<Sparkles size={24} />} color="emerald" onClick={() => onNavigateToReport(ReproductiveStatus.NEWLY_CALVED)} />
          <StatCard label="Pregnant" subLabel="(گابھن)" value={pregnantCount} icon={<ShieldCheck size={24} />} color="emerald" onClick={() => onNavigateToReport(ReproductiveStatus.PREGNANT)} />
          <StatCard label="Inseminated" subLabel="(ٹیکہ شدہ)" value={inseminatedCount} icon={<Activity size={24} />} color="amber" onClick={() => onNavigateToReport(ReproductiveStatus.INSEMINATED)} />
          <StatCard label="Dry" subLabel="(خشک جانور)" value={dryCount} icon={<Wind size={24} />} color="blue" onClick={() => onNavigateToReport(ReproductiveStatus.DRY)} />
          <StatCard label="Open" subLabel="(خالی جانور)" value={openCount} icon={<RotateCcw size={24} />} color="rose" onClick={() => onNavigateToReport(ReproductiveStatus.OPEN)} />
          <StatCard label="Child Status" subLabel="(بچہ حالت)" value={childStatusCount} icon={<Baby size={24} />} color="rose" onClick={() => onNavigateToReport(ReproductiveStatus.CHILD)} />
        </div>

        <div className="flex items-center gap-2 px-2 pt-4">
          <ChevronRight size={16} className="text-indigo-600" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Herd Inventory Categories (جانوروں کی اقسام)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Heifers" subLabel="(بچھڑیاں)" value={totalHeiferCount} icon={<Activity size={24} />} color="indigo" />
          <StatCard label="Cattle" subLabel="(بیل/گائے)" value={cattleCount} icon={<Beef size={24} />} color="blue" />
          <StatCard label="Female Calf" subLabel="(بچھیا)" value={calfCount} icon={<Baby size={24} />} color="rose" />
          <StatCard label="Male Calf" subLabel="(بچھڑا)" value={maleCalfCount} icon={<Baby size={24} />} color="slate" />
        </div>
      </div>

      {/* Searched Animal Profile */}
      {searchedAnimal && (
        <div ref={profileRef} className="bg-white rounded-[2rem] p-6 border-2 border-slate-900 shadow-xl animate-in zoom-in duration-300 relative z-20">
          <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-100 pb-4 mb-5 gap-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Profile Info (جانور کی تفصیل)</p>
                <div className="flex items-center gap-3">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{searchedAnimal.tagNumber}</h2>
                  <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${searchedAnimal.status === ReproductiveStatus.PREGNANT ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                    searchedAnimal.status === ReproductiveStatus.INSEMINATED ? 'bg-amber-50 text-amber-800 border-amber-200' :
                      searchedAnimal.status === ReproductiveStatus.DRY ? 'bg-blue-50 text-blue-800 border-blue-200' :
                        'bg-slate-50 text-slate-600 border-slate-300'
                    }`}>
                    {searchedAnimal.status}
                  </div>
                </div>
              </div>
              <div className="hidden md:flex gap-1.5 ml-2">
                <span className="bg-indigo-900 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">{searchedAnimal.farm}</span>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-200">{searchedAnimal.category}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 no-print">
              <button onClick={() => setViewHistoryAnimal(searchedAnimal)} className="p-2.5 bg-slate-900 text-white hover:bg-black rounded-xl transition-all shadow-md flex items-center gap-2">
                <History size={18} />
                <span className="font-black text-[10px] uppercase tracking-widest">History</span>
              </button>
              <button
                onClick={() => { setEditTarget(searchedAnimal); setIsEditModalOpen(true); }}
                className="p-2.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-xl transition-all border border-indigo-200"
                title="Edit Record"
              >
                <Edit2 size={18} />
              </button>
              <button onClick={() => setSearchQuery('')} className="p-2.5 bg-slate-100 text-slate-400 hover:bg-slate-200 rounded-xl transition-all border border-slate-200">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            {motherTag && <DataBlock label="Mother Tag" value={motherTag} icon={<Users size={14} />} />}

            {searchedAnimal.inseminationDate && (
              <DataBlock label="Insemination Date" value={helpers.formatDate(searchedAnimal.inseminationDate)} icon={<Timer size={14} />} />
            )}

            {searchedAnimal.semenName && (
              <DataBlock label="Semen (ٹیکہ)" value={searchedAnimal.semenName} icon={<Activity size={14} />} />
            )}

            {searchedAnimal.expectedCalvingDate && (
              <DataBlock label="Expected Calving" value={helpers.formatDate(searchedAnimal.expectedCalvingDate)} icon={<Calendar size={14} />} color="emerald" />
            )}

            {(searchedAnimal.status === ReproductiveStatus.PREGNANT || searchedAnimal.status === ReproductiveStatus.DRY) && searchedAnimal.expectedCalvingDate && (
              <DataBlock
                label="Days Remaining"
                value={(() => {
                  const d = helpers.getDaysToCalving(searchedAnimal.expectedCalvingDate);
                  if (d === null) return '0';
                  return d < 0 ? `${Math.abs(d)} Days Overdue` : `${d} Days Remaining`;
                })()}
                icon={<Baby size={14} />}
                color={helpers.getDaysToCalving(searchedAnimal.expectedCalvingDate)! < 0 ? 'rose' : 'emerald'}
              />
            )}

            {searchedAnimal.status === ReproductiveStatus.DRY && (
              <DataBlock label="Dry Since" value={`${helpers.getDaysSinceLastUpdate(searchedAnimal.lastUpdated) || 0} Days`} icon={<Wind size={14} />} />
            )}

            <DataBlock label="Last Updated" value={helpers.formatDate(searchedAnimal.lastUpdated)} icon={<CheckCircle2 size={14} />} />
          </div>

          {searchedAnimal.remarks && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex gap-3">
              <Clipboard size={18} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Remarks / Notes</p>
                <p className="text-sm font-bold text-slate-700 leading-tight">"{searchedAnimal.remarks}"</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ALERTS HUB */}
      {(animalsDueForDry.length > 0 || animalsDueForCheck.length > 0 || animalsReadyForCalving.length > 0) && (
        <div className="no-print space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="bg-rose-100 p-2 rounded-xl text-rose-600 animate-pulse">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Active Notifications</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Immediate Actions Required (ضروری اقدامات)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <AlertGroup
              title="Calving Due"
              subTitle="سوئی کے قریب"
              count={animalsReadyForCalving.length}
              color="rose"
              icon={<Baby size={20} />}
            >
              {animalsReadyForCalving.map(a => (
                <AlertItem
                  key={a.id}
                  animal={a}
                  color="rose"
                  info={helpers.getDaysToCalving(a.expectedCalvingDate!)! <= 0 ? 'Due Now' : `${helpers.getDaysToCalving(a.expectedCalvingDate!)!} Days Left`}
                  onClick={() => setPendingCalvingAnimal(a)}
                />
              ))}
            </AlertGroup>

            <AlertGroup
              title="Dry Off Needed"
              subTitle="خشک کرنے والے"
              count={animalsDueForDry.length}
              color="blue"
              icon={<Wind size={20} />}
            >
              {animalsDueForDry.map(a => (
                <AlertItem
                  key={a.id}
                  animal={a}
                  color="blue"
                  info="Gestation 7.5m+"
                  onClick={() => setPendingDryAnimal(a)}
                />
              ))}
            </AlertGroup>

            <AlertGroup
              title="Pregnancy Check"
              subTitle="ٹیکہ کا معائنہ"
              count={animalsDueForCheck.length}
              color="amber"
              icon={<Timer size={20} />}
            >
              {animalsDueForCheck.map(a => (
                <AlertItem
                  key={a.id}
                  animal={a}
                  color="amber"
                  info="45 Day Milestone"
                  onClick={() => setPendingCheckAnimal(a)}
                />
              ))}
            </AlertGroup>

            <AlertGroup
              title="Ready for Heat/AI"
              subTitle="انسمینیشن کے لیے تیار"
              count={animalsReadyForInsemination.length}
              color="emerald"
              icon={<Sparkles size={20} />}
            >
              {animalsReadyForInsemination.map(a => (
                <AlertItem
                  key={a.id}
                  animal={a}
                  color="emerald"
                  info={(helpers.getDaysSinceCalving(a.calvingDate!) || 0) + " Days since Calving"}
                  onClick={() => onUpdateAnimal(a)} // Just view/edit for now, or maybe add specific action later
                />
              ))}
            </AlertGroup>
          </div>
        </div>
      )}

      {/* Detailed Farm Inventory Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(activeFarm === 'all' || activeFarm === FarmLocation.MILKING_FARM) && (
          <InventorySection title="MILKING FARM (دودھ والا فارم)" color="indigo" icon={<Milk size={24} />}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <SimpleBox label="NEWLY CALVED" subLabel="(تازہ سوئی)" value={allAnimals.filter(a => a.farm === FarmLocation.MILKING_FARM && a.status === ReproductiveStatus.NEWLY_CALVED).length} />
              <SimpleBox label="PREGNANT" subLabel="(گابھن)" value={allAnimals.filter(a => a.farm === FarmLocation.MILKING_FARM && a.status === ReproductiveStatus.PREGNANT).length} />
              <SimpleBox label="INSEMINATED" subLabel="(ٹیکہ شدہ)" value={allAnimals.filter(a => a.farm === FarmLocation.MILKING_FARM && a.status === ReproductiveStatus.INSEMINATED).length} />
              <SimpleBox label="OPEN" subLabel="(خالی)" value={allAnimals.filter(a => a.farm === FarmLocation.MILKING_FARM && a.status === ReproductiveStatus.OPEN).length} />
              <SimpleBox label="DRY" subLabel="(خشک)" value={allAnimals.filter(a => a.farm === FarmLocation.MILKING_FARM && a.status === ReproductiveStatus.DRY).length} />
              <SimpleBox label="FEMALE CALF" subLabel="(بچھیا)" value={allAnimals.filter(a => a.farm === FarmLocation.MILKING_FARM && a.category === AnimalCategory.CALF).length} />
              <SimpleBox label="MALE CALF" subLabel="(بچھڑا)" value={allAnimals.filter(a => a.farm === FarmLocation.MILKING_FARM && a.category === AnimalCategory.CALF_MALE).length} />
            </div>
          </InventorySection>
        )}
        {(activeFarm === 'all' || activeFarm === FarmLocation.HEIFER_FARM) && (
          <InventorySection title="CATTLE FARM (کٹی والا فارم)" color="emerald" icon={<Beef size={24} />}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <SimpleBox label="HEIFERS" subLabel="(بچھڑیاں)" value={allAnimals.filter(a => a.farm === FarmLocation.HEIFER_FARM && a.category === AnimalCategory.HEIFER).length} />
              <SimpleBox label="OPEN" subLabel="(خالی)" value={allAnimals.filter(a => a.farm === FarmLocation.HEIFER_FARM && a.status === ReproductiveStatus.OPEN).length} />
              <SimpleBox label="PREGNANT" subLabel="(گابھن)" value={allAnimals.filter(a => a.farm === FarmLocation.HEIFER_FARM && a.status === ReproductiveStatus.PREGNANT).length} />
              <SimpleBox label="CATTLE" subLabel="(بیل/گائے)" value={allAnimals.filter(a => a.farm === FarmLocation.HEIFER_FARM && a.category === AnimalCategory.CATTLE).length} />
              <SimpleBox label="FEMALE CALF" subLabel="(بچھیا)" value={allAnimals.filter(a => a.farm === FarmLocation.HEIFER_FARM && a.category === AnimalCategory.CALF).length} />
              <SimpleBox label="MALE CALF" subLabel="(بچھڑا)" value={allAnimals.filter(a => a.farm === FarmLocation.HEIFER_FARM && a.category === AnimalCategory.CALF_MALE).length} />
            </div>
          </InventorySection>
        )}
      </div>

      {/* Modals */}
      {isEditModalOpen && (
        <AnimalFormModal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setEditTarget(undefined); }}
          onSave={handleSaveEdit}
          initialData={editTarget}
          mothersList={allAnimals}
        />
      )}

      {pendingDryAnimal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden border-t-[16px] border-blue-500 animate-in zoom-in duration-300">
            <div className="p-10 text-center">
              <h3 className="text-3xl font-black text-slate-900 mb-2">خشک جانور (Dry Animal)</h3>
              <p className="font-black text-slate-500 mb-8 uppercase tracking-widest text-[11px]">Do you want to shift Tag #{pendingDryAnimal.tagNumber} to Dry status?<br />کیا آپ اس جانور کو خشک کرنا چاہتے ہیں؟</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={() => handleDryAction(pendingDryAnimal, true)} className="flex flex-col items-center gap-3 p-6 rounded-[2rem] bg-blue-50 border-2 border-blue-200 text-blue-900 hover:bg-blue-100 transition-all">
                  <CheckCircle2 size={32} />
                  <span className="font-black text-lg">جی ہاں (Yes)</span>
                </button>
                <button onClick={() => handleDryAction(pendingDryAnimal, false)} className="flex flex-col items-center gap-3 p-6 rounded-[2rem] bg-slate-50 border-2 border-slate-200 text-slate-900 hover:bg-slate-100 transition-all">
                  <XCircle size={32} />
                  <span className="font-black text-lg">نہیں (No)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingCheckAnimal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden border-t-[16px] border-amber-400 animate-in zoom-in duration-300">
            <div className="p-10 text-center">
              <h3 className="text-3xl font-black text-slate-900 mb-2">Check Result (ٹیکہ کا نتیجہ)</h3>
              <p className="font-black text-slate-500 mb-8 uppercase tracking-widest text-[10px]">Record Outcome for Tag #{pendingCheckAnimal.tagNumber}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={() => handlePregnancyResult(pendingCheckAnimal, 'pregnant')} className="flex flex-col items-center gap-3 p-6 rounded-[2rem] bg-emerald-50 border-2 border-emerald-200 text-emerald-900 hover:bg-emerald-100 transition-all">
                  <CheckCircle2 size={32} />
                  <span className="font-black text-lg">Pregnant (گابھن)</span>
                </button>
                <button onClick={() => handlePregnancyResult(pendingCheckAnimal, 'open')} className="flex flex-col items-center gap-3 p-6 rounded-[2rem] bg-rose-50 border-2 border-rose-200 text-rose-900 hover:bg-rose-100 transition-all">
                  <XCircle size={32} />
                  <span className="font-black text-lg">Empty / Open (خالی)</span>
                </button>
              </div>
              <button onClick={() => setPendingCheckAnimal(null)} className="mt-8 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {pendingCalvingAnimal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border-t-[16px] border-rose-500 animate-in zoom-in duration-300">
            <div className="p-10">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">Birth Record</h3>
                  <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-1">Mother Tag: #{pendingCalvingAnimal.tagNumber}</p>
                </div>
                <button onClick={() => setPendingCalvingAnimal(null)} className="p-3 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200"><X size={24} /></button>
              </div>
              <form onSubmit={handleCalving} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calving Date (تاریخ)</label>
                    <input type="date" required className="w-full px-5 py-4 border-2 border-slate-200 rounded-2xl font-bold" value={calvingDate} onChange={(e) => setCalvingDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calf Tag ID (ٹیگ نمبر)</label>
                    <input required type="text" placeholder="e.g., C-101" className="w-full px-5 py-4 border-2 border-slate-200 rounded-2xl font-black text-slate-900 text-2xl focus:border-rose-500 outline-none" value={calfTag} onChange={(e) => setCalfTag(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender (جنس)</label>
                  <div className="flex bg-slate-50 p-2 rounded-[1.5rem] border-2 border-slate-100">
                    <button type="button" onClick={() => setCalfGender('female')} className={`flex-1 py-4 rounded-2xl font-black transition-all ${calfGender === 'female' ? 'bg-white text-indigo-800 shadow-xl' : 'text-slate-400'}`}>Female (بچھیا)</button>
                    <button type="button" onClick={() => setCalfGender('male')} className={`flex-1 py-4 rounded-2xl font-black transition-all ${calfGender === 'male' ? 'bg-white text-rose-800 shadow-xl' : 'text-slate-400'}`}>Male (بچھڑا)</button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</label>
                  <textarea rows={2} className="w-full px-5 py-4 border-2 border-slate-200 rounded-2xl font-bold" placeholder="Enter details..." value={calvingDescription} onChange={(e) => setCalvingDescription(e.target.value)} />
                </div>
                <button type="submit" className="w-full py-5 bg-rose-600 text-white rounded-3xl font-black flex items-center justify-center gap-4 hover:bg-rose-700 shadow-xl text-xl transition-all"><Save size={24} /> Confirm Birth Record</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {viewHistoryAnimal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in duration-300">
            <div className="p-10 border-b-2 border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-5">
                {viewHistoryAnimal.image ? (
                  <img src={viewHistoryAnimal.image} className="w-24 h-24 rounded-3xl object-cover shadow-xl border-4 border-white" alt="Profile" />
                ) : (
                  <div className="bg-indigo-900 text-white p-4 rounded-3xl shadow-xl"><History size={28} /></div>
                )}
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">Record Ledger</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-5xl font-black text-indigo-600 tracking-tighter">#{viewHistoryAnimal.tagNumber}</span>
                    <div className="flex flex-col gap-1">
                      <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${viewHistoryAnimal.status === ReproductiveStatus.PREGNANT ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : viewHistoryAnimal.status === ReproductiveStatus.INSEMINATED ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{viewHistoryAnimal.status}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{viewHistoryAnimal.category} | {viewHistoryAnimal.farm}</span>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setViewHistoryAnimal(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={32} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-12 space-y-12 bg-white">
              <div className="relative border-l-4 border-slate-100 pl-10 space-y-12">
                {viewHistoryAnimal.history?.map(event => (
                  <div key={event.id} className="relative">
                    <div className="absolute top-0 -left-[50px] w-8 h-8 rounded-full bg-white border-4 border-slate-200 z-10 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-indigo-600"></div></div>
                    {/* Dynamic Style based on Event Type */}
                    {(() => {
                      const getEventStyle = (type: string, result?: string) => {
                        if (type === 'CALVING') return 'bg-rose-50 border-rose-100';
                        if (type === 'INSEMINATION') return 'bg-amber-50 border-amber-100';
                        if (type === 'PREGNANCY_CHECK') return result === 'Positive' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200';
                        if (type === 'FARM_SHIFT') return 'bg-blue-50 border-blue-100';
                        return 'bg-slate-50 border-slate-200';
                      };

                      const cardStyle = getEventStyle(event.type, event.result);

                      return (
                        <div className={`p-8 rounded-[2rem] border-2 transition-all hover:shadow-lg ${cardStyle}`}>
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{helpers.formatDate(event.date)}</span>
                            <div className="flex gap-2">
                              {event.result && (
                                <span className={`px-3 py-1 rounded text-[10px] font-black uppercase ${event.result === 'Positive' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {event.result}
                                </span>
                              )}
                              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-[10px] font-black uppercase">{event.type}</span>
                            </div>
                          </div>
                          <p className="font-black text-slate-800 text-xl leading-snug mb-2">{event.details}</p>

                          {/* Detailed History Fields - With Legacy Parsing Support */}
                          {(() => {
                            let semenName = event.semen;
                            let calfTagInfo = event.calfId ? animals.find(a => a.id === event.calfId)?.tagNumber : null;

                            // Legacy Parsing for Old Records
                            if (!semenName && event.details && event.details.includes('Inseminated with')) {
                              const match = event.details.match(/Inseminated with (.*)/);
                              if (match && match[1]) semenName = match[1];
                            }
                            if (!calfTagInfo && event.details && event.details.includes('Tag:')) {
                              const match = event.details.match(/Tag: ([^)]+)/);
                              if (match && match[1]) calfTagInfo = match[1];
                            }

                            return (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-3">
                                {semenName && (
                                  <div className="flex items-center gap-3 bg-white/60 px-4 py-2 rounded-xl border border-slate-200/50">
                                    <div className="p-1 bg-white rounded-lg shadow-sm"><Activity size={14} className="text-indigo-600" /></div>
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black uppercase tracking-widest leading-none opacity-50">Semen Used</span>
                                      <span className="font-extrabold text-sm leading-none mt-1">{semenName}</span>
                                    </div>
                                  </div>
                                )}
                                {calfTagInfo && (
                                  <div className="flex items-center gap-3 bg-white/60 px-4 py-2 rounded-xl border border-slate-200/50">
                                    <div className="p-1 bg-white rounded-lg shadow-sm"><Baby size={14} className="text-rose-600" /></div>
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black uppercase tracking-widest leading-none opacity-50">Calf Born</span>
                                      <span className="font-extrabold text-sm leading-none mt-1">Tag: {calfTagInfo}</span>
                                    </div>
                                  </div>
                                )}
                                {event.medications && (
                                  <div className="flex items-center gap-2 text-slate-700 bg-slate-100/80 px-4 py-2 rounded-xl border border-slate-200 col-span-full">
                                    <div className="p-1 bg-white rounded-lg shadow-sm"><div className="w-3.5 h-3.5 flex items-center justify-center font-black text-[8px] border border-slate-400 rounded-sm">Rx</div></div>
                                    <div className="flex flex-col w-full">
                                      <span className="text-[9px] font-black uppercase tracking-widest leading-none opacity-50">Medications / Treatment</span>
                                      <span className="font-bold text-xs leading-none mt-1">{event.medications}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {event.remarks && <p className="text-sm font-bold text-slate-500 mt-5 pt-3 border-t border-slate-200/50 italic">Note: "{event.remarks}"</p>}
                        </div>
                      );
                    })()}
                  </div>
                )) || <p className="italic text-slate-400 py-10 text-center">No record logs found.</p>}
              </div>
            </div>
            <div className="p-10 border-t bg-slate-50 flex justify-end no-print">
              <button onClick={() => setViewHistoryAnimal(null)} className="bg-slate-900 text-white px-12 py-4 rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-xl">Close Ledger</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AlertGroup = ({ title, subTitle, count, color, icon, children }: any) => {
  const styles: any = {
    rose: 'border-rose-200 bg-rose-50/50 text-rose-900',
    blue: 'border-blue-200 bg-blue-50/50 text-blue-900',
    amber: 'border-amber-200 bg-amber-50/50 text-amber-900'
  };
  const iconBg: any = {
    rose: 'bg-rose-100 text-rose-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600'
  };

  if (count === 0) return (
    <div className={`p-6 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center gap-3 opacity-30 grayscale`}>
      <div className="p-3 bg-slate-100 rounded-2xl text-slate-400">{icon}</div>
      <div className="text-center">
        <p className="font-black text-xs uppercase tracking-widest">{title}</p>
        <p className="text-[10px] font-bold opacity-60">No pending actions</p>
      </div>
    </div>
  );

  return (
    <div className={`p-6 rounded-[2rem] border-2 flex flex-col shadow-sm transition-all hover:shadow-md ${styles[color]}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${iconBg[color]}`}>{icon}</div>
          <div>
            <h4 className="font-black text-sm uppercase tracking-tight leading-none">{title}</h4>
            <p className="text-[9px] font-bold opacity-60 uppercase">{subTitle}</p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border-2 border-current`}>{count}</span>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1 custom-scrollbar">
        {children}
      </div>
    </div>
  );
};

const AlertItem = ({ animal, color, info, onClick }: any) => {
  const styles: any = {
    rose: 'bg-white/80 border-rose-100 hover:bg-rose-600 hover:text-white',
    blue: 'bg-white/80 border-blue-100 hover:bg-blue-600 hover:text-white',
    amber: 'bg-white/80 border-amber-100 hover:bg-amber-600 hover:text-white'
  };

  return (
    <div
      onClick={onClick}
      className={`group flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer shadow-sm ${styles[color]}`}
    >
      <div className="flex flex-col">
        <span className="font-black text-lg tracking-tighter leading-none">#{animal.tagNumber}</span>
        <span className={`text-[8px] font-black uppercase tracking-widest mt-1 opacity-60 group-hover:text-white/80`}>{animal.category}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className={`text-[10px] font-black uppercase group-hover:text-white`}>{info}</span>
        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
      </div>
    </div>
  );
};

const StatCard = ({ label, subLabel, value, icon, color, onClick }: any) => {
  const colors: any = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900',
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
  };
  return (
    <div onClick={onClick} className={`p-4 rounded-[1.5rem] border-2 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all ${colors[color]}`}>
      <div className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest mb-0.5 opacity-70 leading-tight truncate">
          {label} <br /> <span className="text-[8px] lowercase font-bold">{subLabel}</span>
        </p>
        <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
      </div>
    </div>
  );
};

const SimpleBox = ({ label, subLabel, value }: any) => (
  <div className="bg-white p-4 rounded-xl border-2 border-slate-100 text-center shadow-sm">
    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
    <p className="text-[7px] font-bold text-slate-300 uppercase mb-1.5">{subLabel}</p>
    <p className="text-xl font-black text-slate-900 leading-none">{value}</p>
  </div>
);

const InventorySection = ({ title, color, icon, children }: any) => {
  const styles: any = {
    indigo: 'border-indigo-200 bg-indigo-50/20 text-indigo-900',
    emerald: 'border-emerald-200 bg-emerald-50/20 text-emerald-900',
    blue: 'border-blue-200 bg-blue-50/20 text-blue-900'
  };
  return (
    <div className={`p-6 rounded-[2rem] border-2 shadow-sm ${styles[color]}`}>
      <div className="flex items-center gap-2.5 mb-6">
        <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">{icon}</div>
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{title}</h3>
      </div>
      {children}
    </div>
  );
};

const DataBlock = ({ label, value, icon, color }: any) => {
  const colorStyles: any = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    rose: 'bg-rose-50 border-rose-100 text-rose-900',
    default: 'bg-slate-50 border-slate-100 text-slate-900'
  };
  const currentStyle = color ? colorStyles[color] : colorStyles.default;

  return (
    <div className={`p-3.5 rounded-xl border ${currentStyle}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon && <div className="opacity-40 shrink-0">{icon}</div>}
        <p className="text-[7.5px] font-black uppercase tracking-widest opacity-60 truncate">{label}</p>
      </div>
      <p className="text-sm font-black leading-tight truncate">{value}</p>
    </div>
  );
};

export default Dashboard;
