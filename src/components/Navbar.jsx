import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User, ShieldAlert, Settings, FileText } from 'lucide-react';

export default function Navbar() {
    const { profile, logout, isHod, isAdmin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    if (!profile) return null;

    return (
        <nav className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

                {/* User Info */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <User size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-100">{profile.name}</span>
                            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                {profile.role}
                            </span>
                        </div>
                        {profile.role !== 'ADMIN' && (
                            <p className="text-xs text-slate-400">
                                Leave Balance: <span className="text-indigo-400 font-bold">{profile.leave_balance} Days</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Dynamic Nav Controls */}
                <div className="flex items-center gap-3">

                    {/* Admin Navigation */}
                    {profile.role === 'ADMIN' && (
                        <button
                            onClick={() => navigate('/admin')}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white shadow-sm hover:bg-amber-700 transition-all flex items-center gap-1.5"
                        >
                            <ShieldAlert size={15} />
                            Admin Console
                        </button>
                    )}

                    {/* Faculty Navigation (non-HoD, non-Admin) */}
                    {!isHod && !isAdmin && (
                        <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/50 flex gap-1">
                            <button
                                onClick={() => navigate('/')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${location.pathname === '/' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                                    }`}
                            >
                                Apply Leave
                            </button>
                            <button
                                onClick={() => navigate('/substitute-requests')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${location.pathname === '/substitute-requests' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                                    }`}
                            >
                                Substitute Requests
                            </button>
                        </div>
                    )}

                    {/* HoD Navigation */}
                    {isHod && (
                        <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/50 flex gap-1">
                            <button
                                onClick={() => navigate('/')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${location.pathname === '/' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                                    }`}
                            >
                                Apply Leave
                            </button>
                            <button
                                onClick={() => navigate('/hod-portal')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${location.pathname === '/hod-portal' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                                    }`}
                            >
                                HoD Approvals
                            </button>
                            <button
                                onClick={() => navigate('/reports')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                                    location.pathname === '/reports' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-400'
                                }`}
                            >
                                <FileText size={13} />
                                Reports
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => navigate('/profile')}
                        className={`p-2 rounded-xl transition-all ${
                            location.pathname === '/profile'
                                ? 'text-indigo-400 bg-slate-800'
                                : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800'
                        }`}
                        title="Profile Settings"
                    >
                        <Settings size={18} />
                    </button>

                    <button
                        onClick={logout}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-all"
                        title="Sign Out"
                    >
                        <LogOut size={18} />
                    </button>
                </div>

            </div>
        </nav>
    );
}
