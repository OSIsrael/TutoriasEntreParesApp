import { Component, OnInit, inject, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, 
  IonList, IonItemSliding, IonItem, IonItemOptions, IonItemOption,
  IonLabel, IonModal, ToastController, AlertController, IonPopover
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  notificationsOutline, bookOutline, logoWhatsapp, 
  personOutline, timeOutline, calendarOutline, trashOutline,
  checkmarkCircleOutline, closeCircleOutline, closeOutline, helpCircleOutline, 
  informationCircleOutline, documentTextOutline, swapHorizontalOutline, schoolOutline, 
  briefcaseOutline, shieldCheckmarkOutline, chevronDownOutline, chevronBackOutline,
  informationCircle, closeCircle, personCircleOutline, checkmarkCircle, 
  settingsOutline, logOutOutline // 🌟 AÑADIDOS PARA EL POPOVER DE PERFIL
} from 'ionicons/icons';
import { Firestore, collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc } from '@angular/fire/firestore';
import { DatabaseService } from '../../services/database';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Auth, signOut } from '@angular/fire/auth';

@Component({
  selector: 'app-tutor-tutorias',
  templateUrl: './tutor-tutorias.page.html',
  styleUrls: ['./tutor-tutorias.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, 
    IonButtons, IonButton, IonIcon, IonList, IonItemSliding, 
    IonItem, IonItemOptions, IonItemOption, IonPopover, IonLabel, IonModal
  ]
})
export class TutorTutoriasPage implements OnInit {
  private dbService = inject(DatabaseService);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(Auth);

  mostrarModalRenovacionTutor: boolean = false;
  decisionTutor: string = '';
  nuevoCicloTutor: number = 0;
  permanenciaTutor: string = ''; 
  periodoApp: string = '';
  tutorDocId: string = '';
  pasoActual: number = 1;

  materiasCatalogo: any[] = [];
  materiasDisponibles: string[] = [];
  materiasSeleccionadas: string[] = [];
  diassemana=['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
  franjasHorarias=['7:00 - 9:00','09:00 - 11:00','11:00 - 13:00','14:00 - 16:00','16:00 - 18:00','18:00 - 20:00','20:00 - 22:00'];
  horarioSeleccionado: { [key: string]: string } = {}; 
  modalidadGlobal: string = 'PRESENCIAL';

  datosTutorActual: any = null; 

  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  
  // 🌟 PERMISOS DE PANELES
  tienePanelTutor: boolean = false;
  tienePanelAdmin: boolean = false;

  tutoriasPorImpartir: any[] = [];
  cargando: boolean = true;
  correoUsuario: string = '';
  nombreUsuario: string = ''; // 🌟 AÑADIDO PARA LA CABECERA
  rolUsuario: string = '';
  hayNotificacionesSinLeer: boolean = false;
  mostrarGuiaTutor: boolean = false;

  @ViewChild('popoverEstado') popoverEstado!: IonPopover;
  menuEstadoAbierto: boolean = false;
  tutoriaSeleccionada: any = null;

  // 🌟 VARIABLES PARA MENÚS DESPLEGABLES
  menuRolAbierto: boolean = false;
  eventoRol: any = null;
  menuPerfilAbierto: boolean = false;
  eventoPerfil: any = null;

  // 🌟 GETTERS PARA LA CABECERA DINÁMICA
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
    addIcons({personCircleOutline,swapHorizontalOutline,helpCircleOutline,notificationsOutline,calendarOutline,bookOutline,informationCircleOutline,personOutline,timeOutline,chevronDownOutline,logoWhatsapp,trashOutline,checkmarkCircleOutline,documentTextOutline,closeOutline,schoolOutline,briefcaseOutline,shieldCheckmarkOutline,chevronBackOutline,closeCircleOutline,informationCircle,checkmarkCircle,closeCircle, settingsOutline, logOutOutline});
  }

  ngOnInit() { }

