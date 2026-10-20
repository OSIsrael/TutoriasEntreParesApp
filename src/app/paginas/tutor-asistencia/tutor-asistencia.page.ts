import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonIcon, IonButton, IonButtons,
  IonItem, IonLabel, IonSelect, IonSelectOption, IonTextarea, IonInput, IonList, IonRange, IonModal, ToastController, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  documentTextOutline, sendOutline, notificationsOutline, 
  personOutline, bookOutline, timeOutline, schoolOutline,
  checkmarkCircleOutline, chatbubblesOutline, gitNetworkOutline, barcodeOutline,
  peopleOutline, trashOutline, closeCircle, helpCircleOutline, swapHorizontalOutline, closeOutline, briefcaseOutline, shieldCheckmarkOutline, personCircleOutline 
} from 'ionicons/icons';
import { Firestore, doc, getDoc, collection, getDocs, where, query, deleteDoc } from '@angular/fire/firestore';
import { DatabaseService } from '../../services/database';

@Component({
  selector: 'app-tutor-asistencia',
  templateUrl: './tutor-asistencia.page.html',
  styleUrls: ['./tutor-asistencia.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, 
    IonIcon, IonButton, IonButtons, IonItem, IonLabel, 
    IonSelect, IonSelectOption, IonTextarea, IonInput, IonList, IonRange, IonModal
  ]
})
export class TutorAsistenciaPage implements OnInit {
  private dbService = inject(DatabaseService);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

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

  tutoriaPreCargada: boolean = false;

  busquedaEstudiante: string = '';
  estudiantesFiltrados: any[] = [];

  estudiantesSeleccionados: any[] = [];

  form = {
    materia: '',
    tema_tratado: '',
    horas: 1,
    asistio: '',
    participo: '',
    codigo_tutoria: ''
  };

  constructor() {
    addIcons({personCircleOutline, swapHorizontalOutline, notificationsOutline, bookOutline, documentTextOutline, timeOutline, barcodeOutline, peopleOutline, personOutline, trashOutline, schoolOutline, gitNetworkOutline, sendOutline, closeOutline, briefcaseOutline, shieldCheckmarkOutline, helpCircleOutline, checkmarkCircleOutline, chatbubblesOutline, closeCircle});
  }

  ngOnInit() { }

  async ionViewWillEnter() {
    this.correoTutor = localStorage.getItem('correo') || '';
    this.nombreTutor = localStorage.getItem('nombre') || '';
    this.carreraTutor = localStorage.getItem('carrera') || '';
    this.rolUsuario = localStorage.getItem('rol') || 'TUTOR';
    this.sedeUsuario = localStorage.getItem('sede') || 'CUENCA';

    // 🌟 SOLUCIÓN A LA CACHÉ: Atrapamos la tutoría enviada justo cuando la página se abre
    const state = history.state;
    if (state && state.tutoriaMaster) {
      this.estudiantesSeleccionados = []; // Limpiamos por si había una clase anterior
      this.preCargarClase(state.tutoriaMaster);
      
      // Limpiamos el historial para no afectar futuras entradas manuales a la pestaña
      history.replaceState({}, '');
    }

    await this.verificarNotificaciones();
    await this.cargarDatos();
  }

  preCargarClase(master: any) {
    this.tutoriaPreCargada = true;
    this.form.materia = master.materia;
    this.form.codigo_tutoria = master.codigo !== 'SIN CÓDIGO' ? master.codigo : '';
    
    // Agregar al solicitante original
    this.estudiantesSeleccionados.push({
      info: `${master.nombreEstudiante} (Solicitante)`,
      nombre: master.nombreEstudiante,
      idReserva: master.id,
      docente: master.docente,
      derivacion: master.tipoDerivacion,
      asistio: 'SI',
      participo: 'SI'
    });

    // Agregar estudiantes que se unieron
    if (master.alumnosExtra && master.alumnosExtra.length > 0) {
      master.alumnosExtra.forEach((extra: any) => {
        this.estudiantesSeleccionados.push({
          info: `${extra.nombreEstudiante} (Invitado)`,
          nombre: extra.nombreEstudiante,
          idReserva: extra.id,
          docente: extra.docente,
          derivacion: extra.tipoDerivacion,
          asistio: 'SI',
          participo: 'SI'
        });
      });
    }
    
    // Forzamos el redibujado de la interfaz por si Ionic se queda congelado
    if (this.cdr) this.cdr.detectChanges();
  }

