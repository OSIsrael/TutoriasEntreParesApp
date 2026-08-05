import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonSpinner,IonButtons,IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { megaphoneOutline, notificationsOffOutline, notificationsOutline } from 'ionicons/icons';
import { Firestore, collection, query, orderBy, getDocs } from '@angular/fire/firestore';
import { Router } from '@angular/router'; // 🌟 Router para la navegación
import { DatabaseService } from '../../services/database';

@Component({
  selector: 'app-avisos',
  templateUrl: './avisos.page.html',
  styleUrls: ['./avisos.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonSpinner, CommonModule,IonButtons,IonButton]
})
export class AvisosPage {
  private firestore = inject(Firestore);
  anuncios: any[] = [];
  cargandoAnuncios: boolean = true;
  private dbService = inject(DatabaseService);
  private router = inject(Router); // 🌟 Inyectamos Router
  hayNotificacionesSinLeer: boolean = false;

  constructor() {
    // Registramos los íconos necesarios para esta pantalla
    addIcons({notificationsOutline,notificationsOffOutline,megaphoneOutline});
  }
irANotificaciones() {
    this.router.navigate(['/notificaciones']);
  }
  // Se ejecuta siempre que el usuario entra a esta pestaña
  async ionViewWillEnter() {
    const correo = localStorage.getItem('correo') || '';
    const rol = localStorage.getItem('rol') || 'ESTUDIANTE';
    const sede = localStorage.getItem('sede') || 'CUENCA';

    // 🌟 Disparamos la revisión de la campanita
    await this.verificarNotificaciones(correo, rol, sede);
    await this.cargarCartelera();
  }

  async cargarCartelera() {
    this.cargandoAnuncios = true;
    try {
      // 1. Obtenemos la sede actual desde la memoria local
      const sedeUsuario = (localStorage.getItem('sede') || 'CUENCA').trim().toUpperCase();
      
      // 2. Descargamos de Firebase, ordenando por el más reciente
      const q = query(collection(this.firestore, 'Anuncios'), orderBy('fecha_publicacion', 'desc'));
      const snapshot = await getDocs(q);

      this.anuncios = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const destino = (data['sede_destino'] || '').trim().toUpperCase();
        
        // 3. El Filtro: Solo pasa si es para todos (GLOBAL) o para su sede exacta
        if (destino === 'GLOBAL' || destino === sedeUsuario) {
          this.anuncios.push({ id: doc.id, ...data });
        }
      });
    } catch (error) {
      console.error("Error al cargar cartelera:", error);
    }
    this.cargandoAnuncios = false;
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
}