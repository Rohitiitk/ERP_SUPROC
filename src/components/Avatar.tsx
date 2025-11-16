// src/components/Avatar.tsx

import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Upload } from 'lucide-react';

interface AvatarProps {
  url: string | null;
  size: number;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
}

export default function Avatar({ url, size, onUpload, uploading }: AvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (url) downloadImage(url);
  }, [url]);

  const downloadImage = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from('avatars').download(path);
      if (error) {
        throw error;
      }
      const url = URL.createObjectURL(data);
      setAvatarUrl(url);
    } catch (error) {
      console.log('Error downloading image: ', error);
    }
  };

  return (
    <div style={{ width: size, height: size }} className="relative rounded-xl">
      <img
        src={avatarUrl || `https://placehold.co/${size}x${size}/EBF4FF/7F9CF5?text=No+Image`}
        alt="Avatar"
        className="rounded-xl object-cover w-full h-full"
        style={{ width: size, height: size }}
      />
      <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 flex items-center justify-center rounded-xl transition-all duration-300">
        <label htmlFor="single" className="cursor-pointer text-white opacity-0 hover:opacity-100">
          {uploading ? 'Uploading...' : <Upload size={24} />}
        </label>
        <input
          style={{
            visibility: 'hidden',
            position: 'absolute',
          }}
          type="file"
          id="single"
          accept="image/*"
          onChange={onUpload}
          disabled={uploading}
        />
      </div>
    </div>
  );
}
