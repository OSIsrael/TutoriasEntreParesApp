import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gietaes.tepes', // 👈 Este es el identificador único de tu App (puedes cambiarlo si deseas)
  appName: 'GIETAES',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    } as any // 🌟 El 'as any' elimina la línea roja de TypeScript
  },
};

export default config;