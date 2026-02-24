
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('Checking for rows with null user_id...');
    const { data, error } = await supabase
        .from('animals')
        .select('id, tagNumber, user_id')
        .is('user_id', null);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Rows with null user_id:', data.length);
        if (data.length > 0) {
            console.log('Sample row:', data[0]);
        }
    }

    console.log('Checking for ANY rows in the table...');
    const { data: allData, error: allErr } = await supabase
        .from('animals')
        .select('id, tagNumber, user_id')
        .limit(5);

    if (allErr) {
        console.error('Error:', allErr);
    } else {
        console.log('Total sample rows across all users:', allData.length);
        console.log('Rows:', allData);
    }
}

diagnose();
