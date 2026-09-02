import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonToolbar, IonIcon, IonButton, IonButtons,
  NavController, IonGrid, IonRow, IonCol, IonSelect, IonSelectOption,
  IonSpinner, ToastController, AlertController,
  IonSegment, IonSegmentButton, IonLabel // 🌟 NUEVOS IMPORTADOS
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  personCircleOutline, mailOutline, businessOutline, schoolOutline,
  bookOutline, logOutOutline, peopleOutline, notificationsOutline, 
  barChartOutline, personOutline, settingsOutline, addCircleOutline,
  closeOutline, checkmarkOutline, warningOutline } from 'ionicons/icons';
import { Auth, signOut } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs, addDoc } from '@angular/fire/firestore';
import { DatabaseService } from '../../services/database';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-tutor-estadisticas',
  templateUrl: './tutor-estadisticas.page.html',
  styleUrls: ['./tutor-estadisticas.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, CommonModule, FormsModule,
    IonButtons, IonButton, IonIcon, IonGrid, IonRow, IonCol,
    IonSelect, IonSelectOption, IonSpinner,
    IonSegment, IonSegmentButton, IonLabel // 🌟 AÑADIDOS AQUÍ
  ]
})
export class TutorEstadisticasPage implements OnInit {
  private firestore = inject(DatabaseService).firestore;
  private dbService = inject(DatabaseService);
  private router = inject(Router);
  private auth = inject(Auth);
  private navCtrl = inject(NavController);

  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  usuario = { nombre: 'CARGANDO...', correo: '', sede: '' };
  rolUsuario: string = '';
  carreraUsuario: string = '';
  cicloUsuario: number = 1;
  celularUsuario: string = '';

  menuAbierto: boolean = false;
  hayNotificacionesSinLeer: boolean = false;

  // 🌟 VARIABLES PARA EL DASHBOARD
  totalClasesDadas: number = 0;
  totalAlumnosAtendidos: number = 0;
  
  @ViewChild('barCanvas', { static: false }) private barCanvas!: ElementRef;
  graficoBarras: any;

  // 🌟 VARIABLES PARA FILTRO DE PERIODO
  filtroPeriodo: string = 'ACTUAL';
  periodoActualApp: string = '';

  // 🌟 VARIABLES PARA INCREMENTO DE MATERIAS
  mostrarModalMaterias: boolean = false;
  cargandoMaterias: boolean = false;
  materiasDisponibles: string[] = [];
  materiasSeleccionadas: string[] = [];
  horariosActualesTutor: any = {};

  constructor() {
    addIcons({notificationsOutline,personCircleOutline,mailOutline,businessOutline,barChartOutline,addCircleOutline,personOutline,logOutOutline,settingsOutline,bookOutline,warningOutline,peopleOutline,schoolOutline,closeOutline,checkmarkOutline});
  }

  ngOnInit() {}

  async ionViewWillEnter() {
    this.menuAbierto = false;
    
    // 🌟 1. CARGAMOS EL PERIODO ACTUAL
    await this.dbService.cargarConfiguracionGlobal();
    this.periodoActualApp = this.dbService.periodo_actual;

    const correoGuardado = localStorage.getItem('correo');
    if (!correoGuardado) {
      this.navCtrl.navigateRoot('/login');
      return;
    }

    this.usuario = {
      nombre: (localStorage.getItem('nombre') || 'SIN NOMBRE').toUpperCase(),
      correo: correoGuardado,
      sede: (localStorage.getItem('sede') || 'CUENCA').toUpperCase()
    };

    this.rolUsuario = localStorage.getItem('rol') || 'TUTOR';
    this.carreraUsuario = (localStorage.getItem('carrera') || '').toUpperCase();
    this.celularUsuario = localStorage.getItem('celular') || '';
    
    const cicloStr = localStorage.getItem('ciclo') || '1';
    this.cicloUsuario = parseInt(cicloStr.replace(/\D/g, ''), 10) || 1;

    await this.verificarNotificaciones(this.usuario.correo, this.rolUsuario, this.usuario.sede);
    
    setTimeout(() => { this.cargarEstadisticas(); }, 300);
  }

  async verificarNotificaciones(correo: string, rol: string, sede: string) {
    try {
      const notifs = await this.dbService.obtenerNotificacionesUsuario(correo, rol, sede, 'TUTOR');
      const sinLeer = notifs.filter((n: any) => !n['leida_por']?.includes(correo));
      this.hayNotificacionesSinLeer = sinLeer.length > 0;
    } catch (error) {}
  }

  irANotificaciones() {
    this.router.navigate(['/notificaciones'], { queryParams: { panel: 'TUTOR' } });
  }

