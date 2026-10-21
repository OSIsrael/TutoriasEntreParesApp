import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonToolbar, IonIcon, IonSpinner, IonButtons, IonButton, IonModal, IonList, IonItem, IonLabel, IonItemSliding, IonItemOptions, IonItemOption, IonPopover } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { megaphoneOutline, notificationsOffOutline, notificationsOutline, closeOutline, schoolOutline, briefcaseOutline, shieldCheckmarkOutline, swapHorizontalOutline, personCircleOutline, trashOutline, chevronDownOutline, settingsOutline, helpCircleOutline, logOutOutline } from 'ionicons/icons';
import { Firestore, collection, query, orderBy, getDocs, where, deleteDoc, doc } from '@angular/fire/firestore';
import { Router } from '@angular/router'; 
import { Auth, signOut } from '@angular/fire/auth';
import { DatabaseService } from '../../services/database';

@Component({
  selector: 'app-avisos',
  templateUrl: './avisos.page.html',
  styleUrls: ['./avisos.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonIcon, IonSpinner, CommonModule, IonButtons, IonButton, IonModal, IonList, IonItem, IonLabel, IonItemSliding, IonItemOptions, IonItemOption, IonPopover]
})
export class AvisosPage {
  private firestore = inject(Firestore);
  anuncios: any[] = [];
  cargandoAnuncios: boolean = true;
  private dbService = inject(DatabaseService);
  private router = inject(Router); 
  private auth = inject(Auth);
  hayNotificacionesSinLeer: boolean = false;
  private cdr = inject(ChangeDetectorRef);

  correoUsuario: string = '';
  nombreUsuario: string = '';
  rolUsuario: string = 'ESTUDIANTE';

  // 🌟 VARIABLES PARA MENÚS DESPLEGABLES DE CABECERA
  menuRolAbierto: boolean = false;
  eventoRol: any = null;
  menuPerfilAbierto: boolean = false;
  eventoPerfil: any = null;

  tienePanelTutor: boolean = false;
  tienePanelAdmin: boolean = false;

  constructor() {
    addIcons({personCircleOutline,swapHorizontalOutline,notificationsOutline,notificationsOffOutline,megaphoneOutline,closeOutline,schoolOutline,briefcaseOutline,shieldCheckmarkOutline, trashOutline, chevronDownOutline, settingsOutline, helpCircleOutline, logOutOutline});
  }

  // 🌟 GETTER DINÁMICO PARA EL ÍCONO DEL ROL
  get iconoRolActual(): string {
    if (this.rolUsuario === 'ADMIN' || this.rolUsuario === 'COORDINADOR') return 'shield-checkmark-outline';
    if (this.rolUsuario === 'TUTOR') return 'briefcase-outline';
    return 'school-outline';
  }

  // 🌟 TRADUCE EL ROL AL NOMBRE DEL ESPACIO DE TRABAJO
  get nombrePanelActual(): string {
    if (this.rolUsuario === 'ADMIN' || this.rolUsuario === 'COORDINADOR') return 'COORDINACIÓN';
    if (this.rolUsuario === 'TUTOR') return 'TUTOR';
    return 'ESTUDIANTE';
  }

  async ionViewWillEnter() {
    this.correoUsuario = localStorage.getItem('correo') || '';
    this.nombreUsuario = localStorage.getItem('nombre') || '';
    
    // 🌟 LEEMOS EL ROL ACTUAL DEL LOCALSTORAGE (Detecta en qué panel está trabajando)
    this.rolUsuario = (localStorage.getItem('rol') || 'ESTUDIANTE').toUpperCase();
    
    const sede = localStorage.getItem('sede') || 'CUENCA';

    await this.verificarNotificaciones(this.correoUsuario, this.rolUsuario, sede);
    await this.cargarPermisosPaneles(this.correoUsuario);
    await this.cargarCartelera();
  }

  async cargarCartelera() {
    this.cargandoAnuncios = true;
    try {
      const sedeUsuario = localStorage.getItem('sede') || 'CUENCA';
      const avisosOcultos = JSON.parse(localStorage.getItem('avisos_ocultos') || '[]');
      
      const q = query(collection(this.firestore, 'Anuncios'), orderBy('fecha_publicacion', 'desc'));
      const snapshot = await getDocs(q);

      this.anuncios = [];
      const ahora = new Date(); 

      snapshot.forEach(documento => {
        const data = documento.data();
        const destino = data['sede_destino'];
        const fechaEvento = data['fecha_evento']; 
        
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

              const fechaLimiteAviso = new Date(anio, mes, dia, 23, 59, 59, 999);

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

  ocultarAviso(id: string, slidingItem: any) {
    slidingItem.close();
    const avisosOcultos = JSON.parse(localStorage.getItem('avisos_ocultos') || '[]');
    if (!avisosOcultos.includes(id)) {
      avisosOcultos.push(id);
      localStorage.setItem('avisos_ocultos', JSON.stringify(avisosOcultos));
    }
    this.anuncios = this.anuncios.filter(a => a.id !== id);
  }

  async verificarNotificaciones(correo: string, rol: string, sede: string) {
    const esPanelTutor = this.router.url.includes('tabs-tutor');
    const panelContexto = esPanelTutor ? 'TUTOR' : 'ESTUDIANTE';

    try {
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
    const esPanelTutor = this.router.url.includes('tabs-tutor');
    const panelContexto = esPanelTutor ? 'TUTOR' : 'ESTUDIANTE';
    this.router.navigate(['/notificaciones'], { queryParams: { panel: panelContexto } });
  }

  // ==========================================
  // 🌟 MÉTODOS PARA MENÚS DE CABECERA
  // ==========================================
  async cargarPermisosPaneles(correo: string) {
    this.tienePanelTutor = false;
    this.tienePanelAdmin = false;

    if (correo) {
      try {
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
    if (this.cdr) this.cdr.detectChanges();
  }

  abrirMenuRol(evento: any) {
    this.eventoRol = evento;
    this.menuRolAbierto = true;
  }

  abrirMenuPerfil(evento: any) {
    this.eventoPerfil = evento;
    this.menuPerfilAbierto = true;
  }

  irAPanel(ruta: string, rolDestino: string) {
    this.menuRolAbierto = false; 
    localStorage.setItem('rol', rolDestino); 
    setTimeout(() => { this.router.navigate([ruta]); }, 150); 
  }

  irAPerfil() {
    this.menuPerfilAbierto = false;
    this.router.navigate(['/tabs/perfil']); 
  }

  abrirGuia() {
    this.menuPerfilAbierto = false;
    // Aquí puedes enlazar tu lógica de guía si la tienes
  }

  async cerrarSesion() {
    this.menuPerfilAbierto = false;
    try {
      await signOut(this.auth);
      localStorage.clear();
      this.router.navigate(['/login']);
    } catch (error) {
      localStorage.clear();
      this.router.navigate(['/login']);
    }
  }
}