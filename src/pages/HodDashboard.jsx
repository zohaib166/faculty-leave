import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HodDashboard() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchHodRequests();

        const channel = supabase
            .channel('hod_updates')
            .on('postgres_changes', { event: '*', schema: 'faculty_leave', table: 'leave_requests' }, () => {
                fetchHodRequests();
            })
            .on('postgres_changes', { event: '*', schema: 'faculty_leave', table: 'lecture_engagements' }, () => {
                fetchHodRequests();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    const fetchHodRequests = async () => {
        const { data, error } = await supabase
            .schema('faculty_leave')
            .from('leave_requests')
            .select('*, profiles!leave_requests_applicant_id_fkey(name, leave_balance), lecture_engagements(*)')
            .order('created_at', { ascending: false });

        if (!error) setRequests(data || []);
        setLoading(false);
    };

    const allSubstitutesAccepted = (engagements) => {
        if (!engagements || engagements.length === 0) return true;
        return engagements.every((eng) => eng.status === 'ACCEPTED');
    };

    // Helper to extract numerical leave value from request duration
    const getDurationValue = (durationStr) => {
        if (durationStr && (durationStr === 'HALF_DAY_FIRST' || durationStr === 'HALF_DAY_SECOND' || durationStr.startsWith('HALF_DAY'))) {
            return 0.5;
        }
        return 1.0;
    };

    const updateLeaveStatus = async (requestId, newStatus, applicantId, durationStr) => {
        // 1. Update the leave request status in database
        const { error: updateError } = await supabase
            .schema('faculty_leave')
            .from('leave_requests')
            .update({ status: newStatus })
            .eq('id', requestId);

        if (updateError) {
            alert('Error updating status: ' + updateError.message);
            return;
        }

        // 2. If APPROVED or APPROVED_BY_OVERRIDE, update profile leave_balance in database
        if (newStatus === 'APPROVED' || newStatus === 'APPROVED_BY_OVERRIDE') {
            const leaveValue = getDurationValue(durationStr);

            // Fetch current profile balance to ensure accurate subtraction
            const { data: profile } = await supabase
                .schema('faculty_leave')
                .from('profiles')
                .select('leave_balance')
                .eq('id', applicantId)
                .single();

            if (profile) {
                const currentBalance = Number(profile.leave_balance ?? 12);
                const updatedBalance = currentBalance - leaveValue;

                const { error: balanceError } = await supabase
                    .schema('faculty_leave')
                    .from('profiles')
                    .update({ leave_balance: updatedBalance })
                    .eq('id', applicantId);

                if (balanceError) {
                    alert('Status updated, but failed to deduct leave balance: ' + balanceError.message);
                }
            }
        }

        // Refresh dashboard items
        fetchHodRequests();
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading requests...</div>;

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
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

            <h2 className="text-xl font-bold text-slate-800 mb-6">Head of Department (HoD) Approval Dashboard</h2>

            {requests.length === 0 ? (
                <p className="text-slate-500">No leave requests found.</p>
            ) : (
                requests.map((req) => {
                    const substitutesReady = allSubstitutesAccepted(req.lecture_engagements);

                    return (
                        <div key={req.id} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm mb-4">
                            <h3 className="font-bold text-slate-800">Applicant: {req.profiles?.name}</h3>
                            <p className="text-sm text-slate-600"><strong>Date:</strong> {req.leave_date} | <strong>Duration:</strong> {req.duration}</p>
                            <p className="text-sm text-slate-600"><strong>Reason:</strong> {req.reason}</p>
                            <p className="text-sm text-slate-600"><strong>Overall Status:</strong> <span className="font-semibold text-indigo-600">{req.status}</span></p>

                            <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500 mt-4 mb-2">Lecture Substitutions Status:</h4>
                            <ul className="space-y-1 text-sm text-slate-700">
                                {req.lecture_engagements?.map((eng) => (
                                    <li key={eng.id}>
                                        {eng.lecture_number} — Status: <strong className={eng.status === 'ACCEPTED' ? 'text-emerald-600' : eng.status === 'REJECTED' ? 'text-rose-600' : 'text-amber-600'}>{eng.status}</strong>
                                    </li>
                                ))}
                            </ul>

                            {req.status === 'APPROVED' || req.status === 'APPROVED_BY_OVERRIDE' || req.status === 'REJECTED' ? (
                                <div className="mt-3 text-xs font-semibold text-slate-500 bg-slate-100 p-2 rounded-lg inline-block">
                                    Status locked: Request is <span className="uppercase text-indigo-600">{req.status}</span>
                                </div>
                            ) : (
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => updateLeaveStatus(req.id, 'APPROVED', req.applicant_id, req.duration)}
                                        disabled={!substitutesReady}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg text-white ${
                                            substitutesReady ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed'
                                        }`}
                                    >
                                        Approve Leave
                                    </button>

                                    <button
                                        onClick={() => updateLeaveStatus(req.id, 'REJECTED', req.applicant_id, req.duration)}
                                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
                                    >
                                        Reject
                                    </button>

                                    <button
                                        onClick={() => updateLeaveStatus(req.id, 'APPROVED_BY_OVERRIDE', req.applicant_id, req.duration)}
                                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
                                    >
                                        Emergency Override
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}
