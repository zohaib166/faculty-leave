import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { UserPlus, Shield, UserCheck, UserX, Trash2, Edit3, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Secondary client instance to allow signUp without signing out the active Admin
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
});

export default function AdminDashboard() {
    const [users, setUsers] = useState([]);
    const navigate = useNavigate();

    // New User Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('FACULTY');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        const { data, error } = await supabase.from('profiles').select('*').order('name');
        if (!error && data) setUsers(data);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreating(true);

        try {
            // 1. Register Auth User natively via Supabase
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email,
                password,
                options: {
                    data: { name }
                }
            });

            if (authError) throw authError;

            const newUserId = authData.user?.id;

            if (newUserId) {
                // 2. Insert corresponding Profile Record
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: newUserId,
                        name,
                        email,
                        role,
                        leave_balance: role === 'ADMIN' ? 0 : 12,
                        is_active: true
                    });

                if (profileError) throw profileError;

                alert(`User ${name} created successfully!`);
                setName('');
                setEmail('');
                setPassword('');
                fetchUsers();
            }
        } catch (err) {
            alert('Error creating user: ' + err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleUpdateBalance = async (userId, currentBalance) => {
        const newBal = prompt('Enter new leave balance:', currentBalance);

        if (newBal !== null && !isNaN(newBal) && newBal.trim() !== '') {
            const parsedBalance = parseFloat(newBal);

            const { error } = await supabase
                .from('profiles')
                .update({ leave_balance: parsedBalance })
                .eq('id', userId);

            if (error) {
                alert('Failed to update leave balance: ' + error.message);
            } else {
                alert('Leave balance updated successfully!');
                fetchUsers();
            }
        }
    };

    const handleToggleStatus = async (userId, currentStatus) => {
        const nextStatus = !currentStatus;
        const actionName = nextStatus ? 'activate' : 'deactivate';

        if (confirm(`Are you sure you want to ${actionName} this user?`)) {
            const { error } = await supabase.rpc('admin_toggle_user_status', {
                target_user_id: userId,
                status_flag: nextStatus
            });

            if (error) {
                alert('Action failed: ' + error.message);
            } else {
                fetchUsers();
            }
        }
    };

    const handleDeleteUser = async (userId, userName) => {
        if (confirm(`Are you sure you want to PERMANENTLY DELETE user "${userName}"? This action cannot be undone.`)) {
            const { error } = await supabase.rpc('admin_delete_user', {
                target_user_id: userId
            });

            if (error) {
                alert('Delete failed: ' + error.message);
            } else {
                fetchUsers();
            }
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">

            {/* Reports Quick Access Banner */}
            <div
                onClick={() => navigate('/reports')}
                className="flex items-center justify-between bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer p-4 rounded-2xl shadow-lg shadow-indigo-600/20"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl">
                        <FileText size={20} className="text-white" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm">Faculty Activity & Leave Reports</p>
                        <p className="text-indigo-200 text-xs">View full summary of leaves, substitutions & faculty activity</p>
                    </div>
                </div>
                <span className="text-white text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-all">
                    Open Reports →
                </span>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-6 text-slate-800">
                    <UserPlus size={20} className="text-indigo-600" />
                    <h2 className="text-lg font-bold">Add New User</h2>
                </div>

                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <input
                        type="text"
                        placeholder="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/50"
                    />
                    <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/50"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/50"
                    />
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/50"
                    >
                        <option value="FACULTY">Faculty</option>
                        <option value="HOD">HOD</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                    <button
                        type="submit"
                        disabled={creating}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl py-2 transition-all shadow-md shadow-indigo-600/20"
                    >
                        {creating ? 'Creating...' : 'Create Account'}
                    </button>
                </form>
            </div>

            {/* 2. User Accounts Management */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-6 text-slate-800">
                    <Shield size={20} className="text-indigo-600" />
                    <h2 className="text-lg font-bold">User Management & Accounts</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                            <tr>
                                <th className="p-3">Name</th>
                                <th className="p-3">Email</th>
                                <th className="p-3">Role</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Leave Balance</th>
                                <th className="p-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((u) => {
                                const isActive = u.is_active !== false;

                                return (
                                    <tr key={u.id}>
                                        <td className="p-3 font-medium text-slate-800">{u.name}</td>
                                        <td className="p-3 text-slate-600">{u.email}</td>
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                                }`}>
                                                {isActive ? 'Active' : 'Deactivated'}
                                            </span>
                                        </td>
                                        <td className="p-3 font-semibold text-slate-800">
                                            {u.role === 'ADMIN' ? 'N/A' : `${u.leave_balance} Days`}
                                        </td>
                                        <td className="p-3 flex items-center gap-3">
                                            {/* Balance Edit Button */}
                                            {u.role !== 'ADMIN' && (
                                                <button
                                                    onClick={() => handleUpdateBalance(u.id, u.leave_balance)}
                                                    className="text-indigo-600 font-semibold hover:underline text-xs flex items-center gap-1"
                                                    title="Edit Leave Balance"
                                                >
                                                    <Edit3 size={14} /> Balance
                                                </button>
                                            )}

                                            {/* Deactivate / Reactivate Toggle */}
                                            <button
                                                onClick={() => handleToggleStatus(u.id, isActive)}
                                                className={`text-xs font-semibold flex items-center gap-1 ${isActive ? 'text-amber-600 hover:underline' : 'text-emerald-600 hover:underline'
                                                    }`}
                                            >
                                                {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                                                {isActive ? 'Deactivate' : 'Reactivate'}
                                            </button>

                                            {/* Delete Button */}
                                            <button
                                                onClick={() => handleDeleteUser(u.id, u.name)}
                                                className="text-rose-600 hover:text-rose-800 font-semibold text-xs flex items-center gap-1"
                                                title="Delete User"
                                            >
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}