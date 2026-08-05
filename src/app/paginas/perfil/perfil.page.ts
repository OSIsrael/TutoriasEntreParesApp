import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { personCircleOutline, bookOutline, logOutOutline, peopleOutline, settingsOutline, businessOutline, mailOutline, notificationsOutline, personOutline } from 'ionicons/icons';
import { Auth, signOut } from '@angular/fire/auth';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, 
  IonButtons, IonButton, IonIcon, IonCard, IonCardHeader, 
  IonCardTitle, IonCardContent, IonItem, IonLabel, IonAvatar,
  NavController 
} from '@ionic/angular/standalone';

// 🌟 IMPORTAMOS TU BASE DE DATOS
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
  private dbService = inject(DatabaseService); // 🌟 INYECTAMOS EL SERVICIO

  usuario = {
    nombre: 'CARGANDO...',
    correo: '',
    sede: ''
  };
  menuAbierto: boolean = false; 

  rolUsuario: string = '';
  esAdmin: boolean = false;
  
  // 🌟 VARIABLE PARA LA CAMPANITA
  hayNotificacionesSinLeer: boolean = false;

  constructor() {
    addIcons({notificationsOutline, personCircleOutline, mailOutline, businessOutline, bookOutline, settingsOutline, logOutOutline, peopleOutline, personOutline});
  }

  ngOnInit() {}

  // 🌟 AÑADIMOS ASYNC AQUÍ
  async ionViewWillEnter() {
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
    this.esAdmin = (this.rolUsuario === 'ADMIN' || this.rolUsuario === 'COORDINADOR');

    // 🌟 REVISAMOS SI HAY NOTIFICACIONES CON LAS VARIABLES CORRECTAS
    await this.verificarNotificaciones(correoGuardado, rolGuardado, sedeGuardada);
  }

  // 🌟 FUNCIÓN VERIFICADORA ADAPTADA
  async verificarNotificaciones(correo: string, rol: string, sede: string) {
    try {
      const notifs = await this.dbService.obtenerNotificacionesUsuario(correo, rol, sede);
      
      // Agregamos (n: any) para que TypeScript no se queje
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

  irAPostulacion() {
    this.router.navigate(['/tabs/postulacion']);
  }

  irAAdministracion() {
    this.router.navigate(['/admin-postulaciones']);
  }

  irANotificaciones() {
    this.router.navigate(['/notificaciones']);
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