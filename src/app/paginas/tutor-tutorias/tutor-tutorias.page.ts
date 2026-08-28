import { Component, OnInit, inject, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, 
  IonList, IonItemSliding, IonItem, IonItemOptions, IonItemOption,
  IonPopover, IonLabel, IonModal,ToastController,AlertController 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  notificationsOutline, bookOutline, logoWhatsapp, 
  personOutline, timeOutline, calendarOutline, trashOutline,
  checkmarkCircleOutline, closeCircleOutline, closeOutline, helpCircleOutline, informationCircleOutline, documentTextOutline, swapHorizontalOutline, schoolOutline, briefcaseOutline, shieldCheckmarkOutline, chevronDownOutline, chevronBackOutline } from 'ionicons/icons';
import { Firestore, collection, query, where, getDocs, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { DatabaseService } from '../../services/database';
import { LocalNotifications } from '@capacitor/local-notifications';

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

  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  mostrarMenuRol: boolean = false;
  tienePanelTutor: boolean = false;
  tienePanelAdmin: boolean = false;

  tutoriasPorImpartir: any[] = [];
  cargando: boolean = true;
  correoUsuario: string = '';
  rolUsuario: string = '';
  hayNotificacionesSinLeer: boolean = false;
  mostrarGuiaTutor: boolean = false;

  @ViewChild('popoverEstado') popoverEstado!: IonPopover;
  menuEstadoAbierto: boolean = false;
  tutoriaSeleccionada: any = null;

  constructor() {
    addIcons({swapHorizontalOutline,helpCircleOutline,notificationsOutline,calendarOutline,bookOutline,personOutline,timeOutline,chevronDownOutline,chevronBackOutline,logoWhatsapp,trashOutline,informationCircleOutline,checkmarkCircleOutline,documentTextOutline,closeOutline,schoolOutline,briefcaseOutline,shieldCheckmarkOutline,closeCircleOutline});
  }

  ngOnInit() { }

  async ionViewWillEnter() {
    this.correoUsuario = localStorage.getItem('correo') || '';
    this.rolUsuario = localStorage.getItem('rol') || 'TUTOR';
    const sede = localStorage.getItem('sede') || 'CUENCA';
    
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
      const qTutor = query(
        collection(this.firestore, 'Reservas'),
        where('correoTutor', '==', this.correoUsuario)
      );
      
      const snapshot = await getDocs(qTutor);

      snapshot.forEach(documento => {
        const res = documento.data();
        
        let colorEstado = '#fde047'; 
        if (res['estado'] === 'CONFIRMADA' || res['estado'] === 'ACEPTADA') colorEstado = '#34d399'; 
        if (res['estado'] === 'CANCELADA') colorEstado = '#ef4444'; 

        this.tutoriasPorImpartir.push({
          id: documento.id,
          materia: res['materia'],
          codigo: res['codigo'] || 'SIN CÓDIGO',
          dia: res['dia_elegido'] || 'Por definir',
          hora: res['hora_elegida'] || 'Por definir',
          color: colorEstado,
          estado: res['estado'],
          celularEstudiante: res['celularEstudiante'], 
          nombreEstudiante: res['nombreEstudiante'],
          correoEstudiante: res['correoEstudiante']
        });
      });
    } catch (error) {
      console.error("Error cargando la agenda del tutor:", error);
    }

    this.cargando = false;
  }

  contactarEstudiante(celular: string, nombre: string, materia: string) {
    if (!celular || celular === 'No registrado' || celular.trim() === '') {
      this.mostrarAviso("El estudiante no registró su número celular.",'error');
      return;
    }
    
    let celFormateado = celular.replace(/\D/g, ''); 
    if (celFormateado.startsWith('0')) {
      celFormateado = '593' + celFormateado.substring(1);
    }
    
    const mensaje = encodeURIComponent(`Hola ${nombre}, soy tu tutor para la materia de ${materia}. Te escribo para coordinar nuestra sesión.`);
    const urlWa = `https://wa.me/${celFormateado}?text=${mensaje}`;
    window.open(urlWa, '_blank');
  }

  abrirMenuEstado(evento: any, tutoria: any) {
    evento.stopPropagation(); 
    this.tutoriaSeleccionada = tutoria;
    this.popoverEstado.event = evento; 
    this.menuEstadoAbierto = true;
  }

  seleccionarNuevoEstado(nuevoEstado: string, nuevoColor: string) {
    if (this.tutoriaSeleccionada) {
      this.actualizarEstadoFirebase(this.tutoriaSeleccionada, nuevoEstado, nuevoColor);
    }
    this.menuEstadoAbierto = false; 
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

      // 🌟 PROGRAMAR RECORDATORIOS AL TUTOR SI SE CONFIRMA LA CLASE
      if (nuevoEstado === 'CONFIRMADA' || nuevoEstado === 'ACEPTADA') {
        await this.programarRecordatoriosTutor(tutoria);
      }

    } catch (error) {
      this.mostrarAviso("Error al guardar el estado. Revisa tu conexión a internet.",'error');
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

  // ==========================================
  // 🌟 LÓGICA DE ALARMAS LOCALES PARA EL TUTOR
  // ==========================================
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

    // 1. Alarma: 1 Hora Antes
    const tiempo1Hora = fechaTutoria.getTime() - (60 * 60 * 1000);
    if (tiempo1Hora > ahora) {
      notificaciones.push({
        id: idBase + 50, // Sumamos 50 para que no choque con los IDs del estudiante si usan el mismo cel
        title: '¡Clase a punto de empezar! ⏰',
        body: `En 1 hora impartirás ${tutoria.materia} a ${tutoria.nombreEstudiante}.`,
        schedule: { at: new Date(tiempo1Hora) }
      });
    }

    // 2. Alarma: 08:00 AM del mismo día
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

  // ==========================================
  // ==========================================

  async eliminarTutoria(tutoria: any) {
    const confirmar = await this.confirmarAccion(`¿Estás seguro de eliminar permanentemente el registro de ${tutoria.nombreEstudiante}?`,'');
    if (!confirmar) return;

    try {
      const tutoriaRef = doc(this.firestore, 'Reservas', tutoria.id);
      await deleteDoc(tutoriaRef);
      this.mostrarAviso('Tutoría eliminada de tu panel.','exito');
      await this.cargarTutoriasPorImpartir();
    } catch (error) {
      this.mostrarAviso('Error al eliminar la tutoría.','error');
    }
  }

  abrirGuia() {
    this.mostrarGuiaTutor = true;
  }

  cerrarGuia() {
    this.mostrarGuiaTutor = false;
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