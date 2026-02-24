
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    const columnsToCheck = [
        'category', 'medications', 'lastUpdated',
        'motherId', 'calvesIds', 'user_id'
    ];

    console.log('Checking remaining columns...');
    for (const col of columnsToCheck) {
        try {
            const { error } = await supabase
                .from('animals')
                .select(col)
                .limit(1);

            if (error) {
                console.log(`Column [${col}] : MISSING (${error.message})`);
            } else {
                console.log(`Column [${col}] : PRESENT`);
            }
        } catch (e) {
            console.log(`Column [${col}] : ERROR (${e.message})`);
        }
    }
}

diagnose();
