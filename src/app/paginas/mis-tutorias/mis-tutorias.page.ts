import { Component, inject, OnInit, ChangeDetectorRef, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { 
  bookOutline, logoWhatsapp, addOutline, checkmarkOutline, closeOutline, 
  personCircleOutline, mailOutline, businessOutline, settingsOutline, 
  logOutOutline, peopleOutline, filterOutline, notificationsOutline, trashOutline,
  chatbubblesOutline, informationCircle, swapHorizontalOutline, schoolOutline, briefcaseOutline, shieldCheckmarkOutline, helpCircleOutline,
  qrCodeOutline, scanOutline, keypadOutline, closeCircleOutline,
  chevronDownOutline, searchOutline, timeOutline, calendarOutline, informationCircleOutline
} from 'ionicons/icons';
import { DatabaseService } from '../../services/database';
import { Router } from '@angular/router'; 
import { LocalNotifications } from '@capacitor/local-notifications';
import { Firestore, collection, query, where, getDocs, doc, deleteDoc, getDoc } from '@angular/fire/firestore';
import { Auth, signOut } from '@angular/fire/auth'; 
import jsQR from 'jsqr'; // 🌟 IMPORTACIÓN DE LA LIBRERÍA WEB DE QR

import { 
  IonContent, IonIcon, IonHeader, IonToolbar, IonButtons, IonButton,
  IonItemSliding, IonItemOptions, IonItemOption, IonItem, IonList,IonModal,IonLabel,ToastController,AlertController, ActionSheetController,
  IonPopover, IonSpinner
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-mis-tutorias',
  templateUrl: './mis-tutorias.page.html',
  styleUrls: ['./mis-tutorias.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonIcon, CommonModule, FormsModule, IonHeader, IonToolbar,
    IonButtons, IonButton, IonItemSliding, IonItemOptions, IonItemOption, IonItem, IonList,IonModal,IonLabel, IonSpinner,
    IonPopover 
  ]
})
export class MisTutoriasPage implements OnInit, OnDestroy {
  private dbService = inject(DatabaseService);
  private router = inject(Router); 
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(Auth); 

  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  menuRolAbierto: boolean = false;
  eventoRol: any = null;
  menuPerfilAbierto: boolean = false;
  eventoPerfil: any = null;

  tienePanelTutor: boolean = false;
  tienePanelAdmin: boolean = false;

  mostrarModalCodigo: boolean = false;
  codigoIngresado: string = '';
  
  mostrarModalMiQR: boolean = false;
  codigoQRGenerado: string = '';

  // 🌟 VARIABLES PARA LA CÁMARA WEB
  scanActive: boolean = false; 
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  canvasElement!: HTMLCanvasElement;
  canvasContext!: CanvasRenderingContext2D | null;
  videoStream: MediaStream | null = null;
  scanInterval: any = null;

  tutorias: any[] = [];
  cargando: boolean = true;
  correoUsuario: string = '';
  rolUsuario: string = 'ESTUDIANTE';
  nombreUsuario: string = '';