  async ionViewWillEnter() {
    this.correoUsuario = localStorage.getItem('correo') || '';
    this.nombreUsuario = localStorage.getItem('nombre') || ''; // 🌟 CARGAMOS EL NOMBRE
    this.rolUsuario = (localStorage.getItem('rol') || 'ESTUDIANTE').toUpperCase();
    
    await this.cargarPermisosPaneles(this.correoUsuario);

    await this.dbService.cargarConfiguracionGlobal(true);
    this.periodoApp = this.dbService.periodo_actual;
    
    const sede = localStorage.getItem('sede') || 'CUENCA';

    if (this.correoUsuario) {
      const qTut = query(collection(this.firestore, 'Tutores'), where('correo_google', '==', this.correoUsuario.toLowerCase().trim()));
      const snapTut = await getDocs(qTut);
      if (!snapTut.empty) {
        this.tutorDocId = snapTut.docs[0].id;
        const datosTut = snapTut.docs[0].data();
        this.datosTutorActual = datosTut;
        
        if (datosTut['ultimo_periodo_activo'] !== this.periodoApp) {
          this.abrirRenovacion(); 
        }
      }
    }
    
    await this.verificarNotificaciones(this.correoUsuario, this.rolUsuario, sede);
    await this.cargarTutoriasPorImpartir();
    const guiaTutorVista = localStorage.getItem('guia_tutor_vista');
    if (!guiaTutorVista) {
      this.mostrarGuiaTutor = true;
      localStorage.setItem('guia_tutor_vista', 'true'); 
    }
  }

