import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonAvatar, IonItem, IonLabel, IonToggle, IonButton, 
  IonIcon, IonList, IonListHeader 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline, schoolOutline, swapHorizontalOutline } from 'ionicons/icons';

// Importamos nuestro cerebro de autenticación
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, 
    IonContent, IonAvatar, IonItem, IonLabel, IonToggle, 
    IonButton, IonIcon, IonList, IonListHeader
  ]
})
export class PerfilPage {
  private authService = inject(AuthService);

  // Datos simulados para la maqueta visual
  usuario = {
    nombre: 'Israel Orellana',
    correo: 'iorellana@est.ups.edu.ec',
    carrera: 'Computación - Nivel 4',
    sede: 'Cuenca'
  };

  modoTutor: boolean = false;

  constructor() {
    addIcons({ logOutOutline, schoolOutline, swapHorizontalOutline });
  }

  cambiarRol() {
    if (this.modoTutor) {
      console.log('Activando Modo Tutor Par (Se cambiarán los menús)...');
    } else {
      console.log('Regresando a Modo Estudiante...');
    }
  }

  cerrarSesion() {
    this.authService.cerrarSesion();
  }
}