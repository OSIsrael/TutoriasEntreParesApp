import { Component, OnInit, inject, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonToolbar, IonIcon, IonButton, IonButtons,
  NavController, IonGrid, IonRow, IonCol, IonSelect, IonSelectOption,
  IonSpinner, ToastController, AlertController,
  IonSegment, IonSegmentButton, IonLabel, IonPopover, IonList, IonItem 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  personCircleOutline, mailOutline, businessOutline, schoolOutline,
  bookOutline, logOutOutline, peopleOutline, notificationsOutline, 
  barChartOutline, personOutline, settingsOutline, addCircleOutline,
  closeOutline, checkmarkOutline, warningOutline, timeOutline, chevronDownOutline, shieldCheckmarkOutline, briefcaseOutline } from 'ionicons/icons';
import { Auth, signOut } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc } from '@angular/fire/firestore';
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
    IonSegment, IonSegmentButton, IonLabel, IonPopover, IonList, IonItem
  ]
})
export class TutorEstadisticasPage implements OnInit {
  private firestore = inject(Firestore);
  private dbService = inject(DatabaseService);
  private router = inject(Router);
  private auth = inject(Auth);
  private navCtrl = inject(NavController);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private cdr = inject(ChangeDetectorRef);

  usuario = { nombre: 'CARGANDO...', correo: '', sede: '' };
  rolUsuario: string = '';
  carreraUsuario: string = '';
  cicloUsuario: number = 1;
  celularUsuario: string = '';
  nombreUsuario: string = '';
  correoUsuario: string = '';

  menuAbierto: boolean = false;
  hayNotificacionesSinLeer: boolean = false;

  totalClasesDadas: number = 0;
  totalAlumnosAtendidos: number = 0;
  
  @ViewChild('barCanvas', { static: false }) private barCanvas!: ElementRef;
  graficoBarras: any;

  filtroPeriodo: string = 'ACTUAL';
  periodoActualApp: string = '';

  mostrarModalMaterias: boolean = false;
  cargandoMaterias: boolean = false;
  materiasDisponibles: string[] = [];
  materiasSeleccionadas: string[] = [];
  horariosActualesTutor: any = {};
  
  mostrarModalHorarios: boolean = false;
  guardandoHorario: boolean = false;
  diassemana = ['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
  franjasHorarias = ['07:00 - 09:00','09:00 - 11:00','11:00 - 13:00','14:00 - 16:00','16:00 - 18:00','18:00 - 20:00','20:00 - 22:00'];  
  horarioSeleccionado: { [key: string]: string } = {}; 
  modalidadGlobal: string = 'PRESENCIAL';

  // 🌟 VARIABLES PARA CABECERA DINÁMICA
  menuRolAbierto: boolean = false;
  eventoRol: any = null;
  menuPerfilAbierto: boolean = false;
  eventoPerfil: any = null;
  tienePanelTutor: boolean = false;
  tienePanelAdmin: boolean = false;

  // 🌟 GETTERS DE DISEÑO
  get iconoRolActual(): string {
    if (this.rolUsuario === 'ADMIN' || this.rolUsuario === 'COORDINADOR') return 'shield-checkmark-outline';
    if (this.rolUsuario === 'TUTOR') return 'briefcase-outline';
    return 'school-outline';
  }

  get nombrePanelActual(): string {
    if (this.rolUsuario === 'ADMIN' || this.rolUsuario === 'COORDINADOR') return 'COORDINACIÓN';
    if (this.rolUsuario === 'TUTOR') return 'TUTOR';
    return 'ESTUDIANTE';
  }

  constructor() {
    addIcons({notificationsOutline,personCircleOutline,mailOutline,businessOutline,barChartOutline,addCircleOutline,personOutline,logOutOutline,settingsOutline,bookOutline,warningOutline,peopleOutline,schoolOutline,closeOutline,checkmarkOutline,timeOutline, chevronDownOutline, shieldCheckmarkOutline, briefcaseOutline});
  }

  ngOnInit() {}

  async ionViewWillEnter() {
    this.menuAbierto = false;
    
    await this.dbService.cargarConfiguracionGlobal();
    this.periodoActualApp = this.dbService.periodo_actual;

    const correoGuardado = localStorage.getItem('correo');
    if (!correoGuardado) {
      this.navCtrl.navigateRoot('/login');
      return;
    }

    this.correoUsuario = correoGuardado;
    this.nombreUsuario = (localStorage.getItem('nombre') || 'SIN NOMBRE').toUpperCase();
    this.rolUsuario = (localStorage.getItem('rol') || 'TUTOR').toUpperCase();

    this.usuario = {
      nombre: this.nombreUsuario,
      correo: this.correoUsuario,
      sede: (localStorage.getItem('sede') || 'CUENCA').toUpperCase()
    };

    this.carreraUsuario = (localStorage.getItem('carrera') || '').toUpperCase();
    this.celularUsuario = localStorage.getItem('celular') || '';
    
    const cicloStr = localStorage.getItem('ciclo') || '1';
    this.cicloUsuario = parseInt(cicloStr.replace(/\D/g, ''), 10) || 1;

    // 🌟 CARGA DE NOTIFICACIONES Y PERMISOS DE PANELES
    await this.verificarNotificaciones(this.usuario.correo, this.rolUsuario, this.usuario.sede);
    await this.cargarPermisosPaneles(this.correoUsuario);
    
    setTimeout(() => { this.cargarEstadisticas(); }, 300);
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
        const rolDB = String(snapEst.docs[0].data()['rol'] || snapEst.docs[0].data()['Rol'] || '').toUpperCase().trim();
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
    } catch (error) { console.error("Error permisos:", error); }
    if (this.cdr) this.cdr.detectChanges(); 
  }

