import React, { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { SidebarNav } from "@/components/navbar/sidenavbar";
import { PageMediaCarousel } from "@/components/media/PageMediaCarousel";
import { tmdbApi, type TMDBSeries } from "@/lib/tmdb";
import { useLocation, useNavigate } from "react-router-dom";

const TvPage: React.FC = () => {
  usePageTitle("Shows • Uira.Live");
  const navigate = useNavigate();
  const location = useLocation();

  const [popular, setPopular] = useState<TMDBSeries[]>([]);
  const [topRated, setTopRated] = useState<TMDBSeries[]>([]);
  const [recent, setRecent] = useState<TMDBSeries[]>([]);
  const [romantic, setRomantic] = useState<TMDBSeries[]>([]);
  const [horror, setHorror] = useState<TMDBSeries[]>([]);
  const [actionSciFi, setActionSciFi] = useState<TMDBSeries[]>([]);
  const [familyDrama, setFamilyDrama] = useState<TMDBSeries[]>([]);
  const [documentary, setDocumentary] = useState<TMDBSeries[]>([]);
  const [fantasy, setFantasy] = useState<TMDBSeries[]>([]);
  const [crime, setCrime] = useState<TMDBSeries[]>([]);
  const [warPolitics, setWarPolitics] = useState<TMDBSeries[]>([]);
  const [animation, setAnimation] = useState<TMDBSeries[]>([]);
  const [kids, setKids] = useState<TMDBSeries[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [
          popularRes,
          topRatedRes,
          recentRes,
          romanticRes,
          horrorRes,
          actionSciFiRes,
          familyDramaRes,
          documentaryRes,
          fantasyRes,
          crimeRes,
          warPoliticsRes,
          animationRes,
          kidsRes,
        ] = await Promise.all([
          tmdbApi.getPopularTV(),
          tmdbApi.discoverTV({
            sort_by: "vote_average.desc",
            "vote_count.gte": 500,
          }),
          tmdbApi.discoverTV({ sort_by: "first_air_date.desc" }),
          tmdbApi.discoverTV({ with_genres: "10749", sort_by: "popularity.desc" }),
          tmdbApi.discoverTV({ with_genres: "9648", sort_by: "popularity.desc" }),
          tmdbApi.discoverTV({ with_genres: "10759|10765", sort_by: "popularity.desc" }),
          tmdbApi.discoverTV({ with_genres: "10751,18", sort_by: "popularity.desc" }),
          tmdbApi.discoverTV({ with_genres: "99", sort_by: "popularity.desc" }),
          tmdbApi.discoverTV({ with_genres: "10765", sort_by: "popularity.desc" }),
          tmdbApi.discoverTV({ with_genres: "80,9648", sort_by: "popularity.desc" }),
          tmdbApi.discoverTV({ with_genres: "10768", sort_by: "popularity.desc" }),
          tmdbApi.discoverTV({ with_genres: "16", sort_by: "popularity.desc" }),
          tmdbApi.discoverTV({ with_genres: "10762", sort_by: "popularity.desc" }),
        ]);

        setPopular(popularRes.results ?? []);
        setTopRated(topRatedRes.results ?? []);
        setRecent(recentRes.results ?? []);
        setRomantic(romanticRes.results ?? []);
        setHorror(horrorRes.results ?? []);
        setActionSciFi(actionSciFiRes.results ?? []);
        setFamilyDrama(familyDramaRes.results ?? []);
        setDocumentary(documentaryRes.results ?? []);
        setFantasy(fantasyRes.results ?? []);
        setCrime(crimeRes.results ?? []);
        setWarPolitics(warPoliticsRes.results ?? []);
        setAnimation(animationRes.results ?? []);
        setKids(kidsRes.results ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const mapSeries = (items: TMDBSeries[]) =>
    items.map((s) => ({
      id: s.id,
      title: s.name,
      poster_path: s.poster_path,
      backdrop_path: s.backdrop_path,
      release_date: s.first_air_date,
      rating: s.vote_average,
      media_type: "tv" as const,
    }));

  return (
    <div className="min-h-screen bg-[var(--theme-content)] text-[var(--theme-foreground)] flex">
      <SidebarNav />

      <main className="flex-1 sm:ml-28 pb-12 pt-6 space-y-10 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-white/10 border-t-white animate-spin" />
            <p className="text-sm text-white/40 tracking-widest uppercase">
              Loading shows
            </p>
          </div>
        ) : (
          <>
            <header className="px-4 sm:px-8 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
                  TV Shows
                </h1>
                <p className="text-sm text-white/60 max-w-xl mt-1">
                  Binge-worthy series, fresh episodes, and hidden gems.
                </p>
              </div>
            </header>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Popular Today"
                items={mapSeries(popular)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Top Rated"
                items={mapSeries(topRated)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Latest Episodes"
                items={mapSeries(recent)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Romantic Series"
                items={mapSeries(romantic)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Horror & Mystery"
                items={mapSeries(horror)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Action & Sci‑Fi"
                items={mapSeries(actionSciFi)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Family & Drama"
                items={mapSeries(familyDrama)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Documentary Series"
                items={mapSeries(documentary)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Fantasy Worlds"
                items={mapSeries(fantasy)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Crime & Investigation"
                items={mapSeries(crime)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="War & Politics"
                items={mapSeries(warPolitics)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Animated Series"
                items={mapSeries(animation)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>

            <section className="pl-4 sm:pl-8">
              <PageMediaCarousel
                title="Kids Shows"
                items={mapSeries(kids)}
                onItemClick={(item) =>
                  navigate(`/tv/${item.id}`, { state: { backgroundLocation: location } })
                }
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default TvPage;