
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('Testing connection...');
    const { data, error } = await supabase
        .from('animals')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching animals (*):', error);
    } else {
        console.log('Successfully fetched 1 animal with (*):', data);
    }

    console.log('Testing specific columns...');
    const { data: data2, error: error2 } = await supabase
        .from('animals')
        .select('id, tagNumber, name, category, status, farm, inseminationDate, semenName, expectedCalvingDate, calvingDate, remarks, medications, lastUpdated, motherId, calvesIds')
        .limit(1);

    if (error2) {
        console.error('Error fetching animals (specific columns):', error2);
    } else {
        console.log('Successfully fetched 1 animal with specific columns.');
    }
}

diagnose();