  hayNotificacionesSinLeer: boolean = false;
  mostrarOpcionesUnirse: boolean = false;

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
    addIcons({personCircleOutline,helpCircleOutline,swapHorizontalOutline,notificationsOutline,chatbubblesOutline,bookOutline,logoWhatsapp,trashOutline,addOutline,informationCircle,checkmarkOutline,closeOutline,schoolOutline,briefcaseOutline,shieldCheckmarkOutline,mailOutline,businessOutline,settingsOutline,logOutOutline,peopleOutline,filterOutline, qrCodeOutline, scanOutline, keypadOutline, closeCircleOutline, chevronDownOutline, searchOutline, timeOutline, calendarOutline, informationCircleOutline});
  }

  ngOnInit() {
    LocalNotifications.requestPermissions();
  }

  async ionViewWillEnter() {
    this.correoUsuario = localStorage.getItem('correo') || '';
    this.rolUsuario = (localStorage.getItem('rol') || 'ESTUDIANTE').toUpperCase();
    this.nombreUsuario = localStorage.getItem('nombre') || '';
    const sede = localStorage.getItem('sede') || 'CUENCA';
    
    this.tienePanelTutor = localStorage.getItem('tienePanelTutor') === 'true';
    this.tienePanelAdmin = localStorage.getItem('tienePanelAdmin') === 'true';

    await this.verificarNotificaciones(this.correoUsuario, this.rolUsuario, sede);
    await this.cargarPermisosPaneles(this.correoUsuario); 
    await this.cargarMisTutorias();
  }

  // ==========================================
  // 🌟 MÉTODOS PARA MENÚS DE CABECERA Y ROLES
  // ==========================================
  async cargarPermisosPaneles(correo: string) {
    if (!correo) return;
    try {
      const adminSnap = await getDoc(doc(this.firestore, 'Administradores', correo));
      if (adminSnap.exists()) {
        this.tienePanelAdmin = true;
        this.tienePanelTutor = true;
      }
      const tutorSnap = await getDoc(doc(this.firestore, 'Tutores', correo));
      if (tutorSnap.exists()) {
        this.tienePanelTutor = true;
      }
      const estSnap = await getDoc(doc(this.firestore, 'Estudiantes', correo));
      if (estSnap.exists()) {
        const rolDB = String(estSnap.data()['rol'] || estSnap.data()['Rol'] || '').toUpperCase().trim();
        if (rolDB === 'TUTOR') this.tienePanelTutor = true;
        if (rolDB === 'COORDINADOR' || rolDB === 'ADMIN') {
          this.tienePanelTutor = true;
          this.tienePanelAdmin = true;
        }
      }
      localStorage.setItem('tienePanelTutor', this.tienePanelTutor ? 'true' : 'false');
      localStorage.setItem('tienePanelAdmin', this.tienePanelAdmin ? 'true' : 'false');
    } catch (error) {
      console.error("Error consultando permisos:", error);
    }
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

  abrirGuia() { this.menuPerfilAbierto = false; }
  irANotificaciones() { this.router.navigate(['/notificaciones']); }

  // ==========================================
  // 🌟 CARGA DE TUTORÍAS Y LECTURA DE GRUPOS
  // ==========================================
  async verificarNotificaciones(correo: string, rol: string, sede: string) {
    try {
      const notifs = await this.dbService.obtenerNotificacionesUsuario(correo, rol, sede);
      const sinLeer = notifs.filter((n: any) => !n['leida_por']?.includes(correo));
      this.hayNotificacionesSinLeer = sinLeer.length > 0;
    } catch (error) {}
  }

 async cargarMisTutorias() {
    this.cargando = true;
    this.tutorias = []; 

    try {
      const qEstudiante = query(collection(this.firestore, 'Reservas'), where('correoEstudiante', '==', this.correoUsuario));
      const snapshot = await getDocs(qEstudiante);
      
      // Consultamos toda la tabla para contar cuántos se han unido a cada código
      const qTotalReservas = query(collection(this.firestore, 'Reservas'));
      const snapshotTotal = await getDocs(qTotalReservas);
      const conteoPorCodigo: { [codigo: string]: number } = {};

      snapshotTotal.forEach(doc => {
        const codigoClase = doc.data()['codigo'];
        if (codigoClase && codigoClase !== 'SIN CÓDIGO') {
          // Contamos a todos (incluyendo al dueño), por lo que restaremos 1 luego
          conteoPorCodigo[codigoClase] = (conteoPorCodigo[codigoClase] || 0) + 1;
        }
      });

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0); 

      for (const documento of snapshot.docs) {
        const res = documento.data();
        
        // Verificamos si la fecha exacta ya pasó para eliminarla de la bandeja
        if (res['fecha_solicitud'] && res['dia_elegido'] !== 'Por definir') {
          const fechaExactaDeLaClase = this.calcularFechaExacta(res['fecha_solicitud'], res['dia_elegido'] || res['dia'], res['hora_elegida'] || res['hora']);
          fechaExactaDeLaClase.setHours(23, 59, 59, 999);

          if (fechaExactaDeLaClase.getTime() < hoy.getTime()) {
            await deleteDoc(doc(this.firestore, 'Reservas', documento.id));
            continue; 
          }
        }

        if (res['estado'] === 'CANCELADA') continue; 

        let colorEstado = '#fde047'; 
        let nombreTutorMostrar = res['nombreTutor'];
        let celularTutorMostrar = res['celularTutor'];

        if (res['estado'] === 'CONFIRMADA' || res['estado'] === 'ACEPTADA') colorEstado = '#34d399'; 

        if (res['estado'] === 'REQUIERE_ADMIN') {
          colorEstado = '#f97316'; 
          nombreTutorMostrar = 'Asignando nuevo tutor...';
          celularTutorMostrar = null; 
        }

        const codigoEval = res['codigo'] || 'SIN CÓDIGO';
        // 🌟 CALCULAMOS LA CANTIDAD DE INVITADOS (Total inscritos al código - 1 el propio estudiante)
        const cantidadUnidos = codigoEval !== 'SIN CÓDIGO' ? (conteoPorCodigo[codigoEval] - 1) : 0;

        const tutoriaFormateada = {
          id: documento.id,
          materia: res['materia'],
          codigo: codigoEval,
          dia: res['dia_elegido'] || res['dia'] || 'Por definir',
          hora: res['hora_elegida'] || res['hora'] || 'Por definir',
          fecha_exacta: res['fecha_exacta'] || '', // 🌟 LEE LA FECHA EXACTA
          modalidad: res['modalidad'] || 'Presencial', // 🌟 LEE LA MODALIDAD
          cantidadUnidos: cantidadUnidos > 0 ? cantidadUnidos : 0, // 🌟 GUARDA LA CANTIDAD DE INVITADOS
          color: colorEstado,
          estado: res['estado'],
          celularContacto: celularTutorMostrar, 
          codigoPaisContacto: res['codigoPaisTutor'] || '+593', 
          nombreContacto: nombreTutorMostrar,
          correoDestino: res['correoTutor'] 
        };

        this.tutorias.push(tutoriaFormateada);

        if (res['estado'] === 'CONFIRMADA' || res['estado'] === 'ACEPTADA') {
          this.programarRecordatorios(tutoriaFormateada);
        }
      }
    } catch (error) {
      console.error("Error cargando la base de datos:", error);
    }
    this.cargando = false;
  }

  calcularFechaExacta(fechaSolISO: string, diaSemana: string, horaRango: string): Date {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaBuscado = diaSemana.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const diaIndex = dias.findIndex(d => d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === diaBuscado);
    if (diaIndex === -1) return new Date();

    const horaStr = horaRango.split('-')[0].trim();
    const [hora, min] = horaStr.split(':').map(Number);
    const fecha = new Date(fechaSolISO);
    fecha.setHours(hora, min, 0, 0);

    let dif = diaIndex - fecha.getDay();
    if (dif < 0 || (dif === 0 && fecha.getTime() < new Date(fechaSolISO).getTime())) {
      dif += 7; 
    }
    fecha.setDate(fecha.getDate() + dif);
    return fecha;
  }

  contactarWhatsApp(celular: string, codigoPais: string, nombre: string, materia: string) {
    if (!celular || celular === 'No registrado') {
      this.mostrarAviso("No hay número de contacto disponible.",'error');
      return;
    }
    let celFormateado = celular.replace(/\D/g, ''); 
    if (celFormateado.startsWith('0')) {
      celFormateado = celFormateado.substring(1);
    }
    let prefijo = (codigoPais || '+593').replace(/\D/g, ''); 
    const numeroFinal = prefijo + celFormateado;
    const mensaje = encodeURIComponent(`Hola ${nombre}, te escribo por la tutoría de ${materia} agendada en la app de las Tutorías entre Pares.`);
    const urlWa = `https://wa.me/${numeroFinal}?text=${mensaje}`;
    window.open(urlWa, '_blank');
  }

  async cancelarTutoria(tutoria: any) {
    const confirmar = await this.confirmarAccion(`¿Estás seguro de cancelar tu solicitud de tutoría para ${tutoria.materia}?`,'');
    if (!confirmar) return;

    try {
      const tutoriaRef = doc(this.firestore, 'Reservas', tutoria.id);
      await deleteDoc(tutoriaRef);
      await this.dbService.crearNotificacion({
        correo_destino: tutoria.correoDestino, 
        titulo: 'Tutoría Cancelada ',
        mensaje: `El estudiante ${this.nombreUsuario} ha cancelado su solicitud para ${tutoria.materia} el ${tutoria.dia}.`,
        tipo: 'CANCELACION',
        sede_destino: localStorage.getItem('sede') || 'GLOBAL'
      });
      this.mostrarAviso('Tutoría cancelada. El tutor ha sido notificado.','info');
      await this.cargarMisTutorias(); 
    } catch (error) {
      this.mostrarAviso('Error al cancelar la tutoría.','error');
    }
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

  async programarRecordatorios(tutoria: any) {
    if(tutoria.dia === 'Por definir' || tutoria.hora === 'Por definir') return;

    const fechaTutoria = this.calcularProximaFechaDesdeHoy(tutoria.dia, tutoria.hora);
    const ahora = new Date().getTime();
    const notificaciones = [];
    const idBase = this.generarIdNumerico(tutoria.id);

    const tiempo1Hora = fechaTutoria.getTime() - (60 * 60 * 1000);
    if (tiempo1Hora > ahora) {
      notificaciones.push({
        id: idBase, 
        title: '¡Tu tutoría es en 1 hora! ⏰',
        body: `Prepárate para ${tutoria.materia} con ${tutoria.nombreContacto || 'tu tutor'}.`,
        schedule: { at: new Date(tiempo1Hora) }
      });
    }

    const fechaMismoDia = new Date(fechaTutoria);
    fechaMismoDia.setHours(8, 0, 0, 0);
    const tiempoMismoDia = fechaMismoDia.getTime();

    if (tiempoMismoDia > ahora && tiempoMismoDia < tiempo1Hora) {
      notificaciones.push({
        id: idBase + 1, 
        title: 'Tienes una tutoría hoy 📅',
        body: `Recuerda que hoy tienes clase de ${tutoria.materia}. ¡Revisa la app!`,
        schedule: { at: new Date(tiempoMismoDia) }
      });
    }

    if (notificaciones.length > 0) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') permStatus = await LocalNotifications.requestPermissions();
      if (permStatus.display === 'granted') await LocalNotifications.schedule({ notifications: notificaciones });
    }
  }

  calcularProximaFechaDesdeHoy(diaSemana: string, horaRango: string): Date {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaBuscado = diaSemana.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const diaIndex = dias.findIndex(d => d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === diaBuscado);
    if (diaIndex === -1) return new Date();

    const horaStr = horaRango.split('-')[0].trim();
    const [hora, min] = horaStr.split(':').map(Number);
    const ahora = new Date();
    let fecha = new Date();
    fecha.setHours(hora, min, 0, 0);

    let dif = diaIndex - ahora.getDay();
    if (dif < 0 || (dif === 0 && fecha.getTime() < ahora.getTime())) dif += 7; 
    fecha.setDate(ahora.getDate() + dif);
    return fecha;
  }

  abrirOpcionesUnirse() { this.mostrarOpcionesUnirse = true; }
  cerrarOpcionesUnirse() { this.mostrarOpcionesUnirse = false; }

  opcionCodigoManualElegido() {
    this.cerrarOpcionesUnirse();
    this.mostrarModalCodigo = true;
  }

  mostrarMiQR(tutoria: any) {
    if (!tutoria.codigo || tutoria.codigo === 'SIN CÓDIGO') {
      this.mostrarAviso('Esta tutoría no tiene un código grupal generado.', 'advertencia');
      return;
    }
    this.codigoQRGenerado = tutoria.codigo;
    this.mostrarModalMiQR = true;
  }

  cerrarModalMiQR() {
    this.mostrarModalMiQR = false;
    this.codigoQRGenerado = '';
  }

  abrirModalCodigo() { this.mostrarModalCodigo = true; }
  cerrarModalCodigo() { this.mostrarModalCodigo = false; this.codigoIngresado = ''; }

  async unirsePorCodigo() {
    if (!this.codigoIngresado || this.codigoIngresado.trim() === '') {
      this.mostrarAviso('Por favor, ingresa un código válido.','advertencia');
      return;
    }
    this.cargando = true;
    const resultado = await this.dbService.unirseATutoriaPorCodigo(this.codigoIngresado, this.correoUsuario, this.nombreUsuario || 'Estudiante');
    this.mostrarAviso(resultado.mensaje,'info');
    if (resultado.exito) {
      this.cerrarModalCodigo();
      await this.cargarMisTutorias(); 
    } else {
      this.cargando = false; 
    }
  }

  // ==========================================
  // 🌟 LÓGICA DE LA CÁMARA PARA ESCANEAR QR (NATIVA WEB / NAVEGADOR)
  // ==========================================
  activarEscanerWeb() {
    this.cerrarOpcionesUnirse();
    this.scanActive = true;
    this.cdr.detectChanges(); // Forzamos el render para que exista el videoElement

    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        this.videoStream = stream;
        
        if (this.videoElement && this.videoElement.nativeElement) {
          this.videoElement.nativeElement.srcObject = stream;
          this.videoElement.nativeElement.setAttribute("playsinline", "true"); // Requiere Safari/iOS
          this.videoElement.nativeElement.play();
          
          this.canvasElement = document.createElement("canvas");
          this.canvasContext = this.canvasElement.getContext("2d");
          
          requestAnimationFrame(this.escanearCuadro.bind(this));
        }
      } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        this.mostrarAviso('No pudimos acceder a tu cámara. Asegúrate de dar los permisos en el navegador.', 'error');
        this.detenerEscanerWeb();
      }
    }, 200);
  }

  escanearCuadro() {
    if (!this.scanActive || !this.videoElement || !this.canvasContext) return;
    
    if (this.videoElement.nativeElement.readyState === this.videoElement.nativeElement.HAVE_ENOUGH_DATA) {
      this.canvasElement.height = this.videoElement.nativeElement.videoHeight;
      this.canvasElement.width = this.videoElement.nativeElement.videoWidth;
      
      this.canvasContext.drawImage(this.videoElement.nativeElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
      
      const imageData = this.canvasContext.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
      const codigoEncontrado = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

      if (codigoEncontrado) {
        // Detenemos la cámara
        this.detenerEscanerWeb();
        this.codigoIngresado = codigoEncontrado.data; // Aquí guardamos el código leído
        this.unirsePorCodigo(); // Y ejecutamos el proceso de unirse directamente
        return;
      }
    }
    
    // Si no encontró nada, sigue buscando en el siguiente frame
    requestAnimationFrame(this.escanearCuadro.bind(this));
  }

  detenerEscanerWeb() {
    this.scanActive = false;
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
  }

  ngOnDestroy() {
    this.detenerEscanerWeb();
  }

  // ==========================================
  // 🌟 ALERTAS NATIVAS
  // ==========================================
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

  async confirmarAccion(cabecera: string, mensaje: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: cabecera, message: mensaje, cssClass: 'alerta-premium-gietaes', mode: 'md', 
        buttons: [
          { text: 'Cancelar', role: 'cancel', cssClass: 'btn-alerta-cancelar', handler: () => resolve(false) },
          { text: 'Sí, Continuar', cssClass: 'btn-alerta-confirmar', handler: () => resolve(true) }
        ]
      });
      await alert.present();
    });
  }
}