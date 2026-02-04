
import React, { useState, useEffect } from 'react';
import { X, Save, Milk, MapPin, Camera, Baby, Plus, Trash2 } from 'lucide-react'; // Added Baby, Plus, Trash2
import { Animal, AnimalCategory, ReproductiveStatus, FarmLocation } from '../types';
import { calculateCalvingDate } from '../utils/helpers';
import { uploadImage } from '../utils/storage';

interface AnimalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Animal>, calvesData?: any[]) => void; // Updated signature
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
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // New State for Calves
  const [showCalfEntry, setShowCalfEntry] = useState(false);
  const [calves, setCalves] = useState<{ tag: string; gender: 'male' | 'female'; imageFile: File | null; imagePreview: string | null }[]>([
    { tag: '', gender: 'female', imageFile: null, imagePreview: null }
  ]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setShowCalfEntry(false); // Reset calf entry on edit
    } else if (activeFarmSelection) {
      const initialCat = activeFarmSelection === FarmLocation.MILKING_FARM ? AnimalCategory.MILKING : AnimalCategory.CATTLE;
      const initialStatus = (initialCat === AnimalCategory.CATTLE)
        ? ReproductiveStatus.OTHER
        : ReproductiveStatus.OPEN;

      setFormData(prev => ({ ...prev, farm: activeFarmSelection, category: initialCat, status: initialStatus }));
      setShowCalfEntry(false);
    }
  }, [initialData, activeFarmSelection]);

  // Helpers for render and logic (Moved up for validation access)
  const isMaleCategory = formData.category === AnimalCategory.CALF_MALE || formData.category === AnimalCategory.CATTLE;
  // Allow calf details for eligible categories (both Create and Edit)
  const canHaveCalves = !isMaleCategory && (formData.category === AnimalCategory.MILKING || formData.status === ReproductiveStatus.NEWLY_CALVED);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      const finalData = { ...formData };

      // Handle Main Image Upload
      if (selectedImageFile) {
        try {
          const imageUrl = await uploadImage(selectedImageFile);
          finalData.image = imageUrl;
        } catch (err: any) {
          alert(`Failed to upload main image: ${err.message || 'Unknown error'}`);
          setIsUploading(false);
          return;
        }
      }

      if (finalData.status === ReproductiveStatus.PREGNANT && finalData.inseminationDate) {
        const calvingDate = calculateCalvingDate(finalData.inseminationDate);
        if (calvingDate) finalData.expectedCalvingDate = calvingDate.toISOString();
      }

      // Prepare calf data if applicable
      let calvesDataToSubmit = undefined;
      if (showCalfEntry && canHaveCalves) {
        calvesDataToSubmit = [];
        for (const calf of calves) {
          if (calf.tag) {
            let calfImageUrl = null;
            if (calf.imageFile) {
              try {
                calfImageUrl = await uploadImage(calf.imageFile);
              } catch (err: any) {
                alert(`Failed to upload image for calf ${calf.tag}: ${err.message}. Aborting save.`);
                setIsUploading(false);
                return;
              }
            }
            calvesDataToSubmit.push({
              tag: calf.tag,
              gender: calf.gender,
              image: calfImageUrl
            });
          }
        }
      }

      onSave(finalData, calvesDataToSubmit);
    } catch (error: any) {
      console.error("Error saving form:", error);
      alert(`An error occurred while saving: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(p => ({ ...p, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Calf Image Upload Handler
  const handleCalfImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newCalves = [...calves];
        newCalves[index].imageFile = file;
        newCalves[index].imagePreview = reader.result as string;
        setCalves(newCalves);
      };
      reader.readAsDataURL(file);
    }
  };

  const addCalfSlot = () => {
    setCalves([...calves, { tag: '', gender: 'female', imageFile: null, imagePreview: null }]);
  };

  const removeCalfSlot = (index: number) => {
    setCalves(calves.filter((_, i) => i !== index));
  };

  const updateCalfField = (index: number, field: keyof typeof calves[0], value: any) => {
    const newCalves = [...calves];
    (newCalves[index] as any)[field] = value;
    setCalves(newCalves);
  };



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

  const handleCategoryChange = (cat: AnimalCategory) => {
    const isNowMale = cat === AnimalCategory.CALF_MALE || cat === AnimalCategory.CATTLE;
    let newStatus = formData.status;

    if (isNowMale) {
      if (!maleStatuses.find(m => m.s === formData.status)) {
        newStatus = ReproductiveStatus.OTHER;
      }
    } else {
      if (!femaleStatuses.find(f => f.s === formData.status)) {
        newStatus = ReproductiveStatus.OPEN;
      }
    }

    setFormData(p => ({ ...p, category: cat, status: newStatus as ReproductiveStatus }));
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
              onChange={(e) => setFormData(p => ({ ...p, tagNumber: e.target.value }))}
              className="w-full px-6 py-5 border-2 rounded-2xl text-4xl font-black text-slate-900 focus:border-indigo-600 outline-none shadow-sm"
              placeholder="000"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <Camera size={18} className="text-slate-400" /> Photo (تصویر)
            </label>
            <div className="flex items-center gap-6">
              <label className="cursor-pointer bg-slate-100 border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 px-6 py-4 rounded-2xl flex flex-col items-center gap-2 transition-all">
                <Camera size={24} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Upload</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
              {formData.image ? (
                <div className="relative group">
                  <img src={formData.image} alt="Preview" className="w-24 h-24 rounded-2xl object-cover border-2 border-indigo-200 shadow-md" />
                  <button type="button" onClick={() => setFormData(p => ({ ...p, image: undefined }))} className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-300 text-xs font-bold uppercase">No Image</div>
              )}
            </div>
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
                  key={item.s} type="button" onClick={() => setFormData(p => ({ ...p, status: item.s }))}
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
                  value={formData.inseminationDate} onChange={(e) => setFormData(p => ({ ...p, inseminationDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-indigo-900">Semen Used (ٹیکہ کا نام)</label>
                <input
                  className="w-full px-5 py-3.5 border-2 rounded-xl font-black text-slate-900"
                  value={formData.semenName} onChange={(e) => setFormData(p => ({ ...p, semenName: e.target.value }))}
                  placeholder="e.g. Bull #99"
                />
              </div>
            </div>
          )}

          {/* ADD CALF ENTRY SECTION */}
          {canHaveCalves && (
            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCalfEntry(!showCalfEntry)}
                className="flex items-center gap-2 text-indigo-600 font-black uppercase text-xs tracking-widest hover:underline mb-4"
              >
                <Baby size={16} />
                {showCalfEntry ? "Don't Add Calf Details" : "Add Calf Details (If Applicable)"}
              </button>

              {showCalfEntry && (
                <div className="space-y-6 bg-slate-50 p-6 rounded-3xl border border-slate-200 animate-in slide-in-from-top-2">
                  <h4 className="font-black text-slate-800 flex items-center gap-2"><Baby size={20} /> Calf Details</h4>
                  {calves.map((calf, idx) => (
                    <div key={idx} className="relative bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      {calves.length > 1 && (
                        <button type="button" onClick={() => removeCalfSlot(idx)} className="absolute top-2 right-2 text-rose-500 hover:bg-rose-50 p-1 rounded-full"><Trash2 size={16} /></button>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calf Tag</label>
                          <input
                            value={calf.tag}
                            onChange={(e) => updateCalfField(idx, 'tag', e.target.value)}
                            placeholder="Tag ID"
                            className="w-full px-4 py-3 border-2 rounded-xl font-black text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sex</label>
                          <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button type="button" onClick={() => updateCalfField(idx, 'gender', 'female')} className={`flex-1 py-2 rounded-lg font-bold text-xs ${calf.gender === 'female' ? 'bg-white shadow text-indigo-800' : 'text-slate-400'}`}>Female</button>
                            <button type="button" onClick={() => updateCalfField(idx, 'gender', 'male')} className={`flex-1 py-2 rounded-lg font-bold text-xs ${calf.gender === 'male' ? 'bg-white shadow text-indigo-800' : 'text-slate-400'}`}>Male</button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {calf.imagePreview ? (
                          <img src={calf.imagePreview} className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                        ) : <div className="w-16 h-16 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center"><Camera size={16} className="text-slate-300" /></div>}
                        <label className="cursor-pointer bg-slate-100 px-4 py-2 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-200">
                          Upload Photo
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCalfImageUpload(idx, e)} />
                        </label>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addCalfSlot} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl font-bold text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                    <Plus size={16} /> Add Another Calf (Twins)
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label>Notes & Medications (دیگر معلومات / ادویات)</label>
            <textarea
              rows={3}
              className="w-full px-6 py-5 border-2 rounded-2xl font-bold text-slate-900 focus:border-indigo-600 outline-none"
              value={formData.remarks}
              onChange={(e) => setFormData(p => ({ ...p, remarks: e.target.value }))}
              placeholder="Details here..."
            />
          </div>

          <div className="flex gap-4 pt-6">
            <button type="button" onClick={onClose} disabled={isUploading} className="flex-1 py-5 bg-slate-100 text-slate-900 rounded-3xl font-black text-lg">Cancel</button>
            <button type="submit" disabled={isUploading} className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black flex items-center justify-center gap-4 hover:bg-black shadow-xl text-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed">
              <Save size={28} /> {isUploading ? 'Uploading...' : 'Confirm Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AnimalFormModal;
