
import React, { useState, useMemo } from 'react';
import { Milk, Search, Save, History, CheckCircle2, Loader2, Calendar, Plus, X, Wind, Timer, Activity, Baby, ChevronRight } from 'lucide-react';
import { Animal, MilkRecord, AnimalCategory, ReproductiveStatus, HistoryEvent } from '../types';
import { formatDate, generateId } from '../utils/helpers';
import { supabase } from '../lib/supabase';
// @ts-ignore
import Tesseract from 'tesseract.js';
import AnimalFormModal from './AnimalFormModal';

interface MilkManagerProps {
    allAnimals: Animal[];
    onSaveMilkRecords: (records: MilkRecord[]) => Promise<void>;
    onLoadDetails: (id: string) => void;
    onSave: (animal: Animal, calves?: any[]) => Promise<void>;
    onBatchSave: (animals: Animal[]) => Promise<void>;
    onDelete: (id: string) => void;
}

const MilkManager: React.FC<MilkManagerProps> = ({
    allAnimals,
    onSaveMilkRecords,
    onLoadDetails,
    onSave,
    onBatchSave,
    onDelete
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [milkEntries, setMilkEntries] = useState<Record<string, { morning: string; evening: string }>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [manuallyAddedAnimalIds, setManuallyAddedAnimalIds] = useState<Set<string>>(new Set());
    const [manuallyRemovedAnimalIds, setManuallyRemovedAnimalIds] = useState<Set<string>>(new Set());
    const [addAnimalSearch, setAddAnimalSearch] = useState('');
    const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
    const [isAnimalModalOpen, setIsAnimalModalOpen] = useState(false);
    const [editTargetId, setEditTargetId] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const editTarget = useMemo(() => {
        return allAnimals.find(a => a.id === editTargetId);
    }, [allAnimals, editTargetId]);

    const addHistoryEvent = (animal: Animal, event: Omit<HistoryEvent, 'id'>): Animal => {
        const newEvent: HistoryEvent = { ...event, id: generateId() };
        return {
            ...animal,
            history: [newEvent, ...(animal.history || [])],
            lastUpdated: new Date().toISOString()
        };
    };

    const handleSaveAnimal = async (data: Partial<Animal>, calvesData?: any[]) => {
        if (editTarget) {
            let updatedAnimal: Animal = { ...editTarget, ...data, lastUpdated: new Date().toISOString() };
            if (data.status && data.status !== editTarget.status) {
                updatedAnimal = addHistoryEvent(updatedAnimal, {
                    type: 'GENERAL',
                    date: new Date().toISOString(),
                    details: `Status manually changed to: ${data.status}`,
                    remarks: data.remarks
                });
            }
            await onSave(updatedAnimal, calvesData);
        } else {
            // New animal
            const newAnimalId = generateId();
            const now = new Date().toISOString();
            let newAnimal: Animal = {
                id: newAnimalId,
                tagNumber: data.tagNumber || '',
                name: data.name,
                category: data.category || AnimalCategory.MILKING,
                status: data.status || ReproductiveStatus.OPEN,
                farm: data.farm || allAnimals[0]?.farm || 'Farm',
                history: [{
                    id: generateId(),
                    type: 'GENERAL',
                    date: now,
                    details: 'Animal registered from Milk Manager'
                }],
                lastUpdated: now,
                ...data
            };
            await onSave(newAnimal, calvesData);
            setManuallyAddedAnimalIds(prev => new Set(prev).add(newAnimal.id));
        }
        setIsAnimalModalOpen(false);
        setEditTargetId(null);
    };

    const handleDeleteAnimal = async (id: string) => {
        if (window.confirm("Are you sure you want to permanently delete this animal?")) {
            await onDelete(id);
        }
    };

    // Eligible animals: Milking category OR Newly Calved status, plus manual overrides
    const eligibleAnimals = useMemo(() => {
        const autoEligible = allAnimals.filter(a =>
            (a.category === AnimalCategory.MILKING || a.status === ReproductiveStatus.NEWLY_CALVED) &&
            a.status !== ReproductiveStatus.SOLD
        );
        const addedAnimals = allAnimals.filter(a => manuallyAddedAnimalIds.has(a.id));
        
        const combined = [...autoEligible];
        addedAnimals.forEach(a => {
            if (!combined.some(c => c.id === a.id)) combined.push(a);
        });

        return combined.filter(a => !manuallyRemovedAnimalIds.has(a.id));
    }, [allAnimals, manuallyAddedAnimalIds, manuallyRemovedAnimalIds]);

    const filteredAnimals = useMemo(() => {
        return eligibleAnimals.filter(a =>
            a.tagNumber.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [eligibleAnimals, searchQuery]);

    const handleMilkChange = (animalId: string, shift: 'morning' | 'evening', value: string) => {
        setMilkEntries(prev => {
            const current = prev[animalId] || { morning: '', evening: '' };
            return {
                ...prev,
                [animalId]: {
                    ...current,
                    [shift]: value
                }
            };
        });
    };

    const calculateTotal = (animalId: string) => {
        const entry = milkEntries[animalId];
        if (!entry) return 0;
        return (parseFloat(entry.morning) || 0) + (parseFloat(entry.evening) || 0);
    };

    const preprocessImage = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(e.target?.result as string);
                        return;
                    }

                    canvas.width = img.width;
                    canvas.height = img.height;

                    // Draw image
                    ctx.drawImage(img, 0, 0);

                    // Apply Grayscale and Contrast
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;

                    for (let i = 0; i < data.length; i += 4) {
                        // Grayscale
                        const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);

                        // Contrast (Simple linear contrast enhancement)
                        const contrast = 1.2; // 1.1 to 2.0
                        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                        const newValue = factor * (avg - 128) + 128;

                        data[i] = newValue;
                        data[i + 1] = newValue;
                        data[i + 2] = newValue;
                    }

                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        setScanProgress(0);

        try {
            // Preprocess image for better OCR
            const processedImageData = await preprocessImage(file);

            const { data: { text } } = await Tesseract.recognize(processedImageData, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') setScanProgress(m.progress);
                }
            });

            processOCRText(text);
        } catch (err) {
            console.error("OCR Error:", err);
            alert("Failed to scan image. Please try again with a clearer photo.");
        } finally {
            setIsScanning(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const normalize = (s: string) => {
        let res = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return res
            .replace(/O/g, '0')
            .replace(/I/g, '1')
            .replace(/L/g, '1')
            .replace(/S/g, '5')
            .replace(/G/g, '6')
            .replace(/B/g, '8')
            .replace(/Z/g, '2');
    };

    const fuzzyMatchToken = (token: string, tag: string): boolean => {
        const normToken = normalize(token);
        const normTag = normalize(tag);
        if (!normTag || !normToken) return false;
        // Exact match instead of .includes prevents "1" from grabbing "10"'s data
        return normToken === normTag;
    };

    const processOCRText = (text: string) => {
        const newEntries = { ...milkEntries };
        let matchCount = 0;
        const foundAnimalIds = new Set<string>();

        // 1. Strict Line-by-Line Match (Primary)
        const rawLines = text.split('\n');
        rawLines.forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine.length < 2) return;

            // Look for a pattern that resembles 3 consecutive tokens: ID, Morning, Evening
            // E.g. "101 12.5 10.0"
            const tokens = cleanLine.split(/[\s,;|:]+/).filter(t => t.length > 0);
            
            // Try to match specific row format if possible
            if (tokens.length >= 3) {
                // Check if the last two or three tokens are numbers
                const numbersFound = cleanLine.replace(/,/g, '.').match(/(\d+(\.\d+)?)/g);
                if (numbersFound && numbersFound.length >= 2) {
                   eligibleAnimals.forEach(animal => {
                       if (foundAnimalIds.has(animal.id)) return;
                       
                       const tagFound = tokens.some(token => fuzzyMatchToken(token, animal.tagNumber));
                       if (tagFound) {
                           // Extract the milk values (assuming they are the numbers that aren't the tag)
                           const nonTagNumbers = numbersFound.filter(num => !fuzzyMatchToken(num, animal.tagNumber));
                           if (nonTagNumbers.length > 0) {
                               newEntries[animal.id] = { 
                                   morning: nonTagNumbers[0] || '', 
                                   evening: nonTagNumbers[1] || '' 
                               };
                               foundAnimalIds.add(animal.id);
                               matchCount++;
                           }
                       }
                   });
                }
            }
        });

        // 2. Token Flow Fallback (checks across lines if a tag was misread or split)
        const allTokens = text.replace(/,/g, '.').split(/[\s\n]+/).filter(t => t.trim().length > 0);
        
        eligibleAnimals.forEach(animal => {
            if (foundAnimalIds.has(animal.id)) return;
            const tIndex = allTokens.findIndex(t => fuzzyMatchToken(t, animal.tagNumber));
            
            if (tIndex !== -1) {
                let mNum = '';
                let eNum = '';
                
                for (let i = tIndex + 1; i < Math.min(tIndex + 6, allTokens.length); i++) {
                    const isNum = /^(\d+(\.\d+)?)$/.test(allTokens[i]);
                    const isAnotherTag = eligibleAnimals.some(a => a.id !== animal.id && fuzzyMatchToken(allTokens[i], a.tagNumber));
                    
                    if (isNum && !isAnotherTag) {
                        if (!mNum) mNum = allTokens[i];
                        else if (!eNum) { eNum = allTokens[i]; break; }
                    }
                }
                
                if (mNum || eNum) {
                    newEntries[animal.id] = { morning: mNum || '', evening: eNum || '' };
                    foundAnimalIds.add(animal.id);
                    matchCount++;
                }
            }
        });

        if (matchCount > 0) {
            setMilkEntries(newEntries);
            window.alert(`AI Scanner (v3.0 - Deep Scan): Successfully analyzed image and verified recordings for ${matchCount} animals using intelligent multi-pass scanning.\nPlease double check the highlighted fields.`);
        } else {
            alert("AI Scanner could not locate any recognized Tag IDs or milk values. Please ensure you are following the formatting criteria by clicking 'How to format sheet?'.");
        }
    };

    const handleSaveAll = async () => {
        const recordsToSave: MilkRecord[] = [];
        const now = new Date().toISOString();

        Object.entries(milkEntries).forEach(([animalId, entry]: [string, { morning: string; evening: string }]) => {
            const animal = allAnimals.find(a => a.id === animalId);
            if (!animal) return;

            const morning = parseFloat(entry.morning) || 0;
            const evening = parseFloat(entry.evening) || 0;

            if (morning > 0 || evening > 0) {
                recordsToSave.push({
                    id: generateId(),
                    animalId,
                    tagNumber: animal.tagNumber,
                    date: selectedDate,
                    morningMilk: morning,
                    eveningMilk: evening,
                    totalMilk: morning + evening,
                    userId: '', // Will be handled in onSaveMilkRecords
                    createdAt: now
                });
            }
        });

        if (recordsToSave.length === 0) {
            alert("No records to save! Please enter milk quantities.");
            return;
        }

        setIsSaving(true);
        setSaveStatus('Saving records...');
        try {
            await onSaveMilkRecords(recordsToSave);
            setSaveStatus('Records saved successfully!');
            setMilkEntries({}); // Clear entries after success
            window.alert(`Successfully saved ${recordsToSave.length} milk records.`);
        } catch (err: any) {
            console.error("Error saving milk records:", err);
            alert("Failed to save milk records: " + (err.message || "Unknown error"));
        } finally {
            setIsSaving(false);
            setSaveStatus('');
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header and Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-6 rounded-3xl border border-slate-300 shadow-sm">
                <div className="flex-1 w-full space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-xl text-white">
                            <Milk size={24} />
                        </div>
                        Milk Recording (دودھ کا ریکارڈ)
                    </h2>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                            <input
                                type="text"
                                placeholder="Search Tag Number..."
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-600 font-black text-slate-700"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <button 
                                onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
                                className="h-full px-6 py-3 bg-indigo-50 text-indigo-700 border-2 border-indigo-200 rounded-xl font-black flex items-center gap-2 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                            >
                                <Plus size={20} /> Add Animal
                            </button>
                            {isAddDropdownOpen && (
                                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-3">
                                    <input 
                                        type="text" 
                                        placeholder="Search any animal tag..." 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold mb-2 outline-none focus:border-indigo-500"
                                        value={addAnimalSearch}
                                        onChange={(e) => setAddAnimalSearch(e.target.value)}
                                        autoFocus
                                    />
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        {allAnimals
                                            .filter(a => a.tagNumber.toLowerCase().includes(addAnimalSearch.toLowerCase()) && !eligibleAnimals.some(e => e.id === a.id))
                                            .slice(0, 10)
                                            .map(a => (
                                            <div 
                                                key={a.id} 
                                                onClick={() => {
                                                    setManuallyAddedAnimalIds(prev => new Set(prev).add(a.id));
                                                    setManuallyRemovedAnimalIds(prev => {
                                                        const next = new Set(prev);
                                                        next.delete(a.id);
                                                        return next;
                                                    });
                                                    setIsAddDropdownOpen(false);
                                                    setAddAnimalSearch('');
                                                }}
                                                className="px-3 py-2 hover:bg-indigo-50 rounded-lg cursor-pointer flex justify-between items-center"
                                            >
                                                <span className="font-black text-slate-800">#{a.tagNumber}</span>
                                                <span className="text-[10px] font-bold text-slate-400">{a.status}</span>
                                            </div>
                                        ))}
                                        {allAnimals.filter(a => a.tagNumber.toLowerCase().includes(addAnimalSearch.toLowerCase()) && !eligibleAnimals.some(e => e.id === a.id)).length === 0 && (
                                            <div className="p-2">
                                                <p className="text-center text-xs text-slate-400 font-bold mb-2">No available animals found.</p>
                                                <button 
                                                    onClick={() => {
                                                        setEditTargetId(null);
                                                        setIsAnimalModalOpen(true);
                                                        setIsAddDropdownOpen(false);
                                                        setAddAnimalSearch('');
                                                    }}
                                                    className="w-full py-2 bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs hover:bg-indigo-200"
                                                >
                                                    + Create New Animal
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="relative flex items-center gap-3 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2">
                            <Calendar size={20} className="text-slate-500" />
                            <input
                                type="date"
                                className="bg-transparent font-bold outline-none text-slate-700"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-2 w-full md:w-auto">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isScanning || isSaving}
                        className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black flex flex-col items-center justify-center gap-1 hover:bg-emerald-700 transition-all shadow-lg w-full min-w-[150px] disabled:opacity-70"
                    >
                        <div className="flex items-center gap-2 text-lg">
                            {isScanning ? <Loader2 className="animate-spin" size={24} /> : <div className="bg-white/20 p-1 rounded-lg"><Search size={20} /></div>}
                            <span>{isScanning ? 'Scanning...' : 'AI Scan Record'}</span>
                        </div>
                    </button>
                    <button 
                        onClick={() => setIsGuideOpen(true)}
                        className="text-xs font-black text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 transition-colors uppercase tracking-widest text-center"
                    >
                        Scanner Guide
                    </button>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileUpload}
                />
                <button
                    onClick={handleSaveAll}
                    disabled={isSaving}
                    className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black flex flex-col items-center justify-center gap-1 hover:bg-indigo-700 transition-all shadow-lg w-full md:w-auto min-w-[200px] disabled:opacity-70"
                >
                    <div className="flex items-center gap-2 text-lg">
                        {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                        <span>{isSaving ? 'Saving...' : 'Save All Records'}</span>
                    </div>
                    {isSaving && saveStatus && (
                        <span className="text-[10px] font-bold text-indigo-100 animate-pulse uppercase tracking-widest">{saveStatus}</span>
                    )}
                </button>
            </div>

            {/* Scanning Progress Overlay */}
            {isScanning && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2rem] p-8 shadow-2xl border-4 border-emerald-500 w-full max-w-md animate-in zoom-in duration-300">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="bg-emerald-100 p-4 rounded-full text-emerald-600 animate-bounce">
                                <Search size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900">Scanning Your Record...</h3>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Our AI is reading your milk sheet (ٹیبل سکین ہو رہا ہے)</p>
                            </div>
                            <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden border-2 border-slate-200">
                                <div
                                    className="bg-emerald-500 h-full transition-all duration-300"
                                    style={{ width: `${scanProgress * 100}%` }}
                                ></div>
                            </div>
                            <p className="font-black text-emerald-600 text-xl">{Math.round(scanProgress * 100)}%</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatBox label="Eligible Animals" value={eligibleAnimals.length} color="indigo" />
                <StatBox label="Animals in List" value={filteredAnimals.length} color="slate" />
                <StatBox label="Recorded Today" value={Object.keys(milkEntries).length} color="emerald" />
                <StatBox label="Total Liter (Current)" value={(Object.values(milkEntries) as { morning: string; evening: string }[]).reduce((acc: number, curr: { morning: string; evening: string }) => acc + (parseFloat(curr.morning) || 0) + (parseFloat(curr.evening) || 0), 0).toFixed(1)} color="amber" />
            </div>

            {/* Animals List */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b-2 border-slate-200">
                                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-center w-24">Tag ID</th>
                                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Animal Info</th>
                                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-center">Morning (صبح)</th>
                                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-center">Evening (شام)</th>
                                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-center">Total (کل)</th>
                                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredAnimals.map(animal => (
                                <tr key={animal.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-center">
                                        <span className="font-black text-slate-900 bg-white border-2 border-slate-200 px-4 py-2 rounded-xl shadow-sm">
                                            {animal.tagNumber}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <p className="font-black text-slate-800 text-sm">{animal.category}</p>
                                        <p className="text-[10px] text-slate-400 font-black uppercase">{animal.status} | {animal.farm}</p>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-center">
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="w-24 px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg text-center font-black text-indigo-600 focus:border-indigo-600 outline-none"
                                                placeholder="0.0"
                                                value={milkEntries[animal.id]?.morning || ''}
                                                onChange={(e) => handleMilkChange(animal.id, 'morning', e.target.value)}
                                            />
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-center">
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="w-24 px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg text-center font-black text-indigo-600 focus:border-indigo-600 outline-none"
                                                placeholder="0.0"
                                                value={milkEntries[animal.id]?.evening || ''}
                                                onChange={(e) => handleMilkChange(animal.id, 'evening', e.target.value)}
                                            />
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col items-center">
                                            <span className="text-lg font-black text-slate-900">{calculateTotal(animal.id).toFixed(1)}</span>
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Liters</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-1 justify-center">
                                            <button 
                                                onClick={() => {
                                                    setEditTargetId(animal.id);
                                                    setIsAnimalModalOpen(true);
                                                    if (!animal.history) onLoadDetails(animal.id);
                                                }}
                                                className="text-slate-400 hover:text-indigo-500 transition-colors p-2 hover:bg-indigo-50 rounded-lg"
                                                title="Edit Animal"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                            </button>
                                            <button 
                                                onClick={() => setManuallyRemovedAnimalIds(prev => new Set(prev).add(animal.id))}
                                                className="text-slate-400 hover:text-amber-500 transition-colors p-2 hover:bg-amber-50 rounded-lg"
                                                title="Remove from Today's List"
                                            >
                                                <X size={20} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteAnimal(animal.id)}
                                                className="text-slate-400 hover:text-rose-500 transition-colors p-2 hover:bg-rose-50 rounded-lg"
                                                title="Delete Animal Permanently"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredAnimals.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-400">
                                            <Search size={48} />
                                            <p className="font-black uppercase tracking-widest text-xs">No eligible animals found matching your search.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden divide-y divide-slate-100">
                    {filteredAnimals.map(animal => (
                        <div key={animal.id} className="p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">#{animal.tagNumber}</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase">{animal.category} | {animal.status}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-indigo-600">{calculateTotal(animal.id).toFixed(1)} <span className="text-[10px]">L</span></p>
                                    <p className="text-[8px] font-black text-slate-400 uppercase">Daily Total</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Morning (صبح)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-center"
                                        placeholder="0.0"
                                        value={milkEntries[animal.id]?.morning || ''}
                                        onChange={(e) => handleMilkChange(animal.id, 'morning', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Evening (شام)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-center"
                                        placeholder="0.0"
                                        value={milkEntries[animal.id]?.evening || ''}
                                        onChange={(e) => handleMilkChange(animal.id, 'evening', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => {
                                        setEditTargetId(animal.id);
                                        setIsAnimalModalOpen(true);
                                        if (!animal.history) onLoadDetails(animal.id);
                                    }}
                                    className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-xs uppercase tracking-widest flex justify-center items-center gap-2"
                                >
                                    Edit
                                </button>
                                <button 
                                    onClick={() => setManuallyRemovedAnimalIds(prev => new Set(prev).add(animal.id))}
                                    className="flex-1 py-2 bg-amber-50 text-amber-600 rounded-lg font-bold text-xs uppercase tracking-widest flex justify-center items-center gap-2"
                                >
                                    Remove
                                </button>
                                <button 
                                    onClick={() => handleDeleteAnimal(animal.id)}
                                    className="flex-1 py-2 bg-rose-50 text-rose-600 rounded-lg font-bold text-xs uppercase tracking-widest flex justify-center items-center gap-2"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* AI Scanner Guide Modal */}
            {isGuideOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl relative">
                        <button 
                            onClick={() => setIsGuideOpen(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
                                <Search size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900">AI Scanner Guide</h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Maximize Accuracy (سکین کو بہتر بنائیں)</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                                <p className="text-amber-900 text-sm font-bold">Because the scanner uses browser-based AI without an expensive internet API, it relies heavily on clear formatting and neat handwriting.</p>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
                                <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">Crucial Criteria for Success</h4>
                                <ul className="list-disc list-inside space-y-2 text-sm font-bold text-slate-700">
                                    <li><strong className="text-slate-900">Block Letters/Numbers:</strong> Write neatly, avoiding cursive or connected numbers.</li>
                                    <li><strong className="text-slate-900">Column Format:</strong> Write entries in a strict order: <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Tag ID</span> <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Morning</span> <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Evening</span>.</li>
                                    <li><strong className="text-slate-900">Spacing:</strong> Leave clear, large spaces between the columns. Do not squeeze them together.</li>
                                    <li><strong className="text-slate-900">Missing Values:</strong> If an animal did not give milk, write <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded">0</span> instead of leaving it blank.</li>
                                    <li><strong className="text-slate-900">Lighting:</strong> Take the photo in bright daylight without shadows over the paper.</li>
                                    <li><strong className="text-slate-900">High Contrast:</strong> Use dark ink on bright white paper.</li>
                                </ul>
                            </div>
                            
                            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl">
                                <p className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-2">Example of a perfect row format:</p>
                                <p className="font-mono bg-white p-3 rounded-xl border border-indigo-100 text-lg tracking-[0.25em] font-bold text-center">451 &nbsp;&nbsp;&nbsp; 12.5 &nbsp;&nbsp;&nbsp; 14.0</p>
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsGuideOpen(false)}
                            className="mt-8 w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-slate-800 transition-colors"
                        >
                            Understood, Close
                        </button>
                    </div>
                </div>
            )}

            {/* Animal Form Modal */}
            {isAnimalModalOpen && (
                <AnimalFormModal
                    isOpen={isAnimalModalOpen}
                    onClose={() => {
                        setIsAnimalModalOpen(false);
                        setEditTargetId(null);
                    }}
                    onSave={handleSaveAnimal}
                    initialData={editTarget}
                    mothersList={allAnimals}
                    allAnimals={allAnimals}
                    editAnimal={editTarget}
                />
            )}
        </div>
    );
};

const StatBox = ({ label, value, color }: { label: string; value: string | number; color: string }) => {
    const colors: Record<string, string> = {
        indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
        emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
        amber: 'bg-amber-50 border-amber-100 text-amber-700',
        slate: 'bg-slate-50 border-slate-100 text-slate-700'
    };

    return (
        <div className={`p-4 rounded-2xl border-2 ${colors[color] || colors.slate} shadow-sm`}>
            <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1">{label}</p>
            <p className="text-2xl font-black tracking-tight">{value}</p>
        </div>
    );
};

export default MilkManager;
