// Declare new restricted features here. An empty role list disables a feature.
const featureRoles = {
  reader: ["admin"],
  writingStudio: ["admin"],
  studioPublishing: ["admin"],
  stagingRoom: ["admin"],
  devBoard: ["admin"],
  localAudiobooks: ["admin"],
} satisfies Record<string, readonly string[]>;

export type Feature = keyof typeof featureRoles;

export function canAccessFeature(feature: Feature, roles: unknown): boolean {
  return Array.isArray(roles) && featureRoles[feature].some(role => roles.includes(role));
}
