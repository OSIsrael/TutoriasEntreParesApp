import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { 
  personCircleOutline, bookOutline, logOutOutline, peopleOutline, 
  settingsOutline, businessOutline, mailOutline, notificationsOutline, 
  personOutline, schoolOutline 
} from 'ionicons/icons';
import { Auth, signOut } from '@angular/fire/auth';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, 
  IonButtons, IonButton, IonIcon, IonCard, IonCardHeader, 
  IonCardTitle, IonCardContent, IonItem, IonLabel, IonAvatar,
  NavController 
} from '@ionic/angular/standalone';

import { DatabaseService } from '../../services/database';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule,
    RouterModule, IonButtons, IonButton, IonIcon, IonCard, IonCardHeader, 
    IonCardTitle, IonCardContent, IonItem, IonLabel, IonAvatar
  ]
})
export class PerfilPage implements OnInit {
  private router = inject(Router);
  private auth = inject(Auth);
  private navCtrl = inject(NavController); 
  private dbService = inject(DatabaseService); 

  esTutor: boolean = false;
  usuario = {
    nombre: 'CARGANDO...',
    correo: '',
    sede: ''
  };
  menuAbierto: boolean = false; 
  rolUsuario: string = '';
  esAdmin: boolean = false;
  hayNotificacionesSinLeer: boolean = false;

  constructor() {
    addIcons({
      notificationsOutline, personCircleOutline, mailOutline, businessOutline, 
      bookOutline, settingsOutline, logOutOutline, peopleOutline, personOutline, schoolOutline
    });
  }

  ngOnInit() {}
  
  async ionViewWillEnter() {
    this.menuAbierto = false; 

    const correoGuardado = localStorage.getItem('correo');
    if (!correoGuardado) {
      this.navCtrl.navigateRoot('/login');
      return;
    }

    const nombreGuardado = localStorage.getItem('nombre') || 'SIN NOMBRE';
    let rolGuardado = localStorage.getItem('rol') || 'ESTUDIANTE';
    const sedeGuardada = localStorage.getItem('sede') || 'CUENCA'; 

    // 🌟 DOBLE VERIFICACIÓN EN TIEMPO REAL: Consultamos si realmente es tutor o admin en la BDD
    const rolReal = await this.dbService.obtenerRolUsuario(correoGuardado);
    if (rolReal === 'TUTOR' || rolReal === 'ADMIN' || rolReal === 'COORDINADOR') {
      rolGuardado = rolReal;
      localStorage.setItem('rol', rolReal); // Actualizamos la memoria del celular si hubo cambios
    }
    
    this.usuario = {
      nombre: nombreGuardado.toUpperCase(),
      correo: correoGuardado,
      sede: sedeGuardada.toUpperCase()
    };

    this.rolUsuario = rolGuardado;
    this.esAdmin = (this.rolUsuario === 'ADMIN' || this.rolUsuario === 'COORDINADOR');
    this.esTutor = (rolGuardado === 'TUTOR' || rolGuardado === 'COORDINADOR' || rolGuardado === 'ADMIN');

    await this.verificarNotificaciones(correoGuardado, rolGuardado, sedeGuardada);
  }

  async verificarNotificaciones(correo: string, rol: string, sede: string) {
    try {
      const notifs = await this.dbService.obtenerNotificacionesUsuario(correo, rol, sede);
      const sinLeer = notifs.filter((n: any) => {
        const leidas = n['leida_por'] || [];
        return !leidas.includes(correo);
      });
      this.hayNotificacionesSinLeer = sinLeer.length > 0;
    } catch (error) {
      console.error("Error al verificar notificaciones:", error);
    }
  }

  toggleMenu() {
    this.menuAbierto = !this.menuAbierto;
  }

  irANotificaciones() {
    this.router.navigate(['/notificaciones']);
  }

  irAPostulacion() {
    this.router.navigate(['/tabs/postulacion']);
  }

  irAPanelTutor() {
    this.router.navigate(['/tabs-tutor/tutorias']);
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
      localStorage.clear();
      this.navCtrl.navigateRoot('/login');
    }
  }
}