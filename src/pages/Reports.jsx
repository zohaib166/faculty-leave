import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Calendar, Layers, UserCheck, Filter, RotateCcw, Download, FileSpreadsheet, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
    const [allProfiles, setAllProfiles] = useState([]);
    const [selectedFacultyId, setSelectedFacultyId] = useState('ALL');

    // Date Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [summary, setSummary] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [engagements, setEngagements] = useState([]);
    const [loading, setLoading] = useState(true);

    // Helper to calculate numerical value based on duration type
    const getDurationValue = (durationStr) => {
        if (durationStr && (durationStr === 'HALF_DAY_FIRST' || durationStr === 'HALF_DAY_SECOND' || durationStr.startsWith('HALF_DAY'))) {
            return 0.5;
        }
        return 1.0;
    };

    useEffect(() => {
        fetchReportData();
    }, []);

    const fetchReportData = async () => {
        setLoading(true);

        // 1. Fetch Profiles
        const { data: profiles } = await supabase
            .schema('faculty_leave')
            .from('profiles')
            .select('id, name, role, leave_balance')
            .order('name');

        // 2. Fetch Approved Leaves
        const { data: leaves } = await supabase
            .schema('faculty_leave')
            .from('leave_requests')
            .select('*, profiles:applicant_id(name)')
            .order('leave_date', { ascending: false });

        // 3. Fetch Lecture Engagements
        const { data: engs } = await supabase
            .schema('faculty_leave')
            .from('lecture_engagements')
            .select('*, substitute:substitute_id(name), leave_requests(leave_date, applicant_id, profiles:applicant_id(name))')
            .order('id', { ascending: false });

        if (profiles) {
            const facultyList = profiles.filter(p => p.role !== 'ADMIN');
            setAllProfiles(facultyList);

            // Aggregate totals per faculty member using decimal summing
            const summaryData = facultyList.map(faculty => {
                const approvedLeaves = (leaves || [])
                    .filter(l => l.applicant_id === faculty.id && l.status?.includes('APPROVED'))
                    .reduce((sum, req) => sum + getDurationValue(req.duration), 0);

                const engagedLectures = (engs || []).filter(
                    e => e.substitute_id === faculty.id && e.status === 'ACCEPTED'
                ).length;

                return {
                    id: faculty.id,
                    name: faculty.name,
                    role: faculty.role,
                    leave_balance: faculty.leave_balance,
                    approvedLeaves,
                    engagedLectures
                };
            });

            setSummary(summaryData);
        }

        if (leaves) setLeaveRequests(leaves);
        if (engs) setEngagements(engs);
        setLoading(false);
    };

    // Reset Filters Helper
    const clearFilters = () => {
        setSelectedFacultyId('ALL');
        setStartDate('');
        setEndDate('');
    };

    // --- Filtering & Aggregation Logic ---
    // 1. Filter Detailed Leaves
    const filteredLeaves = leaveRequests.filter(req => {
        const matchesFaculty = selectedFacultyId === 'ALL' || req.applicant_id === selectedFacultyId;
        const matchesStartDate = !startDate || (req.leave_date && req.leave_date >= startDate);
        const matchesEndDate = !endDate || (req.leave_date && req.leave_date <= endDate);

        return matchesFaculty && matchesStartDate && matchesEndDate;
    });

    // 2. Filter Detailed Engagements
    const filteredEngagements = engagements.filter(eng => {
        const matchesFaculty = selectedFacultyId === 'ALL' ||
            eng.substitute_id === selectedFacultyId ||
            eng.leave_requests?.applicant_id === selectedFacultyId;

        const engDate = eng.leave_requests?.leave_date;
        const matchesStartDate = !startDate || (engDate && engDate >= startDate);
        const matchesEndDate = !endDate || (engDate && engDate <= endDate);

        return matchesFaculty && matchesStartDate && matchesEndDate;
    });

    // 3. Filter & Dynamically Calculate Summary per Faculty based on Date Range
    const filteredSummary = allProfiles
        .filter(faculty => selectedFacultyId === 'ALL' || faculty.id === selectedFacultyId)
        .map(faculty => {
            const approvedLeaves = filteredLeaves
                .filter(l => l.applicant_id === faculty.id && l.status?.includes('APPROVED'))
                .reduce((sum, req) => sum + getDurationValue(req.duration), 0);

            const engagedLectures = filteredEngagements.filter(
                e => e.substitute_id === faculty.id && e.status === 'ACCEPTED'
            ).length;

            return {
                id: faculty.id,
                name: faculty.name,
                role: faculty.role,
                leave_balance: faculty.leave_balance,
                approvedLeaves,
                engagedLectures
            };
        });

    // --- Export Handlers ---
    const handleExportCSV = () => {
        const currentDate = new Date().toISOString().split('T')[0];
        const selectedFacultyName = selectedFacultyId === 'ALL'
            ? 'All_Faculty'
            : (allProfiles.find(f => f.id === selectedFacultyId)?.name || 'Faculty').replace(/\s+/g, '_');

        let csvContent = `data:text/csv;charset=utf-8,\uFEFF`; // UTF-8 BOM

        // Section 1: Report Metadata
        csvContent += `FACULTY LEAVE & ATTENDANCE HR AUDIT REPORT\n`;
        csvContent += `Generated Date: ${new Date().toLocaleString()}\n`;
        csvContent += `Faculty Filter: ${selectedFacultyId === 'ALL' ? 'All Faculty Members' : selectedFacultyName}\n`;
        csvContent += `Date Range Filter: ${startDate || 'Start'} to ${endDate || 'End'}\n\n`;

        // Section 2: Summary Overview
        csvContent += `--- FACULTY ACTIVITY SUMMARY ---\n`;
        csvContent += `Faculty Name,Role,Remaining Balance (Days),Approved Leaves Taken (Days),Proxy Lectures Engaged\n`;
        filteredSummary.forEach(item => {
            csvContent += `"${item.name}","${item.role}",${item.leave_balance},${item.approvedLeaves},${item.engagedLectures}\n`;
        });
        csvContent += `\n`;

        // Section 3: Detailed Leaves Log
        csvContent += `--- DETAILED LEAVE APPLICATIONS LOG ---\n`;
        csvContent += `Applicant,Date,Duration,Reason,Status\n`;
        filteredLeaves.forEach(req => {
            const durationText = `${req.duration} (${getDurationValue(req.duration)} Day)`;
            const cleanReason = (req.reason || '').replace(/"/g, '""');
            csvContent += `"${req.profiles?.name || 'Unknown'}","${req.leave_date}","${durationText}","${cleanReason}","${req.status}"\n`;
        });
        csvContent += `\n`;

        // Section 4: Substitute Lecture Engagements
        csvContent += `--- LECTURE SUBSTITUTION ENGAGEMENTS ---\n`;
        csvContent += `Original Faculty,Substitute Faculty,Lecture Slot,Leave Date,Status\n`;
        filteredEngagements.forEach(eng => {
            csvContent += `"${eng.leave_requests?.profiles?.name || 'N/A'}","${eng.substitute?.name || 'Unassigned'}","${eng.lecture_number}","${eng.leave_requests?.leave_date || 'N/A'}","${eng.status}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `HR_Leave_Report_${selectedFacultyName}_${currentDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const currentDate = new Date().toLocaleDateString();
        const currentTime = new Date().toLocaleTimeString();

        // 1. Header Banner
        doc.setFillColor(30, 41, 59); // Slate-900
        doc.rect(0, 0, 210, 28, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('INSTITUTIONAL FACULTY LEAVE & ATTENDANCE AUDIT', 14, 16);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated on: ${currentDate} ${currentTime}`, 14, 23);

        // 2. Filter Summary Sub-header
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Report Filter Parameters:', 14, 36);

        doc.setFont('helvetica', 'normal');
        const facultyText = selectedFacultyId === 'ALL'
            ? 'All Faculty Members'
            : (allProfiles.find(f => f.id === selectedFacultyId)?.name || 'Selected Faculty');
        const dateRangeText = (startDate || endDate) ? `${startDate || 'Beginning'} to ${endDate || 'Present'}` : 'All Dates';

        doc.text(`Faculty: ${facultyText}  |  Date Range: ${dateRangeText}`, 14, 42);

        let currentY = 48;

        // 3. Table 1: Faculty Activity Summary
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('1. Faculty Activity Summary', 14, currentY);

        autoTable(doc, {
            startY: currentY + 4,
            head: [['Faculty Name', 'Role', 'Remaining Balance', 'Approved Leaves Taken', 'Proxy Engaged']],
            body: filteredSummary.map(item => [
                item.name,
                item.role,
                `${item.leave_balance} Days`,
                `${item.approvedLeaves} Day(s)`,
                `${item.engagedLectures} Slot(s)`
            ]),
            headStyles: { fillColor: [79, 70, 229] },
            styles: { fontSize: 8, cellPadding: 3 }
        });

        currentY = doc.lastAutoTable.finalY + 10;

        // 4. Table 2: Detailed Leave Log
        if (currentY > 230) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('2. Detailed Leave Applications Log', 14, currentY);

        autoTable(doc, {
            startY: currentY + 4,
            head: [['Applicant', 'Leave Date', 'Duration', 'Reason', 'Status']],
            body: filteredLeaves.map(req => [
                req.profiles?.name || 'Unknown',
                req.leave_date,
                `${req.duration} (${getDurationValue(req.duration)} Day)`,
                req.reason || 'N/A',
                req.status
            ]),
            headStyles: { fillColor: [30, 41, 59] },
            styles: { fontSize: 8, cellPadding: 3 }
        });

        currentY = doc.lastAutoTable.finalY + 10;

        // 5. Table 3: Substitution Engagements Log
        if (currentY > 230) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('3. Lecture Substitution Engagements', 14, currentY);

        autoTable(doc, {
            startY: currentY + 4,
            head: [['Original Faculty', 'Substitute Faculty', 'Slot', 'Leave Date', 'Status']],
            body: filteredEngagements.map(eng => [
                eng.leave_requests?.profiles?.name || 'N/A',
                eng.substitute?.name || 'Unassigned',
                eng.lecture_number,
                eng.leave_requests?.leave_date || 'N/A',
                eng.status
            ]),
            headStyles: { fillColor: [16, 185, 129] },
            styles: { fontSize: 8, cellPadding: 3 }
        });

        // 6. Footer Signature Block
        const finalY = doc.lastAutoTable.finalY + 20;
        if (finalY < 270) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text('_______________________', 14, finalY);
            doc.text('Head of Department (Signature)', 14, finalY + 5);

            doc.text('_______________________', 140, finalY);
            doc.text('HR Compliance Officer (Signature)', 140, finalY + 5);
        }

        doc.save(`HR_Faculty_Leave_Report_${currentDate.replace(/\//g, '-')}.pdf`);
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading reports data...</div>;

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
            {/* Header & Filter Controls Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                        <FileText size={22} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Faculty Activity & Leave Reports</h2>
                        <p className="text-xs text-slate-500">Summary of leaves taken and proxy lectures engaged by each faculty member</p>
                    </div>
                </div>

                {/* Filter Controls Row */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Faculty Dropdown Filter */}
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-xl">
                            <Filter size={15} className="text-slate-400" />
                            <label htmlFor="faculty-select" className="text-xs font-semibold text-slate-600">
                                Faculty:
                            </label>
                            <select
                                id="faculty-select"
                                value={selectedFacultyId}
                                onChange={(e) => setSelectedFacultyId(e.target.value)}
                                className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
                            >
                                <option value="ALL">All Faculty Members</option>
                                {allProfiles.map(faculty => (
                                    <option key={faculty.id} value={faculty.id}>
                                        {faculty.name} ({faculty.role})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date Range Filters */}
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-xl">
                            <Calendar size={15} className="text-slate-400" />
                            <span className="text-xs font-semibold text-slate-600">From:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-xl">
                            <Calendar size={15} className="text-slate-400" />
                            <span className="text-xs font-semibold text-slate-600">To:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Export Action Buttons & Reset Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-sm cursor-pointer"
                            title="Export CSV Data for Excel"
                        >
                            <FileSpreadsheet size={15} />
                            Export CSV
                        </button>

                        <button
                            onClick={handleExportPDF}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-sm cursor-pointer"
                            title="Export PDF HR Audit Report"
                        >
                            <Printer size={15} />
                            Export PDF Audit
                        </button>

                        {(selectedFacultyId !== 'ALL' || startDate || endDate) && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all cursor-pointer"
                            >
                                <RotateCcw size={14} />
                                Reset Filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 1. Summary Overview Table */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <UserCheck size={18} className="text-indigo-600" />
                    Faculty Activity Summary
                </h3>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                            <tr>
                                <th className="p-3">Faculty Name</th>
                                <th className="p-3">Role</th>
                                <th className="p-3">Remaining Balance</th>
                                <th className="p-3">Approved Leaves Taken</th>
                                <th className="p-3">Substitute Lectures Engaged</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredSummary.length > 0 ? (
                                filteredSummary.map(item => (
                                    <tr key={item.id}>
                                        <td className="p-3 font-semibold text-slate-800">{item.name}</td>
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                                {item.role}
                                            </span>
                                        </td>
                                        <td className="p-3 font-medium text-slate-700">{item.leave_balance} Days</td>
                                        <td className="p-3 font-bold text-indigo-600">{item.approvedLeaves}</td>
                                        <td className="p-3 font-bold text-emerald-600">{item.engagedLectures}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="p-4 text-center text-slate-500 text-xs">
                                        No faculty record found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 2. All Leave Requests Log */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Calendar size={18} className="text-indigo-600" />
                    Detailed Leave Applications Log
                </h3>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                            <tr>
                                <th className="p-3">Applicant</th>
                                <th className="p-3">Date</th>
                                <th className="p-3">Duration</th>
                                <th className="p-3">Reason</th>
                                <th className="p-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredLeaves.length > 0 ? (
                                filteredLeaves.map(req => (
                                    <tr key={req.id}>
                                        <td className="p-3 font-medium text-slate-800">{req.profiles?.name || 'Unknown'}</td>
                                        <td className="p-3 text-slate-600">{req.leave_date}</td>
                                        <td className="p-3 text-slate-600">
                                            {req.duration} ({getDurationValue(req.duration)} Day)
                                        </td>
                                        <td className="p-3 text-slate-600">{req.reason}</td>
                                        <td className="p-3">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                                req.status?.includes('APPROVED') ? 'bg-emerald-100 text-emerald-700' :
                                                req.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                                {req.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="p-4 text-center text-slate-500 text-xs">
                                        No leave applications match the selected criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 3. All Substitute Lecture Engagements Log */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Layers size={18} className="text-indigo-600" />
                    Lecture Substitution Engagements
                </h3>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                            <tr>
                                <th className="p-3">Original Faculty</th>
                                <th className="p-3">Substitute Faculty</th>
                                <th className="p-3">Lecture Slot</th>
                                <th className="p-3">Leave Date</th>
                                <th className="p-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEngagements.length > 0 ? (
                                filteredEngagements.map(eng => (
                                    <tr key={eng.id}>
                                        <td className="p-3 font-medium text-slate-800">{eng.leave_requests?.profiles?.name || 'N/A'}</td>
                                        <td className="p-3 font-medium text-slate-800">{eng.substitute?.name || 'Unassigned'}</td>
                                        <td className="p-3 text-slate-600">{eng.lecture_number}</td>
                                        <td className="p-3 text-slate-600">{eng.leave_requests?.leave_date || 'N/A'}</td>
                                        <td className="p-3">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                                eng.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' :
                                                eng.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                                {eng.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="p-4 text-center text-slate-500 text-xs">
                                        No substitution engagements match the selected criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
