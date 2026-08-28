import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, query, where, updateDoc, doc } from '@angular/fire/firestore';
import { 
  IonContent, IonHeader, IonToolbar, 
  IonIcon, IonItem, IonLabel, IonSelect, IonSelectOption, IonButtons, IonButton, IonSpinner, IonCheckbox, IonList,IonModal,ToastController,AlertController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  searchOutline, closeOutline, logoWhatsapp, star, mailOutline, 
  peopleOutline, checkmarkOutline, businessOutline, notificationsOutline, 
  informationCircleOutline, locationOutline, calendarOutline, helpCircleOutline, checkmarkCircleOutline, starOutline, swapHorizontalOutline, schoolOutline, briefcaseOutline, shieldCheckmarkOutline, closeCircleOutline, sendOutline } from 'ionicons/icons';
import { DatabaseService } from '../../services/database';
import { Router } from '@angular/router'; 

@Component({
  selector: 'app-horarios',
  templateUrl: './horarios.page.html',
  styleUrls: ['./horarios.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, CommonModule, FormsModule, 
    IonIcon, IonItem, IonLabel, IonSelect, IonSelectOption, IonButtons, IonButton, IonSpinner, IonCheckbox, IonList,IonModal
  ]
})
export class HorariosPage implements OnInit {
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

  hayNotificacionesSinLeer: boolean = false;
  textoBusqueda: string = '';
  cargando: boolean = false;
  mostrarModal: boolean = false;
  mostrarCoordinacion: boolean = false; 
  
  asignaturasMaster: any[] = [];
  asignaturasFiltradas: any[] = [];

  reservaActual: any = null;
  correoUsuario: string = '';
  nombreUsuario: string = '';

  esCoordinadorPanel: boolean = false;
  filtroSedeAgenda: string = 'GLOBAL';

  equipoCoordinacion: any[] = [];
  mostrarGuia: boolean = false;
  
  // 🌟 VARIABLES DE EVALUACIÓN (Ajustadas a 3)
  mostrarModalEvaluacion: boolean = false;
  reservaAEvaluar: any = null;
  enviandoEvaluacion: boolean = false;
  preguntasEvaluacion = [
    "1. ¿Comprendiste mejor el tema después de esta sesión tutorial?",
    "2. ¿La sesión tutorial aclaró tus dudas de forma clara y comprensible?",
    "3. Considero que este tipo de apoyo me ayudará a alcanzar mis metas académicas",
  ];
  // Arreglo de exactamente 3 posiciones (0 significa no respondida)
  respuestasEvaluacion: number[] = [0, 0, 0];

  mostrarModalTerminos: boolean = false;
  aceptaTerminosCheckbox: boolean = false;
  guardandoTerminos: boolean = false;
  usuarioDocId: string = '';

  constructor() {
    addIcons({helpCircleOutline,swapHorizontalOutline,notificationsOutline,businessOutline,peopleOutline,mailOutline,star,logoWhatsapp,checkmarkOutline,closeOutline,informationCircleOutline,searchOutline,calendarOutline,checkmarkCircleOutline,sendOutline,schoolOutline,briefcaseOutline,shieldCheckmarkOutline,closeCircleOutline,locationOutline,starOutline});
  }

  ngOnInit() {
    this.correoUsuario = localStorage.getItem('correo') || '';
    this.nombreUsuario = localStorage.getItem('nombre') || '';
  }
  
  irANotificaciones() {
    this.router.navigate(['/notificaciones']);
  }

