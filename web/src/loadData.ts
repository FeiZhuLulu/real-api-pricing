import type { Mapping, SiteData } from "./types";

type PackedData = Omit<SiteData, "mappings"> & {
  mappings: (Partial<Mapping> & Pick<Mapping, "configuration_id" | "point_id">)[];
};

// The download files stay complete; site.json references shared configurations
// once instead of repeating their fields for every subscription point.
export function unpackData(data: PackedData): SiteData {
  const configs = new Map(data.configurations.map((c) => [c.configuration_id, c]));
  return {
    ...data,
    mappings: data.mappings.map((m) => {
      const c = configs.get(m.configuration_id);
      if (!c) throw new Error(`Missing benchmark configuration: ${m.configuration_id}`);
      const { model, archive, checked_at, ...fields } = c;
      return { ...fields, ...m } as Mapping;
    }),
  };
}