  async cargarDatos() {
    this.cargando = true;
    try {
      const tutorSnap = await getDoc(doc(this.firestore, 'Tutores', this.correoTutor));
      if (tutorSnap.exists()) {
        this.materiasTutor = tutorSnap.data()['materias'] || [];
      }

      const snapEstudiantes = await getDocs(collection(this.firestore, 'Estudiantes'));
      this.estudiantes = snapEstudiantes.docs.map(doc => doc.data());

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
    
    if (!this.estudiantesSeleccionados.find(e => e.info === infoCompletada)) {
      this.estudiantesSeleccionados.push({
        info: infoCompletada,
        nombre: est.nombre_completo,
        cedula: est.cedula,
        docente: '',
        docentesFiltrados: [],
        derivacion: 'DECISIÓN PROPIA',
        asistio: 'SI',
        participo: 'SI'
      });
    }
    
    this.busquedaEstudiante = ''; 
    this.estudiantesFiltrados = [];
  }

  removerEstudiante(index: number) {
    this.estudiantesSeleccionados.splice(index, 1);
  }

  filtrarDocentesParaEstudiante(est: any) {
    const txt = (est.docente || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!txt) { est.docentesFiltrados = []; return; }

    est.docentesFiltrados = this.docentesExcel.filter(d => 
      d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(txt)
    ).slice(0, 5);
  }

  seleccionarDocenteParaEstudiante(est: any, docente: string) {
    est.docente = docente;
    est.docentesFiltrados = [];
  }

  async enviarRegistro() {
    if (this.tutoriaPreCargada) {
      if (!this.form.tema_tratado || !this.form.horas) {
        this.mostrarAviso("Debes completar el Tema Impartido y las Horas.", 'advertencia');
        return;
      }
    } else {
      if (this.estudiantesSeleccionados.length === 0 || !this.form.materia) {
        this.mostrarAviso("Debes añadir al menos un estudiante y seleccionar la Materia.",'advertencia');
        return;
      }
    }

    this.enviando = true;

    try {
      const promesas = [];

      for (const est of this.estudiantesSeleccionados) {
        if (est.asistio === 'SI') {
          const reporte = {
            correoTutor: this.correoTutor,
            nombreTutor: this.nombreTutor,
            materia: this.form.materia,
            tema_tratado: this.form.tema_tratado || 'No especificado',
            horas: this.form.horas || 1,
            asistio: est.asistio, 
            participo: est.participo, 
            codigo_tutoria: this.form.codigo_tutoria || 'SIN CÓDIGO',
            estudiante_info: est.info,
            nombre_docente: est.docente || 'No especificado', 
            derivacion: est.derivacion || 'DECISIÓN PROPIA',          
            fecha_registro: new Date().toISOString()
          };
          promesas.push(this.dbService.guardarAsistencia(reporte));
        }

        if (est.idReserva) {
          promesas.push(deleteDoc(doc(this.firestore, 'Reservas', est.idReserva)));
        }
      }

      await Promise.all(promesas);

      this.mostrarAviso(`Asistencia registrada. La tutoría ha sido finalizada.`, 'exito');
      
      this.form = { materia: '', tema_tratado: '', horas: 1, asistio: '', participo: '', codigo_tutoria: '' };
      this.estudiantesSeleccionados = [];
      this.busquedaEstudiante = '';
      this.tutoriaPreCargada = false;

      this.router.navigate(['/tabs-tutor/tutorias']);

    } catch (error) {
      this.mostrarAviso("Hubo un error al guardar. Revisa tu conexión a internet.",'error');
    } finally {
      this.enviando = false;
    }
  }

  async cambiarPanel() {
    const correo = localStorage.getItem('correo') || '';
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
      } catch (error) {}
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