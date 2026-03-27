import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('animals').select('*').limit(1);
    if (error) console.error(error);
    else if (data && data.length > 0) console.log('Columns:', Object.keys(data[0]));
    else console.log('No data found, but table exists.');
}
check();
