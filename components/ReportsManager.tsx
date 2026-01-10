
import React, { useState, useMemo } from 'react';
import { Filter, Download, ListChecks, Table as TableIcon } from 'lucide-react';
import { Animal, FarmLocation, ReproductiveStatus } from '../types';
import { formatDate } from '../utils/helpers';
import * as helpers from '../utils/helpers';

interface ReportsManagerProps {
  animals: Animal[];
  initialStatus?: ReproductiveStatus;
  activeFarmSelection?: FarmLocation;
  onDownload?: (data: Animal[], titleSuffix: string) => void;
}

const ReportsManager: React.FC<ReportsManagerProps> = ({
  animals,
  initialStatus,
  activeFarmSelection,
  onDownload
}) => {
  const [selectedFarm, setSelectedFarm] = useState<FarmLocation | 'all'>(activeFarmSelection || 'all');
  const [selectedStatus, setSelectedStatus] = useState<ReproductiveStatus | 'all'>(initialStatus || 'all');

  const filteredData = useMemo(() => {
    return animals.filter(a => {
      const farmMatch = selectedFarm === 'all' || a.farm === selectedFarm;
      const statusMatch = selectedStatus === 'all' || a.status === selectedStatus;
      return farmMatch && statusMatch;
    });
  }, [animals, selectedFarm, selectedStatus]);

  const reportTitle = useMemo(() => {
    if (selectedStatus === 'all') return "Full Inventory Summary";
    return `${selectedStatus} Herd Report`;
  }, [selectedStatus]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Filtering Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-slate-100 p-3 rounded-xl text-slate-900">
            <Filter size={24} />
          </div>
          <div>
            <h2 className="font-black text-slate-900 text-xl tracking-tight">Report Generator</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Generate clean tabular records</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto">
          <div className="flex flex-1 md:flex-none gap-3">
            <select
              value={selectedFarm}
              onChange={(e) => setSelectedFarm(e.target.value as any)}
              className="flex-1 px-4 py-3 border-2 rounded-xl font-bold text-slate-900 outline-none focus:border-slate-900 bg-white"
            >
              <option value="all">All Locations</option>
              {Object.values(FarmLocation).map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="flex-1 px-4 py-3 border-2 rounded-xl font-bold text-slate-900 outline-none focus:border-slate-900 bg-white"
            >
              <option value="all">All Statuses</option>
              {Object.values(ReproductiveStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button
            onClick={() => onDownload?.(filteredData, reportTitle)}
            className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-3 hover:bg-black transition-all shadow-lg w-full md:w-auto"
          >
            <Download size={18} /> Download PDF Table
          </button>
        </div>
      </div>

      {/* Simplified Clean Table View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <TableIcon size={20} className="text-slate-400" />
            <h3 className="font-black text-slate-800 text-lg">{reportTitle}</h3>
          </div>
          <span className="px-3 py-1 bg-white border rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {filteredData.length} Records Found
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/50 border-b border-slate-200">
                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-center w-12">No.</th>
                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-center w-28">Tag ID</th>
                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Type / Farm</th>
                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-center">Current Stage</th>
                <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Breeding & Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length > 0 ? filteredData.map((animal, idx) => (
                <tr key={animal.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-center font-bold text-slate-400 text-sm">{idx + 1}</td>
                  <td className="p-4 text-center font-black text-slate-900 text-xl">{animal.tagNumber}</td>
                  <td className="p-4">
                    <p className="font-bold text-slate-800 text-sm">{animal.category}</p>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">{animal.farm}</p>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${animal.status === ReproductiveStatus.PREGNANT ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      animal.status === ReproductiveStatus.INSEMINATED ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                      {animal.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-xs font-bold text-slate-700 space-y-0.5">
                      {animal.expectedCalvingDate && (
                        <div>
                          <p className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-black uppercase text-[8px]">Exp Calving:</span>
                            <span className="text-emerald-700 font-black">{formatDate(animal.expectedCalvingDate)}</span>
                          </p>
                          {(animal.status === ReproductiveStatus.PREGNANT || animal.status === ReproductiveStatus.DRY) && (
                            <p className="text-[10px] font-black text-slate-500">
                              {(() => {
                                const days = helpers.getDaysToCalving(animal.expectedCalvingDate!);
                                if (days === null) return null;
                                return days < 0
                                  ? <span className="text-rose-600">{Math.abs(days)} Days Overdue</span>
                                  : <span className="text-emerald-600">{days} Days Remaining</span>
                              })()}
                            </p>
                          )}
                        </div>
                      )}

                      {animal.inseminationDate && (
                        <div>
                          <p className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-black uppercase text-[8px]">Semen:</span>
                            <span>{animal.semenName || 'Standard'} ({formatDate(animal.inseminationDate)})</span>
                          </p>
                          {animal.status === ReproductiveStatus.INSEMINATED && (
                            <div className="flex flex-col mt-0.5">
                              <span className="text-[9px] font-bold text-slate-500">
                                {helpers.getGestationDays(animal.inseminationDate!)} Days Since Insemination
                              </span>
                              <span className="text-[9px] font-black text-amber-600">
                                {(() => {
                                  const days = helpers.getDaysToPregnancyCheck(animal.inseminationDate!);
                                  if (days === null) return null;
                                  return days <= 0
                                    ? "Check Due Now"
                                    : `Check in ${days} Days`;
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {animal.remarks && <p className="text-[10px] text-slate-400 italic truncate max-w-xs">{animal.remarks}</p>}
                      {!animal.expectedCalvingDate && !animal.inseminationDate && !animal.remarks && (
                        <span className="text-slate-200 font-black">--</span>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-20 text-center font-black text-slate-300 italic text-xl">
                    No animals match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">
        Official Digital Ledger | Generated: {formatDate(new Date().toISOString())}
      </p>
    </div>
  );
};

export default ReportsManager;
