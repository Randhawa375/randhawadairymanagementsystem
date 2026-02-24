
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('Running exact App.tsx query (without user_id filter first)...');
    const { data, error } = await supabase
        .from('animals')
        .select('id, tagNumber, name, category, status, farm, inseminationDate, semenName, expectedCalvingDate, calvingDate, remarks, medications, lastUpdated, motherId, calvesIds');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success! Data returned:', data);
    }
}

diagnose();