  abrirMenuRol(evento: any) { this.eventoRol = evento; this.menuRolAbierto = true; }
  abrirMenuPerfil(evento: any) { this.eventoPerfil = evento; this.menuPerfilAbierto = true; }

  irAPanel(ruta: string, rolDestino: string) {
    this.menuRolAbierto = false; 
    localStorage.setItem('rol', rolDestino); 
    setTimeout(() => { this.router.navigate([ruta]); }, 150); 
  }

  irAPerfil() {
    this.menuPerfilAbierto = false;
    this.router.navigate(['/tabs/perfil']); 
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
  // OTRAS FUNCIONES Y GRÁFICAS
  // ==========================================
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
        if (this.graficoBarras) this.graficoBarras.destroy(); 
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

  async abrirModalMaterias() {
    this.menuAbierto = false;
    this.mostrarModalMaterias = true;
    this.cargandoMaterias = true;
    this.materiasSeleccionadas = [];

    try {
      const idTutor = await this.obtenerDocIdTutor();
      
      let materiasQueYaTiene: string[] = [];
      if (idTutor) {
        const docSnap = await getDoc(doc(this.firestore, 'Tutores', idTutor));
        if (docSnap.exists()) {
          const dataTutor = docSnap.data();
          materiasQueYaTiene = (dataTutor['materias'] || []).map((m:string) => m.toUpperCase());
          this.horariosActualesTutor = dataTutor['horarios'] || { "Aviso": "Mantiene horario registrado" };
        }
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

  // 🌟 BUSCADOR INFALIBLE PARA TUTORES ACTIVOS
  async obtenerDocIdTutor(): Promise<string | null> {
    const correo = this.usuario.correo.toLowerCase().trim();
    
    let q = query(collection(this.firestore, 'Tutores'), where('correo_google', '==', correo), where('estado', '==', 'ACTIVO'));
    let snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
    
    q = query(collection(this.firestore, 'Tutores'), where('correo', '==', correo), where('estado', '==', 'ACTIVO'));
    snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    q = query(collection(this.firestore, 'Tutores'), where('correo_google', '==', correo));
    snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    q = query(collection(this.firestore, 'Tutores'), where('correo', '==', correo));
    snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    return null;
  }

  async abrirModalHorarios() {
    this.menuAbierto = false;
    this.mostrarModalHorarios = true;
    this.horarioSeleccionado = {};

    try {
      const idTutor = await this.obtenerDocIdTutor();
      if (idTutor) {
        const docSnap = await getDoc(doc(this.firestore, 'Tutores', idTutor));
        if (docSnap.exists()) {
          const horariosDb = docSnap.data()['horarios'] || {};
          for(let k in horariosDb) {
            let nuevaClave = k.replace('7:00', '07:00').replace('9:00', '09:00');
            this.horarioSeleccionado[nuevaClave] = horariosDb[k];
          }
        }
      }
    } catch (error) {
      console.error("Error al cargar horarios:", error);
    }
  }

  seleccionarModalidadGlobal(mod: string) { 
    this.modalidadGlobal = mod; 
  }

  esBloqueDeshabilitado(dia: string, franja: string): boolean {
    const diaLimpio = dia.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (diaLimpio === 'sabado') {
      const horaStr = franja.split(':')[0].trim();
      const horaInicio = parseInt(horaStr, 10);
      if (horaInicio >= 13) {
        return true;
      }
    }
    return false;
  }

  seleccionarBloque(dia: string, franja: string) {
    if (this.esBloqueDeshabilitado(dia, franja)) {
      this.mostrarAviso('Los sábados solo se permiten tutorías hasta las 13:00.', 'advertencia');
      return;
    }

    const clave = `${dia}-${franja}`;
    const diaLimpio = dia.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    if (this.horarioSeleccionado[clave]) {
      delete this.horarioSeleccionado[clave]; 
    } else {
      if (diaLimpio === 'sabado') {
        this.horarioSeleccionado[clave] = 'VIRTUAL';
      } else {
        this.horarioSeleccionado[clave] = this.modalidadGlobal; 
      }
    }
    
    this.horarioSeleccionado = { ...this.horarioSeleccionado };
  }

  async guardarNuevoHorario() {
    if (Object.keys(this.horarioSeleccionado).length === 0) {
      this.mostrarAviso('Por favor, selecciona al menos un bloque de horario.', 'advertencia');
      return;
    }
    this.guardandoHorario = true;

    try {
      const horarioLimpio: any = {};
      for (let dia of this.diassemana) {
        for (let franja of this.franjasHorarias) {
          const clave = `${dia}-${franja}`;
          if (this.horarioSeleccionado[clave]) {
            horarioLimpio[clave] = this.horarioSeleccionado[clave];
          }
        }
      }

      const correo = this.usuario.correo.toLowerCase().trim();
      const q1 = query(collection(this.firestore, 'Tutores'), where('correo_google', '==', correo), where('estado', '==', 'ACTIVO'));
      const q2 = query(collection(this.firestore, 'Tutores'), where('correo', '==', correo), where('estado', '==', 'ACTIVO'));
      
      const snaps1 = await getDocs(q1);
      const snaps2 = await getDocs(q2);
      
      const docsAActualizar = new Map();
      snaps1.forEach(d => docsAActualizar.set(d.id, d.data()));
      snaps2.forEach(d => docsAActualizar.set(d.id, d.data()));

      if (docsAActualizar.size > 0) {
        let datosTutorParaExcel: any = null;

        for (let [id, datosTutor] of docsAActualizar) {
          await updateDoc(doc(this.firestore, 'Tutores', id), { horarios: horarioLimpio });
          if (!datosTutorParaExcel) datosTutorParaExcel = datosTutor;
        }

        const horariosFormateados = this.dbService.formatearHorariosParaExcel(horarioLimpio);
        const payloadExcel = {
          opcion: 'aceptarTutorOficial', 
          nombre: datosTutorParaExcel['nombre'] || this.usuario.nombre,
          cedula: datosTutorParaExcel['cedula'] || '',
          ciclo: datosTutorParaExcel['ciclo'] || this.cicloUsuario,
          carrera: datosTutorParaExcel['carrera'] || this.carreraUsuario,
          materias: Array.isArray(datosTutorParaExcel['materias']) ? datosTutorParaExcel['materias'].join(', ') : (datosTutorParaExcel['materias'] || ''),
          correo: datosTutorParaExcel['correo'] || datosTutorParaExcel['correo_google'] || this.usuario.correo,
          celular: datosTutorParaExcel['celular'] || this.celularUsuario,
          permanencia: datosTutorParaExcel['permanencia'] || 'TUTOR ACTIVO',
          horarios: horariosFormateados,
          periodo: datosTutorParaExcel['ultimo_periodo_activo'] || this.periodoActualApp
        };
        await this.dbService.enviarAExcel(payloadExcel);

        this.mostrarAviso('¡Tu horario ha sido actualizado exitosamente!', 'exito');
        this.mostrarModalHorarios = false;
      } else {
        this.mostrarAviso('No pudimos localizar tu perfil en la base de datos.', 'error');
      }
    } catch (error) {
      console.error("Error al guardar horario:", error);
      this.mostrarAviso('Ocurrió un error al guardar tu nuevo horario.', 'error');
    } finally {
      this.guardandoHorario = false;
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
}