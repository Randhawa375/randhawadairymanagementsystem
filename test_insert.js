
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log('Attempting to insert test animal...');
    const testAnimal = {
        id: 'test-id-' + Date.now(),
        tagNumber: 'TEST-001',
        name: 'Test Cow',
        category: 'Milking',
        status: 'Open',
        farm: 'Milking Farm',
        lastUpdated: new Date().toISOString(),
        user_id: '00000000-0000-0000-0000-000000000000' // Mock user ID or real one if known
    };

    const { data, error } = await supabase
        .from('animals')
        .insert(testAnimal)
        .select();

    if (error) {
        console.error('Error inserting test animal:', error);
    } else {
        console.log('Successfully inserted test animal:', data);
    }
}

testInsert();