  async ionViewWillEnter() {
    const correo = localStorage.getItem('correo') || '';
    if (correo) {
      try {
        const qUsuario = query(collection(this.firestore, 'Estudiantes'), where('correo', '==', correo));
        const snapUsuario = await getDocs(qUsuario);
        if (!snapUsuario.empty) {
          const datosUsr = snapUsuario.docs[0].data();
          this.usuarioDocId = snapUsuario.docs[0].id; 
          
          if (!datosUsr['terminos_aceptados']) {
            this.mostrarModalTerminos = true;
          }
        }
      } catch (e) {
        console.error("Error al verificar Firebase:", e);
      }
    }
    const rol = localStorage.getItem('rol') || 'ESTUDIANTE';
    const sede = localStorage.getItem('sede') || 'CUENCA';

    await this.verificarNotificaciones(correo, rol, sede);
    this.cargando = true;
    this.textoBusqueda = ''; 
    
    const rolActual = (localStorage.getItem('rol') || '').toUpperCase();
    this.esCoordinadorPanel = (rolActual === 'ADMIN' || rolActual === 'COORDINADOR');

    const sedeEstudiante = (localStorage.getItem('sede') || 'CUENCA').toUpperCase();
    const carreraEstudiante = (localStorage.getItem('carrera') || '').toUpperCase();

    const snapshotTutores = await getDocs(collection(this.firestore, 'Tutores'));
    let todosLosTutores = snapshotTutores.docs.map(doc => doc.data()).filter(t => t['estado'] === 'ACTIVO');

    const snapshotEstudiantes = await getDocs(collection(this.firestore, 'Estudiantes'));
    const todosLosEstudiantes = snapshotEstudiantes.docs.map(doc => doc.data());

    todosLosTutores.forEach(tutor => {
      const correoTutor = (tutor['correo'] || tutor['correo_google'] || '').toLowerCase().trim();
      const estudianteDB = todosLosEstudiantes.find(e => (e['correo'] || '').toLowerCase().trim() === correoTutor);
      
      if (estudianteDB && estudianteDB['rol']) {
        tutor['rol'] = String(estudianteDB['rol']).toUpperCase();
      } else {
        tutor['rol'] = 'TUTOR'; 
      }
    });

    const coordinadoresDinamicos = todosLosEstudiantes
      .filter(e => {
        const rolUsuarioDB = String(e['rol'] || '').toUpperCase();
        return rolUsuarioDB === 'COORDINADOR' || rolUsuarioDB === 'ADMIN';
      })
      .map(c => ({
        nombre: c['nombre_completo'] || c['nombre'] || 'Sin Nombre',
        correo: c['correo'] || '',
        rol: String(c['rol']).toUpperCase() === 'ADMIN' ? 'ADMINISTRADOR' : 'LÍDER GIETAES'
      }));

    this.equipoCoordinacion = [
      { nombre: 'Proyecto GIETAES', correo: 'gietaes@ups.edu.ec', rol: 'Contacto Oficial' },
      ...coordinadoresDinamicos
    ];

    let tutoresProcesados: any[] = [];
    let materiasPermitidas: string[] = [];

    if (!this.esCoordinadorPanel) {
      try {
        const catalogos = await this.dbService.obtenerCatalogosDesdeExcel();
        if (catalogos && catalogos.materias) {
          materiasPermitidas = catalogos.materias
            .filter((m: any) => (m.carrera || '').toUpperCase() === carreraEstudiante)
            .map((m: any) => (m.nombre || '').toUpperCase());
        }
      } catch (e) {
        console.error("Error al cargar la malla del estudiante", e);
      }
    }

    for (let tutor of todosLosTutores) {
      if (this.esCoordinadorPanel) {
        if (this.filtroSedeAgenda !== 'GLOBAL' && (tutor['sede'] || '').toUpperCase() !== this.filtroSedeAgenda) {
          continue; 
        }
      }

      let materiasDelTutor: string[] = [];
      if (Array.isArray(tutor['materias'])) {
        materiasDelTutor = tutor['materias'].map((m: string) => m.toUpperCase());
      } else if (typeof tutor['materias'] === 'string') {
        materiasDelTutor = tutor['materias'].split(',').map((m: string) => m.trim().toUpperCase());
      }

      if (!this.esCoordinadorPanel) {
        materiasDelTutor = materiasDelTutor.filter(m => materiasPermitidas.includes(m));
      }

      if (materiasDelTutor.length === 0 && !this.esCoordinadorPanel) continue;

      tutor['materiasFiltradas'] = materiasDelTutor;
      tutoresProcesados.push(tutor);
    }

    this.agruparPorMateria(tutoresProcesados, sedeEstudiante, this.esCoordinadorPanel);
    this.cargando = false;
    
    const guiaVista = localStorage.getItem('guia_horarios_vista');
    if (!guiaVista) {
      this.mostrarGuia = true;
      localStorage.setItem('guia_horarios_vista', 'true'); 
    }
    
    await this.verificarEvaluacionesPendientes();
  }
  
