
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    const columnsToCheck = [
        'id', 'tagNumber', 'name', 'category', 'status', 'farm',
        'inseminationDate', 'semenName', 'expectedCalvingDate',
        'calvingDate', 'remarks', 'medications', 'lastUpdated',
        'motherId', 'calvesIds', 'user_id', 'image', 'images'
    ];

    console.log('Checking columns one by one...');
    for (const col of columnsToCheck) {
        const { error } = await supabase
            .from('animals')
            .select(col)
            .limit(1);

        if (error) {
            console.log(`Column [${col}] : MISSING (${error.message})`);
        } else {
            console.log(`Column [${col}] : PRESENT`);
        }
    }
}

diagnose();
