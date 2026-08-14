-- Clear all transactional data (leave requests & substitution engagements)
-- Preserves all user accounts in faculty_leave.profiles

TRUNCATE TABLE faculty_leave.lecture_engagements, faculty_leave.leave_requests CASCADE;

-- Optional: Reset all faculty and HoD leave balances back to default 12 days
UPDATE faculty_leave.profiles
SET leave_balance = 12
WHERE role != 'ADMIN';
