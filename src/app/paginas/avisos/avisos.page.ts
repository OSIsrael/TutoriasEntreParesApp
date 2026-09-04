import { Component, inject,ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonToolbar, IonIcon, IonSpinner,IonButtons,IonButton,IonModal,IonList,IonItem,IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { megaphoneOutline, notificationsOffOutline, notificationsOutline, closeOutline, schoolOutline, briefcaseOutline, shieldCheckmarkOutline, swapHorizontalOutline, personCircleOutline } from 'ionicons/icons';
import { Firestore, collection, query, orderBy, getDocs,where } from '@angular/fire/firestore';
import { Router } from '@angular/router'; 
import { DatabaseService } from '../../services/database';

@Component({
  selector: 'app-avisos',
  templateUrl: './avisos.page.html',
  styleUrls: ['./avisos.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonIcon, IonSpinner, CommonModule,IonButtons,IonButton,IonModal,IonList,IonItem,IonLabel]
})
export class AvisosPage {
  private firestore = inject(Firestore);
  anuncios: any[] = [];
  cargandoAnuncios: boolean = true;
  private dbService = inject(DatabaseService);
  private router = inject(Router); // 🌟 Inyectamos Router
  hayNotificacionesSinLeer: boolean = false;
  private cdr = inject(ChangeDetectorRef);
  rolUsuario:string='ESTUDIANTE';

  // 🌟 VARIABLES PARA EL MENÚ DE ROLES
  mostrarMenuRol: boolean = false;
  tienePanelTutor: boolean = false;
  tienePanelAdmin: boolean = false;

  constructor() {
    // Registramos los íconos necesarios para esta pantalla
    addIcons({personCircleOutline,swapHorizontalOutline,notificationsOutline,notificationsOffOutline,megaphoneOutline,closeOutline,schoolOutline,briefcaseOutline,shieldCheckmarkOutline});
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
      const sedeUsuario = localStorage.getItem('sede') || 'CUENCA';
      
      const q = query(collection(this.firestore, 'Anuncios'), orderBy('fecha_publicacion', 'desc'));
      const snapshot = await getDocs(q);

      this.anuncios = [];
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0); // Hoy a medianoche exacto

      snapshot.forEach(doc => {
        const data = doc.data();
        const destino = data['sede_destino'];
        const fechaEvento = data['fecha_evento']; // "2026-06-22" o "2026-06-22T14:30"
        
        // 🌟 1. FILTRO DE SEDE (Aplica a Global y a la Sede por igual)
        if (destino === 'GLOBAL' || destino === sedeUsuario.toUpperCase()) {
          
          let mostrarAviso = true;

          // 🌟 2. FILTRO DE FECHA (El analizador blindado)
          if (fechaEvento && fechaEvento !== 'Sin fecha' && fechaEvento !== '') {
            
            // Cortamos cualquier hora que venga pegada con la "T" para quedarnos solo con YYYY-MM-DD
            const soloFecha = fechaEvento.split('T')[0]; 
            const partes = soloFecha.split('-'); 

            if (partes.length === 3) {
              const anio = parseInt(partes[0], 10);
              const mes = parseInt(partes[1], 10) - 1; // En JavaScript, enero es el mes 0
              const dia = parseInt(partes[2], 10);

              // Forzamos la creación de la fecha en horario LOCAL hasta las 23:59:59
              const fechaDelAviso = new Date(anio, mes, dia, 23, 59, 59, 999);

              // Si la fecha del evento es menor a hoy a las 00:00, expiró
              if (fechaDelAviso.getTime() < hoy.getTime()) {
                mostrarAviso = false;
              }
            }
          }

          // Lo mostramos solo si pasó las pruebas
          if (mostrarAviso) {
            this.anuncios.push({ id: doc.id, ...data });
          }
        }
      }); 
    } catch (error) {
      console.error("Error al cargar cartelera:", error);
    }
    this.cargandoAnuncios = false;
  }
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