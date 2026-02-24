
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('Fetching list of tables from rpc (if available)...');
    // Sometimes Supabase has a 'get_tables' or similar if configured, or we can use a query that often works
    const { data, error } = await supabase.rpc('get_tables');

    if (error) {
        console.log('RPC get_tables not available. Trying direct query for tables...');
    } else {
        console.log('Tables found via RPC:', data);
        return;
    }

    // Fallback: try to select from information_schema (might fail with anon key)
    const { data: data2, error: error2 } = await supabase
        .from('animals')
        .select('count')
        .limit(1);

    console.log('Animals table exists. Checking others by guessing...');
    const common = ['animals', 'profiles', 'users', 'transactions', 'milking_records', 'cattle', 'heifers', 'calves'];
    for (const t of common) {
        const { error: e } = await supabase.from(t).select('id').limit(1);
        if (!e) console.log(`Table [${t}] exists.`);
    }
}

diagnose();
