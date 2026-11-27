// Configuration dynamique d'Expo, appliquée par-dessus app.json.
//
// HTTP en clair (dossier sécurité, R5) : iOS et Android l'interdisent par défaut, et c'est ce qu'on veut pour
// l'appli de démonstration, qui parle au serveur en ligne en HTTPS. On ne l'autorise que lorsque l'API visée
// n'est pas en HTTPS (développement sur le Mac : http://<IP du Mac>:3001), d'après EXPO_PUBLIC_API_URL (app/.env).
module.exports = ({ config }) => {
  const api = process.env.EXPO_PUBLIC_API_URL ?? '';
  const cleartext = !api.startsWith('https://');
  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        ...(cleartext ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } } : {}),
      },
    },
    android: { ...config.android, usesCleartextTraffic: cleartext },
  };
};
