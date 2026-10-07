import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
// 🌟 SE AGREGARON LOS COMPONENTES DE SLIDING
import { IonContent, IonHeader, IonToolbar, IonIcon, IonSpinner, IonButtons, IonButton, IonModal, IonList, IonItem, IonLabel, IonItemSliding, IonItemOptions, IonItemOption } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
// 🌟 SE AGREGÓ EL ÍCONO DE PAPELERA (trashOutline)
import { megaphoneOutline, notificationsOffOutline, notificationsOutline, closeOutline, schoolOutline, briefcaseOutline, shieldCheckmarkOutline, swapHorizontalOutline, personCircleOutline, trashOutline } from 'ionicons/icons';
// 🌟 SE IMPORTÓ deleteDoc y doc
import { Firestore, collection, query, orderBy, getDocs, where, deleteDoc, doc } from '@angular/fire/firestore';
import { Router } from '@angular/router'; 
import { DatabaseService } from '../../services/database';

@Component({
  selector: 'app-avisos',
  templateUrl: './avisos.page.html',
  styleUrls: ['./avisos.page.scss'],
  standalone: true,
  // 🌟 SE DECLARAN LOS COMPONENTES
  imports: [IonContent, IonHeader, IonToolbar, IonIcon, IonSpinner, CommonModule, IonButtons, IonButton, IonModal, IonList, IonItem, IonLabel, IonItemSliding, IonItemOptions, IonItemOption]
})
export class AvisosPage {
  private firestore = inject(Firestore);
  anuncios: any[] = [];
  cargandoAnuncios: boolean = true;
  private dbService = inject(DatabaseService);
  private router = inject(Router); 
  hayNotificacionesSinLeer: boolean = false;
  private cdr = inject(ChangeDetectorRef);
  rolUsuario: string = 'ESTUDIANTE';

  mostrarMenuRol: boolean = false;
  tienePanelTutor: boolean = false;
  tienePanelAdmin: boolean = false;

  constructor() {
    // 🌟 SE REGISTRA EL ÍCONO TRASH
    addIcons({personCircleOutline,swapHorizontalOutline,notificationsOutline,notificationsOffOutline,megaphoneOutline,closeOutline,schoolOutline,briefcaseOutline,shieldCheckmarkOutline, trashOutline});
  }

  async ionViewWillEnter() {
    const correo = localStorage.getItem('correo') || '';
    const rol = localStorage.getItem('rol') || 'ESTUDIANTE';
    const sede = localStorage.getItem('sede') || 'CUENCA';

    await this.verificarNotificaciones(correo, rol, sede);
    await this.cargarCartelera();
  }

  async cargarCartelera() {
    this.cargandoAnuncios = true;
    try {
      const sedeUsuario = localStorage.getItem('sede') || 'CUENCA';
      // 🌟 RECUPERAMOS LOS AVISOS QUE EL USUARIO HA ELIMINADO LOCALMENTE
      const avisosOcultos = JSON.parse(localStorage.getItem('avisos_ocultos') || '[]');
      
      const q = query(collection(this.firestore, 'Anuncios'), orderBy('fecha_publicacion', 'desc'));
      const snapshot = await getDocs(q);

      this.anuncios = [];
      const ahora = new Date(); // Fecha y hora actual exacta

      snapshot.forEach(documento => {
        const data = documento.data();
        const destino = data['sede_destino'];
        const fechaEvento = data['fecha_evento']; 
        
        // Si el usuario ya lo borró de su pantalla, lo ignoramos
        if (avisosOcultos.includes(documento.id)) return;

        if (destino === 'GLOBAL' || destino === sedeUsuario.toUpperCase()) {
          let mostrarAviso = true;

          if (fechaEvento && fechaEvento !== 'Sin fecha' && fechaEvento !== '') {
            const soloFecha = fechaEvento.split('T')[0]; 
            const partes = soloFecha.split('-'); 

            if (partes.length === 3) {
              const anio = parseInt(partes[0], 10);
              const mes = parseInt(partes[1], 10) - 1; 
              const dia = parseInt(partes[2], 10);

              // 🌟 CALCULAMOS EL FINAL DEL DÍA DEL EVENTO
              const fechaLimiteAviso = new Date(anio, mes, dia, 23, 59, 59, 999);

              // 🌟 SI LA FECHA YA PASÓ: LO OCULTA Y LO DESTRUYE DE LA BASE DE DATOS
              if (fechaLimiteAviso.getTime() < ahora.getTime()) {
                mostrarAviso = false;
                deleteDoc(doc(this.firestore, 'Anuncios', documento.id)).catch(e => console.error(e));
              }
            }
          }

          if (mostrarAviso) {
            this.anuncios.push({ id: documento.id, ...data });
          }
        }
      }); 
    } catch (error) {
      console.error("Error al cargar cartelera:", error);
    }
    this.cargandoAnuncios = false;
  }

