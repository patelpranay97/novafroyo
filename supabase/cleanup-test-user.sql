-- Removes the account created during the security audit.
-- (Safe to run; it only deletes that one probe account.)

delete from auth.users
where email = 'totally.not.the.owner.9f3x@gmail.com';

-- Confirm who can log in at all:
select email, created_at, last_sign_in_at from auth.users order by created_at;
