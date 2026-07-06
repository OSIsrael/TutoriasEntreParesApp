import { Injectable, inject } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signOut } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  async loginConGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(this.auth, provider);
      const user = credential.user;

      const userDocRef = doc(this.firestore, `usuarios/${user.uid}`);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          nombre: user.displayName,
          correo: user.email,
          rol: 'estudiante',
          esTutor: false
        });
        this.router.navigate(['/tabs/inicio']);
      } else {
        this.router.navigate(['/tabs/inicio']);
      }
    } catch (error) {
      console.error('Error en el inicio de sesión:', error);
    }
  }

  async cerrarSesion() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
}