import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { vpsFetch } from '@/lib/vpsApi';

type FavoriteToolsResponse = {
  ok: boolean;
  favorites: string[];
};

export function useFavoriteTools() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorite-tools', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await vpsFetch<FavoriteToolsResponse>('/me/favorite-tools');
      return response.favorites || [];
    },
    enabled: !!user,
  });

  const toggleFavorite = useMutation({
    mutationFn: async (toolId: string) => {
      if (!user) return;
      const isFav = favorites.includes(toolId);
      await vpsFetch('/me/favorite-tools/toggle', {
        method: 'POST',
        body: JSON.stringify({ toolId, favorite: !isFav }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-tools', user?.id] });
    },
  });

  return { favorites, isLoading, toggleFavorite: toggleFavorite.mutate };
}
