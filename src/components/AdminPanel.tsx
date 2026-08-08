import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAdmin } from '../hooks/useAdmin';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  ShieldCheck, 
  ShieldAlert, 
  Hash, 
  RefreshCw, 
  Search, 
  Settings, 
  AlertTriangle,
  UserCheck,
  UserMinus,
  Sparkles,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Database,
  TrendingUp,
  Sliders,
  DollarSign,
  Award
} from 'lucide-react';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  approved: boolean;
  maxAccounts: number;
  isAdmin: boolean;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function AdminPanel() {
  const {
    usersList,
    loading,
    errorMsg,
    updatingUid,
    fetchUsers,
    updateApproval,
    updateMaxAccounts,
    fetchUserData
  } = useAdmin();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected user and their loaded private subdata states
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [inspectData, setInspectData] = useState<{ config: any; signals: any[]; fundedAccounts: any[] } | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const handleViewUserData = async (u: any) => {
    setSelectedUser(u);
    setInspectLoading(true);
    setInspectData(null);
    try {
      const data = await fetchUserData(u.uid);
      setInspectData(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load user subdata");
    } finally {
      setInspectLoading(false);
    }
  };

  const filteredUsers = usersList.filter(user => {
    const term = searchQuery.toLowerCase();
    return (
      (user.displayName || '').toLowerCase().includes(term) ||
      (user.email || '').toLowerCase().includes(term) ||
      (user.firstName || '').toLowerCase().includes(term) ||
      (user.lastName || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const exportToCSV = () => {
    const headers = ['UID', 'Name', 'Email', 'Phone', 'Role', 'Access Status', 'Max Accounts', 'Joined At'];
    const csvContent = [
      headers.join(','),
      ...filteredUsers.map(user => {
        return [
          user.uid,
          `"${user.displayName || ''}"`,
          user.email,
          user.phoneNumber || 'N/A',
          user.isAdmin ? 'Admin' : 'Client',
          user.approved ? 'Approved' : 'Revoked',
          user.maxAccounts,
          user.createdAt ? new Date(user.createdAt).toISOString() : 'N/A'
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Directory exported to CSV');
  };

  return (
    <div className="space-y-6">
      
      {/* Admin Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-600">
            <Users className="w-6 h-6" />
            <h2 className="text-xl font-display font-semibold text-slate-900">Super Administrator Control Center</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Authorize new traders, revoke account access, and enforce precise limits on the maximum number of MetaTrader 5 terminals each customer account is authorized to attach.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 self-start sm:self-center font-mono"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Reload Directory</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-blue-50/20 border border-blue-100/30 text-blue-600 p-4 rounded-xl text-xs flex gap-2.5 items-center">
          <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Directory Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        
        {/* Filter bar */}
        <div className="p-5 border-b border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-600 focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-[10px] text-slate-400 font-mono tracking-wider font-semibold uppercase">
              Total Enrolled: {filteredUsers.length} Users
            </span>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700/10 hover:bg-blue-700/20 text-blue-600 rounded-lg border border-blue-600/20 text-xs font-semibold cursor-pointer transition-colors font-mono"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-white/30">
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">User / Trader Info</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Role</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Access Status</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Max MT5 Accounts Limit</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-400">
                    No matching profiles found in the directory.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-white/10 transition-colors">
                    
                    {/* Identity Info */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img 
                          src={user.photoURL} 
                          alt={user.displayName}
                          className="w-10 h-10 rounded-full border border-slate-200 shrink-0" 
                        />
                        <div>
                          <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                            {user.displayName}
                            {user.email === 'gowdarakshath17@gmail.com' && (
                              <span className="text-[9px] bg-blue-600/10 text-blue-600 border border-blue-600/20 px-1.5 py-0.5 rounded font-mono">Owner</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{user.email}</div>
                          {user.phoneNumber && (
                            <div className="text-[10px] text-blue-600 font-mono mt-0.5">📞 {user.phoneNumber}</div>
                          )}
                          {user.createdAt && (
                            <div className="text-[9px] text-slate-600 mt-1">Joined: {new Date(user.createdAt).toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-6">
                      {user.isAdmin ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-blue-50/20 text-blue-600 border border-blue-100/30 rounded-full font-mono font-semibold">
                          <ShieldCheck className="w-3 h-3 text-blue-600" />
                          Administrator
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-white text-slate-400 border border-slate-200 rounded-full font-mono font-semibold">
                          Traders / Client
                        </span>
                      )}
                    </td>

                    {/* Access Approval State */}
                    <td className="py-4 px-6">
                      {user.approved ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded-full font-semibold font-sans">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-orange-950/20 text-orange-400 border border-orange-900/30 rounded-full font-semibold font-sans animate-pulse">
                          <XCircle className="w-3.5 h-3.5" />
                          Awaiting Approval
                        </span>
                      )}
                    </td>

                    {/* Max Accounts Selector */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5 text-slate-400" />
                        <select
                          disabled={updatingUid === user.uid || user.isAdmin}
                          value={user.maxAccounts}
                          onChange={(e) => updateMaxAccounts(user.uid, Number(e.target.value))}
                          className="bg-white border border-slate-200 rounded-lg text-xs text-slate-900 px-2.5 py-1.5 focus:outline-none focus:border-blue-600 transition-colors font-mono font-bold cursor-pointer disabled:opacity-50"
                        >
                          {[1, 2, 3, 4, 5, 10, 15, 20].map(val => (
                            <option key={val} value={val}>{val} Account{val > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* Quick Access Control Actions */}
                    <td className="py-4 px-6 text-right">
                      {user.isAdmin ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewUserData(user)}
                            className="inline-flex items-center gap-1.5 text-[10px] bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-600/20 transition-colors font-semibold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect Data</span>
                          </button>
                          <span className="text-[10px] text-slate-400 font-mono italic">Root</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewUserData(user)}
                            className="inline-flex items-center gap-1.5 text-[10px] bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-600/20 transition-colors font-semibold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect Data</span>
                          </button>
                          {user.approved ? (
                            <button
                              disabled={updatingUid === user.uid}
                              onClick={() => updateApproval(user.uid, false)}
                              className="inline-flex items-center gap-1 text-[10px] bg-red-950/25 hover:bg-red-950/45 text-red-400 px-3 py-1.5 rounded-lg border border-red-900/30 transition-colors font-semibold cursor-pointer"
                            >
                              <UserMinus className="w-3.5 h-3.5 text-red-500" />
                              <span>Suspend</span>
                            </button>
                          ) : (
                            <button
                              disabled={updatingUid === user.uid}
                              onClick={() => updateApproval(user.uid, true)}
                              className="inline-flex items-center gap-1 text-[10px] bg-emerald-950/25 hover:bg-emerald-950/45 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-900/30 transition-colors font-semibold cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Approve</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
            <div className="text-[10px] text-slate-400 font-mono">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 bg-white hover:bg-slate-100 text-slate-400 rounded-lg border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-xs text-slate-900 font-mono font-semibold px-2">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-white hover:bg-slate-100 text-slate-400 rounded-lg border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>

      <div className="p-4 bg-blue-700/5 rounded-2xl border border-blue-600/10 flex items-start gap-3 text-xs text-slate-400">
        <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-900">Admin Capability:</strong> This panel reads and updates security policies securely within Firestore database path configurations. Approval settings default to <strong>false</strong> for general client registrations to guarantee strict administrative vetting before MT5 live connections can execute.
        </div>
      </div>

      {/* User subdata inspection modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedUser(null)}
          />
          
          <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col animate-slide-in">
            {/* Close Button */}
            <button 
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4 shrink-0">
              <img 
                src={selectedUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${selectedUser.uid}`} 
                alt={selectedUser.displayName} 
                className="w-12 h-12 rounded-full border border-slate-200"
                referrerPolicy="no-referrer"
              />
              <div>
                <h3 className="text-base font-display font-bold text-slate-900 flex items-center gap-2">
                  {selectedUser.displayName}
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    selectedUser.isAdmin 
                      ? 'bg-blue-50/25 text-blue-600 border-blue-100/30 font-semibold' 
                      : 'bg-slate-50 text-slate-500 border-slate-100'
                  }`}>
                    {selectedUser.isAdmin ? 'Admin' : 'Client / Trader'}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    selectedUser.approved 
                      ? 'bg-emerald-50/25 text-emerald-600 border-emerald-100/30' 
                      : 'bg-orange-50/25 text-orange-600 border-orange-100/30 font-semibold'
                  }`}>
                    {selectedUser.approved ? 'Approved' : 'Awaiting Approval'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">{selectedUser.email}</p>
                {selectedUser.phoneNumber && (
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">📞 {selectedUser.phoneNumber}</p>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto py-6 space-y-6">
              {inspectLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-xs text-slate-400 font-mono">Syncing complete user payload securely from Firestore...</p>
                </div>
              ) : inspectData ? (
                <div className="space-y-6">
                  {/* Grid of Config & Accounts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Column 1: Config */}
                    <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-4">
                      <div className="flex items-center gap-2 text-blue-600 border-b border-slate-100 pb-2">
                        <Sliders className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Terminal Bridge Configuration</h4>
                      </div>
                      {inspectData.config ? (
                        <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono uppercase">Lot Sizing Mode</span>
                            <span className="font-semibold text-slate-800">{inspectData.config.lotSizingMode || 'DynamicRisk'}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono uppercase">Fixed Lot Size</span>
                            <span className="font-semibold text-slate-800">{inspectData.config.fixedLotSize || '0.1'}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono uppercase">Stop Loss Points</span>
                            <span className="font-semibold text-slate-800">{inspectData.config.stopLossPoints || '10.0'}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono uppercase">Take Profit Points</span>
                            <span className="font-semibold text-slate-800">{inspectData.config.takeProfitPoints || '20.0'}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono uppercase">Risk Percent</span>
                            <span className="font-semibold text-slate-800">{inspectData.config.riskPercent || '1.0'}%</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono uppercase">Daily Profit Goal</span>
                            <span className="font-semibold text-slate-800">${inspectData.config.dailyProfitGoal || '500'}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono uppercase">Passphrase</span>
                            <span className="font-mono bg-slate-200/60 px-1.5 py-0.5 rounded text-[10px] text-slate-850 truncate block max-w-[150px]" title={inspectData.config.passphrase}>
                              {inspectData.config.passphrase || 'None'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No custom configuration synced yet.</p>
                      )}
                    </div>

                    {/* Column 2: Funded Accounts */}
                    <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-4">
                      <div className="flex items-center gap-2 text-blue-600 border-b border-slate-100 pb-2">
                        <Award className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Funded Prop Accounts ({inspectData.fundedAccounts.length})</h4>
                      </div>
                      {inspectData.fundedAccounts.length > 0 ? (
                        <div className="space-y-3 max-h-[180px] overflow-y-auto">
                          {inspectData.fundedAccounts.map((acc: any, i: number) => (
                            <div key={acc.id || i} className="bg-white border border-slate-100 rounded-lg p-2.5 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-semibold text-slate-850">{acc.propFirm}</span>
                                <span className="text-[10px] text-slate-400 font-mono ml-2">#{acc.accountId}</span>
                                <div className="text-[10px] text-slate-400 mt-0.5">Server: {acc.mt5Server || 'Default'} • {acc.platform || 'MT5'}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-slate-900">${acc.currentBalance?.toLocaleString()}</div>
                                <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-mono ${
                                  acc.status === 'Authorized' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {acc.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic py-4 text-center">No authorized prop-firm accounts.</p>
                      )}
                    </div>
                  </div>

                  {/* Execution history block */}
                  <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-blue-600 border-b border-slate-100 pb-2">
                      <TrendingUp className="w-4 h-4" />
                      <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Webhook Execution History ({inspectData.signals.length} Signals)</h4>
                    </div>
                    {inspectData.signals.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-400 font-mono">
                              <th className="py-2">Time</th>
                              <th className="py-2">Type / Pair</th>
                              <th className="py-2">Lot Size</th>
                              <th className="py-2">Price</th>
                              <th className="py-2">Status</th>
                              <th className="py-2 text-right">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {inspectData.signals.slice(0, 10).map((sig: any, i: number) => (
                              <tr key={sig.id || i} className="hover:bg-slate-50/30">
                                <td className="py-2 font-mono text-[10px] text-slate-400">
                                  {new Date(sig.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="py-2 font-semibold">
                                  <span className={`mr-1 px-1 py-0.5 rounded text-[10px] ${sig.type === 'BUY' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'bg-rose-50 text-rose-600 font-bold'}`}>{sig.type}</span>
                                  {sig.symbol}
                                </td>
                                <td className="py-2 font-mono font-medium">{sig.lotSize}</td>
                                <td className="py-2 font-mono">${sig.price?.toFixed(2)}</td>
                                <td className="py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                    sig.status === 'Executed' ? 'bg-emerald-50 text-emerald-600' : sig.status === 'Failed' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                                  }`}>
                                    {sig.status}
                                  </span>
                                </td>
                                <td className="py-2 text-right font-mono text-[10px] text-slate-400 max-w-[150px] truncate" title={sig.executionDetails}>
                                  {sig.executionDetails || 'No output'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {inspectData.signals.length > 10 && (
                          <p className="text-[10px] text-slate-400 italic text-center mt-3 font-mono">Truncated; showing first 10 signals</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic py-4 text-center">No signals executed on this profile yet.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs italic">
                  Could not retrieve user profile data
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 pt-4 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