  toggleMenu() { this.menuAbierto = !this.menuAbierto; }
  irAPanelEstudiante() { this.router.navigate(['/tabs/perfil']); }

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

  // 🌟 FUNCIÓN DE ESTADÍSTICAS TUTOR (Ahora filtra localmente por periodo)
  async cargarEstadisticas() {
    try {
      const qClases = query(collection(this.firestore, 'Asistencias'), where('correoTutor', '==', this.usuario.correo.toLowerCase()));
      const clasesSnap = await getDocs(qClases);
      
      let asistencias = clasesSnap.docs.map(doc => doc.data());

      if (this.filtroPeriodo === 'ACTUAL') {
        asistencias = asistencias.filter(data => data['periodo'] === this.periodoActualApp);
      }

      this.totalClasesDadas = asistencias.length;
      const alumnosUnicos = new Set();
      const conteoMaterias: { [key: string]: number } = {};

      asistencias.forEach(data => {
        if (data['estudiante_info']) alumnosUnicos.add(data['estudiante_info']);
        const materia = data['materia'] || 'Otra';
        conteoMaterias[materia] = (conteoMaterias[materia] || 0) + 1;
      });

      this.totalAlumnosAtendidos = alumnosUnicos.size;

      if (Object.keys(conteoMaterias).length > 0) {
        this.generarGrafico(conteoMaterias);
      } else {
        if (this.graficoBarras) this.graficoBarras.destroy(); // Limpia gráfico si está vacío
      }
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    }
  }

  generarGrafico(datos: any) {
    if (this.graficoBarras) this.graficoBarras.destroy();
    const labels = Object.keys(datos);
    const data = Object.values(datos);

    this.graficoBarras = new Chart(this.barCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Tutorías Impartidas',
          data: data,
          backgroundColor: '#EAB308',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  // ==========================================
  // 🌟 INCREMENTO DE ASIGNATURAS
  // ==========================================
  async abrirModalMaterias() {
    this.menuAbierto = false;
    this.mostrarModalMaterias = true;
    this.cargandoMaterias = true;
    this.materiasSeleccionadas = [];

    try {
      const qTutor = query(collection(this.firestore, 'Tutores'), where('correo', '==', this.usuario.correo.toLowerCase()));
      const snapTutor = await getDocs(qTutor);
      
      let materiasQueYaTiene: string[] = [];
      if (!snapTutor.empty) {
        const dataTutor = snapTutor.docs[0].data();
        materiasQueYaTiene = (dataTutor['materias'] || []).map((m:string) => m.toUpperCase());
        this.horariosActualesTutor = dataTutor['horarios'] || { "Aviso": "Mantiene horario registrado" };
      }

      const catalogos = await this.dbService.obtenerCatalogosDesdeExcel();
      
      this.materiasDisponibles = catalogos.materias
        .filter(m => 
          m.carrera.toUpperCase() === this.carreraUsuario && 
          m.ciclo < this.cicloUsuario && 
          !materiasQueYaTiene.includes(m.nombre.toUpperCase())
        )
        .map(m => m.nombre.toUpperCase());

    } catch (error) {
      console.error("Error al cargar materias:", error);
    }
    this.cargandoMaterias = false;
  }

  async enviarSolicitudMaterias() {
    if (this.materiasSeleccionadas.length === 0) {
      this.mostrarAviso("Selecciona al menos una materia para solicitar.",'advertencia');
      return;
    }

    try {
      this.cargandoMaterias = true;
      const basePayload = {
        correo: this.usuario.correo.toLowerCase(),
        nombre: this.usuario.nombre,
        sede: this.usuario.sede,
        carrera: this.carreraUsuario,
        ciclo: this.cicloUsuario,
        celular: this.celularUsuario,
        permanencia: 'TUTOR ACTIVO (INCREMENTO)',
        disponibilidad_horaria: this.horariosActualesTutor,
        estado_aprobacion: 'PENDIENTE',
        fecha_postulacion: new Date().toISOString()
      };

      for (let materia of this.materiasSeleccionadas) {
        const payload = { ...basePayload, materia_postulada: materia };
        await addDoc(collection(this.firestore, 'Postulaciones'), payload);
        
        await this.dbService.crearNotificacion({
          titulo: 'Solicitud de Incremento de Materias',
          mensaje: `${this.usuario.nombre} solicitó impartir ${materia}.`,
          tipo: 'POSTULACION',
          rol_destino: 'ADMIN',
          sede_destino: this.usuario.sede 
        });
      }

      this.mostrarAviso("Solicitud enviada correctamente. El administrador la revisará pronto.",'exito');
      this.mostrarModalMaterias = false;

    } catch (error) {
      this.mostrarAviso("Error al enviar la solicitud.",'error');
    } finally {
      this.cargandoMaterias = false;
    }
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