import { Component, inject, OnInit,ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { 
  bookOutline, logoWhatsapp, addOutline, checkmarkOutline, closeOutline, 
  personCircleOutline, mailOutline, businessOutline, settingsOutline, 
  logOutOutline, peopleOutline, filterOutline, notificationsOutline, trashOutline,
  chatbubblesOutline, informationCircle, swapHorizontalOutline, schoolOutline, briefcaseOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { DatabaseService } from '../../services/database';
import { Router } from '@angular/router'; 
import { LocalNotifications } from '@capacitor/local-notifications';
import { Firestore, collection, query, where, getDocs, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { 
  IonContent, IonIcon, IonHeader, IonToolbar, IonButtons, IonButton,
  IonItemSliding, IonItemOptions, IonItemOption, IonItem, IonList,IonModal,IonLabel,ToastController,AlertController
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-mis-tutorias',
  templateUrl: './mis-tutorias.page.html',
  styleUrls: ['./mis-tutorias.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonIcon, CommonModule, FormsModule, IonHeader, IonToolbar,
    IonButtons, IonButton, IonItemSliding, IonItemOptions, IonItemOption, IonItem, IonList,IonModal,IonLabel
  ]
})
export class MisTutoriasPage implements OnInit {
  private dbService = inject(DatabaseService);
  private router = inject(Router); 
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);

  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  // 🌟 VARIABLES PARA EL MENÚ DE ROLES
  mostrarMenuRol: boolean = false;
  tienePanelTutor: boolean = false;
  tienePanelAdmin: boolean = false;

  mostrarModalCodigo: boolean = false;
  codigoIngresado: string = '';
  
  tutorias: any[] = [];
  cargando: boolean = true;
  correoUsuario: string = '';
  rolUsuario: string = '';
  nombreUsuario: string = '';

  hayNotificacionesSinLeer: boolean = false;

  constructor() {
    // 🌟 Añadimos los iconos para nuestras guías visuales
    addIcons({notificationsOutline,swapHorizontalOutline,chatbubblesOutline,bookOutline,logoWhatsapp,trashOutline,addOutline,informationCircle,checkmarkOutline,closeOutline,schoolOutline,briefcaseOutline,shieldCheckmarkOutline,personCircleOutline,mailOutline,businessOutline,settingsOutline,logOutOutline,peopleOutline,filterOutline});
  }

  ngOnInit() {
    LocalNotifications.requestPermissions();
  }

  irANotificaciones() {
    this.router.navigate(['/notificaciones']);
  }

  async ionViewWillEnter() {
    this.correoUsuario = localStorage.getItem('correo') || '';
    this.rolUsuario = localStorage.getItem('rol') || 'ESTUDIANTE';
    this.nombreUsuario = localStorage.getItem('nombre') || '';
    const sede = localStorage.getItem('sede') || 'CUENCA';
    
    await this.verificarNotificaciones(this.correoUsuario, this.rolUsuario, sede);
    await this.cargarMisTutorias();
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

  async cargarMisTutorias() {
    this.cargando = true;
    this.tutorias = []; 

    try {
      const qEstudiante = query(
        collection(this.firestore, 'Reservas'), 
        where('correoEstudiante', '==', this.correoUsuario)
      );
      
      const snapshot = await getDocs(qEstudiante);
      
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0); // Medianoche exacta

      for (const documento of snapshot.docs) {
        const res = documento.data();
        
        // 🌟 CONSERJE AUTOMÁTICO: Filtro de expiración
        if (res['fecha_solicitud'] && res['dia_elegido'] !== 'Por definir') {
          const fechaExactaDeLaClase = this.calcularFechaExacta(res['fecha_solicitud'], res['dia_elegido'] || res['dia'], res['hora_elegida'] || res['hora']);
          
          // Le damos vigencia hasta el último segundo de ese día (23:59:59)
          fechaExactaDeLaClase.setHours(23, 59, 59, 999);

          // Si el día de la tutoría ya pasó, la destruimos de Firebase
          if (fechaExactaDeLaClase.getTime() < hoy.getTime()) {
            await deleteDoc(doc(this.firestore, 'Reservas', documento.id));
            console.log(`Tutoría expirada eliminada automáticamente: ${res['materia']}`);
            continue; // Saltamos a la siguiente sin mostrarla en pantalla
          }
        }

        let colorEstado = '#fde047'; 
        if (res['estado'] === 'CONFIRMADA' || res['estado'] === 'ACEPTADA') colorEstado = '#34d399'; 
        if (res['estado'] === 'CANCELADA') colorEstado = '#ef4444'; 

        const tutoriaFormateada = {
          id: documento.id,
          materia: res['materia'],
          codigo: res['codigo'] || 'SIN CÓDIGO',
          dia: res['dia_elegido'] || res['dia'] || 'Por definir',
          hora: res['hora_elegida'] || res['hora'] || 'Por definir',
          color: colorEstado,
          estado: res['estado'],
          celularContacto: res['celularTutor'], 
          nombreContacto: res['nombreTutor'],
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

  // 🌟 FUNCIÓN NUEVA: Calcula la fecha de calendario basándose en el día que se solicitó
  calcularFechaExacta(fechaSolISO: string, diaSemana: string, horaRango: string): Date {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaBuscado = diaSemana.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const diaIndex = dias.findIndex(d => d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === diaBuscado);
    if (diaIndex === -1) return new Date();

    const horaStr = horaRango.split('-')[0].trim();
    const [hora, min] = horaStr.split(':').map(Number);

    // Partimos desde el día exacto en que se hizo la reserva
    const fecha = new Date(fechaSolISO);
    fecha.setHours(hora, min, 0, 0);

    let dif = diaIndex - fecha.getDay();
    // Encontramos la fecha del próximo (o actual) día de la semana que coincide
    if (dif < 0 || (dif === 0 && fecha.getTime() < new Date(fechaSolISO).getTime())) {
      dif += 7; 
    }
    fecha.setDate(fecha.getDate() + dif);
    return fecha;
  }

  contactarWhatsApp(celular: string, nombre: string, materia: string) {
    if (!celular || celular === 'No registrado') {
      this.mostrarAviso("No hay número de contacto disponible.",'error');
      return;
    }
    
    let celFormateado = celular.replace(/\D/g, ''); 
    if (celFormateado.startsWith('0')) {
      celFormateado = '593' + celFormateado.substring(1);
    }
    
    const mensaje = encodeURIComponent(`Hola ${nombre}, te escribo por la tutoría de ${materia} agendada en la app de las Tutorías entre Pares.`);
    const urlWa = `https://wa.me/${celFormateado}?text=${mensaje}`;
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

// 🌟 CONVIERTE EL ID DE FIREBASE EN NÚMERO PARA LAS ALARMAS
  generarIdNumerico(idString: string): number {
    let hash = 0;
    if (!idString) return Math.floor(Math.random() * 100000);
    for (let i = 0; i < idString.length; i++) {
      hash = (hash << 5) - hash + idString.charCodeAt(i);
      hash |= 0; 
    }
    return Math.abs(hash);
  }

  // 🌟 LAS 2 ALARMAS EXACTAS PARA EL ESTUDIANTE
  async programarRecordatorios(tutoria: any) {
    if(tutoria.dia === 'Por definir' || tutoria.hora === 'Por definir') return;

    const fechaTutoria = this.calcularProximaFechaDesdeHoy(tutoria.dia, tutoria.hora);
    const ahora = new Date().getTime();
    const notificaciones = [];
    const idBase = this.generarIdNumerico(tutoria.id);

    // 1. Alarma: Exactamente 1 hora antes de la clase
    const tiempo1Hora = fechaTutoria.getTime() - (60 * 60 * 1000);
    if (tiempo1Hora > ahora) {
      notificaciones.push({
        id: idBase, 
        title: '¡Tu tutoría es en 1 hora! ⏰',
        body: `Prepárate para ${tutoria.materia} con ${tutoria.nombreContacto || 'tu tutor'}.`,
        schedule: { at: new Date(tiempo1Hora) }
      });
    }

    // 2. Alarma: A las 08:00 AM del mismo día de la clase
    const fechaMismoDia = new Date(fechaTutoria);
    fechaMismoDia.setHours(8, 0, 0, 0);
    const tiempoMismoDia = fechaMismoDia.getTime();

    // Solo la programa si aún no son las 8 AM de ese día y si no choca con la de 1 hora
    if (tiempoMismoDia > ahora && tiempoMismoDia < tiempo1Hora) {
      notificaciones.push({
        id: idBase + 1, 
        title: 'Tienes una tutoría hoy 📅',
        body: `Recuerda que hoy tienes clase de ${tutoria.materia}. ¡Revisa la app!`,
        schedule: { at: new Date(tiempoMismoDia) }
      });
    }

    // Programar en el dispositivo
    if (notificaciones.length > 0) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        permStatus = await LocalNotifications.requestPermissions();
      }
      if (permStatus.display === 'granted') {
        await LocalNotifications.schedule({ notifications: notificaciones });
      }
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
    if (dif < 0 || (dif === 0 && fecha.getTime() < ahora.getTime())) {
      dif += 7; 
    }
    fecha.setDate(ahora.getDate() + dif);
    return fecha;
  }

  abrirModalCodigo() { this.mostrarModalCodigo = true; }
  cerrarModalCodigo() { this.mostrarModalCodigo = false; this.codigoIngresado = ''; }

  async unirsePorCodigo() {
    if (!this.codigoIngresado || this.codigoIngresado.trim() === '') {
      this.mostrarAviso('Por favor, ingresa un código válido.','advertencia');
      return;
    }

    this.cargando = true;
    const resultado = await this.dbService.unirseATutoriaPorCodigo(
      this.codigoIngresado, 
      this.correoUsuario, 
      this.nombreUsuario || 'Estudiante'
    );

    this.mostrarAviso(resultado.mensaje,'info');

    if (resultado.exito) {
      this.cerrarModalCodigo();
      await this.cargarMisTutorias(); 
    } else {
      this.cargando = false; 
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