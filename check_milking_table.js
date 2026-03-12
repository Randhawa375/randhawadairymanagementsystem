
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMilkingTable() {
    console.log('Checking for milking_records table...');
    const { data, error } = await supabase
        .from('milking_records')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error or table missing:', error.message);
    } else {
        console.log('Table milking_records exists. Sample data:', data);

        // Let's try to guess content columns if it's empty
        const possibleCols = ['id', 'animal_id', 'date', 'morning_milk', 'evening_milk', 'total_milk', 'user_id', 'created_at', 'tag_number'];
        console.log('Checking columns for milking_records...');
        for (const col of possibleCols) {
            const { error: e } = await supabase.from('milking_records').select(col).limit(1);
            if (!e) console.log(`Column [${col}] : PRESENT`);
            else console.log(`Column [${col}] : MISSING`);
        }
    }
}

checkMilkingTable();
