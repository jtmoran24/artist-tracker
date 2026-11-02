import Form from "next/form";
import { SubmitButton } from "@/components/SubmitButton";
import { searchPlaces, type Place } from "@/utils/geocode";
import { requireUser } from "@/utils/supabase/server";
import { addLocation, deleteLocation, updateLocation } from "./actions";
import { RADIUS_OPTIONS_KM } from "./radius";

type Location = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  active: boolean;
};

function RadiusSelect({ defaultValue }: { defaultValue: number }) {
  return (
    <select name="radius_km" defaultValue={defaultValue} aria-label="Alert radius" className="input">
      {RADIUS_OPTIONS_KM.map((km) => (
        <option key={km} value={km}>
          {km} km
        </option>
      ))}
    </select>
  );
}

export default async function LocationsPage(props: PageProps<"/locations">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const { supabase } = await requireUser();

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, latitude, longitude, radius_km, active")
    .order("created_at")
    .returns<Location[]>();

  let places: Place[] = [];
  let searchError: string | null = null;
  if (query) {
    try {
      places = await searchPlaces(query);
    } catch (error) {
      searchError = error instanceof Error ? error.message : "Search failed";
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="vapor-heading mb-1 text-4xl">Locations</h1>
      <p className="pixel mb-6 text-xl text-sage">
        ロケーション · alerts cover shows within the radius of any active location
      </p>

      <Form action="/locations" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search for a city"
          className="input min-w-0 flex-1"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </Form>

      {query && (
        <section className="mt-4">
          <h2 className="pixel mb-2 text-xl text-cyan">search results</h2>
          {searchError ? (
            <p className="panel p-4 text-pink">{searchError}</p>
          ) : places.length === 0 ? (
            <p className="panel p-4 text-sage">No places found for “{query}”.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {places.map((place) => (
                <li key={place.id} className="panel p-3">
                  <form action={addLocation} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="name" value={place.name} />
                    <input type="hidden" name="latitude" value={place.latitude} />
                    <input type="hidden" name="longitude" value={place.longitude} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-pale">{place.name}</div>
                      <div className="pixel text-lg text-sage">
                        {[place.region, place.country].filter(Boolean).join(", ")}
                      </div>
                    </div>
                    <RadiusSelect defaultValue={50} />
                    <SubmitButton className="btn btn-primary" pendingText="…">
                      Add
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="vapor-heading mb-3 text-2xl">
          Your locations ({locations?.length ?? 0})
        </h2>
        {!locations || locations.length === 0 ? (
          <p className="panel p-6 text-sage">
            No locations yet. Search above to add one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {locations.map((location) => (
              <li
                key={location.id}
                className="panel flex flex-wrap items-center gap-3 p-3"
              >
                <div className={`min-w-0 flex-1 ${location.active ? "" : "opacity-50"}`}>
                  <div className="font-semibold text-pale">
                    {location.name}
                    {!location.active && (
                      <span className="chip ml-2 text-pink">paused</span>
                    )}
                  </div>
                  <div className="pixel text-lg text-sage">
                    {location.latitude.toFixed(2)}, {location.longitude.toFixed(2)}
                  </div>
                </div>
                <form action={updateLocation} className="flex gap-1">
                  <input type="hidden" name="locationId" value={location.id} />
                  <RadiusSelect defaultValue={Number(location.radius_km)} />
                  <SubmitButton className="btn" pendingText="…">
                    Save
                  </SubmitButton>
                </form>
                <form action={updateLocation}>
                  <input type="hidden" name="locationId" value={location.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={location.active ? "false" : "true"}
                  />
                  <SubmitButton className="btn">
                    {location.active ? "Pause" : "Resume"}
                  </SubmitButton>
                </form>
                <form action={deleteLocation}>
                  <input type="hidden" name="locationId" value={location.id} />
                  <SubmitButton className="btn btn-danger" pendingText="…">
                    Remove
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
