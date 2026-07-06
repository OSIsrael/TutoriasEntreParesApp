import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { megaphoneOutline, notificationsOffOutline } from 'ionicons/icons';
import { Firestore, collection, query, orderBy, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-avisos',
  templateUrl: './avisos.page.html',
  styleUrls: ['./avisos.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonSpinner, CommonModule]
})
export class AvisosPage {
  private firestore = inject(Firestore);
  anuncios: any[] = [];
  cargandoAnuncios: boolean = true;

  constructor() {
    // Registramos los íconos necesarios para esta pantalla
    addIcons({ megaphoneOutline, notificationsOffOutline });
  }

  // Se ejecuta siempre que el usuario entra a esta pestaña
  async ionViewWillEnter() {
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
}