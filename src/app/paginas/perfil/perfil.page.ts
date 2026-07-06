import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { personCircleOutline, bookOutline, logOutOutline, peopleOutline, settingsOutline, businessOutline, mailOutline } from 'ionicons/icons';
import { Auth, signOut } from '@angular/fire/auth';
import { IonContent, IonIcon, IonHeader, IonToolbar, NavController } from '@ionic/angular/standalone';
@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, IonHeader, IonToolbar]
})
export class PerfilPage {
  private router = inject(Router);
  private auth = inject(Auth);
  private navCtrl = inject(NavController); 

  usuario = {
    nombre: 'CARGANDO...',
    correo: '',
    sede: ''
  };
  menuAbierto: boolean = false; 

  rolUsuario: string = '';
  esAdmin: boolean = false;

  constructor() {
    addIcons({personCircleOutline,mailOutline,businessOutline,settingsOutline,logOutOutline,peopleOutline,bookOutline});
  }

  ionViewWillEnter() {
    this.menuAbierto = false; 

    const correoGuardado = localStorage.getItem('correo');

    if (!correoGuardado) {
      this.navCtrl.navigateRoot('/login');
      return;
    }

    const nombreGuardado = localStorage.getItem('nombre') || 'SIN NOMBRE';
    const rolGuardado = localStorage.getItem('rol') || 'ESTUDIANTE';
    const sedeGuardada = localStorage.getItem('sede') || 'CUENCA'; 
    
    this.usuario = {
      nombre: nombreGuardado.toUpperCase(),
      correo: correoGuardado,
      sede: sedeGuardada.toUpperCase()
    };

    this.rolUsuario = rolGuardado;
    this.esAdmin = (this.rolUsuario === 'ADMIN');
  }

  toggleMenu() {
    this.menuAbierto = !this.menuAbierto;
  }

  // 🌟 NUEVA FUNCIÓN PARA REDIRIGIR A LA PÁGINA DE POSTULACIÓN
// 🌟 FUNCIÓN CORREGIDA
  irAPostulacion() {
    this.router.navigate(['/tabs/postulacion']);
  }

  irAAdministracion() {
    this.router.navigate(['/admin-postulaciones']);
  }

  async cerrarSesion() {
    try {
      await signOut(this.auth);
      localStorage.clear();
      this.navCtrl.navigateRoot('/login');
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      localStorage.clear();
      this.navCtrl.navigateRoot('/login');
    }
  }
}