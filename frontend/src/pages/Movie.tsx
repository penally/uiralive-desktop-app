import React, { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { SidebarNav } from "@/components/navbar/sidenavbar";
import { PageMediaCarousel } from "@/components/media/PageMediaCarousel";
import { tmdbApi, type TMDBMovie } from "@/lib/tmdb";
import { useLocation, useNavigate } from "react-router-dom";

const MoviePage: React.FC = () => {
  usePageTitle("Movies • Uira.Live");
  const navigate = useNavigate();
  const location = useLocation();

  const [popular, setPopular] = useState<TMDBMovie[]>([]);
  const [topRated, setTopRated] = useState<TMDBMovie[]>([]);
  const [recent, setRecent] = useState<TMDBMovie[]>([]);
  const [upcoming, setUpcoming] = useState<TMDBMovie[]>([]);
  const [romantic, setRomantic] = useState<TMDBMovie[]>([]);
  const [horror, setHorror] = useState<TMDBMovie[]>([]);
  const [actionSciFi, setActionSciFi] = useState<TMDBMovie[]>([]);
  const [familyDrama, setFamilyDrama] = useState<TMDBMovie[]>([]);
  const [documentary, setDocumentary] = useState<TMDBMovie[]>([]);
  const [fantasy, setFantasy] = useState<TMDBMovie[]>([]);
  const [crime, setCrime] = useState<TMDBMovie[]>([]);
  const [war, setWar] = useState<TMDBMovie[]>([]);
  const [adventure, setAdventure] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [popularRes, topRatedRes, recentRes, upcomingRes, romanticRes, horrorRes, actionSciFiRes, familyDramaRes, documentaryRes, fantasyRes, crimeRes, warRes, adventureRes] = await Promise.all([
          tmdbApi.getPopularMovies(),
          tmdbApi.discoverMovies({ sort_by: "vote_average.desc", "vote_count.gte": 500 }),
          tmdbApi.discoverMovies({ sort_by: "popularity.desc" }),
          tmdbApi.discoverMovies({ sort_by: "primary_release_date.desc" }),
          tmdbApi.discoverMovies({ sort_by: "primary_release_date.asc", "primary_release_date.gte": today }),
          tmdbApi.discoverMovies({ with_genres: "10749", sort_by: "popularity.desc" }),
          tmdbApi.discoverMovies({ with_genres: "27", sort_by: "popularity.desc" }),
          tmdbApi.discoverMovies({ with_genres: "28,878", sort_by: "popularity.desc" }),
          tmdbApi.discoverMovies({ with_genres: "10751,18", sort_by: "popularity.desc" }),
          tmdbApi.discoverMovies({ with_genres: "99", sort_by: "popularity.desc" }),
          tmdbApi.discoverMovies({ with_genres: "14", sort_by: "popularity.desc" }),
          tmdbApi.discoverMovies({ with_genres: "80", sort_by: "popularity.desc" }),
          tmdbApi.discoverMovies({ with_genres: "10752", sort_by: "popularity.desc" }),
          tmdbApi.discoverMovies({ with_genres: "12", sort_by: "popularity.desc" }),
        ]);
        setPopular(popularRes.results ?? []);
        setTopRated(topRatedRes.results ?? []);
        setRecent(recentRes.results ?? []);
        setUpcoming(upcomingRes.results ?? []);
        setRomantic(romanticRes.results ?? []);
        setHorror(horrorRes.results ?? []);
        setActionSciFi(actionSciFiRes.results ?? []);
        setFamilyDrama(familyDramaRes.results ?? []);
        setDocumentary(documentaryRes.results ?? []);
        setFantasy(fantasyRes.results ?? []);
        setCrime(crimeRes.results ?? []);
        setWar(warRes.results ?? []);
        setAdventure(adventureRes.results ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const mapMovie = (m: TMDBMovie) => ({
    id: m.id,
    title: m.title,
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path,
    release_date: m.release_date,
    rating: m.vote_average,
    media_type: "movie" as const,
  });

  const goToMovie = (item: { id: number }) =>
    navigate(`/movie/${item.id}`, { state: { backgroundLocation: location } });

  return (
    <div className="min-h-screen bg-[#070505] text-white flex">
      <SidebarNav />

      <main className="flex-1 sm:ml-28 pb-12 pt-6 space-y-10 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-white/10 border-t-white animate-spin" />
            <p className="text-sm text-white/40 tracking-widest uppercase">
              Loading movies
            </p>
          </div>
        ) : (
          <>
            <header className="px-4 sm:px-8 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
                  Movies
                </h1>
                <p className="text-sm text-white/60 max-w-xl mt-1">
                  Explore what&apos;s trending, highly rated, and newly released.
                </p>
              </div>
            </header>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="Popular Today" items={popular.map(mapMovie)} onItemClick={goToMovie} />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="Top Rated" items={topRated.map(mapMovie)} onItemClick={goToMovie} />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="Latest Releases" items={recent.map(mapMovie)} onItemClick={goToMovie} />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="Upcoming Releases" items={upcoming.map(mapMovie)} onItemClick={goToMovie} />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="Romantic" items={romantic.map(mapMovie)} onItemClick={goToMovie} />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="Horror" items={horror.map(mapMovie)} onItemClick={goToMovie} />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="Action & Sci-Fi" items={actionSciFi.map(mapMovie)} onItemClick={goToMovie} />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="Family & Drama" items={familyDrama.map(mapMovie)} onItemClick={goToMovie} />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="Documentary" items={documentary.map(mapMovie)} onItemClick={goToMovie} />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="Fantasy" items={fantasy.map(mapMovie)} onItemClick={goToMovie} />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="Crime" items={crime.map(mapMovie)} onItemClick={goToMovie} />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="War" items={war.map(mapMovie)} onItemClick={goToMovie} />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel title="Adventure" items={adventure.map(mapMovie)} onItemClick={goToMovie} />
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default MoviePage;