import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Check, X } from 'lucide-react';

export default function SubRequests() {
    const { user } = useAuth();
    const [engagements, setEngagements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPendingEngagements();

        // Subscribe to real-time updates for substitute alerts
        const channel = supabase
            .channel('sub_updates')
            .on('postgres_changes', { event: '*', schema: 'faculty_leave', table: 'lecture_engagements' }, () => {
                fetchPendingEngagements();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [user]);

    const fetchPendingEngagements = async () => {
        const { data, error } = await supabase
            .from('lecture_engagements')
            .select('*, leave_requests(leave_date, reason, applicant_id, profiles!leave_requests_applicant_id_fkey(name))')
            .eq('substitute_id', user.id)
            .order('updated_at', { ascending: false });

        if (!error) setEngagements(data || []);
        setLoading(false);
    };

    const handleAction = async (engagementId, newStatus) => {
        const { error } = await supabase
            .from('lecture_engagements')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', engagementId);

        if (error) {
            alert('Error: ' + error.message);
        } else {
            fetchPendingEngagements();
        }
    };

    if (loading) return <div>Loading substitution requests...</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            <h2>Substitute Requests Assigned to You</h2>
            {engagements.length === 0 ? (
                <p>No substitution requests assigned to you.</p>
            ) : (
                engagements.map((item) => (
                    <div key={item.id} style={{ border: '1px solid #cbd5e1', padding: '15px', borderRadius: '8px', marginBottom: '15px', background: '#fff' }}>
                        <p><strong>Lecture Slot:</strong> {item.lecture_number}</p>
                        <p><strong>Date:</strong> {item.leave_requests?.leave_date}</p>
                        <p><strong>Applicant Reason:</strong> {item.leave_requests?.reason}</p>
                        <p><strong>Current Status:</strong> <span style={{ fontWeight: 'bold' }}>{item.status}</span></p>

                        {item.status === 'PENDING' && (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button onClick={() => handleAction(item.id, 'ACCEPTED')} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Check size={16} /> Accept
                                </button>
                                <button onClick={() => handleAction(item.id, 'REJECTED')} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <X size={16} /> Reject
                                </button>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}