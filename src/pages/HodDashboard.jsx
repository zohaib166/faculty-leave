import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function HodDashboard() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

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
            .from('leave_requests')
            .select('*, profiles!leave_requests_applicant_id_fkey(name), lecture_engagements(*)')
            .order('created_at', { ascending: false });

        if (!error) setRequests(data || []);
        setLoading(false);
    };

    const allSubstitutesAccepted = (engagements) => {
        if (!engagements || engagements.length === 0) return true;
        return engagements.every((eng) => eng.status === 'ACCEPTED');
    };

    const updateLeaveStatus = async (requestId, newStatus) => {
        const { error } = await supabase
            .from('leave_requests')
            .update({ status: newStatus })
            .eq('id', requestId);

        if (error) {
            alert('Error updating status: ' + error.message);
        } else {
            fetchHodRequests();
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading requests...</div>;

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
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

                            {/* PASTE YOUR CODE SNIPPET RIGHT HERE */}
                            {req.status === 'APPROVED' || req.status === 'APPROVED_BY_OVERRIDE' || req.status === 'REJECTED' ? (
                                <div className="mt-3 text-xs font-semibold text-slate-500 bg-slate-100 p-2 rounded-lg inline-block">
                                    Status locked: Request is <span className="uppercase text-indigo-600">{req.status}</span>
                                </div>
                            ) : (
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => updateLeaveStatus(req.id, 'APPROVED')}
                                        disabled={!substitutesReady}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg text-white ${substitutesReady ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed'
                                            }`}
                                    >
                                        Approve Leave
                                    </button>

                                    <button
                                        onClick={() => updateLeaveStatus(req.id, 'REJECTED')}
                                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
                                    >
                                        Reject
                                    </button>

                                    <button
                                        onClick={() => updateLeaveStatus(req.id, 'APPROVED_BY_OVERRIDE')}
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