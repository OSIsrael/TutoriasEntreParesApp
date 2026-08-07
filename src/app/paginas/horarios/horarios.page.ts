import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, 
  IonIcon, IonItem, IonLabel, IonSelect, IonSelectOption,IonButtons,IonButton 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { searchOutline, closeOutline, logoWhatsapp, star, mailOutline, peopleOutline, checkmarkOutline, businessOutline, notificationsOutline } from 'ionicons/icons';
import { DatabaseService } from '../../services/database';
import { Router } from '@angular/router'; // 🌟 Router para la navegación

@Component({
  selector: 'app-horarios',
  templateUrl: './horarios.page.html',
  styleUrls: ['./horarios.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, 
    IonIcon, IonItem, IonLabel, IonSelect, IonSelectOption,IonButtons, IonButton
  ]
})
export class HorariosPage implements OnInit {
  private dbService = inject(DatabaseService);
  private firestore = inject(Firestore);
  private router = inject(Router); // 🌟 Inyectamos Router

  // 2. La variable que enciende o apaga el punto dorado
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

  equipoCoordinacion = [
    { nombre: 'GIETAES', correo: 'gietaes@ups.edu.ec', rol: 'Contacto GIETAES' },
    { nombre: 'Israel Sebastián Orellana Solano', correo: 'iorellanas@ups.edu.ec', rol: 'Miembro GIETAES' },
    { nombre: 'Samantha Daniela Quezada Segarra', correo: 'squezada@ups.edu.ec', rol: 'Miembro GIETAES' },
    { nombre: 'Sarah Angeline Guzman Lopera', correo: 'sguzmanl@ups.edu.ec', rol: 'Miembro GIETAES' },
    { nombre: 'Juan Pablo Vargas González', correo: 'jvargasg@ups.edu.ec', rol: 'Miembro GIETAES' },
    { nombre: 'Veronica Estefanía Tobar Ortega', correo: 'vtobar@ups.edu.ec', rol: 'Miembro GIETAES' },
    { nombre: 'Silvana Nayeli Guillén Nieto', correo: 'sguillen@ups.edu.ec', rol: 'Miembro GIETAES' },
    { nombre: 'Jean Pierre Artega Figueroa', correo: 'jarteaga@ups.edu.ec', rol: 'Miembro GIETAES' },
    { nombre: 'Alejandra Rithsavé Alvarado Pacheco', correo: 'aalvaradop@ups.edu.ec', rol: 'Miembro GIETAES' }
  ];