  async verificarNotificaciones(correo: string, rol: string, sede: string) {
    try {
      const notifs = await this.dbService.obtenerNotificacionesUsuario(correo, rol, sede);
      const sinLeer = notifs.filter((n: any) => {
        const leidas = n['leida_por'] || [];
        return !leidas.includes(correo);
      });
      this.hayNotificacionesSinLeer = sinLeer.length > 0;
    } catch (error) {
      console.error("Error al verificar notificaciones:", error);
    }
  }

  async recargarAgendaSede() {
    await this.ionViewWillEnter();
  }

  agruparPorMateria(tutores: any[], sedeUsuario: string, esAdmin: boolean = false) {
    const diccionario: { [materia: string]: any[] } = {};

    tutores.forEach(tutor => {
      let materiasArray = tutor.materiasFiltradas || [];
      if (materiasArray.length === 0 && esAdmin) {
        if (Array.isArray(tutor.materias)) {
          materiasArray = tutor.materias;
        } else if (typeof tutor.materias === 'string') {
          materiasArray = tutor.materias.split(',').map((m: string) => m.trim());
        }
      }

      const sedeTutor = (tutor.sede || '').toUpperCase();
      const esMismaSede = (sedeTutor === sedeUsuario.toUpperCase());

      let hVisible: any = { lunes: '', martes: '', miercoles: '', jueves: '', viernes: '', sabado: '' };

      if (tutor.horarios) {
        for (let clave in tutor.horarios) {
          let dashIndex = clave.indexOf('-');
          
          if (dashIndex > -1) {
            let diaCrudo = clave.substring(0, dashIndex); 
            let horaCruda = clave.substring(dashIndex + 1); 
            
            let diaClave = diaCrudo.toLowerCase().replace('é', 'e').replace('á', 'a').trim();
            let modalidad = (tutor.horarios[clave] || '').toUpperCase();
            
            const esPermitido = esAdmin || esMismaSede || (modalidad === 'VIRTUAL' || modalidad === 'AMBAS');

            if (esPermitido) {
              let etiqueta = '(P)';
              if (modalidad === 'VIRTUAL') etiqueta = '(V)';
              if (modalidad === 'AMBAS') etiqueta = '(P)(V)';

              if (hVisible[diaClave] !== undefined) {
                hVisible[diaClave] += `${horaCruda.trim()} ${etiqueta}\n`;
              }
            }
          } else {
            let diaClave = clave.toLowerCase().replace('é', 'e').replace('á', 'a').trim();
            if (esAdmin || esMismaSede) {
              if (hVisible[diaClave] !== undefined && typeof tutor.horarios[clave] === 'string') {
                hVisible[diaClave] += `${tutor.horarios[clave]}\n`;
              }
            }
          }
        }
      }

      let tieneHorariosValidos = false;
      for (let d in hVisible) {
        hVisible[d] = hVisible[d].trim();
        if (hVisible[d] !== '') {
          tieneHorariosValidos = true;
        }
      }

      if (tieneHorariosValidos || esAdmin) {
        const tutorCopia = { ...tutor, horarioVisible: hVisible };

        materiasArray.forEach((materia: string) => {
          if (!materia) return;
          const nombreMateria = materia.toUpperCase();
          if (!diccionario[nombreMateria]) {
            diccionario[nombreMateria] = [];
          }
          diccionario[nombreMateria].push(tutorCopia);
        });
      }
    });

    this.asignaturasMaster = Object.keys(diccionario).sort().map(nombre => {
      let tutoresMateria = diccionario[nombre];

      tutoresMateria.sort((a, b) => {
        const esCoordA = a.rol === 'COORDINADOR';
        const esCoordB = b.rol === 'COORDINADOR';
        
        if (esCoordA && !esCoordB) return -1;
        if (!esCoordA && esCoordB) return 1;
        
        return (a.nombre || '').localeCompare(b.nombre || '');
      });

      return {
        asignatura: nombre,
        tutores: tutoresMateria
      };
    });

    this.asignaturasFiltradas = [...this.asignaturasMaster];
  }

