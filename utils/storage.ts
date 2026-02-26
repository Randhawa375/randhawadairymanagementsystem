
import { supabase } from '../lib/supabase';
import { generateId } from './helpers';
import imageCompression from 'browser-image-compression';

export const uploadImage = async (file: File): Promise<string | null> => {
    try {
        let fileToUpload = file;

        // Compress image before upload
        if (file.type.startsWith('image/')) {
            try {
                const options = {
                    maxSizeMB: 0.8, // Target ~800KB
                    maxWidthOrHeight: 1600, // HD Quality
                    useWebWorker: true,
                    initialQuality: 0.8
                };
                fileToUpload = await imageCompression(file, options);
            } catch (compressionError) {
                console.warn('Image compression failed, falling back to original file:', compressionError);
            }
        }

        const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
        const fileName = `${generateId()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, fileToUpload);

        if (uploadError) {
            console.error('Error uploading image to Supabase:', uploadError);
            if (uploadError.message.includes('row-level security policy')) {
                throw new Error('Upload failed: Permissions error (RLS). Please contact the administrator to verify storage bucket policies.');
            }
            throw new Error(`Upload failed: ${uploadError.message}`);
        }

        const { data } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (error: any) {
        console.error('Error in uploadImage utility:', error);
        throw error;
    }
};
