import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, query, where, updateDoc, doc } from '@angular/fire/firestore';
import { Auth, signOut } from '@angular/fire/auth'; 
import { 
  IonContent, IonHeader, IonToolbar, 
  IonIcon, IonItem, IonLabel, IonSelect, IonSelectOption, IonButtons, IonButton, IonSpinner, IonCheckbox, IonList,IonModal,ToastController,AlertController,IonInput,
  IonPopover, IonDatetime, IonDatetimeButton 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  searchOutline, closeOutline, logoWhatsapp, star, mailOutline, 
  peopleOutline, checkmarkOutline, businessOutline, notificationsOutline, 
  informationCircleOutline, locationOutline, calendarOutline, helpCircleOutline, checkmarkCircleOutline, starOutline, swapHorizontalOutline, schoolOutline, briefcaseOutline, shieldCheckmarkOutline, closeCircleOutline, sendOutline, personCircleOutline, flashOutline,
  chevronDownOutline, logOutOutline, settingsOutline 
} from 'ionicons/icons';
import { DatabaseService } from '../../services/database';
import { Router } from '@angular/router'; 

@Component({
  selector: 'app-horarios',
  templateUrl: './horarios.page.html',
  styleUrls: ['./horarios.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, CommonModule, FormsModule, 
    IonIcon, IonItem, IonLabel, IonSelect, IonSelectOption, IonButtons, IonButton, IonSpinner, IonCheckbox, IonList,IonModal,IonInput, IonPopover, IonDatetime, IonDatetimeButton
  ]
})
export class HorariosPage implements OnInit {

  rolUsuario:string='ESTUDIANTE';
  private dbService = inject(DatabaseService);
  private firestore = inject(Firestore);
  private router = inject(Router); 
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(Auth); 

  mostrarModalRenovacionEstudiante: boolean = false;
  nuevoCicloEstudiante: number = 1;
  periodoApp: string = '';
  
  listaHorasDisponibles: string[] = [];
  horaSeleccionada: string = '';
  modalidadElegida: string = '';       
  opcionesModalidad: string[] = [];    

  // 🌟 VARIABLES BLOQUEO DE DOBLE CLIC Y FECHAS EXACTAS
  enviandoReserva: boolean = false;
  fechaExactaTutoria: string = new Date().toISOString();
  fechaMinima: string = new Date().toISOString(); 
  fechasPermitidasNormal: any;
  fechasPermitidasMatch: any;

  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  datosEstudianteActual: any = null; 

  menuRolAbierto: boolean = false;
  eventoRol: any = null;
  menuPerfilAbierto: boolean = false;
  eventoPerfil: any = null;

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
  
  mostrarModalEvaluacion: boolean = false;
  reservaAEvaluar: any = null;
  enviandoEvaluacion: boolean = false;
  preguntasEvaluacion = [
    "1. ¿Comprendiste mejor el tema después de esta sesión tutorial?",
    "2. ¿La sesión tutorial aclaró tus dudas de forma clara y comprensible?",
    "3. Considero que este tipo de apoyo me ayudará a alcanzar mis metas académicas",
  ];
  respuestasEvaluacion: number[] = [0, 0, 0];

  mostrarModalTerminos: boolean = false;
  aceptaTerminosCheckbox: boolean = false;
  guardandoTerminos: boolean = false;
  usuarioDocId: string = '';

  mostrarModalInteligente: boolean = false;
  textoBusquedaInteligente: string = '';
  materiasSugeridas: string[] = [];
  
  materiaInteligente: string = '';
  diaInteligente: string = '';
  horaInteligente: string = '';

  diasDisponiblesInteligente: string[] = [];
  horasDisponiblesInteligente: string[] = [];

