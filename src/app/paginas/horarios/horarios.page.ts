import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, 
  IonIcon,IonItem,IonLabel,IonSelect,IonSelectOption 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { searchOutline, closeOutline, logoWhatsapp, star, mailOutline, peopleOutline, checkmarkOutline, arrowBackOutline, checkmarkCircleOutline, closeCircleOutline, megaphoneOutline, businessOutline } from 'ionicons/icons';
import { DatabaseService } from '../../services/database';

@Component({
  selector: 'app-horarios',
  templateUrl: './horarios.page.html',
  styleUrls: ['./horarios.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonIcon, IonItem, IonLabel, IonSelect, IonSelectOption]
})
export class HorariosPage implements OnInit {
  private dbService = inject(DatabaseService);
  esCoordinadorPanel: boolean = false;
  filtroSedeAgenda: string = 'GLOBAL';
  textoBusqueda: string = '';
  cargando: boolean = false;
  mostrarModal: boolean = false;
  mostrarCoordinacion: boolean = false; 
  
  asignaturasMaster: any[] = [];
  asignaturasFiltradas: any[] = [];

  reservaActual: any = null;
  correoUsuario: string = '';
  nombreUsuario: string = '';

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
    addIcons({businessOutline,peopleOutline,mailOutline,star,logoWhatsapp,checkmarkOutline,closeOutline,arrowBackOutline,checkmarkCircleOutline,closeCircleOutline,megaphoneOutline,searchOutline});
  }

  ngOnInit() {
    this.correoUsuario = localStorage.getItem('correo') || '';
    this.nombreUsuario = localStorage.getItem('nombre') || '';
  }

async ionViewWillEnter() {
    this.cargando = true;
    this.textoBusqueda = ''; 
    
    const rolActual = (localStorage.getItem('rol') || '').toUpperCase();
    
    // Si es ADMIN o COORDINADOR habilitamos el interruptor en la UI
    this.esCoordinadorPanel = (rolActual === 'ADMIN' || rolActual === 'COORDINADOR');
    
    const carreraActual = localStorage.getItem('carrera') || '';
    let tutoresBrutos: any[] = [];

    if (this.filtroSedeAgenda === 'GLOBAL') {
      // 🌟 COMBINACIÓN GLOBAL: Hace un barrido secuencial por las tres sedes reales
      const sedes = ['CUENCA', 'QUITO', 'GUAYAQUIL'];
      for (const s of sedes) {
        const porSede = await this.dbService.obtenerTutoresFiltrados(s, carreraActual);
        tutoresBrutos = [...tutoresBrutos, ...porSede];
      }
    } else {
      // Filtrado por la sede seleccionada en el menú dropdown
      tutoresBrutos = await this.dbService.obtenerTutoresFiltrados(this.filtroSedeAgenda, carreraActual);
    }

    this.agruparPorMateria(tutoresBrutos);
    this.cargando = false;
  }

  agruparPorMateria(tutores: any[]) {
    const diccionario: { [materia: string]: any[] } = {};

    tutores.forEach(tutor => {
      let materiasArray = [];
      if (Array.isArray(tutor.materias)) {
        materiasArray = tutor.materias;
      } else if (typeof tutor.materias === 'string') {
        materiasArray = tutor.materias.split(',').map((m: string) => m.trim());
      }

      // 🌟 EL TRADUCTOR: Convierte los formatos nuevos y viejos a texto visible
      let hVisible: any = { lunes: '', martes: '', miercoles: '', jueves: '', viernes: '', sabado: '' };

      if (tutor.horarios) {
        for (let clave in tutor.horarios) {
          let dashIndex = clave.indexOf('-');
          
          if (dashIndex > -1) {
            // FORMATO NUEVO: "Lunes-07:00 - 09:00" -> "PRESENCIAL"
            let diaCrudo = clave.substring(0, dashIndex); 
            let horaCruda = clave.substring(dashIndex + 1); 
            
            let diaClave = diaCrudo.toLowerCase().replace('é', 'e').replace('á', 'a').trim();
            let modalidad = tutor.horarios[clave];
            
            let etiqueta = '(P)';
            if (modalidad === 'VIRTUAL') etiqueta = '(V)';
            if (modalidad === 'AMBAS') etiqueta = '(P)(V)';

            if (hVisible[diaClave] !== undefined) {
              hVisible[diaClave] += `${horaCruda.trim()} ${etiqueta}\n`; // Agrega salto de línea
            }
          } else {
            // FORMATO VIEJO: "lunes" -> "07:00 - 09:00" (Para no borrar tutores antiguos)
            let diaClave = clave.toLowerCase().replace('é', 'e').replace('á', 'a').trim();
            if (hVisible[diaClave] !== undefined && typeof tutor.horarios[clave] === 'string') {
              hVisible[diaClave] += `${tutor.horarios[clave]}\n`;
            }
          }
        }
      }

      // Limpiamos los espacios extras al final
      for (let d in hVisible) {
        hVisible[d] = hVisible[d].trim();
      }

      tutor.horarioVisible = hVisible;

      materiasArray.forEach((materia: string) => {
        if (!materia) return;
        const nombreMateria = materia.toUpperCase();
        if (!diccionario[nombreMateria]) {
          diccionario[nombreMateria] = [];
        }
        diccionario[nombreMateria].push({ ...tutor });
      });
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
    this.reservaActual = {
      tutorNombre: tutor.nombre,
      correoTutor: tutor.correo,
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
        // Al enviar a la base de datos de agendamiento, se manda la hora tal cual la vio
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
  async recargarAgendaSede() {
    await this.ionViewWillEnter();
  }
}