import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Save, KeyRound } from 'lucide-react';

export default function ProfileSettings() {
    const { user, refreshProfile } = useAuth();
    const [name, setName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        if (user?.id) {
            fetchUserProfile();
        }
    }, [user]);

    const fetchUserProfile = async () => {
        const { data, error } = await supabase
            .schema('faculty_leave')
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .single();

        if (!error && data) {
            setName(data.name || '');
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        // Validate passwords if user wants to change password
        if (newPassword && newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match!' });
            return;
        }

        if (newPassword && newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
            return;
        }

        setLoading(true);

        try {
            // 1. Update Name in profiles table
            const { error: profileError } = await supabase
                .schema('faculty_leave')
                .from('profiles')
                .update({ name })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // 2. Update Password in Supabase Auth (if entered)
            if (newPassword) {
                const { error: authError } = await supabase.auth.updateUser({
                    password: newPassword
                });

                if (authError) throw authError;
            }

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setNewPassword('');
            setConfirmPassword('');
            await refreshProfile(); // Update Navbar name instantly
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto py-8 px-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                        <User size={22} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Profile Settings</h2>
                        <p className="text-xs text-slate-500">Update your full name or account password</p>
                    </div>
                </div>

                {message.text && (
                    <div className={`p-3 rounded-xl mb-6 text-xs font-semibold ${message.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                    {/* Change Name */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <User size={14} /> Full Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-slate-50/50"
                        />
                    </div>

                    <hr className="border-slate-100" />

                    {/* Change Password */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <KeyRound size={16} className="text-indigo-600" /> Change Password
                        </h3>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Lock size={14} /> New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Leave blank to keep current password"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-slate-50/50"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Lock size={14} /> Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter new password"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-slate-50/50"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                        >
                            <Save size={16} />
                            {loading ? 'Saving Changes...' : 'Save Profile'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}