  tipoDerivacion: string = '';
  docenteBuscado: string = '';
  docentesFiltrados: string[] = [];
  docentesExcel: string[] = []; 
  sedeUsuario: string = '';

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
    addIcons({personCircleOutline,helpCircleOutline,swapHorizontalOutline,notificationsOutline,businessOutline,searchOutline,peopleOutline,mailOutline,star,logoWhatsapp,checkmarkOutline,closeOutline,informationCircleOutline,calendarOutline,checkmarkCircleOutline,sendOutline,schoolOutline,briefcaseOutline,shieldCheckmarkOutline,flashOutline,closeCircleOutline,locationOutline,starOutline,chevronDownOutline,logOutOutline,settingsOutline});
  }

  ngOnInit() {
    this.correoUsuario = localStorage.getItem('correo') || '';
    this.nombreUsuario = localStorage.getItem('nombre') || '';
  }

  // 🌟 FUNCIÓN QUE BLOQUEA EL CALENDARIO SEGÚN EL DÍA ELEGIDO
  calcularFechasPermitidas(diaSemanaTexto: string) {
    const diasSemanaMapa: { [key: string]: number } = {
      'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6
    };
    const diaLimpio = diaSemanaTexto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const diaObjetivo = diasSemanaMapa[diaLimpio];

    return (dateString: string) => {
      const date = new Date(dateString);
      return date.getUTCDay() === diaObjetivo; // Valida que solo se escoja ese día de la semana
    };
  }

  async ionViewWillEnter() {
    const correo = localStorage.getItem('correo') || '';
    const rolActual = (localStorage.getItem('rol') || '').toUpperCase();
    this.rolUsuario = rolActual; 
    this.sedeUsuario = (localStorage.getItem('sede') || 'CUENCA').toUpperCase();
    
    this.esCoordinadorPanel = (rolActual === 'ADMIN' || rolActual === 'COORDINADOR');
    if (this.rolUsuario === 'COORDINADOR') {
      this.filtroSedeAgenda = this.sedeUsuario;
    }

    await this.dbService.cargarConfiguracionGlobal(true);
    this.periodoApp = this.dbService.periodo_actual;

    if (correo) {
      try {
        const qUsuario = query(collection(this.firestore, 'Estudiantes'), where('correo', '==', correo));
        const snapUsuario = await getDocs(qUsuario);
        if (!snapUsuario.empty) {
          const datosUsr = snapUsuario.docs[0].data();
          this.usuarioDocId = snapUsuario.docs[0].id; 
          this.datosEstudianteActual=datosUsr;  
          if (datosUsr['ultimo_periodo_activo'] !== this.periodoApp) {
            this.mostrarModalRenovacionEstudiante = true;
          } else if (!datosUsr['terminos_aceptados']) {
            this.mostrarModalTerminos = true;
          }
        }
      } catch (e) {
        console.error("Error al verificar Firebase:", e);
      }
    }

    await this.verificarNotificaciones(correo, this.rolUsuario, this.sedeUsuario);
    await this.cargarPermisosPaneles(correo); 
    
    this.cargando = true;
    this.textoBusqueda = ''; 

    const carreraEstudiante = (localStorage.getItem('carrera') || '').toUpperCase();
    const snapshotTutores = await getDocs(collection(this.firestore, 'Tutores'));
    let todosLosTutores = snapshotTutores.docs.map(doc => doc.data()).filter(t => t['estado'] === 'ACTIVO');

    const snapshotEstudiantes = await getDocs(collection(this.firestore, 'Estudiantes'));
    const todosLosEstudiantes = snapshotEstudiantes.docs.map(doc => doc.data());

    todosLosTutores.forEach(tutor => {
      const correoTutor = (tutor['correo'] || tutor['correo_google'] || '').toLowerCase().trim();
      const estudianteDB = todosLosEstudiantes.find(e => (e['correo'] || '').toLowerCase().trim() === correoTutor);
      if (estudianteDB && estudianteDB['rol']) tutor['rol'] = String(estudianteDB['rol']).toUpperCase();
      else tutor['rol'] = 'TUTOR'; 
    });

    const coordinadoresDinamicos = todosLosEstudiantes
      .filter(e => {
        const rolUsuarioDB = String(e['rol'] || '').toUpperCase();
        const sedeCoord = String(e['sede'] || '').toUpperCase();
        const cumpleSede = (this.rolUsuario === 'ADMIN') || (sedeCoord === this.sedeUsuario);
        return (rolUsuarioDB === 'COORDINADOR' || rolUsuarioDB === 'ADMIN') && cumpleSede;
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
      } catch (e) { console.error("Error", e); }
    }

    for (let tutor of todosLosTutores) {
      if (this.esCoordinadorPanel) {
        if (this.filtroSedeAgenda !== 'GLOBAL' && (tutor['sede'] || '').toUpperCase() !== this.filtroSedeAgenda) continue; 
      }
      let materiasDelTutor: string[] = [];
      if (Array.isArray(tutor['materias'])) materiasDelTutor = tutor['materias'].map((m: string) => m.toUpperCase());
      else if (typeof tutor['materias'] === 'string') materiasDelTutor = tutor['materias'].split(',').map((m: string) => m.trim().toUpperCase());

      if (!this.esCoordinadorPanel) materiasDelTutor = materiasDelTutor.filter(m => materiasPermitidas.includes(m));
      if (materiasDelTutor.length === 0 && !this.esCoordinadorPanel) continue;

      tutor['materiasFiltradas'] = materiasDelTutor;
      tutoresProcesados.push(tutor);
    }

    this.agruparPorMateria(tutoresProcesados, this.sedeUsuario, this.esCoordinadorPanel);
    this.cargando = false;
    
    const guiaVista = localStorage.getItem('guia_horarios_vista');
    if (!guiaVista) {
      this.mostrarGuia = true;
      localStorage.setItem('guia_horarios_vista', 'true'); 
    }
    
    await this.verificarEvaluacionesPendientes();
    
    // 🌟 ENVIAMOS LA SEDE DEL ESTUDIANTE A DATABASE.TS PARA FILTRAR
    this.docentesExcel = await this.dbService.obtenerDocentesDesdeExcel(this.sedeUsuario);
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
    } catch (error) {}
    if (this.cdr) this.cdr.detectChanges(); 
  }

  abrirMenuRol(evento: any) { this.eventoRol = evento; this.menuRolAbierto = true; }
  abrirMenuPerfil(evento: any) { this.eventoPerfil = evento; this.menuPerfilAbierto = true; }
  irAPanel(ruta: string, rolDestino: string) { this.menuRolAbierto = false; localStorage.setItem('rol', rolDestino); setTimeout(() => { this.router.navigate([ruta]); }, 150); }
  irAPerfil() { this.menuPerfilAbierto = false; this.router.navigate(['/tabs/perfil']); }
  irANotificaciones() { this.router.navigate(['/notificaciones']); }
  async cerrarSesion() { this.menuPerfilAbierto = false; try { await signOut(this.auth); localStorage.clear(); this.router.navigate(['/login']); } catch (error) { localStorage.clear(); this.router.navigate(['/login']); } }
  async recargarAgendaSede() { await this.ionViewWillEnter(); }
  toggleCoordinacion() { this.mostrarCoordinacion = !this.mostrarCoordinacion; }
  abrirGuia() { this.mostrarGuia = true; this.menuPerfilAbierto = false; }
  cerrarGuia() { this.mostrarGuia = false; }

  async verificarNotificaciones(correo: string, rol: string, sede: string) {
    try {
      const notifs = await this.dbService.obtenerNotificacionesUsuario(correo, rol, sede);
      const sinLeer = notifs.filter((n: any) => { return !n['leida_por']?.includes(correo); });
      this.hayNotificacionesSinLeer = sinLeer.length > 0;
    } catch (error) {}
  }

  agruparPorMateria(tutores: any[], sedeUsuario: string, esAdmin: boolean = false) {
    const diccionario: { [materia: string]: any[] } = {};
    const tutoresUnicos = new Map();
    tutores.forEach(t => {
      const correo = (t.correo || t.correo_google || '').toLowerCase().trim();
      if (!tutoresUnicos.has(correo)) tutoresUnicos.set(correo, t);
    });

    tutoresUnicos.forEach(tutor => {
      let materiasArray = tutor.materiasFiltradas || [];
      if (materiasArray.length === 0 && esAdmin) {
        if (Array.isArray(tutor.materias)) materiasArray = tutor.materias;
        else if (typeof tutor.materias === 'string') materiasArray = tutor.materias.split(',').map((m: string) => m.trim());
      }
      const sedeTutor = (tutor.sede || '').toUpperCase();
      const esMismaSede = (sedeTutor === sedeUsuario.toUpperCase());
      let hVisible: any = { lunes: '', martes: '', miercoles: '', jueves: '', viernes: '', sabado: '' };

      if (tutor.horarios) {
        const clavesOrdenadas = Object.keys(tutor.horarios).sort((a, b) => {
          const horaA = a.split('-')[1]?.trim() || '';
          const horaB = b.split('-')[1]?.trim() || '';
          return horaA.localeCompare(horaB);
        });

        for (let clave of clavesOrdenadas) {
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
              if (modalidad === 'AMBAS') etiqueta = '(P/V)';
              if (hVisible[diaClave] !== undefined) hVisible[diaClave] += `${horaCruda.trim()} ${etiqueta}\n`;
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
        if (hVisible[d] !== '') tieneHorariosValidos = true;
      }

      if (tieneHorariosValidos || esAdmin) {
        const tutorCopia = { ...tutor, horarioVisible: hVisible };
        materiasArray.forEach((materia: string) => {
          if (!materia) return;
          const nombreMateria = materia.toUpperCase();
          if (!diccionario[nombreMateria]) diccionario[nombreMateria] = [];
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
      return { asignatura: nombre, tutores: tutoresMateria };
    });
    this.asignaturasFiltradas = [...this.asignaturasMaster];
  }

  limpiarTexto(texto: string): string {
    if (!texto) return '';
    return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  filtrar() {
    const busquedaLimpia = this.limpiarTexto(this.textoBusqueda);
    if (busquedaLimpia === '') {
      this.asignaturasFiltradas = [...this.asignaturasMaster];
      return;
    }
    this.asignaturasFiltradas = this.asignaturasMaster.filter(bloque => {
      const materiaLimpia = this.limpiarTexto(bloque.asignatura);
      const coincideMateria = materiaLimpia.includes(busquedaLimpia);
      const coincideTutor = bloque.tutores.some((t: any) => {
        const tutorLimpio = this.limpiarTexto(t.nombre || '');
        return tutorLimpio.includes(busquedaLimpia);
      });
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
      this.mostrarAviso('No puedes agendar una tutoría contigo mismo.','error'); return; 
    }
    if (nombreDelTutor !== '' && nombreDelTutor === miNombre) {
      this.mostrarAviso('Acción bloqueada: No puedes ser el estudiante y el tutor a la vez.','advertencia'); return;
    }

    this.listaHorasDisponibles = horas.split('\n').map(h => h.trim()).filter(h => h.length > 0);
    this.horaSeleccionada = ''; 
    this.modalidadElegida = '';
    this.opcionesModalidad = [];
    this.fechaExactaTutoria = new Date().toISOString(); 

    // 🌟 APLICAMOS RESTRICCIÓN DE FECHAS AL CALENDARIO
    this.fechasPermitidasNormal = this.calcularFechasPermitidas(dia);

    this.reservaActual = { 
      tutorNombre: tutor.nombre, 
      correoTutor: tutor.correo || tutor.correo_google, 
      celularTutor: tutor.celular, 
      codigoPaisTutor: tutor.codigo_pais || '+593',
      tutorSede: (tutor.sede || 'NO DEFINIDA').toUpperCase(), 
      dia: dia, 
      horas: horas, 
      materia: materia 
    }; 
    this.mostrarModal = true; 
  }

  actualizarOpcionesModalidad() {
    this.modalidadElegida = '';
    this.opcionesModalidad = [];

    if (!this.horaSeleccionada || !this.reservaActual) return;

    const esOtraSede = this.reservaActual.tutorSede !== this.sedeUsuario;

    if (this.horaSeleccionada.includes('(P/V)')) {
      if (esOtraSede) {
        this.opcionesModalidad = ['VIRTUAL'];
        this.modalidadElegida = 'VIRTUAL'; 
      } else {
        this.opcionesModalidad = ['PRESENCIAL', 'VIRTUAL']; 
      }
    } else if (this.horaSeleccionada.includes('(V)')) {
      this.opcionesModalidad = ['VIRTUAL'];
      this.modalidadElegida = 'VIRTUAL';
    } else if (this.horaSeleccionada.includes('(P)')) {
      this.opcionesModalidad = ['PRESENCIAL'];
      this.modalidadElegida = 'PRESENCIAL';
    } else {
      this.opcionesModalidad = ['PRESENCIAL'];
      this.modalidadElegida = 'PRESENCIAL';
    }
  }

  cerrarConfirmacion() {
    this.mostrarModal = false;
    this.reservaActual = null;
    this.listaHorasDisponibles = [];
    this.horaSeleccionada = '';
    this.modalidadElegida = '';
    this.opcionesModalidad = [];
  }

  async confirmarReserva() {
    if (this.enviandoReserva) return; 
    if (!this.reservaActual) return;
    if (!this.horaSeleccionada) { this.mostrarAviso('Por favor, selecciona una hora específica para la tutoría.', 'advertencia'); return; }
    if (this.opcionesModalidad.length > 1 && !this.modalidadElegida) { this.mostrarAviso('Por favor, selecciona la modalidad de la tutoría.', 'advertencia'); return; }
    if (!this.tipoDerivacion && !this.reservaActual.tipo_derivacion) { this.mostrarAviso('Por favor, indica el motivo de la tutoría.', 'advertencia'); return; }
    if (!this.docenteBuscado && !this.reservaActual.docente) { this.mostrarAviso('Por favor, busca y selecciona un docente.', 'advertencia'); return; }

    this.enviandoReserva = true; 

    try {
      const horaLimpia = this.horaSeleccionada.split('(')[0].trim();
      const fechaCorta = this.fechaExactaTutoria.split('T')[0]; 

      const datosReserva = {
        correoEstudiante: this.correoUsuario,
        nombreEstudiante: this.nombreUsuario,
        celularEstudiante: localStorage.getItem('celular') || 'No registrado',
        codigoPaisEstudiante: localStorage.getItem('codigo_pais') || '+593', 
        correoTutor: this.reservaActual.correoTutor,
        nombreTutor: this.reservaActual.tutorNombre,
        celularTutor: this.reservaActual.celularTutor || 'No registrado',
        codigoPaisTutor: this.reservaActual.codigoPaisTutor || '+593', 
        materia: this.reservaActual.materia,
        dia_elegido: this.reservaActual.dia,
        hora_elegida: horaLimpia, 
        fecha_exacta: fechaCorta, 
        modalidad: this.modalidadElegida, 
        sedeTutor: this.reservaActual.tutorSede, 
        codigo: this.dbService.generarCodigoTutoria(this.reservaActual.materia),
        tipo_derivacion: this.tipoDerivacion || this.reservaActual.tipo_derivacion || 'DECISIÓN PROPIA',
        docente: this.docenteBuscado || this.reservaActual.docente || 'No especificado'
      };
      
      await this.dbService.agendarTutoria(datosReserva);

      try {
        if (this.dbService.crearNotificacion) {
          await this.dbService.crearNotificacion({
            titulo: 'Nueva Solicitud de Tutoría',
            mensaje: `${this.nombreUsuario} ha solicitado una clase ${this.modalidadElegida} de ${this.reservaActual.materia} el ${fechaCorta} a las ${horaLimpia}.`, 
            tipo: 'TUTORIA',
            correo_destino: this.reservaActual.correoTutor,
            sede_destino: 'GLOBAL',
            rol_destino: 'TUTOR' 
          });
        }
      } catch (notiError) {}

      this.cerrarConfirmacion();
      this.mostrarAviso('¡Tutoría agendada con éxito! Revisa la pestaña de Mis Tutorías.','exito');
      
      this.tipoDerivacion = '';
      this.docenteBuscado = '';
      this.docentesFiltrados = [];
    } catch (error) {
      this.mostrarAviso('Hubo un problema al enviar tu solicitud.','error');
    } finally {
      this.enviandoReserva = false; 
    }
  }

  formatearNumeroWA(numero: string): string {
    if (!numero) return '';
    let limpio = numero.replace(/\D/g, '');
    if (limpio.startsWith('09')) limpio = '9' + limpio.substring(2);
    return limpio;
  }

  async verificarEvaluacionesPendientes() {
    const nombre = localStorage.getItem('nombre');
    const cedula = localStorage.getItem('cedula');
    if(!nombre || !cedula) return;
    const miInfo = `${nombre} - ${cedula}`;

    try {
      const q = query(collection(this.firestore, 'Asistencias'), where('estudiante_info', '==', miInfo));
      const snap = await getDocs(q);
      const pendientes = snap.docs.map(d => ({ id: d.id, ...d.data() as any })).filter(r => !r.evaluado);

      if (pendientes.length > 0) {
        this.reservaAEvaluar = pendientes[0]; 
        this.mostrarModalEvaluacion = true;   
      }
    } catch (error) {}
  }

  get evaluacionValida(): boolean {
    return this.respuestasEvaluacion[0] > 0 && this.respuestasEvaluacion[1] > 0 && this.respuestasEvaluacion[2] > 0;
  }

  seleccionarCalificacion(indexPregunta: number, valor: number) {
    this.respuestasEvaluacion[indexPregunta] = valor;
  }

  async enviarEvaluacion() {
    if (!this.evaluacionValida) {
      this.mostrarAviso("Por favor, califica las 3 preguntas antes de enviar.",'info'); return;
    }
    this.enviandoEvaluacion = true;
    try {
      const urlScript = 'https://script.google.com/macros/s/AKfycbxZU9rwtMPcWsqNrwMaGPXFEjD2vEj-Tyhby5EYMtk__5_yrk7EELUn3ZqOEr1EOEZO/exec';
      const payload = {
        opcion: 'guardarEvaluacion', 
        estudiante: localStorage.getItem('nombre') || 'Desconocido',
        tutor: this.reservaAEvaluar.nombreTutor,
        materia: this.reservaAEvaluar.materia,
        p1: this.respuestasEvaluacion[0], p2: this.respuestasEvaluacion[1], p3: this.respuestasEvaluacion[2], p4: 'N/A', p5: 'N/A'  
      };
      await fetch(urlScript, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      await updateDoc(doc(this.firestore, 'Asistencias', this.reservaAEvaluar.id), { evaluado: true });
      this.mostrarAviso("¡Gracias por tu retroalimentación! Ya puedes seguir agendando.",'exito');
      this.mostrarModalEvaluacion = false;
      this.respuestasEvaluacion = [0, 0, 0]; 
    } catch (error) {
      this.mostrarAviso("Hubo un error de conexión al enviar la evaluación.",'error');
    } finally {
      this.enviandoEvaluacion = false;
    }
  }

  async aceptarTerminos() {
    if (!this.aceptaTerminosCheckbox) return;
    this.guardandoTerminos = true;
    try {
      await updateDoc(doc(this.firestore, 'Estudiantes', this.usuarioDocId), { terminos_aceptados: true });
      this.mostrarModalTerminos = false;
    } catch (error) {
      this.mostrarAviso("Hubo un problema de conexión. Inténtalo de nuevo.",'info');
    } finally {
      this.guardandoTerminos = false;
    }
  }

  async confirmarRenovacionEstudiante() {
    try {
      await updateDoc(doc(this.firestore, 'Estudiantes', this.usuarioDocId), {
        ciclo: this.nuevoCicloEstudiante, ultimo_periodo_activo: this.periodoApp
      });
      if (this.datosEstudianteActual) {
        const payloadExcel = { opcion: 'registrarEstudiante', periodo: this.periodoApp, ...this.datosEstudianteActual, ciclo: this.nuevoCicloEstudiante };
        await this.dbService.enviarAExcel(payloadExcel);
      }
      this.mostrarModalRenovacionEstudiante = false;
    } catch (error) { alert("Error al actualizar el ciclo. Revisa tu conexión."); }
  }

  abrirAgendamientoInteligente() {
    this.mostrarModalInteligente = true;
    this.resetearFiltrosInteligentes();
  }

  cerrarAgendamientoInteligente() {
    this.mostrarModalInteligente = false;
    this.resetearFiltrosInteligentes();
  }

  resetearFiltrosInteligentes() {
    this.textoBusquedaInteligente = ''; this.materiaInteligente = ''; this.diaInteligente = '';
    this.horaInteligente = ''; this.materiasSugeridas = []; this.diasDisponiblesInteligente = [];
    this.horasDisponiblesInteligente = []; this.tipoDerivacion = ''; this.docenteBuscado = ''; this.docentesFiltrados = [];
    this.fechaExactaTutoria = new Date().toISOString(); 
  }

  buscarMateriaInteligente(event?: any) {
    if (event && event.detail) this.textoBusquedaInteligente = event.detail.value;
    if (!this.textoBusquedaInteligente || this.textoBusquedaInteligente.trim() === '') {
      this.materiasSugeridas = [];
      if (this.cdr) this.cdr.detectChanges();
      return;
    }

    const busqueda = this.limpiarTexto(this.textoBusquedaInteligente);
    const sugerenciasTemp: string[] = [];

    if (this.asignaturasMaster && this.asignaturasMaster.length > 0) {
      this.asignaturasMaster.forEach((bloque: any) => {
        if (bloque.asignatura) {
          const materiaLimpia = this.limpiarTexto(bloque.asignatura);
          if (materiaLimpia.includes(busqueda) && !sugerenciasTemp.includes(bloque.asignatura)) {
            sugerenciasTemp.push(bloque.asignatura);
          }
        }
      });
    }
    this.materiasSugeridas = sugerenciasTemp;
    if (this.cdr) this.cdr.detectChanges();
  } 

  seleccionarMateriaInteligente(materia: string) {
    this.materiaInteligente = materia;
    this.textoBusquedaInteligente = materia; 
    this.materiasSugeridas = []; 
    this.diaInteligente = ''; this.horaInteligente = '';

    const bloque = this.asignaturasMaster.find((a: any) => a.asignatura === materia);
    const diasSet = new Set<string>();
    const horasSet = new Set<string>();

    if (bloque && bloque.tutores) {
      bloque.tutores.forEach((tutor: any) => {
        if (tutor.horarios) {
          Object.keys(tutor.horarios).forEach(clave => {
            const partes = clave.split('-');
            if (partes.length >= 2) {
              diasSet.add(partes[0].trim());
              const hora = partes.slice(1).join('-').trim();
              horasSet.add(hora);
            }
          });
        }
      });
    }

    const ordenDias: { [key: string]: number } = { 'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6, 'domingo': 7 };
    this.diasDisponiblesInteligente = Array.from(diasSet).sort((a, b) => {
      const diaA = a.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const diaB = b.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return (ordenDias[diaA] || 99) - (ordenDias[diaB] || 99);
    });

    this.horasDisponiblesInteligente = Array.from(horasSet).sort((a, b) => {
      const horaA = a.split('-')[0].trim(); 
      const horaB = b.split('-')[0].trim();
      return horaA.localeCompare(horaB);    
    });
    
    if (this.cdr) this.cdr.detectChanges(); 
  }

  // 🌟 SE ACTIVA AL SELECCIONAR EL DÍA EN EL MATCH
  alSeleccionarDiaMatch() {
    if (this.diaInteligente) {
      this.fechasPermitidasMatch = this.calcularFechasPermitidas(this.diaInteligente);
      this.fechaExactaTutoria = new Date().toISOString();
    }
  }

  async ejecutarMatchInteligente() {
    if (this.enviandoReserva) return; 

    if (!this.materiaInteligente || !this.diaInteligente || !this.horaInteligente || !this.tipoDerivacion || !this.docenteBuscado) {
      this.mostrarAviso('Por favor, completa todos los campos para buscar tu tutor ideal.', 'advertencia'); return;
    }

    const bloque = this.asignaturasMaster.find((a: any) => a.asignatura === this.materiaInteligente);
    let tutoresValidos: any[] = [];

    if (bloque && bloque.tutores) {
      bloque.tutores.forEach((tutor: any) => {
        const claveBuscada = `${this.diaInteligente}-${this.horaInteligente}`;
        if (tutor.horarios && tutor.horarios[claveBuscada]) {
          const miCorreo = String(localStorage.getItem('correo')).toLowerCase().trim();
          const correoTutor = String(tutor.correo || tutor.correo_google).toLowerCase().trim();
          if (correoTutor !== miCorreo) tutoresValidos.push(tutor);
        }
      });
    }

    if (tutoresValidos.length === 0) {
      this.mostrarAviso('No hay tutores disponibles en ese cruce exacto. Intenta con otra hora.', 'error'); return;
    }

    const indiceAleatorio = Math.floor(Math.random() * tutoresValidos.length);
    const tutorElegido = tutoresValidos[indiceAleatorio];

    const claveBuscada = `${this.diaInteligente}-${this.horaInteligente}`;
    const modalidadTutor = (tutorElegido.horarios[claveBuscada] || '').toUpperCase();
    const esOtraSede = (tutorElegido.sede || '').toUpperCase() !== this.sedeUsuario;

    if (esOtraSede) this.modalidadElegida = 'VIRTUAL';
    else {
      if (modalidadTutor === 'PRESENCIAL') this.modalidadElegida = 'PRESENCIAL';
      else if (modalidadTutor === 'VIRTUAL') this.modalidadElegida = 'VIRTUAL';
      else this.modalidadElegida = 'VIRTUAL'; 
    }

    this.reservaActual = {
      tutorNombre: tutorElegido.nombre,
      correoTutor: tutorElegido.correo || tutorElegido.correo_google,
      celularTutor: tutorElegido.celular,
      codigoPaisTutor: tutorElegido.codigo_pais || '+593',
      tutorSede: (tutorElegido.sede || 'NO DEFINIDA').toUpperCase(),
      dia: this.diaInteligente,
      horas: this.horaInteligente,
      materia: this.materiaInteligente,
      tipo_derivacion: this.tipoDerivacion,
      docente: this.docenteBuscado
    };
    
    this.horaSeleccionada = this.horaInteligente; 
    await this.confirmarReserva(); 
    this.cerrarAgendamientoInteligente();
  }

  filtrarDocentes() {
    const txt = (this.docenteBuscado || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!txt) { this.docentesFiltrados = []; return; }
    this.docentesFiltrados = this.docentesExcel.filter((d: string) => d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(txt)).slice(0, 5); 
  }

  seleccionarDocente(docente: string) {
    this.docenteBuscado = docente;
    this.docentesFiltrados = []; 
  }

  async mostrarAviso(mensaje: string, tipo: 'exito' | 'error' | 'advertencia' | 'info' = 'exito') {
    let icono = 'checkmark-circle-outline';
    let claseCss = 'toast-exito';
    if (tipo === 'error') { icono = 'close-circle-outline'; claseCss = 'toast-error'; } 
    else if (tipo === 'advertencia') { icono = 'warning-outline'; claseCss = 'toast-advertencia'; } 
    else if (tipo === 'info') { icono = 'information-circle-outline'; claseCss = 'toast-info'; }

    const toast = await this.toastController.create({
      message: mensaje, duration: 3000, position: 'top', icon: icono, cssClass: `toast-premium-gietaes ${claseCss}`, mode: 'ios' 
    });
    await toast.present();
  }
}