import { Component, OnInit, inject, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { 
  personCircleOutline, bookOutline, logOutOutline, peopleOutline, 
  settingsOutline, businessOutline, mailOutline, notificationsOutline, 
  personOutline, schoolOutline, analyticsOutline, chevronDownOutline, 
  briefcaseOutline, shieldCheckmarkOutline, helpCircleOutline
} from 'ionicons/icons';
import { Auth, signOut } from '@angular/fire/auth';
import { 
  IonContent, IonHeader, IonToolbar, 
  IonButtons, IonButton, IonIcon,
  NavController, ToastController, AlertController,
  IonSegment, IonSegmentButton, IonLabel, IonPopover, IonList, IonItem
} from '@ionic/angular/standalone';

import { DatabaseService } from '../../services/database';
import { Firestore, collection, query, where, getDocs, doc, getDoc } from '@angular/fire/firestore';
import Chart from 'chart.js/auto'; 

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, CommonModule, FormsModule,
    RouterModule, IonButtons, IonButton, IonIcon, 
    IonSegment, IonSegmentButton, IonLabel, IonPopover, IonList, IonItem
  ]
})
export class PerfilPage implements OnInit {
  private router = inject(Router);
  private auth = inject(Auth);
  private navCtrl = inject(NavController); 
  private dbService = inject(DatabaseService); 
  private firestore = inject(Firestore); 
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private cdr = inject(ChangeDetectorRef);

  esTutor: boolean = false;
  usuario = { nombre: 'CARGANDO...', correo: '', sede: '' };
  
  rolUsuario: string = '';
  esAdmin: boolean = false;
  hayNotificacionesSinLeer: boolean = false;
  puedePostularse: boolean = true;

  @ViewChild('barCanvas', { static: false }) private barCanvas!: ElementRef;
  graficoBarras: any;
  totalTutorias: number = 0;

  // 🌟 VARIABLES DE FILTRO POR PERIODO
  filtroPeriodo: string = 'ACTUAL';
  periodoActualApp: string = '';

  // 🌟 VARIABLES PARA MENÚS DESPLEGABLES DE CABECERA
  menuRolAbierto: boolean = false;
  eventoRol: any = null;
  menuPerfilAbierto: boolean = false;
  eventoPerfil: any = null;
  tienePanelTutor: boolean = false;
  tienePanelAdmin: boolean = false;

