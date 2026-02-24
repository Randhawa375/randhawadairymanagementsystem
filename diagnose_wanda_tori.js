
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('Checking for Wanda and Tori tables...');
    const tables = ['wanda', 'tori', 'wanda_records', 'tori_records', 'milk_data', 'expenses'];
    for (const t of tables) {
        const { error } = await supabase.from(t).select('id').limit(1);
        if (!error) console.log(`Table [${t}] exists.`);
    }
}

diagnose();