  filtrar() {
    const texto = this.textoBusqueda.toLowerCase().trim();
    if (texto === '') {
      this.asignaturasFiltradas = [...this.asignaturasMaster];
      return;
    }
    this.asignaturasFiltradas = this.asignaturasMaster.filter(bloque => {
      const coincideMateria = bloque.asignatura.toLowerCase().includes(texto);
      const coincideTutor = bloque.tutores.some((t: any) => (t.nombre || '').toLowerCase().includes(texto));
      return coincideMateria || coincideTutor;
    });
  }

  abrirConfirmacion(tutor: any, dia: string, horas: string, materia: string) { 
    if (!horas || horas.trim() === '') return; 

    const miCorreo = String(localStorage.getItem('correo') || '').toLowerCase().trim();
    const miNombre = String(localStorage.getItem('nombre') || '').toLowerCase().trim();
    
    const correoDelTutor = String(tutor.correo || tutor.correo_google || '').toLowerCase().trim();
    const nombreDelTutor = String(tutor.nombre || '').toLowerCase().trim();

    if (correoDelTutor !== '' && correoDelTutor === miCorreo) {
      this.mostrarAviso('No puedes agendar una tutoría contigo mismo.','error');
      return; 
    }

    if (nombreDelTutor !== '' && nombreDelTutor === miNombre) {
      this.mostrarAviso('Acción bloqueada: No puedes ser el estudiante y el tutor a la vez.','advertencia');
      return;
    }

    this.reservaActual = { 
      tutorNombre: tutor.nombre, 
      correoTutor: tutor.correo || tutor.correo_google, 
      celularTutor: tutor.celular, 
      dia: dia, 
      horas: horas, 
      materia: materia 
    }; 
    this.mostrarModal = true; 
  }

  cerrarConfirmacion() {
    this.mostrarModal = false;
    this.reservaActual = null;
  }

  async confirmarReserva() {
    if (!this.reservaActual) return;
    try {
      const datosReserva = {
        correoEstudiante: this.correoUsuario,
        nombreEstudiante: this.nombreUsuario,
        celularEstudiante: localStorage.getItem('celular') || 'No registrado',
        correoTutor: this.reservaActual.correoTutor,
        nombreTutor: this.reservaActual.tutorNombre,
        celularTutor: this.reservaActual.celularTutor || 'No registrado',
        materia: this.reservaActual.materia,
        dia_elegido: this.reservaActual.dia,
        hora_elegida: this.reservaActual.horas, 
        codigo: this.dbService.generarCodigoTutoria(this.reservaActual.materia)
      };
      
      await this.dbService.agendarTutoria(datosReserva);

      try {
        if (this.dbService.crearNotificacion) {
          await this.dbService.crearNotificacion({
            titulo: 'Nueva Solicitud de Tutoría',
            mensaje: `${this.nombreUsuario} ha solicitado una clase de ${this.reservaActual.materia} el día ${this.reservaActual.dia}.`,
            tipo: 'TUTORIA',
            correo_destino: this.reservaActual.correoTutor,
            sede_destino: 'GLOBAL',
            rol_destino: 'TUTOR' 
          });
        }
      } catch (notiError) {
        console.warn('Se guardó la clase, pero falló la notificación:', notiError);
      }

      this.cerrarConfirmacion();
      this.mostrarAviso('¡Tutoría agendada con éxito! Revisa la pestaña de Mis Tutorías.','exito');
    } catch (error) {
      console.error("Error al agendar:", error);
      this.mostrarAviso('Hubo un problema al enviar tu solicitud.','error');
    }
  }

  formatearNumeroWA(numero: string): string {
    if (!numero) return '';
    let limpio = numero.replace(/\D/g, '');
    if (limpio.startsWith('09')) {
      limpio = '9' + limpio.substring(2);
    }
    return limpio;
  }

