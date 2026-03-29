-- Migration: Add upi_id to profiles for direct P2P payments
ALTER TABLE profiles ADD COLUMN upi_id text;
