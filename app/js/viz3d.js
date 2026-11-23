// Registry of the 3D lesson scenes. Each scene lives in js/scenes/<key>.js (default export: () => <figure element>) and is loaded on demand.
// A scene not yet ported to the real-model toolkit (kit3d.js) still comes from legacy3d.js.
export const SCENES = new Proxy({}, {
  get: (_, key) => () => import(`./scenes/${key}.js`).then(m => m.default(), () => import('./legacy3d.js').then(m => m.SCENES[key]())),
});
