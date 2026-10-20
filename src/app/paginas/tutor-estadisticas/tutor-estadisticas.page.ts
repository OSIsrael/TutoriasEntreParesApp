import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonToolbar, IonIcon, IonButton, IonButtons,
  NavController, IonGrid, IonRow, IonCol, IonSelect, IonSelectOption,
  IonSpinner, ToastController, AlertController,
  IonSegment, IonSegmentButton, IonLabel 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  personCircleOutline, mailOutline, businessOutline, schoolOutline,
  bookOutline, logOutOutline, peopleOutline, notificationsOutline, 
  barChartOutline, personOutline, settingsOutline, addCircleOutline,
  closeOutline, checkmarkOutline, warningOutline, timeOutline } from 'ionicons/icons';
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
    IonSegment, IonSegmentButton, IonLabel
  ]
})
export class TutorEstadisticasPage implements OnInit {
  // 🌟 CORRECCIÓN DE INYECCIÓN DE FIRESTORE
  private firestore = inject(Firestore);
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
// 🌟 AÑADIMOS EL CERO A LAS 7 Y A LAS 9 PARA QUE COINCIDAN PERFECTAMENTE
  franjasHorarias = ['07:00 - 09:00','09:00 - 11:00','11:00 - 13:00','14:00 - 16:00','16:00 - 18:00','18:00 - 20:00','20:00 - 22:00'];  horarioSeleccionado: { [key: string]: string } = {}; 
  modalidadGlobal: string = 'PRESENCIAL';

  constructor() {
    addIcons({notificationsOutline,personCircleOutline,mailOutline,businessOutline,barChartOutline,addCircleOutline,personOutline,logOutOutline,settingsOutline,bookOutline,warningOutline,peopleOutline,schoolOutline,closeOutline,checkmarkOutline,timeOutline});
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

  // ==========================================
  // 🌟 CAMBIO DE HORARIOS (NUEVO Y BLINDADO)
  // ==========================================

  // 🌟 BUSCADOR INFALIBLE: Prioriza el perfil ACTIVO del tutor
  async obtenerDocIdTutor(): Promise<string | null> {
    const correo = this.usuario.correo.toLowerCase().trim();
    
    // 1. Buscamos en 'correo_google' asegurando que esté ACTIVO
    let q = query(collection(this.firestore, 'Tutores'), where('correo_google', '==', correo), where('estado', '==', 'ACTIVO'));
    let snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
    
    // 2. Buscamos en 'correo' asegurando que esté ACTIVO
    q = query(collection(this.firestore, 'Tutores'), where('correo', '==', correo), where('estado', '==', 'ACTIVO'));
    snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;

    // 3. Respaldo por si perdió el estado activo por accidente
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
          
          // 🌟 NORMALIZAMOS LAS LLAVES VIEJAS ("7:00" a "07:00") PARA QUE SE REFLEJEN EN LA TABLA
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
    
    // 🌟 FORZAMOS EL REDIBUJADO VISUAL
    this.horarioSeleccionado = { ...this.horarioSeleccionado };
  }

  async guardarNuevoHorario() {
    if (Object.keys(this.horarioSeleccionado).length === 0) {
      this.mostrarAviso('Por favor, selecciona al menos un bloque de horario.', 'advertencia');
      return;
    }
    this.guardandoHorario = true;

    try {
      // 🌟 LIMPIEZA DE FANTASMAS: Filtramos solo las llaves que existen en la cuadrícula actual
      const horarioLimpio: any = {};
      for (let dia of this.diassemana) {
        for (let franja of this.franjasHorarias) {
          const clave = `${dia}-${franja}`;
          if (this.horarioSeleccionado[clave]) {
            horarioLimpio[clave] = this.horarioSeleccionado[clave];
          }
        }
      }

      // Buscamos si el tutor tiene perfiles duplicados en la base de datos
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

        // 🌟 ACTUALIZAMOS TODOS LOS PERFILES DEL TUTOR (borrando los horarios viejos)
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

  // ==========================================
  // 🌟 ALERTAS NATIVAS
  // ==========================================
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