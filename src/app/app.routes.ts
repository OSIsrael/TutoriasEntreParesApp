import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'splash', pathMatch: 'full' },
  { 
    path: 'login', 
    loadComponent: () => import('./paginas/login/login.page').then(m => m.LoginPage) 
  },
  {
    path: 'splash',
    loadComponent: () => import('./paginas/splash/splash.page').then(m => m.SplashPage)
  },
  {
    path: 'tabs',
    loadComponent: () => import('./paginas/tabs/tabs.page').then(m => m.TabsPage),
    children: [
      { path: 'horarios', loadComponent: () => import('./paginas/horarios/horarios.page').then(m => m.HorariosPage) },
      { path: 'mis-tutorias', loadComponent: () => import('./paginas/mis-tutorias/mis-tutorias.page').then(m => m.MisTutoriasPage) },
      { path: 'postulacion', loadComponent: () => import('./paginas/postulacion/postulacion.page').then(m => m.PostulacionPage) },
      { path: 'perfil', loadComponent: () => import('./paginas/perfil/perfil.page').then(m => m.PerfilPage) },
      {
        path: 'avisos',
        loadComponent: () => import('./paginas/avisos/avisos.page').then(m => m.AvisosPage)
      },
      // Por defecto entra al calendario (horarios)
      { path: '', redirectTo: 'horarios', pathMatch: 'full' }
      
    ]
  },
  {
    path: 'admin-postulaciones',
    loadComponent: () => import('./paginas/admin-postulaciones/admin-postulaciones.page').then( m => m.AdminPostulacionesPage)
  },
  {
    path: 'avisos',
    loadComponent: () => import('./paginas/avisos/avisos.page').then( m => m.AvisosPage)
  },
  {
    path: 'notificaciones',
    loadComponent: () => import('./paginas/notificaciones/notificaciones.page').then( m => m.NotificacionesPage)
  },
  
];