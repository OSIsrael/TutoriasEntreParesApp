import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

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
      // 🌟 VALIDACIÓN INHACKEABLE: Consulta directo a la base de datos
      const q = query(collection(this.firestore, 'Estudiantes'), where('correo', '==', correo));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const rolReal = snap.docs[0].data()['rol'];
        
        if (rolReal === 'ADMIN' || rolReal === 'COORDINADOR') {
          return true; // ✅ Acceso concedido
        }
      }

      // 🚨 Si llega aquí, es un Estudiante intentando entrar al panel Admin
      alert("Acceso denegado: No tienes permisos de Coordinación.");
      this.router.navigate(['/tabs/perfil']);
      return false;

    } catch (error) {
      this.router.navigate(['/login']);
      return false;
    }
  }
}