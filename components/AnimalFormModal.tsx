
import React, { useState, useEffect } from 'react';
import { X, Save, Milk, MapPin } from 'lucide-react';
import { Animal, AnimalCategory, ReproductiveStatus, FarmLocation } from '../types';
import { calculateCalvingDate } from '../utils/helpers';

interface AnimalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Animal>) => void;
  initialData?: Animal;
  activeFarmSelection?: FarmLocation;
  mothersList: Animal[];
}

const AnimalFormModal: React.FC<AnimalFormModalProps> = ({ 
  isOpen, onClose, onSave, initialData, activeFarmSelection, mothersList
}) => {
  const [formData, setFormData] = useState<Partial<Animal>>({
    tagNumber: '',
    category: AnimalCategory.MILKING,
    status: ReproductiveStatus.OPEN,
    farm: activeFarmSelection || FarmLocation.MILKING_FARM,
    inseminationDate: '',
    semenName: '',
    remarks: '',
    medications: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else if (activeFarmSelection) {
      const initialCat = activeFarmSelection === FarmLocation.MILKING_FARM ? AnimalCategory.MILKING : AnimalCategory.CATTLE;
      // Set a default status based on the category
      // Fix: Remove redundant CALF_MALE check since initialCat can only be MILKING or CATTLE here
      const initialStatus = (initialCat === AnimalCategory.CATTLE) 
        ? ReproductiveStatus.OTHER 
        : ReproductiveStatus.OPEN;
        
      setFormData(prev => ({ ...prev, farm: activeFarmSelection, category: initialCat, status: initialStatus }));
    }
  }, [initialData, activeFarmSelection]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = { ...formData };
    if (finalData.status === ReproductiveStatus.PREGNANT && finalData.inseminationDate) {
      const calvingDate = calculateCalvingDate(finalData.inseminationDate);
      if (calvingDate) finalData.expectedCalvingDate = calvingDate.toISOString();
    }
    onSave(finalData);
  };

  const isMaleCategory = formData.category === AnimalCategory.CALF_MALE || formData.category === AnimalCategory.CATTLE;

  // Breeding status options based on gender/category
  const femaleStatuses = [
    { s: ReproductiveStatus.OPEN, u: 'خالی' },
    { s: ReproductiveStatus.INSEMINATED, u: 'ٹیکہ لگا ہوا' },
    { s: ReproductiveStatus.PREGNANT, u: 'گابھن' },
    { s: ReproductiveStatus.DRY, u: 'خشک' },
    { s: ReproductiveStatus.NEWLY_CALVED, u: 'تازہ سوئی ہوئی' },
    { s: ReproductiveStatus.CHILD, u: 'بچہ' }
  ];

  const maleStatuses = [
    { s: ReproductiveStatus.BREEDING_BULL, u: 'ببری سانڈ' },
    { s: ReproductiveStatus.OTHER, u: 'دیگر' }
  ];

  const activeStatusOptions = isMaleCategory ? maleStatuses : femaleStatuses;

  // Auto-correct status if category changes and current status is invalid for that gender
  const handleCategoryChange = (cat: AnimalCategory) => {
    const isNowMale = cat === AnimalCategory.CALF_MALE || cat === AnimalCategory.CATTLE;
    let newStatus = formData.status;
    
    if (isNowMale) {
      // If was female status, switch to male
      if (!maleStatuses.find(m => m.s === formData.status)) {
        newStatus = ReproductiveStatus.OTHER;
      }
    } else {
      // If was male status, switch to female
      if (!femaleStatuses.find(f => f.s === formData.status)) {
        newStatus = ReproductiveStatus.OPEN;
      }
    }
    
    setFormData(p => ({...p, category: cat, status: newStatus as ReproductiveStatus}));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-8 border-b-2 bg-slate-50 flex items-center justify-between border-slate-100">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Milk size={24} className="text-white" />
            </div>
            <h3 className="font-black text-slate-900 text-2xl">{initialData ? 'Update Record' : 'Register Animal'}</h3>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-200 text-slate-900 rounded-full hover:bg-slate-300 transition-all"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto max-h-[80vh] bg-white">
          <div className="space-y-2">
            <label>Tag Number (ٹیگ نمبر)</label>
            <input 
              required autoFocus value={formData.tagNumber}
              onChange={(e) => setFormData(p => ({...p, tagNumber: e.target.value}))}
              className="w-full px-6 py-5 border-2 rounded-2xl text-4xl font-black text-slate-900 focus:border-indigo-600 outline-none shadow-sm"
              placeholder="000"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label>Location (فارم کی جگہ)</label>
              <div className="px-5 py-4 bg-slate-100 border-2 border-slate-200 rounded-2xl font-black text-slate-900 flex items-center gap-3">
                <MapPin size={20} className="text-indigo-600" /> {formData.farm}
              </div>
            </div>
            
            <div className="space-y-2">
              <label>Category (جانور کی قسم)</label>
              <select 
                className="w-full px-5 py-4 border-2 rounded-2xl font-black text-slate-900 text-lg focus:border-indigo-600"
                value={formData.category} 
                onChange={(e) => handleCategoryChange(e.target.value as AnimalCategory)}
              >
                <option value={AnimalCategory.MILKING}>Milking (دودھ والی)</option>
                <option value={AnimalCategory.HEIFER}>Heifer (بچھڑی)</option>
                <option value={AnimalCategory.CATTLE}>Cattle (گائے/بیل)</option>
                <option value={AnimalCategory.CALF}>Female Calf (بچھیا)</option>
                <option value={AnimalCategory.CALF_MALE}>Male Calf (بچھڑا)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label>Breeding Status (جانور کی حالت)</label>
            <div className="grid grid-cols-2 gap-3">
              {activeStatusOptions.map(item => (
                <button
                  key={item.s} type="button" onClick={() => setFormData(p => ({...p, status: item.s}))}
                  className={`p-4 rounded-2xl border-2 font-black text-xs transition-all flex flex-col items-center ${formData.status === item.s ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-indigo-400'}`}
                >
                  <span>{item.s}</span>
                  <span className="text-[10px] font-bold mt-1 opacity-70">({item.u})</span>
                </button>
              ))}
            </div>
          </div>

          {!isMaleCategory && (formData.status === ReproductiveStatus.INSEMINATED || formData.status === ReproductiveStatus.PREGNANT) && (
            <div className="p-8 bg-indigo-50/50 rounded-3xl border-2 border-indigo-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-indigo-900">Insemination Date (ٹیکہ کی تاریخ)</label>
                <input 
                  type="date" className="w-full px-5 py-3.5 border-2 rounded-xl font-black text-slate-900"
                  value={formData.inseminationDate} onChange={(e) => setFormData(p => ({...p, inseminationDate: e.target.value}))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-indigo-900">Semen Used (ٹیکہ کا نام)</label>
                <input 
                  className="w-full px-5 py-3.5 border-2 rounded-xl font-black text-slate-900"
                  value={formData.semenName} onChange={(e) => setFormData(p => ({...p, semenName: e.target.value}))}
                  placeholder="e.g. Bull #99"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label>Notes & Medications (دیگر معلومات / ادویات)</label>
            <textarea 
              rows={3}
              className="w-full px-6 py-5 border-2 rounded-2xl font-bold text-slate-900 focus:border-indigo-600 outline-none"
              value={formData.remarks}
              onChange={(e) => setFormData(p => ({...p, remarks: e.target.value}))}
              placeholder="Details here..."
            />
          </div>

          <div className="flex gap-4 pt-6">
            <button type="button" onClick={onClose} className="flex-1 py-5 bg-slate-100 text-slate-900 rounded-3xl font-black text-lg">Cancel</button>
            <button type="submit" className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black flex items-center justify-center gap-4 hover:bg-black shadow-xl text-xl transition-all">
              <Save size={28} /> Confirm Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AnimalFormModal;