  // 🌟 FUNCIÓN PARA ELIMINAR EL AVISO DESLIZANDO
  ocultarAviso(id: string, slidingItem: any) {
    // Cerramos la animación del deslizador
    slidingItem.close();
    
    // Guardamos el ID en el almacenamiento del teléfono para que no vuelva a aparecer
    const avisosOcultos = JSON.parse(localStorage.getItem('avisos_ocultos') || '[]');
    if (!avisosOcultos.includes(id)) {
      avisosOcultos.push(id);
      localStorage.setItem('avisos_ocultos', JSON.stringify(avisosOcultos));
    }
    
    // Lo quitamos visualmente al instante
    this.anuncios = this.anuncios.filter(a => a.id !== id);
  }

  /* ... MANTÉN EL RESTO DE TUS FUNCIONES INTACTAS (verificarNotificaciones, irANotificaciones, cambiarPanel, etc.) ... */
  async verificarNotificaciones(correo: string, rol: string, sede: string) {
    // 🌟 DETECTA AUTOMÁTICAMENTE EN QUÉ PANEL ESTÁ
    const esPanelTutor = this.router.url.includes('tabs-tutor');
    const panelContexto = esPanelTutor ? 'TUTOR' : 'ESTUDIANTE';

    try {
      // 🌟 USA LAS VARIABLES QUE RECIBE POR PARÁMETRO
      const notifs = await this.dbService.obtenerNotificacionesUsuario(
        correo, rol, sede, panelContexto
      );
      
      const sinLeer = notifs.filter((n: any) => {
        const leidas = n['leida_por'] || [];
        return !leidas.includes(correo);
      });
      
      this.hayNotificacionesSinLeer = sinLeer.length > 0;
    } catch (error) {
      console.error("Error al verificar notificaciones:", error);
    }
  }
 



  irANotificaciones() {
    // 🌟 ENVÍA AL USUARIO A LA BANDEJA CORRECTA
    const esPanelTutor = this.router.url.includes('tabs-tutor');
    const panelContexto = esPanelTutor ? 'TUTOR' : 'ESTUDIANTE';
    
    this.router.navigate(['/notificaciones'], { queryParams: { panel: panelContexto } });
  }
  // ==========================================
  // 🌟 CAMBIO DE PANELES (MULTI-COLECCIÓN)
  // ==========================================
  async cambiarPanel() {
    const correo = localStorage.getItem('correo') || '';
    this.tienePanelTutor = false;
    this.tienePanelAdmin = false;

    if (correo) {
      try {
        // 1. BUSCAMOS EN ESTUDIANTES
        const qEst = query(collection(this.firestore, 'Estudiantes'), where('correo', '==', correo));
        const snapEst = await getDocs(qEst);
        
        if (!snapEst.empty) {
          const rolDB = (snapEst.docs[0].data()['rol'] || snapEst.docs[0].data()['Rol'] || '').toUpperCase().trim();
          
          if (rolDB === 'TUTOR') this.tienePanelTutor = true;
          if (rolDB === 'COORDINADOR' || rolDB === 'ADMIN') {
            this.tienePanelTutor = true;
            this.tienePanelAdmin = true;
          }
        }

        // 2. BUSCAMOS EN TUTORES SI AÚN NO LO ES
        if (!this.tienePanelTutor) {
          const qTut = query(collection(this.firestore, 'Tutores'), where('correo', '==', correo));
          const snapTut = await getDocs(qTut);
          
          if (!snapTut.empty) {
            this.tienePanelTutor = true; 
          }
        }
      } catch (error) {
        console.error("Error consultando permisos:", error);
      }
    }

    this.mostrarMenuRol = true;
    if (this.cdr) this.cdr.detectChanges();
  }

  irAPanel(ruta: string, rolDestino: string) {
    this.mostrarMenuRol = false; 
    localStorage.setItem('rol', rolDestino); 
    
    setTimeout(() => {
      this.router.navigate([ruta]); 
    }, 150); 
  }
}