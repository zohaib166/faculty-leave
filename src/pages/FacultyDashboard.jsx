import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Send, Calendar, Clock, FileText, Layers, Bell, CheckCircle, XCircle, History } from 'lucide-react';

export default function FacultyDashboard() {
    const { user } = useAuth();
    const [leaveDate, setLeaveDate] = useState('');
    const [duration, setDuration] = useState('FULL_DAY');
    const [reason, setReason] = useState('');
    const [lectures, setLectures] = useState([{ lecture_number: '', substitute_id: '' }]);
    const [facultyList, setFacultyList] = useState([]);
    const [myRequests, setMyRequests] = useState([]);
    const [assignedEngagements, setAssignedEngagements] = useState([]);
    const [loading, setLoading] = useState(false);

    const getDurationValue = (durationStr) => {
        if (durationStr && (durationStr === 'HALF_DAY_FIRST' || durationStr === 'HALF_DAY_SECOND' || durationStr.startsWith('HALF_DAY'))) {
            return 0.5;
        }
        return 1.0;
    };

    useEffect(() => {
        if (user?.id) {
            fetchFacultyMembers();
            fetchMyLeaveRequests();
            fetchAssignedEngagements();
        }
    }, [user]);

    const fetchFacultyMembers = async () => {
        const { data, error } = await supabase
            .schema('faculty_leave')
            .from('profiles')
            .select('id, name')
            .neq('id', user.id)
            .neq('role', 'ADMIN'); // Exclude admin from the substitute list

        if (!error && data) setFacultyList(data);
    };

    const fetchMyLeaveRequests = async () => {
        const { data, error } = await supabase
            .schema('faculty_leave')
            .from('leave_requests')
            .select('*, lecture_engagements(*)')
            .eq('applicant_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && data) setMyRequests(data);
    };

    const fetchAssignedEngagements = async () => {
        const { data, error } = await supabase
            .schema('faculty_leave')
            .from('lecture_engagements')
            .select(`
        id,
        lecture_number,
        status,
        updated_at,
        leave_requests (
          leave_date,
          reason,
          applicant_id,
          profiles:applicant_id ( name )
        )
      `)
            .eq('substitute_id', user.id)
            .order('id', { ascending: false });

        if (!error && data) setAssignedEngagements(data);
    };

    const handleRespondEngagement = async (engagementId, accept) => {
        const newStatus = accept ? 'ACCEPTED' : 'REJECTED';

        const { error } = await supabase
            .schema('faculty_leave')
            .from('lecture_engagements')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', engagementId);

        if (error) {
            alert('Failed to update engagement: ' + error.message);
        } else {
            alert(`Lecture engagement set to ${newStatus}`);
            fetchAssignedEngagements();
        }
    };

    const handleAddLecture = () => {
        setLectures([...lectures, { lecture_number: '', substitute_id: '' }]);
    };

    const handleRemoveLecture = (index) => {
        setLectures(lectures.filter((_, i) => i !== index));
    };

    const handleLectureChange = (index, field, value) => {
        const updated = [...lectures];
        updated[index][field] = value;
        setLectures(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: leave, error: leaveErr } = await supabase
                .schema('faculty_leave')
                .from('leave_requests')
                .insert([{
                    applicant_id: user.id,
                    leave_date: leaveDate,
                    duration,
                    reason,
                    status: 'PENDING_SUBSTITUTES'
                }])
                .select()
                .single();

            if (leaveErr) throw leaveErr;

            if (lectures.length > 0 && lectures[0].lecture_number) {
                const engagementPayload = lectures.map(lec => ({
                    leave_request_id: leave.id,
                    lecture_number: lec.lecture_number,
                    substitute_id: lec.substitute_id || null,
                    status: 'PENDING'
                }));

                const { error: engErr } = await supabase
                    .schema('faculty_leave')
                    .from('lecture_engagements')
                    .insert(engagementPayload);

                if (engErr) throw engErr;
            }

            alert('Leave request submitted successfully!');
            setLeaveDate('');
            setReason('');
            setLectures([{ lecture_number: '', substitute_id: '' }]);
            fetchMyLeaveRequests();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Separate pending requests from actioned (Accepted/Rejected) requests
    const pendingEngagements = assignedEngagements.filter(item => item.status === 'PENDING');
    const pastEngagements = assignedEngagements.filter(item => item.status !== 'PENDING');

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">

            {/* TOP BANNER: Only active pending action requests appear here */}
            {pendingEngagements.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-base border-b border-amber-200/60 pb-3">
                        <Bell className="text-amber-600 animate-bounce" size={20} />
                        <span>Action Required: Pending Lecture Engagements ({pendingEngagements.length})</span>
                    </div>

                    <div className="divide-y divide-amber-200/60">
                        {pendingEngagements.map((item) => {
                            const applicantName = item.leave_requests?.profiles?.name || 'A faculty member';
                            const leaveDateVal = item.leave_requests?.leave_date || 'N/A';

                            return (
                                <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-amber-950">{item.lecture_number}</span>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
                                                {item.status}
                                            </span>
                                        </div>

                                        <p className="text-sm text-amber-900">
                                            Requested by <span className="font-semibold">{applicantName}</span> for leave on{' '}
                                            <span className="font-semibold">{leaveDateVal}</span>.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => handleRespondEngagement(item.id, true)}
                                            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                        >
                                            <CheckCircle size={14} /> Accept
                                        </button>
                                        <button
                                            onClick={() => handleRespondEngagement(item.id, false)}
                                            className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                        >
                                            <XCircle size={14} /> Reject
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Main Leave Application Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Calendar size={22} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Apply for Leave</h2>
                        <p className="text-xs text-slate-500">Submit a new leave application with lecture arrangements</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Calendar size={14} /> Leave Date
                            </label>
                            <input
                                type="date"
                                value={leaveDate}
                                onChange={e => setLeaveDate(e.target.value)}
                                required
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-slate-50/50"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Clock size={14} /> Duration
                            </label>
                            <select
                                value={duration}
                                onChange={e => setDuration(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-slate-50/50"
                            >
                                <option value="FULL_DAY">Full Day</option>
                                <option value="HALF_DAY_FIRST">Half Day (1st Half)</option>
                                <option value="HALF_DAY_SECOND">Half Day (2nd Half)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <FileText size={14} /> Reason for Leave
                        </label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Provide detail for leave request..."
                            required
                            rows={3}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-slate-50/50"
                        />
                    </div>

                    <div className="space-y-4 pt-2">
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers size={14} /> Lecture Substitutions
                        </label>

                        {lectures.map((lec, index) => (
                            <div key={index} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                                <select
                                    value={lec.lecture_number}
                                    onChange={e => handleLectureChange(index, 'lecture_number', e.target.value)}
                                    required
                                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                                >
                                    <option value="">Select Lecture</option>
                                    <option value="Lecture I">Lecture I</option>
                                    <option value="Lecture II">Lecture II</option>
                                    <option value="Lecture III">Lecture III</option>
                                    <option value="Lecture IV">Lecture IV</option>
                                    <option value="Lecture V">Lecture V</option>
                                    <option value="Lecture VI">Lecture VI</option>
                                </select>

                                <select
                                    value={lec.substitute_id}
                                    onChange={e => handleLectureChange(index, 'substitute_id', e.target.value)}
                                    required
                                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                                >
                                    <option value="">Select Substitute Faculty</option>
                                    {facultyList.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>

                                {lectures.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveLecture(index)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={handleAddLecture}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-3 py-2 rounded-lg transition-all"
                        >
                            <Plus size={15} /> Add Lecture
                        </button>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                        >
                            <Send size={16} />
                            {loading ? 'Submitting...' : 'Submit Leave Request'}
                        </button>
                    </div>
                </form>
            </div>

            {/* BOTTOM SECTION: Past Actioned Substitutions */}
            {pastEngagements.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                        <History className="text-slate-500" size={18} />
                        <h3 className="text-base font-bold text-slate-800">Assigned Engagements History</h3>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {pastEngagements.map((item) => {
                            const applicantName = item.leave_requests?.profiles?.name || 'Faculty Member';
                            const leaveDateVal = item.leave_requests?.leave_date || 'N/A';

                            return (
                                <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 text-sm">{item.lecture_number}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' :
                                                item.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                                                    'bg-purple-100 text-purple-800'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Requested by <span className="font-medium text-slate-700">{applicantName}</span> for <span className="font-medium text-slate-700">{leaveDateVal}</span>
                                        </p>
                                    </div>

                                    <span className="text-xs text-slate-400 font-medium shrink-0">
                                        Updated: {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* History Card for User's Own Leave Applications */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
                <h3 className="text-lg font-bold text-slate-800 mb-4">My Leave History</h3>

                <div className="space-y-3">
                    {myRequests.length === 0 ? (
                        <p className="text-sm text-slate-500 py-4 text-center">No leave requests submitted yet.</p>
                    ) : (
                        myRequests.map(req => (
                            <div key={req.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800 text-sm">{req.leave_date}</span>
                                        <span className="text-xs text-slate-500">({req.duration} — {getDurationValue(req.duration)} Day)</span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1">{req.reason}</p>
                                </div>

                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${req.status?.includes('APPROVED')
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : req.status === 'REJECTED'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                    {req.status}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    );
}