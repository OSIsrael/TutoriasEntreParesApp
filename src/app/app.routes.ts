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
      { path: '', redirectTo: 'horarios', pathMatch: 'full' }
    ]
  },
  // 🌟 NUEVAS RUTAS PARA EL PANEL DEL TUTOR
  {
    path: 'tabs-tutor',
    loadComponent: () => import('./paginas/tabs-tutor/tabs-tutor.page').then(m => m.TabsTutorPage),
    children: [
      {
        path: 'tutorias',
        loadComponent: () => import('./paginas/tutor-tutorias/tutor-tutorias.page').then(m => m.TutorTutoriasPage)
      },
      {
        path: 'asistencia',
        loadComponent: () => import('./paginas/tutor-asistencia/tutor-asistencia.page').then(m => m.TutorAsistenciaPage)
      },
      {
        path: 'avisos',
        loadComponent: () => import('./paginas/avisos/avisos.page').then(m => m.AvisosPage)
      },
      {
        path: 'estadisticas',
        loadComponent: () => import('./paginas/tutor-estadisticas/tutor-estadisticas.page').then(m => m.TutorEstadisticasPage)
      },
      { path: '', redirectTo: 'tutorias', pathMatch: 'full' }
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
  {
    path: 'tabs-tutor',
    loadComponent: () => import('./paginas/tabs-tutor/tabs-tutor.page').then( m => m.TabsTutorPage)
  },
  {
    path: 'tutor-tutorias',
    loadComponent: () => import('./paginas/tutor-tutorias/tutor-tutorias.page').then( m => m.TutorTutoriasPage)
  },
  {
    path: 'tutor-asistencia',
    loadComponent: () => import('./paginas/tutor-asistencia/tutor-asistencia.page').then( m => m.TutorAsistenciaPage)
  },
  {
    path: 'tutor-estadisticas',
    loadComponent: () => import('./paginas/tutor-estadisticas/tutor-estadisticas.page').then( m => m.TutorEstadisticasPage)
  },
];