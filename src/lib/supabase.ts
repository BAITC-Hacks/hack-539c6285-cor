import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fjfpyvnvxxyfjsixtqst.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZnB5dm52eHh5ZmpzaXh0cXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzY1NTIsImV4cCI6MjA4OTI1MjU1Mn0.BeVw3ZNCesZIh8GiyW91akGOjqWc_wAXHeqeOBgUIkw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
