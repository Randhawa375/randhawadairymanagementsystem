
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('Listing tables (if permission allows)...');
    // Note: standard anon keys often don't have access to information_schema.
    // We can try to guess or use a common table name.

    // Try common table names
    const tablesToTry = ['animals', 'animal_records', 'inventory', 'farm_data'];
    for (const table of tablesToTry) {
        const { data, error } = await supabase.from(table).select('count').limit(1);
        if (error) {
            console.log(`Table [${table}] : NOT FOUND or ERROR (${error.message})`);
        } else {
            console.log(`Table [${table}] : FOUND`);
        }
    }

    // Try to count animals
    const { count, error: countError } = await supabase
        .from('animals')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('Error counting animals:', countError);
    } else {
        console.log('Total animals in [animals] table (any user):', count);
    }
}

diagnose();
