import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export interface InspectionPhoto {
  id: string;
  watchId?: string;
  jobId?: string;
  customerId?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  photoType: 'intake' | 'during_service' | 'completed' | 'damage' | 'before' | 'after' | 'reference';
  description?: string;
  createdAt: string;
  updatedAt: string;
  watch?: {
    id: string;
    brand?: string;
    model?: string;
  };
  job?: {
    id: string;
    jobId: string;
  };
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export function useInspectionPhotos(params?: {
  watchId?: string;
  jobId?: string;
  customerId?: string;
  photoType?: string;
}) {
  return useQuery({
    queryKey: ['inspection-photos', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.watchId) searchParams.append('watchId', params.watchId);
      if (params?.jobId) searchParams.append('jobId', params.jobId);
      if (params?.customerId) searchParams.append('customerId', params.customerId);
      if (params?.photoType) searchParams.append('photoType', params.photoType);

      const { data } = await api.get<{ success: boolean; data: InspectionPhoto[] }>(
        `/v1/inspection-photos?${searchParams.toString()}`
      );
      return data.data;
    },
  });
}

export function useInspectionPhoto(id: string) {
  return useQuery({
    queryKey: ['inspection-photos', id],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: InspectionPhoto }>(
        `/v1/inspection-photos/${id}`
      );
      return data.data;
    },
    enabled: !!id,
  });
}

export function useUploadInspectionPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post('/v1/inspection-photos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-photos'] });
    },
  });
}

export function useUpdateInspectionPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      description,
      photoType,
    }: {
      id: string;
      description?: string;
      photoType?: string;
    }) => {
      const { data } = await api.patch(`/v1/inspection-photos/${id}`, {
        description,
        photoType,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-photos'] });
    },
  });
}

export function useDeleteInspectionPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/v1/inspection-photos/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-photos'] });
    },
  });
}
