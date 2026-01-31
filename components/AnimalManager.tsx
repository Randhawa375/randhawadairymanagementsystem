
import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Baby, History, X, Save, ClipboardList, Timer, Droplets, Wind, ArrowRightLeft, Activity, Camera } from 'lucide-react';
import { Animal, AnimalCategory, ReproductiveStatus, FarmLocation, HistoryEvent } from '../types';
import AnimalFormModal from './AnimalFormModal';
import {
  formatDate,
  generateId,
  getDaysToCalving,
  getDaysToPregnancyCheck,
  getGestationDays,
  getDaysSinceLastUpdate,
  getSireInfo
} from '../utils/helpers';
import { uploadImage } from '../utils/storage';

interface AnimalManagerProps {
  animals: Animal[];
  allAnimals: Animal[];
  onSave: (animal: Animal) => void;
  onBatchSave: (animals: Animal[]) => void;
  onDelete: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  activeFarm: FarmLocation | 'all';
}

const AnimalManager: React.FC<AnimalManagerProps> = ({
  animals,
  allAnimals,
  onSave,
  onBatchSave,
  onDelete,
  searchQuery,
  setSearchQuery,
  activeFarm,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCalvingModalOpen, setIsCalvingModalOpen] = useState(false);
  const [viewHistoryAnimal, setViewHistoryAnimal] = useState<Animal | null>(null);
  const [calvingMother, setCalvingMother] = useState<Animal | null>(null);
  const [editTarget, setEditTarget] = useState<Animal | undefined>(undefined);

  const [calvingDate, setCalvingDate] = useState(new Date().toISOString().split('T')[0]);
  const [calfGender, setCalfGender] = useState<'male' | 'female'>('female');
  const [calfTag, setCalfTag] = useState('');
  const [calvingDescription, setCalvingDescription] = useState('');
  const [calfImages, setCalfImages] = useState<string[]>([]);
  const [calfImageFiles, setCalfImageFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleCalfImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        setCalfImageFiles(prev => [...prev, file]);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            setCalfImages(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeCalfImage = (index: number) => {
    setCalfImages(prev => prev.filter((_, i) => i !== index));
    setCalfImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this record? This will remove it from the cloud database permanently.')) {
      onDelete(id);
    }
  };

  const addHistoryEvent = (animal: Animal, event: Omit<HistoryEvent, 'id'>): Animal => {
    const newEvent: HistoryEvent = { ...event, id: generateId() };
    return {
      ...animal,
      history: [newEvent, ...(animal.history || [])],
      lastUpdated: new Date().toISOString()
    };
  };

  const handleSave = (data: Partial<Animal>, calvesData?: any[]) => {
    if (!editTarget && allAnimals.some(a => a.tagNumber === data.tagNumber)) {
      alert(`Tag Number ${data.tagNumber} already exists!`);
      return;
    }

    // 1. EDIT EXISTING RECORD
    if (editTarget) {
      let updatedAnimal: Animal = { ...editTarget, ...data, lastUpdated: new Date().toISOString() };

      const isStatusChanged = data.status && data.status !== editTarget.status;
      const isMedsChanged = data.medications && data.medications !== editTarget.medications;
      const isInsemDataChanged = (data.inseminationDate !== editTarget.inseminationDate) || (data.semenName !== editTarget.semenName);

      // --- DETAILED HISTORY LOGIC ---

      // 1. Status Change (Major Event)
      if (isStatusChanged) {
        if (data.status === ReproductiveStatus.INSEMINATED) {
          updatedAnimal = addHistoryEvent(updatedAnimal, {
            type: 'INSEMINATION',
            date: data.inseminationDate || new Date().toISOString(),
            details: `Inseminated with ${data.semenName} on ${formatDate(data.inseminationDate || '')}`,
            semen: data.semenName,
            remarks: data.remarks
          });
        } else if (data.status === ReproductiveStatus.PREGNANT) {
          updatedAnimal = addHistoryEvent(updatedAnimal, {
            type: 'PREGNANCY_CHECK',
            date: new Date().toISOString(),
            details: `Confirmed Pregnant. Expected Calving: ${formatDate(data.expectedCalvingDate || '')}`,
            result: 'Positive',
            semen: updatedAnimal.semenName, // Capture semen used
            remarks: data.remarks
          });
        } else if (data.status === ReproductiveStatus.OPEN) {
          updatedAnimal = addHistoryEvent(updatedAnimal, {
            type: 'PREGNANCY_CHECK',
            date: new Date().toISOString(),
            details: `Marked OPEN (Empty).`,
            result: 'Negative',
            remarks: data.remarks
          });
        } else {
          updatedAnimal = addHistoryEvent(updatedAnimal, {
            type: 'GENERAL',
            date: new Date().toISOString(),
            details: `Status changed to: ${data.status}`,
            remarks: data.remarks
          });
        }
      }
      // 2. Insemination Data Update (without status change, e.g. correction)
      else if (isInsemDataChanged && data.status === ReproductiveStatus.INSEMINATED) {
        updatedAnimal = addHistoryEvent(updatedAnimal, {
          type: 'INSEMINATION',
          date: data.inseminationDate || new Date().toISOString(),
          details: `Insemination record updated. Semen: ${data.semenName} on ${formatDate(data.inseminationDate || '')}`,
          semen: data.semenName,
          remarks: 'Record Correction'
        });
      }

      // 3. Medication Update
      if (isMedsChanged) {
        updatedAnimal = addHistoryEvent(updatedAnimal, {
          type: 'MEDICATION',
          date: new Date().toISOString(),
          details: `Medication Added/Updated`,
          medications: data.medications,
          remarks: data.remarks
        });
      }

      // 4. General Field Updates (Category, Farm, etc.) - Detect other changes
      if (!isStatusChanged && !isMedsChanged && !isInsemDataChanged) {
        const changes: string[] = [];
        if (data.category !== editTarget.category) changes.push(`Category: ${editTarget.category} -> ${data.category}`);
        if (data.farm !== editTarget.farm) changes.push(`Location: ${editTarget.farm} -> ${data.farm}`);
        if (data.remarks !== editTarget.remarks && data.remarks) changes.push(`Note Added`);

        if (changes.length > 0) {
          updatedAnimal = addHistoryEvent(updatedAnimal, {
            type: 'GENERAL',
            date: new Date().toISOString(),
            details: `Profile Updated: ${changes.join(', ')}`,
          });
        }
      }

      onSave(updatedAnimal);
    }
    // 2. CREATE NEW RECORD (With Potential Calves)
    else {
      const motherId = generateId();
      const now = new Date().toISOString();
      const processedCalves: Animal[] = [];

      // Process Calves First if detected
      if (calvesData && calvesData.length > 0) {
        calvesData.forEach(calf => {
          const calfId = generateId();
          processedCalves.push({
            id: calfId,
            tagNumber: calf.tag,
            category: calf.gender === 'male' ? AnimalCategory.CALF_MALE : AnimalCategory.CALF,
            status: ReproductiveStatus.OPEN,
            farm: data.farm || FarmLocation.MILKING_FARM,
            motherId: motherId,
            image: calf.image,
            history: [{
              id: generateId(),
              type: 'GENERAL',
              date: now,
              details: `Born to Mother Tag: ${data.tagNumber}`,
            }],
            lastUpdated: now
          });
        });
      }

      let newMother: Animal = {
        id: motherId,
        tagNumber: data.tagNumber || '',
        category: data.category || AnimalCategory.MILKING,
        status: data.status || ReproductiveStatus.OPEN,
        farm: data.farm || FarmLocation.MILKING_FARM,
        inseminationDate: data.inseminationDate,
        semenName: data.semenName,
        expectedCalvingDate: data.expectedCalvingDate,
        motherId: data.motherId,
        remarks: data.remarks,
        medications: data.medications,
        calvesIds: processedCalves.map(c => c.id), // Link calves to mother
        image: data.image,
        history: [{
          id: generateId(),
          type: 'GENERAL',
          date: now,
          details: 'Animal registered'
        }],
        lastUpdated: now,
      };

      // Add Calving History to Mother if calves were added
      if (processedCalves.length > 0) {
        newMother = addHistoryEvent(newMother, {
          type: 'CALVING',
          date: now,
          details: `Registered with ${processedCalves.length} calf/calves. Tag(s): ${processedCalves.map(c => c.tagNumber).join(', ')}`,
          remarks: 'Initial Entry with Calves'
        });
      }

      if (processedCalves.length > 0) {
        onBatchSave([newMother, ...processedCalves]);
      } else {
        onSave(newMother);
      }
    }
    setIsModalOpen(false);
    setEditTarget(undefined);
  };

  const handleSold = (animal: Animal) => {
    if (confirm('Are you sure you want to mark this animal as SOLD? This will remove it from the active farm list.')) {
      let updatedAnimal = { ...animal, status: ReproductiveStatus.SOLD, lastUpdated: new Date().toISOString() };
      updatedAnimal = addHistoryEvent(updatedAnimal, {
        type: 'GENERAL',
        date: new Date().toISOString(),
        details: 'Animal SOLD OUT from farm.',
        remarks: 'Status changed to Sold'
      });
      onSave(updatedAnimal);
    }
  };

  const handleShiftFarm = (animal: Animal) => {
    const newFarm = animal.farm === FarmLocation.MILKING_FARM ? FarmLocation.HEIFER_FARM : FarmLocation.MILKING_FARM;
    const confirmMessage = `Are you sure you want to shift this animal from ${animal.farm} to ${newFarm}?`;

    if (confirm(confirmMessage)) {
      let updatedAnimal = { ...animal, farm: newFarm, lastUpdated: new Date().toISOString() };
      updatedAnimal = addHistoryEvent(updatedAnimal, {
        type: 'FARM_SHIFT',
        date: new Date().toISOString(),
        details: `Shifted from ${animal.farm} to ${newFarm}`,
        remarks: 'Manual Shift'
      });
      onSave(updatedAnimal);
    }
  };

  const handleCalving = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calvingMother || !calfTag) return;
    setIsUploading(true);

    try {
      const uploadedImageUrls: string[] = [];
      for (const file of calfImageFiles) {
        const url = await uploadImage(file);
        if (url) uploadedImageUrls.push(url);
      }

      const now = new Date().toISOString();
      const newCalf: Animal = {
        id: generateId(),
        tagNumber: calfTag,
        category: calfGender === 'male' ? AnimalCategory.CALF_MALE : AnimalCategory.CALF,
        status: ReproductiveStatus.OPEN,
        farm: calvingMother.farm,
        motherId: calvingMother.id,
        image: uploadedImageUrls[0], // Primary image
        images: uploadedImageUrls,   // Gallery
        history: [{
          id: generateId(),
          type: 'GENERAL',
          date: calvingDate,
          details: `Born to Mother Tag: ${calvingMother.tagNumber}`,
          semen: calvingMother.semenName || 'Unknown' // Pass semen info to calf history
        }],
        lastUpdated: now
      };

      // Capture previous insemination details for history BEFORE clearing them
      const previousSemen = calvingMother.semenName || 'Unknown Semen';
      const previousInsemDate = calvingMother.inseminationDate ? formatDate(calvingMother.inseminationDate) : 'Unknown Date';

      let updatedMother: Animal = {
        ...calvingMother,
        status: ReproductiveStatus.NEWLY_CALVED,
        calvingDate: calvingDate,
        expectedCalvingDate: undefined,
        inseminationDate: undefined,
        semenName: undefined, // Clear semen name as well
        calvesIds: [...(calvingMother.calvesIds || []), newCalf.id],
        lastUpdated: now
      };

      updatedMother = addHistoryEvent(updatedMother, {
        type: 'CALVING',
        date: calvingDate,
        details: `Official Calving Recorded: Produced ${calfGender === 'male' ? 'Male Calf' : 'Female Calf'} (Tag: ${calfTag}).\nCycle Info: Semen ${previousSemen} used on ${previousInsemDate}.`,
        remarks: calvingDescription,
        calfId: newCalf.id
      });

      onBatchSave([newCalf, updatedMother]);

      setIsCalvingModalOpen(false);
      setCalfTag('');
      setCalvingDescription('');
      setCalfImages([]);
      setCalfImageFiles([]);
      setCalvingDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error("Error in calving submission:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const searchedAnimal = useMemo(() => {
    if (searchQuery.length < 1) return null;
    return allAnimals.find(a => a.tagNumber.toLowerCase() === searchQuery.toLowerCase());
  }, [allAnimals, searchQuery]);

  const motherTag = useMemo(() => {
    if (!searchedAnimal?.motherId) return null;
    return allAnimals.find(a => a.id === searchedAnimal.motherId)?.tagNumber;
  }, [allAnimals, searchedAnimal]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-4 items-center no-print bg-white p-6 rounded-2xl border border-slate-300 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="Search by Tag Number..."
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-300 rounded-xl outline-none focus:border-indigo-600 font-black text-slate-900 text-xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => { setEditTarget(undefined); setIsModalOpen(true); }}
          className="bg-slate-900 text-white px-10 py-4 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-black transition-all shadow-md w-full md:w-auto text-lg"
        >
          <Plus size={24} /> New Record
        </button>
      </div>

      {searchedAnimal && (
        <div className="bg-white rounded-3xl p-8 border-4 border-slate-900 shadow-2xl animate-in slide-in-from-top-4 duration-300 relative overflow-hidden">
          <div className="flex justify-between items-start border-b-2 border-slate-100 pb-6 mb-6">
            <div className="flex items-center gap-6">
              {searchedAnimal.image && (
                <img src={searchedAnimal.image} className="w-32 h-32 rounded-2xl object-cover border-4 border-slate-100 shadow-lg" alt="Animal" />
              )}
              <div>
                <p className="text-xs font-black text-slate-500 uppercase mb-1">Tag Number</p>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter">{searchedAnimal.tagNumber}</h2>
                <div className="flex gap-2 mt-2">
                  <span className="bg-slate-100 px-3 py-1 rounded-md text-[10px] font-black text-slate-600 uppercase tracking-widest">{searchedAnimal.category}</span>
                  <span className="bg-slate-100 px-3 py-1 rounded-md text-[10px] font-black text-slate-600 uppercase tracking-widest">{searchedAnimal.farm}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`px-6 py-2 rounded-xl font-black text-lg border-2 ${searchedAnimal.status === ReproductiveStatus.PREGNANT ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                searchedAnimal.status === ReproductiveStatus.INSEMINATED ? 'bg-amber-50 text-amber-800 border-amber-200' :
                  searchedAnimal.status === ReproductiveStatus.DRY ? 'bg-blue-50 text-blue-800 border-blue-200' :
                    'bg-slate-50 text-slate-800 border-slate-300'
                }`}>
                {searchedAnimal.status}
              </span>
              <button
                onClick={() => setViewHistoryAnimal(searchedAnimal)}
                className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline"
              >
                <History size={14} /> Full History
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <SummaryItem label="Breeding Date" value={formatDate(searchedAnimal.inseminationDate || '')} />
            {motherTag && <SummaryItem label="Mother Tag" value={motherTag} />}
            <SummaryItem
              label={searchedAnimal.status === ReproductiveStatus.DRY ? "Expected Calving" : "Expected Calving"}
              value={searchedAnimal.expectedCalvingDate ? formatDate(searchedAnimal.expectedCalvingDate) : '--'}
            />
            <SummaryItem
              label="Days Left"
              value={
                searchedAnimal.expectedCalvingDate
                  ? `${getDaysToCalving(searchedAnimal.expectedCalvingDate) || '??'} Days`
                  : '--'
              }
            />
            <SummaryItem label="Last Update" value={formatDate(searchedAnimal.lastUpdated)} />
          </div>

          <div className="flex flex-wrap gap-2 justify-end pt-6 border-t border-slate-100">
            {(searchedAnimal.status === ReproductiveStatus.PREGNANT || searchedAnimal.status === ReproductiveStatus.DRY) && searchedAnimal.expectedCalvingDate && (
              <QuickActionBtn onClick={() => { setCalvingMother(searchedAnimal); setIsCalvingModalOpen(true); }} icon={<Baby size={18} />} label="Record Calving" color="blue" />
            )}
            <QuickActionBtn
              onClick={() => handleShiftFarm(searchedAnimal)}
              icon={<ArrowRightLeft size={18} />}
              label={`Shift to ${searchedAnimal.farm === FarmLocation.MILKING_FARM ? 'Cattle Farm' : 'Milking Farm'}`}
              color="amber"
            />
            <QuickActionBtn onClick={() => { setEditTarget(searchedAnimal); setIsModalOpen(true); }} icon={<Edit2 size={18} />} label="Edit Profile" color="slate" />
            {searchedAnimal.status !== ReproductiveStatus.SOLD && (
              <QuickActionBtn
                onClick={() => handleSold(searchedAnimal)}
                icon={<Wind size={18} />}
                label="Sold Out"
                color="rose"
              />
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-900 p-2 rounded-lg text-white">
              <ClipboardList size={22} />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Farm Ledger</h3>
          </div>
        </div>

        {/* MOBILE CARD VIEW (Visible < md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {animals.map(animal => {
            const daysToCalving = (animal.status === ReproductiveStatus.PREGNANT || animal.status === ReproductiveStatus.DRY) && animal.expectedCalvingDate
              ? getDaysToCalving(animal.expectedCalvingDate)
              : null;

            const daysToPregnancyCheck = animal.status === ReproductiveStatus.INSEMINATED && animal.inseminationDate
              ? getDaysToPregnancyCheck(animal.inseminationDate)
              : null;

            const daysInDry = animal.status === ReproductiveStatus.DRY
              ? getDaysSinceLastUpdate(animal.lastUpdated)
              : null;

            return (
              <div key={animal.id} className="p-4 bg-white space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-black text-2xl text-slate-900">#{animal.tagNumber}</span>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{animal.category}</span>
                      <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{animal.farm}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${animal.status === ReproductiveStatus.PREGNANT ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                    animal.status === ReproductiveStatus.INSEMINATED ? 'bg-amber-50 text-amber-800 border-amber-200' :
                      animal.status === ReproductiveStatus.DRY ? 'bg-blue-50 text-blue-800 border-blue-200' :
                        'bg-slate-50 text-slate-600 border-slate-300'
                    }`}>
                    {animal.status}
                  </span>
                </div>

                {/* Status Indicators */}
                <div className="flex flex-wrap gap-2">
                  {daysInDry !== null && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border bg-blue-50 border-blue-100">
                      <Wind size={12} className="text-blue-600" />
                      <span className="text-[10px] font-black uppercase text-blue-700">{daysInDry} days in dry</span>
                    </div>
                  )}
                  {animal.status === ReproductiveStatus.PREGNANT && getGestationDays(animal.inseminationDate!) && getGestationDays(animal.inseminationDate!)! >= 225 && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border bg-blue-100 border-blue-200 animate-pulse">
                      <Droplets size={12} className="text-blue-600" />
                      <span className="text-[10px] font-black uppercase text-blue-800">Needs Dry</span>
                    </div>
                  )}
                  {daysToCalving !== null && (
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border ${daysToCalving <= 0 ? 'bg-rose-100 border-rose-200' : 'bg-emerald-100/50 border-emerald-200'}`}>
                      <Baby size={12} className={daysToCalving <= 0 ? 'text-rose-600' : 'text-emerald-600'} />
                      <span className={`text-[10px] font-black uppercase ${daysToCalving <= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {daysToCalving <= 0 ? 'Due for Calving' : `${daysToCalving} days to delivery`}
                      </span>
                    </div>
                  )}
                  {daysToPregnancyCheck !== null && (
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border ${daysToPregnancyCheck <= 0 ? 'bg-amber-100 border-amber-200' : 'bg-blue-50 border-blue-100'}`}>
                      <Timer size={12} className={daysToPregnancyCheck <= 0 ? 'text-amber-600' : 'text-blue-600'} />
                      <span className={`text-[10px] font-black uppercase ${daysToPregnancyCheck <= 0 ? 'text-amber-700' : 'text-blue-700'}`}>
                        {daysToPregnancyCheck <= 0 ? 'Check Required' : `${daysToPregnancyCheck} days to check`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-50 no-print">
                  <button onClick={() => setViewHistoryAnimal(animal)} className="flex-1 py-2 bg-slate-50 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-100 transition-colors">History</button>
                  <button onClick={() => handleShiftFarm(animal)} className="flex-1 py-2 bg-amber-50 text-amber-600 rounded-xl font-black text-xs uppercase hover:bg-amber-100 transition-colors">Shift</button>
                  <button onClick={() => { setEditTarget(animal); setIsModalOpen(true); }} className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs uppercase hover:bg-indigo-100 transition-colors">Edit</button>
                  <button onClick={() => handleDelete(animal.id)} className="w-10 flex items-center justify-center bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>

        {/* DESKTOP TABLE VIEW (Visible >= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-200">
                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-center w-12">ID Tag</th>
                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Type / Location</th>
                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-center">Status / cycle info</th>
                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-center no-print">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {animals.map(animal => {
                const daysToCalving = (animal.status === ReproductiveStatus.PREGNANT || animal.status === ReproductiveStatus.DRY) && animal.expectedCalvingDate
                  ? getDaysToCalving(animal.expectedCalvingDate)
                  : null;

                const daysToPregnancyCheck = animal.status === ReproductiveStatus.INSEMINATED && animal.inseminationDate
                  ? getDaysToPregnancyCheck(animal.inseminationDate)
                  : null;

                const daysGestation = (animal.status === ReproductiveStatus.PREGNANT || animal.status === ReproductiveStatus.DRY) && animal.inseminationDate
                  ? getGestationDays(animal.inseminationDate)
                  : null;

                const daysInDry = animal.status === ReproductiveStatus.DRY
                  ? getDaysSinceLastUpdate(animal.lastUpdated)
                  : null;

                return (
                  <tr key={animal.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 text-center">
                      <span className="font-black text-slate-900 bg-white border-2 border-slate-200 px-4 py-2 rounded-xl shadow-sm group-hover:border-indigo-400 transition-all">{animal.tagNumber}</span>
                    </td>
                    <td className="p-4">
                      <p className="font-black text-slate-800 text-sm">{animal.category}</p>
                      <p className="text-[10px] text-slate-400 font-black uppercase">{animal.farm}</p>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${animal.status === ReproductiveStatus.PREGNANT ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          animal.status === ReproductiveStatus.INSEMINATED ? 'bg-amber-50 text-amber-800 border-amber-200' :
                            animal.status === ReproductiveStatus.DRY ? 'bg-blue-50 text-blue-800 border-blue-200' :
                              'bg-slate-50 text-slate-600 border-slate-300'
                          }`}>
                          {animal.status}
                        </span>

                        {daysInDry !== null && (
                          <div className="flex items-center gap-1.5 mt-1 px-3 py-0.5 rounded-lg border bg-blue-50 border-blue-100">
                            <Wind size={12} className="text-blue-600" />
                            <span className="text-[10px] font-black uppercase text-blue-700">
                              {daysInDry} days in dry
                            </span>
                          </div>
                        )}

                        {animal.status === ReproductiveStatus.PREGNANT && daysGestation !== null && daysGestation >= 225 && (
                          <div className="flex items-center gap-1.5 mt-1 px-3 py-0.5 rounded-lg border bg-blue-100 border-blue-200 animate-pulse">
                            <Droplets size={12} className="text-blue-600" />
                            <span className="text-[10px] font-black uppercase text-blue-800">
                              Needs Dry (7.5+ Months)
                            </span>
                          </div>
                        )}

                        {daysToCalving !== null && (
                          <div className={`flex items-center gap-1.5 mt-1 px-3 py-0.5 rounded-lg border ${daysToCalving <= 0 ? 'bg-rose-100 border-rose-200' : 'bg-emerald-100/50 border-emerald-200'}`}>
                            <Baby size={12} className={daysToCalving <= 0 ? 'text-rose-600' : 'text-emerald-600'} />
                            <span className={`text-[10px] font-black uppercase ${daysToCalving <= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {daysToCalving <= 0 ? 'Due for Calving' : `${daysToCalving} days to delivery`}
                            </span>
                          </div>
                        )}

                        {daysToPregnancyCheck !== null && (
                          <div className={`flex items-center gap-1.5 mt-1 px-3 py-0.5 rounded-lg border ${daysToPregnancyCheck <= 0 ? 'bg-amber-100 border-amber-200' : 'bg-blue-50 border-blue-100'}`}>
                            <Timer size={12} className={daysToPregnancyCheck <= 0 ? 'text-amber-600' : 'text-blue-600'} />
                            <span className={`text-[10px] font-black uppercase ${daysToPregnancyCheck <= 0 ? 'text-amber-700' : 'text-blue-700'}`}>
                              {daysToPregnancyCheck <= 0 ? 'Check Required' : `${daysToPregnancyCheck} days to check`}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 no-print text-center">
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => setViewHistoryAnimal(animal)} className="p-2.5 hover:bg-slate-200 text-slate-500 rounded-xl border border-slate-200 transition-all" title="History"><History size={18} /></button>
                        <button
                          onClick={() => handleShiftFarm(animal)}
                          className="p-2.5 hover:bg-amber-50 text-amber-600 rounded-xl border border-slate-200 transition-all"
                          title={`Shift to ${animal.farm === FarmLocation.MILKING_FARM ? 'Cattle Farm' : 'Milking Farm'}`}
                        >
                          <ArrowRightLeft size={18} />
                        </button>
                        <button onClick={() => { setEditTarget(animal); setIsModalOpen(true); }} className="p-2.5 hover:bg-indigo-50 text-indigo-600 rounded-xl border border-slate-200 transition-all" title="Edit"><Edit2 size={18} /></button>
                        <button onClick={() => handleDelete(animal.id)} className="p-2.5 hover:bg-red-50 text-red-600 rounded-xl border border-slate-200 transition-all" title="Delete"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {viewHistoryAnimal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-10 border-b-2 border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="bg-indigo-900 text-white p-4 rounded-3xl shadow-xl">
                  <History size={28} />
                </div>
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
                    <div className="absolute top-0 -left-[50px] w-8 h-8 rounded-full bg-white border-4 border-slate-200 z-10 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                    </div>
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
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{formatDate(event.date)}</span>
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

                            // Legacy Parsing
                            if (!semenName && event.details && event.details.includes('Inseminated with')) {
                              const match = event.details.match(/Inseminated with (.*)/);
                              if (match && match[1]) semenName = match[1];
                            }
                            if (!calfTagInfo && event.details && event.details.includes('Tag:')) {
                              const match = event.details.match(/Tag: ([^)]+)/);
                              if (match && match[1]) calfTagInfo = match[1];
                            }

                            // --- Logic to Find Semen for "Born to" events (Child's Perspective) ---
                            if (!semenName && event.details.includes('Born to Mother Tag:')) {
                              // Use the robust helper
                              const derivedSire = getSireInfo(viewHistoryAnimal, allAnimals);
                              if (derivedSire) semenName = derivedSire;
                            }

                            return (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-3">
                                {semenName && (
                                  <div className="flex items-center gap-3 bg-white/60 px-4 py-2 rounded-xl border border-slate-200/50">
                                    <div className="p-1 bg-white rounded-lg shadow-sm"><Activity size={14} className="text-indigo-600" /></div>
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black uppercase tracking-widest leading-none opacity-50">Semen / Sire</span>
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

            <div className="p-10 border-t bg-slate-50 flex justify-between items-center no-print">
              <button
                onClick={() => handleShiftFarm(viewHistoryAnimal)}
                className="bg-amber-100 text-amber-900 px-8 py-4 rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-sm hover:bg-amber-200 transition-colors flex items-center gap-3"
              >
                <ArrowRightLeft size={20} /> Shift Farm
              </button>
              <button onClick={() => setViewHistoryAnimal(null)} className="bg-slate-900 text-white px-12 py-4 rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-xl">Close Ledger</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && <AnimalFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} initialData={editTarget} activeFarmSelection={activeFarm !== 'all' ? activeFarm : undefined} mothersList={[]} />}

      {isCalvingModalOpen && calvingMother && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border-t-[15px] border-blue-600">
            <div className="p-10">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Record Official Calving</h3>
                <button onClick={() => setIsCalvingModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={32} /></button>
              </div>
              <form onSubmit={handleCalving} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Actual Calving Date</label>
                    <input
                      type="date" required
                      className="w-full px-5 py-4 border-2 border-slate-200 rounded-2xl font-bold"
                      value={calvingDate} onChange={(e) => setCalvingDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Calf Tag ID</label>
                    <input
                      required type="text" placeholder="e.g., C-101"
                      className="w-full px-5 py-4 border-2 border-slate-200 rounded-2xl font-black text-slate-900 text-2xl focus:border-blue-600"
                      value={calfTag} onChange={(e) => setCalfTag(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Calf Photos (بچھڑے کی تصاویر)</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="cursor-pointer bg-slate-100 border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 w-24 h-24 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all">
                      <Camera size={20} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Add</span>
                      <input type="file" accept="image/*" multiple onChange={handleCalfImageUpload} className="hidden" />
                    </label>
                    {calfImages.map((img, idx) => (
                      <div key={idx} className="relative group w-24 h-24">
                        <img src={img} className="w-full h-full rounded-2xl object-cover border-2 border-slate-200 shadow-sm" />
                        <button type="button" onClick={() => removeCalfImage(idx)} className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md transform hover:scale-110">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex bg-slate-50 p-2 rounded-[1.5rem] border-2 border-slate-100">
                  <button type="button" onClick={() => setCalfGender('female')} className={`flex-1 py-4 rounded-2xl font-black transition-all ${calfGender === 'female' ? 'bg-white text-indigo-800 shadow-xl' : 'text-slate-400'}`}>Female</button>
                  <button type="button" onClick={() => setCalfGender('male')} className={`flex-1 py-4 rounded-2xl font-black transition-all ${calfGender === 'male' ? 'bg-white text-indigo-800 shadow-xl' : 'text-slate-400'}`}>Male</button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Calving Description / Remarks</label>
                  <textarea
                    rows={3}
                    className="w-full px-5 py-4 border-2 border-slate-200 rounded-2xl font-bold"
                    placeholder="Enter details about the calving process..."
                    value={calvingDescription} onChange={(e) => setCalvingDescription(e.target.value)}
                  />
                </div>

                <button type="submit" disabled={isUploading} className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black flex items-center justify-center gap-5 hover:bg-blue-700 shadow-2xl text-2xl transition-all disabled:opacity-70">
                  <Save size={32} /> {isUploading ? 'Uploading & Saving...' : 'Confirm Birth Record'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryItem = ({ label, value }: any) => (
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
    <p className="text-lg font-black text-slate-800 tracking-tight">{value}</p>
  </div>
);

const QuickActionBtn = ({ onClick, icon, label, color }: any) => {
  const styles: any = {
    blue: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-400',
    amber: 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300',
    slate: 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300'
  };
  return (
    <button onClick={onClick} className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all border-b-4 shadow-sm ${styles[color]}`}>
      {icon} {label}
    </button>
  );
};

export default AnimalManager;
