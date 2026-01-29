
import { supabase } from '../lib/supabase';
import { generateId } from './helpers';

export const uploadImage = async (file: File): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${generateId()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('images') // Assumes a bucket named 'images' exists
            .upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading image:', uploadError);
            return null;
        }

        const { data } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (error) {
        console.error('Error in uploadImage:', error);
        return null;
    }
};
