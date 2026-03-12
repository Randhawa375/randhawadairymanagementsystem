
import React, { useState, useMemo } from 'react';
import { Milk, Search, Save, History, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import { Animal, MilkRecord, AnimalCategory, ReproductiveStatus } from '../types';
import { formatDate, generateId } from '../utils/helpers';
import { supabase } from '../lib/supabase';
// @ts-ignore
import Tesseract from 'tesseract.js';

interface MilkManagerProps {
    allAnimals: Animal[];
    onSaveMilkRecords: (records: MilkRecord[]) => Promise<void>;
    onLoadDetails: (id: string) => void;
}

const MilkManager: React.FC<MilkManagerProps> = ({
    allAnimals,
    onSaveMilkRecords,
    onLoadDetails
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [milkEntries, setMilkEntries] = useState<Record<string, { morning: string; evening: string }>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Eligible animals: Milking category OR Newly Calved status
    const eligibleAnimals = useMemo(() => {
        return allAnimals.filter(a =>
            (a.category === AnimalCategory.MILKING || a.status === ReproductiveStatus.NEWLY_CALVED) &&
            a.status !== ReproductiveStatus.SOLD
        );
    }, [allAnimals]);

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
                        const contrast = 1.5; // 1.1 to 2.0
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

    const fuzzyMatch = (text: string, tag: string): boolean => {
        // Normalize strings: remove all non-alphanumeric and convert to uppercase
        const normalize = (s: string) => {
            let res = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
            // Common OCR substitutions
            return res
                .replace(/O/g, '0')
                .replace(/I/g, '1')
                .replace(/L/g, '1')
                .replace(/S/g, '5')
                .replace(/G/g, '6')
                .replace(/B/g, '8')
                .replace(/Z/g, '2');
        };

        const normText = normalize(text);
        const normTag = normalize(tag);

        if (!normTag) return false;

        // Exact normalized match or inclusion
        return normText.includes(normTag) || normTag.includes(normText);
    };

    const processOCRText = (text: string) => {
        // Split into lines and cleanup
        const rawLines = text.split('\n');
        const newEntries = { ...milkEntries };
        let matchCount = 0;

        rawLines.forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine.length < 2) return;

            // Look for numbers in the line (potential milk quantities)
            // Pattern: Allow decimals, commas as dots, etc.
            const numbersFound = cleanLine.replace(/,/g, '.').match(/(\d+(\.\d+)?)/g);
            if (!numbersFound) return;

            // For each eligible animal, check if its tag is present in this line
            eligibleAnimals.forEach(animal => {
                const tag = animal.tagNumber;

                // If tag is found in line using fuzzy logic
                if (fuzzyMatch(cleanLine, tag)) {
                    // Filter out numbers that are likely the tag number itself
                    const nonTagNumbers = numbersFound.filter(num => !fuzzyMatch(num, tag));

                    if (nonTagNumbers.length > 0) {
                        const morning = nonTagNumbers[0] || '';
                        const evening = nonTagNumbers[1] || '';

                        // Only update if we found something new or if it's currently empty
                        if (!newEntries[animal.id] || (!newEntries[animal.id].morning && !newEntries[animal.id].evening)) {
                            newEntries[animal.id] = {
                                morning: morning,
                                evening: evening
                            };
                            matchCount++;
                        }
                    }
                }
            });
        });

        if (matchCount > 0) {
            setMilkEntries(newEntries);
            window.alert(`AI Scanner (v2.0): Successfully matched and imported recordings for ${matchCount} animals using intelligent matching.`);
        } else {
            alert("AI Scanner was unable to find any matching Tag IDs. Tip: Make sure Tag IDs are clearly visible and use the 'Morning, Evening' format.");
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
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning || isSaving}
                    className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black flex flex-col items-center justify-center gap-1 hover:bg-emerald-700 transition-all shadow-lg w-full md:w-auto min-w-[150px] disabled:opacity-70"
                >
                    <div className="flex items-center gap-2 text-lg">
                        {isScanning ? <Loader2 className="animate-spin" size={24} /> : <div className="bg-white/20 p-1 rounded-lg"><Search size={20} /></div>}
                        <span>{isScanning ? 'Scanning...' : 'AI Scan Record'}</span>
                    </div>
                </button>
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
                                </tr>
                            ))}
                            {filteredAnimals.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
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
                        </div>
                    ))}
                </div>
            </div>
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
