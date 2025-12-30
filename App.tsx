
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  User as UserIcon,
  Download,
  LogOut,
  Milk,
  Loader2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Dashboard from './components/Dashboard';
import AnimalManager from './components/AnimalManager';
import ReportsManager from './components/ReportsManager';
import Auth from './components/Auth';
import { Animal, FarmLocation, AnimalCategory, ReproductiveStatus, User } from './types';
import { formatDate } from './utils/helpers';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState<'dashboard' | 'list' | 'reports'>('dashboard');
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [activeFarm, setActiveFarm] = useState<FarmLocation | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reportFilter, setReportFilter] = useState<{status?: ReproductiveStatus}>({});
  const [loading, setLoading] = useState(true);

  const FARM_NAME = "Randhawa Dairy Animal Management System";
  const PROPRIETOR = "Farhan Randhawa";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) {
        fetchAnimals(user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) {
        fetchAnimals(user.id);
      } else {
        setAnimals([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAnimals = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('animals')
        .select('*')
        .eq('user_id', userId)
        .order('lastUpdated', { ascending: false });

      if (error) throw error;
      setAnimals(data || []);
    } catch (err) {
      console.error('Error fetching animals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (user: any) => {
    setCurrentUser(user);
    fetchAnimals(user.id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setAnimals([]);
  };

  /**
   * Helper to ensure data is compatible with Postgres types.
   * Converts empty strings to null for date fields.
   */
  const sanitizeAnimal = (animal: Animal, userId: string) => {
    const clean: any = { ...animal, user_id: userId };
    
    // Postgres TIMESTAMPTZ columns reject empty strings but accept nulls
    const dateFields = ['inseminationDate', 'expectedCalvingDate', 'calvingDate'];
    dateFields.forEach(field => {
      if (clean[field] === "" || clean[field] === undefined) {
        clean[field] = null;
      }
    });

    return clean;
  };

  // Sync a single animal change to Supabase
  const onSyncAnimal = async (animal: Animal) => {
    // Optimistic local update
    setAnimals(prev => {
      const exists = prev.find(a => a.id === animal.id);
      if (exists) {
        return prev.map(a => a.id === animal.id ? animal : a);
      }
      return [animal, ...prev];
    });

    if (!currentUser) return;

    try {
      const cleanData = sanitizeAnimal(animal, currentUser.id);
      const { error } = await supabase
        .from('animals')
        .upsert(cleanData, { onConflict: 'id' });
      
      if (error) throw error;
    } catch (err) {
      console.error('Individual Sync Error:', err);
      fetchAnimals(currentUser.id);
    }
  };

  // Sync a batch of animals
  const onSyncBatch = async (animalsBatch: Animal[]) => {
    setAnimals(prev => {
      let newState = [...prev];
      animalsBatch.forEach(animal => {
        const idx = newState.findIndex(a => a.id === animal.id);
        if (idx !== -1) newState[idx] = animal;
        else newState = [animal, ...newState];
      });
      return newState;
    });

    if (!currentUser) return;

    try {
      const cleanBatch = animalsBatch.map(a => sanitizeAnimal(a, currentUser.id));
      const { error } = await supabase
        .from('animals')
        .upsert(cleanBatch, { onConflict: 'id' });
      
      if (error) throw error;
    } catch (err) {
      console.error('Batch Sync Error:', err);
      fetchAnimals(currentUser.id);
    }
  };

  // Sync a deletion
  const onSyncDelete = async (id: string) => {
    setAnimals(prev => prev.filter(a => a.id !== id));

    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from('animals')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (err) {
      console.error('Delete Sync Error:', err);
      fetchAnimals(currentUser.id);
    }
  };

  const filteredAnimals = useMemo(() => {
    return animals.filter(a => {
      const farmMatch = activeFarm === 'all' || a.farm === activeFarm;
      const searchMatch = searchQuery === '' || a.tagNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return farmMatch && searchMatch;
    });
  }, [animals, activeFarm, searchQuery]);

  const handleAlertAction = (status: ReproductiveStatus) => {
    if (activeFarm === 'all') {
      setReportFilter({ status });
      setView('reports');
    } else {
      setView('list');
    }
  };

  const handleDownloadPDF = (dataToUse?: Animal[], titleSuffix?: string) => {
    const data = dataToUse || filteredAnimals;
    const date = new Date().toLocaleDateString('en-GB');
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); 
    doc.text(FARM_NAME, 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); 
    doc.text(`Official Animal Inventory Record | Proprietor: ${PROPRIETOR}`, 105, 21, { align: 'center' });
    
    doc.setDrawColor(203, 213, 225);
    doc.line(15, 25, 195, 25);

    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); 
    doc.text(`${titleSuffix || 'Herd Inventory Summary'}`, 15, 35);
    
    doc.setFontSize(10);
    doc.text(`Total Animals: ${data.length}`, 15, 41);
    doc.text(`Date: ${date}`, 195, 41, { align: 'right' });

    const farmCounts = Object.values(FarmLocation).map(f => ({
      label: f,
      count: data.filter(a => a.farm === f).length
    })).filter(item => item.count > 0);

    const categoryCounts = Object.values(AnimalCategory).map(cat => ({
      label: cat,
      count: data.filter(a => a.category === cat).length
    })).filter(item => item.count > 0);

    const statusCounts = Object.values(ReproductiveStatus).map(stat => ({
      label: stat,
      count: data.filter(a => a.status === stat).length
    })).filter(item => item.count > 0);

    const maxLen = Math.max(farmCounts.length, categoryCounts.length, statusCounts.length);
    
    const summaryHeader = [['Farm Distribution', 'Qty', '', 'Category Breakdown', 'Qty', '', 'Reproductive Status', 'Qty']];
    const summaryBody = [];
    
    for (let i = 0; i < maxLen; i++) {
      summaryBody.push([
        farmCounts[i]?.label || '',
        farmCounts[i]?.count !== undefined ? farmCounts[i].count.toString() : '',
        '',
        categoryCounts[i]?.label || '',
        categoryCounts[i]?.count !== undefined ? categoryCounts[i].count.toString() : '',
        '',
        statusCounts[i]?.label || '',
        statusCounts[i]?.count !== undefined ? statusCounts[i].count.toString() : ''
      ]);
    }

    autoTable(doc, {
      startY: 46,
      head: summaryHeader,
      body: summaryBody,
      theme: 'plain',
      headStyles: { fontStyle: 'bold', textColor: [51, 65, 85], fontSize: 9, fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 10 },
        3: { cellWidth: 35 },
        4: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 10 },
        6: { cellWidth: 35 },
        7: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }
      }
    });

    const tableStartY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Detailed Registry (Filtered List)`, 15, tableStartY - 4);

    const rows = data.map((a, i) => [
      i + 1,
      a.tagNumber,
      a.category,
      a.farm,
      a.status,
      a.expectedCalvingDate ? `Exp Calving: ${formatDate(a.expectedCalvingDate)}` : (a.remarks || '--')
    ]);

    autoTable(doc, {
      startY: tableStartY,
      head: [['No.', 'Tag ID', 'Type/Category', 'Farm Location', 'Repro Status', 'Record Notes']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 9, halign: 'center', textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { halign: 'center', cellWidth: 30 }
      }
    });

    const reportName = titleSuffix ? titleSuffix.replace(/\s+/g, '_') : 'Full_Inventory';
    doc.save(`Randhawa_Dairy_${reportName}_${new Date().toLocaleDateString('en-GB')}.pdf`);
  };

  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 size={48} className="animate-spin text-indigo-600 mx-auto" />
          <p className="font-black text-slate-900 uppercase tracking-widest text-xs">Loading Cloud Database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" dir="ltr">
      <header className="bg-white p-4 shadow-sm border-b border-slate-200">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg">
              <Milk size={28} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Randhawa Dairy Animal Management System <br/><span className="text-sm font-bold opacity-60"> </span>
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <UserIcon size={12} className="text-indigo-600" />
                  <span>Proprietor: {PROPRIETOR}</span>
                </div>
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-[10px] font-black text-rose-600 uppercase tracking-widest hover:text-rose-800 transition-colors"
                >
                  <LogOut size={12} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex bg-slate-100 rounded-2xl p-1 border border-slate-200">
              <FarmToggle active={activeFarm === 'all'} onClick={() => { setActiveFarm('all'); setSearchQuery(''); }} label="Overview" />
              <FarmToggle active={activeFarm === FarmLocation.MILKING_FARM} onClick={() => { setActiveFarm(FarmLocation.MILKING_FARM); setSearchQuery(''); }} label="Milking Farm" />
              <FarmToggle active={activeFarm === FarmLocation.HEIFER_FARM} onClick={() => { setActiveFarm(FarmLocation.HEIFER_FARM); setSearchQuery(''); }} label="Cattle Farm" />
            </div>
            <button 
              onClick={() => handleDownloadPDF(animals, 'Full Inventory Summary')}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-black transition-all shadow-md"
            >
              <Download size={18} /> Summary Report
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto flex gap-1 px-4">
          <NavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={18} />} label="Dashboard" />
          {activeFarm !== 'all' ? (
            <NavItem active={view === 'list'} onClick={() => setView('list')} icon={<UserIcon size={18} />} label="Records List" />
          ) : (
            <NavItem active={view === 'reports'} onClick={() => setView('reports')} icon={<FileText size={18} />} label="Summary Reports" />
          )}
        </div>
      </nav>

      <main className="flex-1 container mx-auto p-4 md:p-8">
        {view === 'dashboard' && (
          <Dashboard 
            animals={filteredAnimals} 
            allAnimals={animals}
            farmName={activeFarm === 'all' ? 'Overall Management' : activeFarm} 
            activeFarm={activeFarm}
            onNavigateToReport={handleAlertAction}
            onAlertClick={handleAlertAction}
            onUpdateAnimal={onSyncAnimal}
            onUpdateBatch={onSyncBatch}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        )}
        {view === 'list' && activeFarm !== 'all' && (
          <AnimalManager 
            animals={filteredAnimals} 
            allAnimals={animals} 
            onSave={onSyncAnimal}
            onBatchSave={onSyncBatch}
            onDelete={onSyncDelete}
            searchQuery={searchQuery} 
            setSearchQuery={setSearchQuery} 
            activeFarm={activeFarm} 
          />
        )}
        {view === 'reports' && activeFarm === 'all' && (
          <ReportsManager 
            animals={animals} 
            initialStatus={reportFilter.status} 
            onDownload={(data, title) => handleDownloadPDF(data, title)}
          />
        )}
      </main>

      <footer className="bg-white p-6 border-t border-slate-200">
        <div className="container mx-auto text-center flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <Milk size={14} className="text-indigo-600" />
            <span className="font-bold text-slate-900 text-xs uppercase">{FARM_NAME}</span>
          </div>
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Proprietor: {PROPRIETOR} | v5.7 Cloud-Secure</span>
        </div>
      </footer>
    </div>
  );
};

const FarmToggle = ({ active, onClick, label }: any) => (
  <button 
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${active ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
  >
    {label}
  </button>
);

const NavItem = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`py-4 px-6 border-b-2 font-black text-xs flex items-center gap-2.5 transition-all ${active ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
  >
    {icon} {label}
  </button>
);

export default App;
