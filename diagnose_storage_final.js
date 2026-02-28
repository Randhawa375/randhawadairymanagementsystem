
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env vars from .env files if they exist or use placeholders
// In a real scenario, I'd read these from the project config
const supabaseUrl = 'https://kluxftjsibdnbsrppbuf.supabase.co';
const supabaseKey = 'sb_publishable_kSNNSnvMba81clr7hyUDSA_8VL2CM3l';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseStorage() {
    console.log('--- SUPABASE STORAGE DIAGNOSTIC ---');
    console.log('URL:', supabaseUrl);

    // 1. Check Bucket Existence
    console.log('\n1. Checking "images" bucket...');
    const { data: bucketData, error: bucketGetError } = await supabase.storage.getBucket('images');

    if (bucketGetError) {
        console.error('Error getting "images" bucket details:', bucketGetError.message);
    } else {
        console.log('SUCCESS: getBucket("images") worked.');
        console.log('Bucket Name:', bucketData.id);
        console.log('Public:', bucketData.public);
    }

    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
        console.error('Error listing buckets:', bucketError.message);
    } else {
        const imagesBucket = buckets.find(b => b.id === 'images');
        if (imagesBucket) {
            console.log('SUCCESS: "images" bucket exists.');
            console.log('Public:', imagesBucket.public);
        } else {
            console.error('ERROR: "images" bucket NOT FOUND.');
            console.log('Available buckets:', buckets.map(b => b.id).join(', '));
        }
    }

    // 2. Test Upload
    console.log('\n2. Testing Upload...');
    const testFileName = `diag_${Date.now()}.txt`;
    const testContent = 'diagnostic test content';

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('images')
        .upload(testFileName, testContent, {
            contentType: 'text/plain',
            upsert: true
        });

    if (uploadError) {
        console.error('UPLOAD FAILED:', uploadError.message);
        if (uploadError.message.includes('row-level security')) {
            console.log('CAUSE: RLS Policy violation. The user needs to run the SQL mentioned in walkthrough.md');
        }
    } else {
        console.log('UPLOAD SUCCESS:', uploadData.path);

        // 3. Test Public URL
        const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(testFileName);
        console.log('Public URL:', urlData.publicUrl);

        // 4. Test Database Insertion with that URL
        console.log('\n3. Testing Database Insertion (Animals table)...');
        const testAnimalId = `test_${Date.now()}`;
        const testUserId = '00000000-0000-0000-0000-000000000000'; // Dummy UUID
        const { data: insertData, error: insertError } = await supabase
            .from('animals')
            .insert([
                {
                    id: testAnimalId,
                    tagNumber: 'DIAG-999',
                    category: 'Female Calf',
                    status: 'Child',
                    farm: 'Milking Farm',
                    image: urlData.publicUrl,
                    user_id: testUserId,
                    lastUpdated: new Date().toISOString()
                }
            ])
            .select();

        if (insertError) {
            console.error('DB INSERT FAILED:', insertError.message);
            if (insertError.message.includes('permission denied')) {
                console.log('CAUSE: Database RLS Policy violation for "animals" table.');
            }
        } else {
            console.log('DB INSERT SUCCESS:', insertData[0].id);
            // Cleanup DB
            await supabase.from('animals').delete().eq('id', testAnimalId);
            console.log('DB Cleanup successful.');
        }

        // 5. Cleanup Storage
        await supabase.storage.from('images').remove([testFileName]);
        console.log('Storage Cleanup successful.');
    }
}

diagnoseStorage();
