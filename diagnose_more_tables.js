
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('Querying for all table names in public schema...');

    // Direct SQL via RPC if enabled, or just try to select from pg_tables
    // Note: Anon key usually can't do this, but if they have a custom 'get_schema' RPC...
    const { data, error } = await supabase.rpc('get_schema_info');
    if (error) {
        console.log('RPC get_schema_info not found.');
    } else {
        console.log('Schema info:', data);
        return;
    }

    // Try one more common table name: 'animal' (singular)
    const { error: e1 } = await supabase.from('animal').select('id').limit(1);
    if (!e1) console.log('Table [animal] exists.');

    const { error: e2 } = await supabase.from('records').select('id').limit(1);
    if (!e2) console.log('Table [records] exists.');
}

diagnose();
