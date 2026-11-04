// Extiende app.json. Con EXPO_BASE_URL (en Vercel, "/app") la versión web se sirve bajo esa ruta;
// en desarrollo local y en los builds nativos no cambia nada.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || undefined },
});
