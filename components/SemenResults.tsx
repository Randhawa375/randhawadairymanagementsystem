
import React, { useMemo, useState } from 'react';
import { Baby, Calendar, User, Syringe, Image as ImageIcon, Search, Microscope, CheckCircle2, Timer, AlertCircle } from 'lucide-react';
import { Animal, ReproductiveStatus } from '../types';
import { formatDate } from '../utils/helpers';
import ImageModal from './ImageModal';

interface SemenResultsProps {
    allAnimals: Animal[];
    onLoadDetails: (id: string) => void;
}

type ResultStatus = 'CALVED' | 'PREGNANT' | 'INSEMINATED' | 'FAILED';

interface SemenResult {
    id: string; // for key
    type: ResultStatus;
    calfTag?: string;
    calfGender?: string;
    motherTag: string;
    motherId: string;
    semenName: string;
    date: string;
    imageUrl?: string;
    details?: string;
}

const SemenResults: React.FC<SemenResultsProps> = ({ allAnimals, onLoadDetails }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

    const results = useMemo(() => {
        const items: SemenResult[] = [];
        const processedCalfIds = new Set<string>();

        allAnimals.forEach(animal => {
            // 1. Process History Events for Mothers (Primary Source)
            if (animal.history) {
                animal.history.forEach(event => {
                    // --- CALVING EVENTS (The actual Results) ---
                    if (event.type === 'CALVING') {
                        let calf: Animal | undefined;
                        if (event.calfId) {
                            calf = allAnimals.find(a => a.id === event.calfId);
                            if (calf) processedCalfIds.add(calf.id);
                        }

                        // Robust Tag Extraction
                        const calfTagMatch = event.details.match(/Tag: ([^)\n\r ]+)/) || event.details.match(/Tag\(s\): ([^)\n\r ]+)/);
                        const calfTag = calf?.tagNumber || (calfTagMatch ? calfTagMatch[1].trim() : 'Unknown');

                        // Robust Gender Extraction
                        const genderMatch = event.details.match(/Produced (Male Calf|Female Calf)/);
                        const gender = calf?.category || (genderMatch ? genderMatch[1] : 'Birth Record');

                        // Robust Semen Extraction
                        const semenMatch = event.details.match(/Semen ([^ ]+) used/) || event.details.match(/with ([^ ]+) on/);
                        const semen = event.semen || (semenMatch ? semenMatch[1] : 'Not Recorded');

                        items.push({
                            id: event.id,
                            type: 'CALVED',
                            calfTag,
                            calfGender: gender,
                            motherTag: animal.tagNumber,
                            motherId: animal.id,
                            semenName: semen,
                            date: event.date,
                            imageUrl: calf?.image || (calf?.images && calf.images[0]) || (animal.category.includes('Calf') ? animal.image : undefined),
                            details: event.details
                        });
                    }
                });
            }

            // 2. Process ALL animals directly (Backup source for records where mother doesn't have history)
            const birthEvent = animal.history?.find(h => h.details.includes('Born to Mother'));
            if (birthEvent && !processedCalfIds.has(animal.id)) {
                const motherTagMatch = birthEvent.details.match(/Mother Tag: ([^ ]+)/);
                const motherTag = motherTagMatch ? motherTagMatch[1] : 'Unknown';

                items.push({
                    id: animal.id,
                    type: 'CALVED',
                    calfTag: animal.tagNumber,
                    calfGender: animal.category,
                    motherTag: motherTag,
                    motherId: animal.motherId || '',
                    semenName: birthEvent.semen || 'Unknown',
                    date: birthEvent.date,
                    imageUrl: animal.image || (animal.images && animal.images[0]),
                    details: birthEvent.details
                });
            }
        });

        // Filtering to avoid duplicates on the same day for same animal
        const uniqueMap = new Map<string, SemenResult>();
        items.forEach(item => {
            const key = `${item.motherTag}-${item.date.split('T')[0]}-${item.calfTag}`;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, item);
            }
        });

        return Array.from(uniqueMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [allAnimals]);

    const filteredResults = results.filter(r =>
        r.calfTag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.motherTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.semenName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusBadge = (type: ResultStatus) => {
        if (type === 'CALVED') {
            return (
                <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    <CheckCircle2 size={12} /> Success: Calved
                </span>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
            {/* Header Section */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                    <Microscope size={160} className="text-indigo-900" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="bg-indigo-900 p-3 rounded-2xl shadow-lg">
                            <Microscope size={24} className="text-white" />
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Semen Results Ledger</h2>
                    </div>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[11px] ml-16">
                        Visual tracking of breeding success and calving outcomes
                    </p>

                    <div className="mt-10 flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
                            <input
                                type="text"
                                placeholder="Search by Calf, Mother or Semen Tag..."
                                className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none focus:border-indigo-600 focus:bg-white transition-all font-bold text-slate-900 shadow-inner"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-4">
                            <StatBox label="Total Recorded" value={results.length} color="indigo" icon={<Microscope size={20} />} />
                            <StatBox label="Successful Births" value={results.filter(r => r.type === 'CALVED').length} color="emerald" icon={<Baby size={20} />} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid View */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredResults.map((result) => (
                    <div key={result.id} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden hover:shadow-2xl transition-all duration-300 group flex flex-col h-full border-b-[6px] hover:border-b-indigo-500">
                        {/* Image Preview */}
                        <div className="h-64 bg-slate-100 relative overflow-hidden flex items-center justify-center cursor-pointer group-hover:brightness-110 transition-all"
                            onClick={() => result.imageUrl && setFullScreenImage(result.imageUrl)}>
                            {result.imageUrl ? (
                                <img src={result.imageUrl} alt="Record" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-slate-300">
                                    <div className="p-6 bg-white rounded-full shadow-sm">
                                        <ImageIcon size={48} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest">No Image Available</span>
                                </div>
                            )}

                            {/* Type Badge Floating */}
                            <div className="absolute top-5 left-5">
                                {getStatusBadge(result.type)}
                            </div>

                            <div className="absolute bottom-5 right-5">
                                <span className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl text-[11px] font-black text-slate-900 shadow-xl border border-white/20 uppercase tracking-widest">
                                    {formatDate(result.date)}
                                </span>
                            </div>
                        </div>

                        <div className="p-8 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
                                        {result.type === 'CALVED' ? `Calf #${result.calfTag}` : `Mother #${result.motherTag}`}
                                    </h3>
                                    <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest mt-1">
                                        {result.type === 'CALVED' ? result.calfGender : 'Pregnancy/Breeding Case'}
                                    </p>
                                </div>
                                <div className={`p-3.5 rounded-2xl shadow-lg ${result.type === 'CALVED' ? 'bg-emerald-900 text-white' : 'bg-slate-900 text-white'}`}>
                                    {result.type === 'CALVED' ? <Baby size={24} /> : <Syringe size={24} />}
                                </div>
                            </div>

                            <div className="space-y-4 flex-1">
                                <InfoRow
                                    label="Mother Tag"
                                    value={`#${result.motherTag}`}
                                    icon={<User size={18} />}
                                    color="slate"
                                />

                                <InfoRow
                                    label="Semen Straw"
                                    value={result.semenName}
                                    icon={<Syringe size={18} />}
                                    color="amber"
                                />

                                {result.details && (
                                    <div className="mt-6 pt-6 border-t border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Technical Note</p>
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            "{result.details.length > 100 ? result.details.substring(0, 100) + '...' : result.details}"
                                        </p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => onLoadDetails(result.motherId)}
                                className="w-full mt-8 py-4 bg-slate-900 hover:bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95"
                            >
                                <Calendar size={16} /> View History Ledger
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredResults.length === 0 && (
                <div className="bg-white rounded-[3rem] p-24 text-center border-4 border-dashed border-slate-100">
                    <div className="bg-slate-50 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <Microscope size={48} className="text-slate-200" />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900">No Records Match Your Search</h3>
                    <p className="text-slate-400 font-bold mt-3 text-lg">We couldn't find any results. Try searching for a different tag or straw name.</p>
                </div>
            )}

            {fullScreenImage && <ImageModal imageUrl={fullScreenImage} onClose={() => setFullScreenImage(null)} />}
        </div>
    );
};

const StatBox = ({ label, value, color, icon }: any) => (
    <div className={`bg-${color}-50 px-6 py-4 rounded-[1.5rem] flex items-center gap-5 border border-${color}-100 shadow-sm`}>
        <div className="bg-white p-3 rounded-2xl shadow-sm text-indigo-600">
            {icon}
        </div>
        <div>
            <p className={`text-[10px] font-black text-${color}-400 uppercase tracking-widest`}>{label}</p>
            <p className={`text-2xl font-black text-${color}-900`}>{value}</p>
        </div>
    </div>
);

const InfoRow = ({ label, value, icon, color }: any) => (
    <div className={`flex items-center gap-4 p-4 rounded-2xl bg-${color}-50 border border-${color}-100 transition-colors`}>
        <div className="bg-white p-2.5 rounded-xl shadow-sm">
            <span className={`text-${color}-500`}>{icon}</span>
        </div>
        <div className="min-w-0">
            <p className={`text-[10px] font-black text-${color}-400 uppercase tracking-widest`}>{label}</p>
            <p className={`font-black text-${color}-900 truncate`}>{value}</p>
        </div>
    </div>
);

export default SemenResults;
