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

const buttonClass = "rounded-md border px-3 py-1 text-sm disabled:opacity-40";
const primaryButtonClass =
  "rounded-md bg-black px-3 py-1 text-sm text-white disabled:opacity-40";
const selectClass = "rounded-md border px-2 py-1 text-sm";

function RadiusSelect({ defaultValue }: { defaultValue: number }) {
  return (
    <select name="radius_km" defaultValue={defaultValue} className={selectClass}>
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
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Locations</h1>
      <p className="mb-4 text-sm text-gray-500">
        You get alerts for shows within the radius of any active location.
      </p>

      <Form action="/locations" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search for a city"
          className="flex-1 rounded-md border px-3 py-2"
        />
        <button type="submit" className={primaryButtonClass}>
          Search
        </button>
      </Form>

      {query && (
        <section className="mt-4">
          {searchError ? (
            <p className="text-red-600">{searchError}</p>
          ) : places.length === 0 ? (
            <p className="text-gray-500">No places found for “{query}”.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {places.map((place) => (
                <li key={place.id} className="rounded-md border p-3">
                  <form action={addLocation} className="flex items-center gap-3">
                    <input type="hidden" name="name" value={place.name} />
                    <input type="hidden" name="latitude" value={place.latitude} />
                    <input type="hidden" name="longitude" value={place.longitude} />
                    <div className="flex-1">
                      <div className="font-medium">{place.name}</div>
                      <div className="text-xs text-gray-500">
                        {[place.region, place.country].filter(Boolean).join(", ")}
                      </div>
                    </div>
                    <RadiusSelect defaultValue={50} />
                    <SubmitButton className={primaryButtonClass} pendingText="Adding…">
                      Add
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">
          Your locations ({locations?.length ?? 0})
        </h2>
        {!locations || locations.length === 0 ? (
          <p className="text-gray-500">
            No locations yet. Search above to add one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {locations.map((location) => (
              <li
                key={location.id}
                className="flex flex-wrap items-center gap-3 rounded-md border p-3"
              >
                <div className={`flex-1 ${location.active ? "" : "opacity-50"}`}>
                  <div className="font-medium">
                    {location.name}
                    {!location.active && (
                      <span className="ml-2 text-xs uppercase text-gray-500">
                        paused
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {location.latitude.toFixed(2)}, {location.longitude.toFixed(2)}
                  </div>
                </div>
                <form action={updateLocation} className="flex gap-1">
                  <input type="hidden" name="locationId" value={location.id} />
                  <RadiusSelect defaultValue={Number(location.radius_km)} />
                  <SubmitButton className={buttonClass} pendingText="Saving…">
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
                  <SubmitButton className={buttonClass}>
                    {location.active ? "Pause" : "Resume"}
                  </SubmitButton>
                </form>
                <form action={deleteLocation}>
                  <input type="hidden" name="locationId" value={location.id} />
                  <SubmitButton className={buttonClass} pendingText="Removing…">
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