  async verificarNotificaciones(correo: string, rol: string, sede: string) {
    try {
      const notifs = await this.dbService.obtenerNotificacionesUsuario(correo, rol, sede, 'TUTOR');
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
    this.router.navigate(['/notificaciones'], { queryParams: { panel: 'TUTOR' } });
  }

 async cargarTutoriasPorImpartir() {
    this.cargando = true;
    this.tutoriasPorImpartir = [];

    try {
      const qTutor = query(collection(this.firestore, 'Reservas'), where('correoTutor', '==', this.correoUsuario));
      const snapshot = await getDocs(qTutor);

      const tutoriasAgrupadas = new Map();
      const tutoriasIndividuales: any[] = [];

      snapshot.forEach(documento => {
        const res = documento.data();
        
        if (res['estado'] === 'CANCELADA') return;

        let colorEstado = '#fde047'; 
        if (res['estado'] === 'CONFIRMADA' || res['estado'] === 'ACEPTADA') colorEstado = '#34d399'; 

    const tutoriaFormateada: any = {
          id: documento.id,
          materia: res['materia'],
          codigo: res['codigo'] || res['codigo_tutoria'] || 'SIN CÓDIGO',
          dia: res['dia_elegido'] || res['dia'] || 'Por definir',
          hora: res['hora_elegida'] || res['hora'] || 'Por definir',
          fecha_exacta: res['fecha_exacta'] || '', 
          modalidad: res['modalidad'] || 'Presencial', 
          color: colorEstado,
          estado: res['estado'],
          celularEstudiante: res['celularEstudiante'], 
          codigoPaisEstudiante: res['codigoPaisEstudiante'] || '+593', 
          nombreEstudiante: res['nombreEstudiante'],
          correoEstudiante: res['correoEstudiante'],
          tipoDerivacion: res['tipo_derivacion'] || 'DECISIÓN PROPIA',
          es_invitado: res['es_invitado'] || false, 
          // 🌟 SOLUCIÓN: Atrapamos cualquier posible nombre de variable del Docente
          docente: res['docente'] || res['nombreDocente'] || res['docenteEstudiante'] || res['nombre_docente'] || '', 
          alumnosExtra: [] 
        };

        if (tutoriaFormateada.codigo !== 'SIN CÓDIGO') {
          if (tutoriasAgrupadas.has(tutoriaFormateada.codigo)) {
            const master = tutoriasAgrupadas.get(tutoriaFormateada.codigo);
            // Si el que acabamos de leer es el dueño original, intercambiamos roles
            if (!tutoriaFormateada.es_invitado && master.es_invitado) {
              tutoriaFormateada.alumnosExtra = [...master.alumnosExtra, master];
              tutoriasAgrupadas.set(tutoriaFormateada.codigo, tutoriaFormateada);
            } else {
              master.alumnosExtra.push(tutoriaFormateada);
            }
          } else {
            tutoriasAgrupadas.set(tutoriaFormateada.codigo, tutoriaFormateada);
          }
        } else {
          tutoriasIndividuales.push(tutoriaFormateada);
        }
      });

      this.tutoriasPorImpartir = [...Array.from(tutoriasAgrupadas.values()), ...tutoriasIndividuales];

    } catch (error) {
      console.error("Error cargando la agenda del tutor:", error);
    }
    this.cargando = false;
  }

  irATomarAsistencia(tutoria: any) {
    this.router.navigate(['/tabs-tutor/asistencia'], {
      state: { tutoriaMaster: tutoria }
    });
  }

  contactarEstudiante(celular: string, codigoPais: string, nombre: string, materia: string) {
    if (!celular || celular === 'No registrado' || celular.trim() === '') {
      this.mostrarAviso("El estudiante no registró su número celular.",'error');
      return;
    }
    
    let celFormateado = celular.replace(/\D/g, ''); 
    if (celFormateado.startsWith('0')) {
      celFormateado = celFormateado.substring(1);
    }
    
    let prefijo = (codigoPais || '+593').replace(/\D/g, ''); 
    const numeroFinal = prefijo + celFormateado;
    
    const mensaje = encodeURIComponent(`Hola ${nombre}, soy tu tutor para la materia de ${materia}. Te escribo para coordinar nuestra sesión.`);
    const urlWa = `https://wa.me/${numeroFinal}?text=${mensaje}`;
    window.open(urlWa, '_blank');
  }

  abrirMenuEstado(evento: any, tutoria: any) {
    evento.stopPropagation(); 
    this.tutoriaSeleccionada = tutoria;
    this.popoverEstado.event = evento; 
    this.menuEstadoAbierto = true;
  }

  seleccionarNuevoEstado(nuevoEstado: string, nuevoColor: string) {
    this.menuEstadoAbierto = false; 
    if (this.tutoriaSeleccionada) {
      if (nuevoEstado === 'CANCELADA') {
        this.cancelarTutoriaInteligente(this.tutoriaSeleccionada);
      } else {
        this.actualizarEstadoFirebase(this.tutoriaSeleccionada, nuevoEstado, nuevoColor);
      }
    }
  }

  async actualizarEstadoFirebase(tutoria: any, nuevoEstado: string, nuevoColor: string) {
    const index = this.tutoriasPorImpartir.findIndex(t => t.id === tutoria.id);
    if (index !== -1) {
      this.tutoriasPorImpartir[index].estado = nuevoEstado;
      this.tutoriasPorImpartir[index].color = nuevoColor;
      this.tutoriasPorImpartir = [...this.tutoriasPorImpartir]; 
    }

    try {
      const tutoriaRef = doc(this.firestore, 'Reservas', tutoria.id);
      await updateDoc(tutoriaRef, { estado: nuevoEstado });

      if (nuevoEstado === 'CONFIRMADA' || nuevoEstado === 'ACEPTADA') {
        await this.programarRecordatoriosTutor(tutoria);
      }
    } catch (error) {
      this.mostrarAviso("Error al guardar el estado.",'error');
      return;
    }

    try {
      if (this.dbService.crearNotificacion) {
        await this.dbService.crearNotificacion({
          titulo: `Tutoría ${nuevoEstado}`,
          mensaje: `El tutor ha marcado tu clase de ${tutoria.materia} como ${nuevoEstado}.`,
          tipo: 'TUTORIA',
          correo_destino: tutoria.correoEstudiante || 'sin_correo',
          rol_destino: 'ESTUDIANTE' 
        });
      }
    } catch (notiError) {}
  }

  calcularProximaFecha(diaElegido: string, horaElegida: string): Date {
    const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const diaNormalizado = diaElegido.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const diaIndex = dias.indexOf(diaNormalizado);

    const hoy = new Date();
    let fecha = new Date(hoy);

    if (diaIndex !== -1) {
      const hoyIndex = hoy.getDay();
      let diasFaltantes = diaIndex - hoyIndex;
      if (diasFaltantes < 0) diasFaltantes += 7; 
      fecha.setDate(hoy.getDate() + diasFaltantes);
    }

    const horaLimpia = horaElegida.split('-')[0].replace(/[^0-9:]/g, '').trim();
    if (horaLimpia.includes(':')) {
      const partes = horaLimpia.split(':');
      fecha.setHours(parseInt(partes[0], 10), parseInt(partes[1], 10), 0, 0);
    }
    return fecha;
  }

  generarIdNumerico(idString: string): number {
    let hash = 0;
    if (!idString) return Math.floor(Math.random() * 100000);
    for (let i = 0; i < idString.length; i++) {
      hash = (hash << 5) - hash + idString.charCodeAt(i);
      hash |= 0; 
    }
    return Math.abs(hash);
  }

  async programarRecordatoriosTutor(tutoria: any) {
    if(tutoria.dia === 'Por definir' || tutoria.hora === 'Por definir') return;

    const fechaTutoria = this.calcularProximaFecha(tutoria.dia, tutoria.hora);
    const ahora = new Date().getTime();
    const notificaciones = [];
    const idBase = this.generarIdNumerico(tutoria.id);

    const tiempo1Hora = fechaTutoria.getTime() - (60 * 60 * 1000);
    if (tiempo1Hora > ahora) {
      notificaciones.push({
        id: idBase + 50, 
        title: '¡Clase a punto de empezar! ⏰',
        body: `En 1 hora impartirás ${tutoria.materia} a ${tutoria.nombreEstudiante}.`,
        schedule: { at: new Date(tiempo1Hora) }
      });
    }

    const fechaMismoDia = new Date(fechaTutoria);
    fechaMismoDia.setHours(8, 0, 0, 0);
    const tiempoMismoDia = fechaMismoDia.getTime();

    if (tiempoMismoDia > ahora && tiempoMismoDia < tiempo1Hora) {
      notificaciones.push({
        id: idBase + 51, 
        title: 'Hoy tienes clases programadas ',
        body: `Hoy impartirás una tutoría de ${tutoria.materia} a ${tutoria.nombreEstudiante}.`,
        schedule: { at: new Date(tiempoMismoDia) }
      });
    }

    if (notificaciones.length > 0) {
      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        permStatus = await LocalNotifications.requestPermissions();
      }
      if (permStatus.display === 'granted') {
        await LocalNotifications.schedule({ notifications: notificaciones });
      }
    }
  }