  toggleCoordinacion() {
    this.mostrarCoordinacion = !this.mostrarCoordinacion;
  }
  
  abrirGuia() {
    this.mostrarGuia = true;
  }

  cerrarGuia() {
    this.mostrarGuia = false;
  }

  // ==========================================
  // 🌟 SISTEMA DE EVALUACIÓN (3 PREGUNTAS + ESCALA NUMÉRICA)
  // ==========================================
  async verificarEvaluacionesPendientes() {
    const nombre = localStorage.getItem('nombre');
    const cedula = localStorage.getItem('cedula');
    if(!nombre || !cedula) return;

    const miInfo = `${nombre} - ${cedula}`;

    try {
      const q = query(
        collection(this.firestore, 'Asistencias'),
        where('estudiante_info', '==', miInfo)
      );
      const snap = await getDocs(q);
      
      const pendientes = snap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .filter(r => !r.evaluado);

      if (pendientes.length > 0) {
        this.reservaAEvaluar = pendientes[0]; 
        this.mostrarModalEvaluacion = true;   
      }
    } catch (error) {
      console.error("Error al buscar evaluaciones pendientes", error);
    }
  }

  // 🌟 VALIDAMOS QUE LAS 3 PREGUNTAS TENGAN RESPUESTA
  get evaluacionValida(): boolean {
    return this.respuestasEvaluacion[0] > 0 && 
           this.respuestasEvaluacion[1] > 0 && 
           this.respuestasEvaluacion[2] > 0;
  }

  seleccionarCalificacion(indexPregunta: number, valor: number) {
    this.respuestasEvaluacion[indexPregunta] = valor;
  }

  async enviarEvaluacion() {
    if (!this.evaluacionValida) {
      this.mostrarAviso("Por favor, califica las 3 preguntas antes de enviar.",'info');
      return;
    }

    this.enviandoEvaluacion = true;

    try {
      const urlScript = 'https://script.google.com/macros/s/AKfycbxZU9rwtMPcWsqNrwMaGPXFEjD2vEj-Tyhby5EYMtk__5_yrk7EELUn3ZqOEr1EOEZO/exec';
      
      const payload = {
        opcion: 'guardarEvaluacion', 
        estudiante: localStorage.getItem('nombre') || 'Desconocido',
        tutor: this.reservaAEvaluar.nombreTutor,
        materia: this.reservaAEvaluar.materia,
        p1: this.respuestasEvaluacion[0],
        p2: this.respuestasEvaluacion[1],
        p3: this.respuestasEvaluacion[2],
        p4: 'N/A', // Rellenamos para no descuadrar tu Google Sheet
        p5: 'N/A'  // Rellenamos para no descuadrar tu Google Sheet
      };

      await fetch(urlScript, { 
        method: 'POST', 
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      await updateDoc(doc(this.firestore, 'Asistencias', this.reservaAEvaluar.id), { evaluado: true });

      this.mostrarAviso("¡Gracias por tu retroalimentación! Ya puedes seguir agendando.",'exito');
      this.mostrarModalEvaluacion = false;
      this.respuestasEvaluacion = [0, 0, 0]; // Reiniciar

    } catch (error) {
      this.mostrarAviso("Hubo un error de conexión al enviar la evaluación.",'error');
    } finally {
      this.enviandoEvaluacion = false;
    }
  }

  // ==========================================
  // 🌟 ACEPTACIÓN DE TÉRMINOS Y CONDICIONES
  // ==========================================
  async aceptarTerminos() {
    if (!this.aceptaTerminosCheckbox) return;
    
    this.guardandoTerminos = true;
    try {
      await updateDoc(doc(this.firestore, 'Estudiantes', this.usuarioDocId), { 
        terminos_aceptados: true 
      });
      
      this.mostrarModalTerminos = false;
    } catch (error) {
      console.error("Error al guardar términos:", error);
      this.mostrarAviso("Hubo un problema de conexión. Inténtalo de nuevo.",'info');
    } finally {
      this.guardandoTerminos = false;
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
        console.error("❌ Error consultando permisos:", error);
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