  constructor() {
    addIcons({
      notificationsOutline, personCircleOutline, mailOutline, businessOutline, 
      bookOutline, settingsOutline, logOutOutline, peopleOutline, personOutline, 
      schoolOutline, analyticsOutline, chevronDownOutline, briefcaseOutline, 
      shieldCheckmarkOutline, helpCircleOutline
    });
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

  ngOnInit() {}
  
  async ionViewWillEnter() {
    // 🌟 1. CARGAMOS EL PERIODO
    await this.dbService.cargarConfiguracionGlobal();
    this.periodoActualApp = this.dbService.periodo_actual;

    const correoGuardado = localStorage.getItem('correo');
    if (!correoGuardado) {
      this.navCtrl.navigateRoot('/login');
      return;
    }

    let dataPerfil: any = null;
    let coleccionOrigen = 'Estudiantes';

    const adminSnap = await getDoc(doc(this.firestore, 'Administradores', correoGuardado));
    if (adminSnap.exists()) {
      dataPerfil = adminSnap.data();
      coleccionOrigen = 'Administradores';
    } else {
      const tutorSnap = await getDoc(doc(this.firestore, 'Tutores', correoGuardado));
      if (tutorSnap.exists()) {
        dataPerfil = tutorSnap.data();
        coleccionOrigen = 'Tutores';
      } else {
        const estSnap = await getDoc(doc(this.firestore, 'Estudiantes', correoGuardado));
        if (estSnap.exists()) {
          dataPerfil = estSnap.data();
          coleccionOrigen = 'Estudiantes';
        }
      }
    }

    if (dataPerfil) {
      this.usuario.nombre = (dataPerfil['nombre_completo'] || dataPerfil['nombre'] || 'USUARIO').toUpperCase();
      this.usuario.sede = (dataPerfil['sede'] || 'CUENCA').toUpperCase();
      // Leemos el rol en el que está navegando actualmente, no el que leímos en la BDD
      this.rolUsuario = (localStorage.getItem('rol') || 'ESTUDIANTE').toUpperCase();
      
      localStorage.setItem('nombre', this.usuario.nombre);
      localStorage.setItem('sede', this.usuario.sede);
    }

    this.esAdmin = (this.rolUsuario === 'ADMIN' || this.rolUsuario === 'COORDINADOR');
    
    if (coleccionOrigen === 'Administradores') {
      this.esTutor = false;
      this.puedePostularse = false;
      localStorage.setItem('es_admin_puro', 'true'); 
    } else {
      // Un admin no puro (coordinador estudiantil) sí puede ser tutor
      this.esTutor = (this.rolUsuario === 'TUTOR' || this.rolUsuario === 'COORDINADOR');
      this.puedePostularse = true;
      localStorage.setItem('es_admin_puro', 'false');
    }

    await this.verificarNotificaciones(correoGuardado, this.rolUsuario, this.usuario.sede);
    await this.cargarPermisosPaneles(correoGuardado); 
    
    setTimeout(() => { this.cargarEstadisticasEstudiante(); }, 500);
  }

  // ==========================================
  // 🌟 MÉTODOS PARA MENÚS DE CABECERA
  // ==========================================
  async cargarPermisosPaneles(correo: string) {
    this.tienePanelTutor = false;
    this.tienePanelAdmin = false;
    if (!correo) return;
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
        if (!snapTut.empty) this.tienePanelTutor = true;
      }
    } catch (error) {
      console.error("Error cargando permisos:", error);
    }
    if (this.cdr) this.cdr.detectChanges(); // Forzamos actualización visual
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
  }

  async cerrarSesion() {
    this.menuPerfilAbierto = false;
    try {
      await signOut(this.auth);
      localStorage.clear();
      this.navCtrl.navigateRoot('/login');
    } catch (error) {
      localStorage.clear();
      this.navCtrl.navigateRoot('/login');
    }
  }

  // ==========================================
  // 🌟 ESTADÍSTICAS Y OTRAS FUNCIONES
  // ==========================================
  async cargarEstadisticasEstudiante() {
    try {
      const q = query(collection(this.firestore, 'Reservas'), where('correoEstudiante', '==', this.usuario.correo));
      const snapshot = await getDocs(q);
      
      let reservas = snapshot.docs.map(doc => doc.data());
      
      if (this.filtroPeriodo === 'ACTUAL') {
        reservas = reservas.filter(res => res['periodo'] === this.periodoActualApp);
      }

      this.totalTutorias = reservas.length;
      const conteoMaterias: { [key: string]: number } = {};
      
      reservas.forEach(data => {
        const materia = data['materia'] || 'Otra';
        conteoMaterias[materia] = (conteoMaterias[materia] || 0) + 1;
      });

      const labels = Object.keys(conteoMaterias);
      const dataGrafico = Object.values(conteoMaterias);
      this.generarGraficoBarras(labels, dataGrafico);
    } catch (error) {
      console.error("Error cargando estadísticas del estudiante: ", error);
    }
  }

  generarGraficoBarras(labels: string[], data: number[]) {
    if (this.graficoBarras) this.graficoBarras.destroy();
    if (!this.barCanvas || labels.length === 0) return;
    this.graficoBarras = new Chart(this.barCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Tutorías Recibidas',
          data: data,
          backgroundColor: '#003366', 
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  async verificarNotificaciones(correo: string, rol: string, sede: string) {
    try {
      const panelContexto = this.rolUsuario === 'TUTOR' ? 'TUTOR' : 'ESTUDIANTE';
      const notifs = await this.dbService.obtenerNotificacionesUsuario(correo, rol, sede, panelContexto);
      const sinLeer = notifs.filter((n: any) => !n['leida_por']?.includes(correo));
      this.hayNotificacionesSinLeer = sinLeer.length > 0;
    } catch (error) {}
  }
  
  irANotificaciones() { 
    const panelContexto = this.rolUsuario === 'TUTOR' ? 'TUTOR' : 'ESTUDIANTE';
    this.router.navigate(['/notificaciones'], { queryParams: { panel: panelContexto } }); 
  }
  
  // 🌟 NAVEGACIÓN DIRECTA A POSTULARSE
  irAPostulacion() { 
    this.router.navigate(['/tabs/postulacion']); 
  }

  async mostrarAviso(mensaje: string, tipo: 'exito' | 'error' | 'advertencia' | 'info' = 'exito') {
    let icono = 'checkmark-circle-outline';
    let claseCss = 'toast-exito';

    if (tipo === 'error') {
      icono = 'close-circle-outline';
      claseCss = 'toast-error';
    } else if (tipo === 'advertencia') {
      icono = 'warning-outline';
      claseCss = 'toast-advertencia';
    } else if (tipo === 'info') {
      icono = 'information-circle-outline';
      claseCss = 'toast-info';
    }

    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      position: 'top', 
      icon: icono,
      cssClass: `toast-premium-gietaes ${claseCss}`,
      mode: 'ios' 
    });
    await toast.present();
  }

  async confirmarAccion(cabecera: string, mensaje: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: cabecera,
        message: mensaje,
        cssClass: 'alerta-premium-gietaes',
        mode: 'md', 
        buttons: [
          { text: 'Cancelar', role: 'cancel', cssClass: 'btn-alerta-cancelar', handler: () => resolve(false) },
          { text: 'Sí, Continuar', cssClass: 'btn-alerta-confirmar', handler: () => resolve(true) }
        ]
      });
      await alert.present();
    });
  }
}