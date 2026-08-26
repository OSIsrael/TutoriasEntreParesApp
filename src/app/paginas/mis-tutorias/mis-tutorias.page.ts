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
  IonItemSliding, IonItemOptions, IonItemOption, IonItem, IonList,IonModal,IonLabel
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
      alert("No hay número de contacto disponible.");
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
    const confirmar = confirm(`¿Estás seguro de cancelar tu solicitud de tutoría para ${tutoria.materia}?`);
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

      alert('Tutoría cancelada. El tutor ha sido notificado.');
      await this.cargarMisTutorias(); 
    } catch (error) {
      alert('Error al cancelar la tutoría.');
    }
  }

  async programarRecordatorios(tutoria: any) {
    if(tutoria.dia === 'Por definir' || tutoria.hora === 'Por definir') return;

    // A diferencia de la limpieza, aquí si calculamos desde "Hoy" para las alarmas futuras
    const fechaTutoria = this.calcularProximaFechaDesdeHoy(tutoria.dia, tutoria.hora);
    const ahora = new Date().getTime();
    const notificaciones = [];

    const tiempo1Hora = fechaTutoria.getTime() - (60 * 60 * 1000);
    if (tiempo1Hora > ahora) {
      notificaciones.push({
        id: Math.floor(Math.random() * 10000),
        title: '¡Tu tutoría es en 1 hora! ',
        body: `Prepárate para ${tutoria.materia} con ${tutoria.nombreContacto}.`,
        schedule: { at: new Date(tiempo1Hora) }
      });
    }

    const tiempo30Min = fechaTutoria.getTime() - (30 * 60 * 1000);
    if (tiempo30Min > ahora) {
      notificaciones.push({
        id: Math.floor(Math.random() * 10000),
        title: '¡Tutoría a punto de empezar! 🚀',
        body: `Faltan 30 minutos para tu tutoría de ${tutoria.materia}.`,
        schedule: { at: new Date(tiempo30Min) }
      });
    }

    let tiempoPeriodico = ahora + (5 * 60 * 60 * 1000);
    let contador = 1;
    while (tiempoPeriodico < tiempo1Hora) {
      notificaciones.push({
        id: Math.floor(Math.random() * 10000) + contador,
        title: 'Recordatorio Tutorías entre Pares App',
        body: `Tienes una tutoría confirmada de ${tutoria.materia} el ${tutoria.dia}.`,
        schedule: { at: new Date(tiempoPeriodico) }
      });
      tiempoPeriodico += (5 * 60 * 60 * 1000);
      contador++;
    }

    if (notificaciones.length > 0) {
      await LocalNotifications.schedule({ notifications: notificaciones });
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
      alert('Por favor, ingresa un código válido.');
      return;
    }

    this.cargando = true;
    const resultado = await this.dbService.unirseATutoriaPorCodigo(
      this.codigoIngresado, 
      this.correoUsuario, 
      this.nombreUsuario || 'Estudiante'
    );

    alert(resultado.mensaje);

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
}