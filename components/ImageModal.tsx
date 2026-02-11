
import React from 'react';
import { X, Download } from 'lucide-react';

interface ImageModalProps {
    imageUrl: string;
    onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose }) => {
    if (!imageUrl) return null;

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `animal_image_${new Date().getTime()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8 bg-black/95 backdrop-blur-xl transition-opacity duration-300"
            onClick={onClose}
        >
            <div
                className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top Controls */}
                <div className="absolute top-0 right-0 left-0 flex justify-between items-center p-4 z-10">
                    <button
                        onClick={handleDownload}
                        className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md border border-white/20 shadow-lg"
                        title="Download Image"
                    >
                        <Download size={24} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md border border-white/20 shadow-lg"
                        title="Close"
                    >
                        <X size={32} />
                    </button>
                </div>

                {/* Image Display */}
                <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-3xl">
                    <img
                        src={imageUrl}
                        alt="Full size"
                        className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                    />
                </div>

                {/* Bottom Hint (Mobile Friendly) */}
                <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">
                    Tap anywhere outside to close
                </p>
            </div>
        </div>
    );
};

export default ImageModal;
