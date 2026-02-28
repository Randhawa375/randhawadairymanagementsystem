
import { supabase } from '../lib/supabase';
import { generateId } from './helpers';

export const uploadImage = async (file: File): Promise<string | null> => {
    try {
        console.log(`Starting upload for: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);

        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${generateId()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading image to Supabase:', uploadError);
            let userMsg = `Upload failed: ${uploadError.message}`;
            if (uploadError.message.includes('row-level security policy')) {
                userMsg = 'Upload failed: Permissions error (RLS). Please contact the administrator to verify storage bucket policies.';
            }
            window.alert(userMsg);
            throw new Error(userMsg);
        }

        const { data } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);

        console.log(`Upload successful: ${data.publicUrl}`);
        return data.publicUrl;
    } catch (error: any) {
        console.error('Error in uploadImage utility:', error);
        window.alert("CRITICAL UPLOAD ERROR: " + (error.message || "Unknown error"));
        throw error;
    }
};