  async eliminarTutoria(tutoria: any) {
    this.cancelarTutoriaInteligente(tutoria);
  }

  async cancelarTutoriaInteligente(tutoria: any) {
    const confirmar = await this.confirmarAccion(
      '¿Estás seguro de CANCELAR esta clase?',
      'El sistema buscará automáticamente otro tutor disponible en este mismo horario.'
    );
    if (!confirmar) return;

    this.procesarCancelacion(tutoria);
  }

  async procesarCancelacion(tutoria: any) {
    this.tutoriasPorImpartir = [...this.tutoriasPorImpartir.filter(t => t.id !== tutoria.id)];

    try {
      const tutoriaRef = doc(this.firestore, 'Reservas', tutoria.id);
      const snap = await getDoc(tutoriaRef);
      const data = snap.data();
      const yaReasignada = data ? data['reasignada_automaticamente'] : false;

      if (yaReasignada) {
        await updateDoc(tutoriaRef, {
          estado: 'REQUIERE_ADMIN',
          correoTutor: 'POR_ASIGNAR', 
          notas_admin: 'Cancelada por el segundo tutor asignado. Requiere asignación manual.'
        });
        this.mostrarAviso('Esta tutoría ya había sido reasignada antes. Se ha enviado una alerta a Coordinación.', 'info');
      } else {
        const nuevoTutor = await this.buscarTutorReemplazo(tutoria.materia, tutoria.dia, tutoria.hora, this.correoUsuario);

        if (nuevoTutor) {
          await updateDoc(tutoriaRef, {
            correoTutor: String(nuevoTutor.correo || nuevoTutor.correo_google).toLowerCase().trim(), 
            nombreTutor: nuevoTutor.nombre.toUpperCase(),
            celularTutor: nuevoTutor.celular || 'No registrado',
            reasignada_automaticamente: true, 
            estado: 'PENDIENTE'
          });
          this.mostrarAviso(`Tutoría cancelada y reasignada.`, 'exito');
        } else {
          await updateDoc(tutoriaRef, {
            estado: 'REQUIERE_ADMIN',
            correoTutor: 'POR_ASIGNAR', 
            reasignada_automaticamente: true,
            notas_admin: 'No se encontró un tutor de reemplazo automático.'
          });
          this.mostrarAviso('No hay reemplazo automático disponible. Se ha enviado al Administrador.', 'advertencia');
        }
      }

    } catch (error) {
      console.error('Error procesando cancelación:', error);
      this.mostrarAviso('Ocurrió un error al procesar la cancelación.', 'error');
    }
  }

