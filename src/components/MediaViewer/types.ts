export type MediaItem = {
  id: number;
  filepath: string;
  filename: string;
  type: string;
  thumbnail_path: string;
  width: number;
  height: number;
  duration?: number;
  size?: number;
  created_at?: string;
};

export type TagType = {
  id: number;
  name: string;
};
