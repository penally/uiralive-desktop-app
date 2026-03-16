import React, { useEffect, useState } from "react";
import { SidebarNav } from "@/components/navbar/sidenavbar";
import { usePageTitle } from "@/hooks/usePageTitle";
import { anilistApi, type AniListMedia } from "@/lib/anilist";
import AnimeCarousel from "@/components/anime/AnimeCarousel";
import AnimeHeroCarousel from "@/components/anime/AnimeHeroCarousel";
import AnimeDetailModal from "@/components/anime/AnimeDetailModal";

const AnimePage: React.FC = () => {
  usePageTitle("Anime • Uira.Live");

  const [trending, setTrending] = useState<AniListMedia[]>([]);
  const [popular, setPopular] = useState<AniListMedia[]>([]);
  const [topRated, setTopRated] = useState<AniListMedia[]>([]);
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [tr, pop, top] = await Promise.all([
          anilistApi.getTrendingAnime(),
          anilistApi.getPopularAnime(),
          anilistApi.getTopRatedAnime(),
        ]);
        setTrending(tr);
        setPopular(pop);
        setTopRated(top);
      } catch (e) {
        console.error(e);
      }
    };
    void load();
  }, []);

  const handleItemClick = (media: AniListMedia) => {
    setSelectedAnimeId(media.id);
    setIsDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-[var(--theme-content)] text-[var(--theme-foreground)]">
      <SidebarNav />
      {/* Hero background, same pattern as Home */}
      <AnimeHeroCarousel />

      <main className="sm:ml-28">
        <div className="relative pt-8 sm:pt-10 px-4 sm:px-8 bg-[var(--theme-content)] space-y-10 pb-12 max-w-7xl mx-auto">
          <header className="space-y-3">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
              Anime
            </h1>
            <p className="text-sm text-white/60 max-w-xl">
              Discover trending series, fan favorites, and critically acclaimed
              anime powered by AniList.
            </p>
          </header>

          <section>
            <AnimeCarousel
              title="Trending Now"
              items={trending}
              onItemClick={handleItemClick}
            />
          </section>

          <section>
            <AnimeCarousel
              title="Most Popular"
              items={popular}
              onItemClick={handleItemClick}
            />
          </section>

          <section>
            <AnimeCarousel
              title="Top Rated"
              items={topRated}
              onItemClick={handleItemClick}
            />
          </section>
        </div>
      </main>

      <AnimeDetailModal
        open={isDetailOpen}
        animeId={selectedAnimeId}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
};

export default AnimePage;

