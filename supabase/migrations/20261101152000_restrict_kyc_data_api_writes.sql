-- Direct PostgREST insertion could spoof a reviewing partner and all-clear screening.
-- KYC creation and review use the authenticated server API; clients can read only.
revoke insert,update,delete on public.prospect_kyc_reviews from authenticated;