  constructor() {
    addIcons({notificationsOutline,businessOutline,peopleOutline,mailOutline,star,logoWhatsapp,checkmarkOutline,closeOutline,searchOutline});
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
    const rol = localStorage.getItem('rol') || 'ESTUDIANTE';
    const sede = localStorage.getItem('sede') || 'CUENCA';

    // 🌟 Disparamos la revisión de la campanita
    await this.verificarNotificaciones(correo, rol, sede);
    this.cargando = true;
    this.textoBusqueda = ''; 
    
    const rolActual = (localStorage.getItem('rol') || '').toUpperCase();
    this.esCoordinadorPanel = (rolActual === 'ADMIN' || rolActual === 'COORDINADOR');

    const sedeEstudiante = (localStorage.getItem('sede') || 'CUENCA').toUpperCase();
    const carreraEstudiante = (localStorage.getItem('carrera') || '').toUpperCase();

    // 🌟 1. Obtenemos todos los tutores activos de Firebase
    const snapshot = await getDocs(collection(this.firestore, 'Tutores'));
    let todosLosTutores = snapshot.docs.map(doc => doc.data());
    todosLosTutores = todosLosTutores.filter(t => t['estado'] === 'ACTIVO');

    let tutoresBrutos: any[] = [];

    if (this.esCoordinadorPanel) {
      // 🌟 VISTA ADMIN: Si es Global ve todo, si elige sede filtra tutores de esa sede
      if (this.filtroSedeAgenda === 'GLOBAL') {
        tutoresBrutos = todosLosTutores;
      } else {
        tutoresBrutos = todosLosTutores.filter(t => (t['sede'] || '').toUpperCase() === this.filtroSedeAgenda);
      }
      this.agruparPorMateria(tutoresBrutos, this.filtroSedeAgenda, true);

    } else {
      // 🌟 VISTA ESTUDIANTE:
      // Filtramos por la carrera del estudiante
      if (carreraEstudiante) {
        tutoresBrutos = todosLosTutores.filter(t => {
          const carreraTutor = (t['carrera'] || '').toUpperCase();
          return carreraTutor === carreraEstudiante || carreraTutor === '';
        });
      } else {
        tutoresBrutos = todosLosTutores;
      }

      // Procesamos agrupamiento pasando la sede del estudiante y bandera de estudiante (false)
      this.agruparPorMateria(tutoresBrutos, sedeEstudiante, false);
    }

    this.cargando = false;
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
      let materiasArray = [];
      if (Array.isArray(tutor.materias)) {
        materiasArray = tutor.materias;
      } else if (typeof tutor.materias === 'string') {
        materiasArray = tutor.materias.split(',').map((m: string) => m.trim());
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
            
            // 🌟 REGLA CLAVE DE VIRTUAL VS PRESENCIAL:
            // - Si es Admin o si el tutor es de la MISMA sede -> Acepta Presencial, Virtual y Ambas
            // - Si el tutor es de OTRA sede -> SOLO acepta horarios Virtuales o Ambas (descarta Presencial)
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
            // Compatibilidad con formato antiguo
            let diaClave = clave.toLowerCase().replace('é', 'e').replace('á', 'a').trim();
            if (esAdmin || esMismaSede) {
              if (hVisible[diaClave] !== undefined && typeof tutor.horarios[clave] === 'string') {
                hVisible[diaClave] += `${tutor.horarios[clave]}\n`;
              }
            }
          }
        }
      }

      // Verificamos si al tutor le quedó al menos un horario visible permitido
      let tieneHorariosValidos = false;
      for (let d in hVisible) {
        hVisible[d] = hVisible[d].trim();
        if (hVisible[d] !== '') {
          tieneHorariosValidos = true;
        }
      }

      // 🌟 Solo mostramos al tutor si tiene al menos un horario válido para este alumno
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

    this.asignaturasMaster = Object.keys(diccionario).sort().map(nombre => ({
      asignatura: nombre,
      tutores: diccionario[nombre]
    }));

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

    // 🌟 ESCUDO REFORZADO: Leemos la memoria del celular en este preciso instante
    const miCorreo = String(localStorage.getItem('correo') || '').toLowerCase().trim();
    const miNombre = String(localStorage.getItem('nombre') || '').toLowerCase().trim();
    
    // Extraemos los datos del tutor previniendo que vengan nulos o vacíos
    const correoDelTutor = String(tutor.correo || tutor.correo_google || '').toLowerCase().trim();
    const nombreDelTutor = String(tutor.nombre || '').toLowerCase().trim();

    // 🛡️ BLOQUEO 1: Comprobación por correo electrónico
    if (correoDelTutor !== '' && correoDelTutor === miCorreo) {
      alert('⚠️ No puedes agendar una tutoría contigo mismo.');
      return; 
    }

    // 🛡️ BLOQUEO 2 (Respaldo): Comprobación por coincidencia de nombre
    if (nombreDelTutor !== '' && nombreDelTutor === miNombre) {
      alert('⚠️ Acción bloqueada: No puedes ser el estudiante y el tutor a la vez.');
      return;
    }

    // Si pasa la seguridad, abrimos el modal normalmente
    this.reservaActual = { 
      tutorNombre: tutor.nombre, 
      correoTutor: tutor.correo || tutor.correo_google, // Pasamos el correo que sí exista
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
      this.cerrarConfirmacion();
      alert('¡Tutoría agendada con éxito! Revisa la pestaña de Mis Tutorías.');
    } catch (error) {
      console.error("Error al agendar:", error);
      alert('Hubo un problema al enviar tu solicitud.');
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
}