  async buscarTutorReemplazo(materia: string, dia: string, hora: string, correoCancelador: string) {
    const q = query(collection(this.firestore, 'Tutores'), where('estado', '==', 'ACTIVO'));
    const snapshot = await getDocs(q);
    
    let candidatosValidos: any[] = []; 
    const correoCanceladorLimpio = String(correoCancelador || '').toLowerCase().trim();

    snapshot.forEach(doc => {
      const tutor = doc.data() as any;
      const correoTutorLimpio = String(tutor.correo || tutor.correo_google || '').toLowerCase().trim();

      if (correoTutorLimpio !== correoCanceladorLimpio) {
        const enseñaMateria = tutor.materias && tutor.materias.includes(materia);
        const claveHorario = `${dia}-${hora}`;
        const tieneHorario = tutor.horarios && tutor.horarios[claveHorario];

        if (enseñaMateria && tieneHorario) {
          candidatosValidos.push(tutor); 
        }
      }
    });

    if (candidatosValidos.length > 0) {
      const indiceAlAzar = Math.floor(Math.random() * candidatosValidos.length);
      return candidatosValidos[indiceAlAzar];
    }
    return null; 
  }

  abrirGuia() {
    this.mostrarGuiaTutor = true;
  }

  cerrarGuia() {
    this.mostrarGuiaTutor = false;
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

  async confirmarRenovacionTutor() {
    try {
      const tutorRef = doc(this.firestore, 'Tutores', this.tutorDocId);

      if (this.decisionTutor === 'NO') {
        await deleteDoc(tutorRef); 
        this.mostrarModalRenovacionTutor = false;
        this.mostrarAviso('Tu perfil de tutor ha sido eliminado. ¡Gracias por tu servicio!', 'info');
        this.irAPanel('/tabs/horarios', 'ESTUDIANTE'); 
        return;
      }

      if (!this.permanenciaTutor || this.materiasSeleccionadas.length === 0 || Object.keys(this.horarioSeleccionado).length === 0) {
        this.mostrarAviso('Por favor, completa tu permanencia, elige materias y selecciona tus horarios en el calendario.', 'advertencia');
        return;
      }

      await updateDoc(tutorRef, {
        ciclo: this.nuevoCicloTutor,
        permanencia: this.permanenciaTutor,
        materias: this.materiasSeleccionadas,
        horarios: this.horarioSeleccionado,
        ultimo_periodo_activo: this.periodoApp
      });

      if (this.datosTutorActual) {
        const horariosFormateados = this.dbService.formatearHorariosParaExcel(this.horarioSeleccionado);
        const payloadExcel = {
          opcion: 'aceptarTutorOficial',
          nombre: this.datosTutorActual['nombre'],
          cedula: this.datosTutorActual['cedula'] || '',
          ciclo: this.nuevoCicloTutor,
          carrera: this.datosTutorActual['carrera'],
          materias: this.materiasSeleccionadas.join(', '), 
          correo: this.datosTutorActual['correo'],
          celular: this.datosTutorActual['celular'] || '',
          permanencia: this.permanenciaTutor,
          horarios: horariosFormateados,
          periodo: this.periodoApp
        };
        await this.dbService.enviarAExcel(payloadExcel);
      }

      this.mostrarModalRenovacionTutor = false;
      this.mostrarAviso(`¡Renovación exitosa para el Periodo ${this.periodoApp}!`, 'exito');

    } catch (error) {
      this.mostrarAviso('Error de conexión al procesar tu renovación.', 'error');
    }
  }

  async prepararRenovacion() {
    this.horarioSeleccionado = {}; 
    try {
      const estudianteRef = doc(this.firestore, 'Estudiantes', this.correoUsuario.toLowerCase().trim());
      const estudianteSnap = await getDoc(estudianteRef);
      if (estudianteSnap.exists() && estudianteSnap.data()['ciclo']) {
        this.nuevoCicloTutor = estudianteSnap.data()['ciclo'];
      } else {
        this.nuevoCicloTutor = parseInt((localStorage.getItem('ciclo') || '1').replace(/\D/g, ''), 10) || 1;
      }
    } catch (error) {
      this.nuevoCicloTutor = 1; 
    }
    const catalogos = await this.dbService.obtenerCatalogosDesdeExcel();
    this.materiasCatalogo = catalogos.materias;
    this.filtrarMateriasDisponibles(); 
  }

  siguientePaso() {
    if (this.pasoActual === 1) {
      if (!this.decisionTutor) {
        this.mostrarAviso('Por favor, selecciona una opción.', 'advertencia');
        return;
      }
      if (this.decisionTutor === 'NO') {
        this.confirmarRenovacionTutor();
        return;
      }
      this.pasoActual++;
    } 
    else if (this.pasoActual === 2) {
      if (!this.permanenciaTutor) {
        this.mostrarAviso('Selecciona tu tiempo como tutor.', 'advertencia');
        return;
      }
      this.filtrarMateriasDisponibles();
      this.pasoActual++;
    } 
    else if (this.pasoActual === 3) {
      if (this.materiasSeleccionadas.length === 0) {
        this.mostrarAviso('Selecciona al menos una materia.', 'advertencia');
        return;
      }
      this.pasoActual++;
    }
  }

  filtrarMateriasDisponibles() {
    if (!this.datosTutorActual || this.materiasCatalogo.length === 0) return;
    this.materiasDisponibles = this.materiasCatalogo
      .filter(m => m.carrera === this.datosTutorActual['carrera'] && m.ciclo < this.nuevoCicloTutor)
      .map(m => m.nombre);
    this.materiasSeleccionadas = []; 
  }

  abrirRenovacion() {
    this.pasoActual = 1;
    this.decisionTutor = '';
    this.mostrarModalRenovacionTutor = true;
    this.prepararRenovacion();
  }

  pasoAnterior() {
    if (this.pasoActual > 1) {
      this.pasoActual--;
    }
  }

  seleccionarDecision(decision: string) { this.decisionTutor = decision; }
  seleccionarCiclo(ciclo: number) { this.nuevoCicloTutor = ciclo; }
  seleccionarPermanencia(perm: string) { this.permanenciaTutor = perm; }
  seleccionarModalidadGlobal(mod: string) { this.modalidadGlobal = mod; }

  toggleMateriaSeleccionada(materia: string) {
    const index = this.materiasSeleccionadas.indexOf(materia);
    if (index > -1) {
      this.materiasSeleccionadas.splice(index, 1);
    } else {
      this.materiasSeleccionadas.push(materia);
    }
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
      this.router.navigate(['/login']);
    } catch (error) {
      localStorage.clear();
      this.router.navigate(['/login']);
    }
  }
  
}