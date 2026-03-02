
import React, { useMemo, useState } from 'react';
import { Baby, Calendar, User, Syringe, Image as ImageIcon, Search, Microscope } from 'lucide-react';
import { Animal, HistoryEvent } from '../types';
import { formatDate } from '../utils/helpers';
import ImageModal from './ImageModal';

interface SemenResultsProps {
    allAnimals: Animal[];
    onLoadDetails: (id: string) => void;
}

interface SemenResult {
    calfTag: string;
    calfGender: string;
    motherTag: string;
    semenName: string;
    date: string;
    imageUrl?: string;
    originalAnimal: Animal;
}

const SemenResults: React.FC<SemenResultsProps> = ({ allAnimals, onLoadDetails }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

    const results = useMemo(() => {
        const items: SemenResult[] = [];

        allAnimals.forEach(animal => {
            // Find CALVING events in history
            if (animal.history) {
                animal.history.forEach(event => {
                    if (event.type === 'CALVING') {
                        // Extract info from calving event details or remarks
                        // Example details: "Official Calving Recorded: Produced Female Calf (Tag: C101).\nCycle Info: Semen Bull-A used on 01/01/2024."

                        // Try to find the calf if calfId is present
                        let calf: Animal | undefined;
                        if (event.calfId) {
                            calf = allAnimals.find(a => a.id === event.calfId);
                        }

                        // If calf not found by ID (maybe not loaded yet), try searching by tag if we can extract it
                        // For now, let's rely on what we can gather

                        const calfTagMatch = event.details.match(/Tag: ([^)]+)/);
                        const calfTag = calf?.tagNumber || (calfTagMatch ? calfTagMatch[1] : 'Unknown');

                        const genderMatch = event.details.match(/Produced (Male Calf|Female Calf)/);
                        const gender = calf?.category || (genderMatch ? genderMatch[1] : 'Unknown');

                        const semenMatch = event.details.match(/Semen ([^ ]+) used/);
                        const semen = semenMatch ? semenMatch[1] : (event.semen || 'Not Recorded');

                        items.push({
                            calfTag: calfTag,
                            calfGender: gender,
                            motherTag: animal.tagNumber,
                            semenName: semen,
                            date: event.date,
                            imageUrl: calf?.image,
                            originalAnimal: animal // Mother
                        });
                    }
                });
            }

            // Also look at Calves directly to see if they have semen info in their birth history
            if (animal.category === 'Male Calf' || animal.category === 'Female Calf') {
                const birthEvent = animal.history?.find(h => h.details.includes('Born to Mother'));
                if (birthEvent && !items.find(i => i.calfTag === animal.tagNumber)) {
                    const motherTagMatch = birthEvent.details.match(/Mother Tag: ([^ ]+)/);
                    const motherTag = motherTagMatch ? motherTagMatch[1] : 'Unknown';

                    items.push({
                        calfTag: animal.tagNumber,
                        calfGender: animal.category,
                        motherTag: motherTag,
                        semenName: birthEvent.semen || 'Unknown',
                        date: birthEvent.date,
                        imageUrl: animal.image,
                        originalAnimal: animal
                    });
                }
            }
        });

        // Sort by date descending
        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [allAnimals]);

    const filteredResults = results.filter(r =>
        r.calfTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.motherTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.semenName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
            {/* Header Section */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Microscope size={120} className="text-indigo-900" />
                </div>
                <div className="relative z-10">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">Semen Results Ledger</h2>
                    <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-xs flex items-center gap-2">
                        <Microscope size={14} className="text-indigo-600" />
                        Comprehensive Calving & Breeding Success Track
                    </p>

                    <div className="mt-8 flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search by Calf, Mother or Semen..."
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-bold text-slate-900"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="bg-indigo-50 px-6 py-4 rounded-2xl flex items-center gap-4 border border-indigo-100">
                            <div className="bg-white p-2 rounded-xl shadow-sm">
                                <Baby size={24} className="text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Total Success</p>
                                <p className="text-2xl font-black text-indigo-900">{results.length}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid View */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredResults.map((result, idx) => (
                    <div key={idx} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden hover:shadow-xl transition-all group flex flex-col h-full">
                        {/* Image Placeholder or Actual Image */}
                        <div className="h-56 bg-slate-100 relative overflow-hidden flex items-center justify-center cursor-pointer"
                            onClick={() => result.imageUrl && setFullScreenImage(result.imageUrl)}>
                            {result.imageUrl ? (
                                <img src={result.imageUrl} alt="Calf" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-slate-300">
                                    <ImageIcon size={48} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">No Image Uploaded</span>
                                </div>
                            )}
                            <div className="absolute top-4 right-4">
                                <span className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-900 shadow-sm border border-white/20 uppercase tracking-widest">
                                    {formatDate(result.date)}
                                </span>
                            </div>
                        </div>

                        <div className="p-6 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 leading-tight">Calf #{result.calfTag}</h3>
                                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">{result.calfGender}</p>
                                </div>
                                <div className="bg-slate-900 text-white p-2.5 rounded-xl">
                                    <Baby size={20} />
                                </div>
                            </div>

                            <div className="space-y-4 flex-1">
                                <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div className="bg-white p-2 rounded-lg shadow-sm">
                                        <User size={16} className="text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mother Tag</p>
                                        <p className="font-black text-slate-900">#{result.motherTag}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 p-3 rounded-2xl bg-amber-50 border border-amber-100">
                                    <div className="bg-white p-2 rounded-lg shadow-sm">
                                        <Syringe size={16} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Semen Used</p>
                                        <p className="font-black text-amber-900">{result.semenName}</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    // Logic to find and view original animal details if needed
                                    // Currently just showing history for the mother or calf
                                }}
                                className="w-full mt-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                            >
                                <Calendar size={14} /> Full Record Detail
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredResults.length === 0 && (
                <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-slate-200">
                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Microscope size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">No Semen Results Found</h3>
                    <p className="text-slate-500 font-bold mt-2">Adjust your search or record new calving events to see results here.</p>
                </div>
            )}

            {fullScreenImage && <ImageModal imageUrl={fullScreenImage} onClose={() => setFullScreenImage(null)} />}
        </div>
    );
};

export default SemenResults;
