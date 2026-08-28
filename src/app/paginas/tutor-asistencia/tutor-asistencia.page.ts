import { Component, OnInit, inject,ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonIcon, IonButton, IonButtons,
  IonItem, IonLabel, IonSelect, IonSelectOption, IonTextarea, IonInput, IonList,IonRange,IonModal,ToastController,AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  documentTextOutline, sendOutline, notificationsOutline, 
  personOutline, bookOutline, timeOutline, schoolOutline,
  checkmarkCircleOutline, chatbubblesOutline, gitNetworkOutline, barcodeOutline,
  peopleOutline, trashOutline, closeCircle, helpCircleOutline, swapHorizontalOutline, closeOutline, briefcaseOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { Firestore, doc, getDoc, collection, getDocs,where,query } from '@angular/fire/firestore';
import { DatabaseService } from '../../services/database';

@Component({
  selector: 'app-tutor-asistencia',
  templateUrl: './tutor-asistencia.page.html',
  styleUrls: ['./tutor-asistencia.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, 
    IonIcon, IonButton, IonButtons, IonItem, IonLabel, 
    IonSelect, IonSelectOption, IonTextarea, IonInput, IonList,IonRange,IonModal
  ]
})
export class TutorAsistenciaPage implements OnInit {
  private dbService = inject(DatabaseService);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  // 🌟 VARIABLES PARA EL MENÚ DE ROLES
  mostrarMenuRol: boolean = false;
  tienePanelTutor: boolean = false;
  tienePanelAdmin: boolean = false;

  correoTutor: string = '';
  nombreTutor: string = '';
  carreraTutor: string = '';
  rolUsuario: string = '';
  sedeUsuario: string = '';

  estudiantes: any[] = [];
  docentesExcel: string[] = [];
  materiasTutor: string[] = [];
  
  cargando: boolean = true;
  enviando: boolean = false;
  hayNotificacionesSinLeer: boolean = false;

  // 🌟 BUSCADOR INTELIGENTE DE ESTUDIANTES
  busquedaEstudiante: string = '';
  estudiantesFiltrados: any[] = [];

  // 🌟 LISTA DE ALUMNOS AÑADIDOS A ESTA TUTORÍA (Para envío múltiple)
  estudiantesSeleccionados: any[] = [];

  // 🌟 DATOS GENERALES DE LA CLASE (Se aplican a todos los alumnos)
  form = {
    materia: '',
    tema_tratado: '',
    horas: 1,
    asistio: '',
    participo: '',
    codigo_tutoria: ''
  };

  constructor() {
    addIcons({swapHorizontalOutline,notificationsOutline,bookOutline,documentTextOutline,timeOutline,barcodeOutline,peopleOutline,personOutline,trashOutline,schoolOutline,gitNetworkOutline,sendOutline,closeOutline,briefcaseOutline,shieldCheckmarkOutline,helpCircleOutline,checkmarkCircleOutline,chatbubblesOutline,closeCircle});
  }

  ngOnInit() { }

  async ionViewWillEnter() {
    this.correoTutor = localStorage.getItem('correo') || '';
    this.nombreTutor = localStorage.getItem('nombre') || '';
    this.carreraTutor = localStorage.getItem('carrera') || '';
    this.rolUsuario = localStorage.getItem('rol') || 'TUTOR';
    this.sedeUsuario = localStorage.getItem('sede') || 'CUENCA';

    await this.verificarNotificaciones();
    await this.cargarDatos();
  }

  async cargarDatos() {
    this.cargando = true;
    try {
      const tutorSnap = await getDoc(doc(this.firestore, 'Tutores', this.correoTutor));
      if (tutorSnap.exists()) {
        this.materiasTutor = tutorSnap.data()['materias'] || [];
      }

      // 🌟 SOLUCIÓN AL PUNTO 1: Traemos TODOS los estudiantes sin importar la carrera
      const snapEstudiantes = await getDocs(collection(this.firestore, 'Estudiantes'));
      this.estudiantes = snapEstudiantes.docs.map(doc => doc.data());

      // Cargamos la lista de docentes
      this.docentesExcel = await this.dbService.obtenerDocentesDesdeExcel();
    } catch (e) {
      console.error(e);
    }
    this.cargando = false;
  }

  async verificarNotificaciones() {
    try {
      const notifs = await this.dbService.obtenerNotificacionesUsuario(this.correoTutor, this.rolUsuario, this.sedeUsuario, 'TUTOR');
      const sinLeer = notifs.filter((n: any) => !n['leida_por']?.includes(this.correoTutor));
      this.hayNotificacionesSinLeer = sinLeer.length > 0;
    } catch (error) {}
  }

  irANotificaciones() {
    this.router.navigate(['/notificaciones'], { queryParams: { panel: 'TUTOR' } });
  }

  // ==========================================
  // 🌟 GESTIÓN DE ESTUDIANTES MÚLTIPLES
  // ==========================================
  filtrarEstudiantes() {
    const txt = this.busquedaEstudiante.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!txt) { this.estudiantesFiltrados = []; return; }
    
    this.estudiantesFiltrados = this.estudiantes.filter(e => {
      const textoCompleto = `${e.nombre_completo} ${e.cedula}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return textoCompleto.includes(txt);
    }).slice(0, 5);
  }

  seleccionarEstudiante(est: any) {
    const infoCompletada = `${est.nombre_completo} - ${est.cedula}`;
    
    // Verificamos que no lo haya añadido dos veces por accidente
    if (!this.estudiantesSeleccionados.find(e => e.info === infoCompletada)) {
      this.estudiantesSeleccionados.push({
        info: infoCompletada,
        nombre: est.nombre_completo,
        cedula: est.cedula,
        docente: '',
        docentesFiltrados: [], // 🌟 AÑADIDO PARA LA BÚSQUEDA NATIVA DE DOCENTES
        derivacion: 'DECISION PROPIA'
      });
    }
    
    this.busquedaEstudiante = ''; 
    this.estudiantesFiltrados = [];
  }

  removerEstudiante(index: number) {
    this.estudiantesSeleccionados.splice(index, 1);
  }

  // ==========================================
  // 🌟 GESTIÓN DE DOCENTES (BÚSQUEDA NATIVA)
  // ==========================================
  filtrarDocentesParaEstudiante(est: any) {
    const txt = (est.docente || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!txt) { est.docentesFiltrados = []; return; }

    est.docentesFiltrados = this.docentesExcel.filter(d => 
      d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(txt)
    ).slice(0, 5); // Máximo 5 sugerencias para no saturar la pantalla
  }

  seleccionarDocenteParaEstudiante(est: any, docente: string) {
    est.docente = docente;
    est.docentesFiltrados = []; // Cierra la lista al seleccionar
  }

  // ==========================================
  // 🌟 ENVÍO MASIVO (BULK)
  // ==========================================
  async enviarRegistro() {
    if (this.estudiantesSeleccionados.length === 0 || !this.form.materia || !this.form.asistio) {
      this.mostrarAviso("Debes añadir al menos un estudiante y completar la Materia y la Asistencia global.",'advertencia');
      return;
    }

    this.enviando = true;

    try {
      const promesas = this.estudiantesSeleccionados.map(est => {
        const reporte = {
          correoTutor: this.correoTutor,
          nombreTutor: this.nombreTutor,
          materia: this.form.materia,
          tema_tratado: this.form.tema_tratado || 'No especificado',
          horas: this.form.horas || '1',
          asistio: this.form.asistio,
          participo: this.form.participo || 'NO',
          codigo_tutoria: this.form.codigo_tutoria || 'SIN CÓDIGO',
          
          estudiante_info: est.info,
          nombre_docente: est.docente || 'No especificado', 
          derivacion: est.derivacion || 'NINGUNA',          
          
          fecha_registro: new Date().toISOString()
        };
        return this.dbService.guardarAsistencia(reporte);
      });

      await Promise.all(promesas);

      this.mostrarAviso(`Se registraron exitosamente las asistencias de ${this.estudiantesSeleccionados.length} estudiante(s).`,'exito');
      
      this.form = { materia: '', tema_tratado: '', horas: 1, asistio: '', participo: '', codigo_tutoria: '' };
      this.estudiantesSeleccionados = [];
      this.busquedaEstudiante = '';

    } catch (error) {
      this.mostrarAviso("Hubo un error al guardar. Revisa tu conexión a internet.",'error');
    } finally {
      this.enviando = false;
    }
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
  // ==========================================
  // 🌟 SISTEMA DE AVISOS NATIVOS PREMIUM
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
      position: 'top', // Los pasamos arriba para que no tapen tus pestañas de navegación
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
          {
            text: 'Cancelar',
            role: 'cancel',
            cssClass: 'btn-alerta-cancelar',
            handler: () => resolve(false)
          },
          {
            text: 'Sí, Continuar',
            cssClass: 'btn-alerta-confirmar',
            handler: () => resolve(true)
          }
        ]
      });
      await alert.present();
    });
  }
}