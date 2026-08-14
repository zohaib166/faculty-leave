-- PostgreSQL Schema Update & Trigger Definition for Faculty Leave System
-- Database Schema: faculty_leave

-- 1. Ensure Profiles table leave_balance column supports fractional values (NUMERIC/DECIMAL)
ALTER TABLE faculty_leave.profiles 
ALTER COLUMN leave_balance TYPE NUMERIC(5,2);

-- 2. Trigger function to handle leave balance deduction based on duration
CREATE OR REPLACE FUNCTION faculty_leave.deduct_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
    deduct_val NUMERIC := 1.0;
BEGIN
    -- Only trigger deduction when status transitions to APPROVED or APPROVED_BY_OVERRIDE
    IF (NEW.status IN ('APPROVED', 'APPROVED_BY_OVERRIDE')) 
       AND (OLD.status NOT IN ('APPROVED', 'APPROVED_BY_OVERRIDE') OR OLD.status IS NULL) THEN

        -- Determine deduction value based on duration string
        IF NEW.duration = 'HALF_DAY_FIRST' 
           OR NEW.duration = 'HALF_DAY_SECOND' 
           OR NEW.duration LIKE 'HALF_DAY%' THEN
            deduct_val := 0.5;
        ELSE
            deduct_val := 1.0;
        END IF;

        -- Deduct from the applicant's leave balance in profiles table
        UPDATE faculty_leave.profiles
        SET leave_balance = GREATEST(0, leave_balance - deduct_val)
        WHERE id = NEW.applicant_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop trigger if already exists and recreate
DROP TRIGGER IF EXISTS trigger_deduct_leave_balance ON faculty_leave.leave_requests;

CREATE TRIGGER trigger_deduct_leave_balance
AFTER UPDATE ON faculty_leave.leave_requests
FOR EACH ROW
EXECUTE FUNCTION faculty_leave.deduct_leave_balance();
