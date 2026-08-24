import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  private firestore = inject(Firestore);
  private router = inject(Router);

  async canActivate(): Promise<boolean> {
    const correo = localStorage.getItem('correo');
    
    if (!correo) {
      this.router.navigate(['/login']);
      return false;
    }

    try {
      let rolReal = 'ESTUDIANTE';

      // Busca en Administradores Puros
      const adminSnap = await getDoc(doc(this.firestore, 'Administradores', correo));
      if (adminSnap.exists()) {
        rolReal = adminSnap.data()['rol'];
      } else {
        // Busca en Tutores (Coordinadores que ascendieron)
        const tutorSnap = await getDoc(doc(this.firestore, 'Tutores', correo));
        if (tutorSnap.exists()) {
          rolReal = tutorSnap.data()['rol'];
        } else {
          // Busca en Estudiantes
          const estSnap = await getDoc(doc(this.firestore, 'Estudiantes', correo));
          if (estSnap.exists()) {
            rolReal = estSnap.data()['rol'];
          }
        }
      }

      // 🌟 Si el rolReal es ADMIN o COORDINADOR, abre la puerta
      if (rolReal === 'ADMIN' || rolReal === 'COORDINADOR') {
        return true; 
      }

      alert("Acceso denegado: No tienes permisos de Administración.");
      this.router.navigate(['/tabs/perfil']);
      return false;

    } catch (error) {
      this.router.navigate(['/login']);
      return false;
    }
  }
}