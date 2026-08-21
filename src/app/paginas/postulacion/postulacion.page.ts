import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonButton, IonIcon, IonSpinner, IonSelect, IonSelectOption, IonItem, IonLabel, NavController, IonButtons } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, bookOutline, warningOutline, checkmarkCircleOutline, timeOutline, closeCircleOutline, calendarOutline, helpCircleOutline, informationCircleOutline } from 'ionicons/icons';
import { DatabaseService, MateriaCatalogo } from '../../services/database'; 
import { collection, query, where, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-postulacion',
  templateUrl: './postulacion.page.html',
  styleUrls: ['./postulacion.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonButton, IonIcon, IonSpinner, IonSelect, IonSelectOption, IonItem, IonLabel, IonButtons]
})
export class PostulacionPage {
  public dbService = inject(DatabaseService);
  private router = inject(Router);
  private navCtrl = inject(NavController);

  estadoVista: 'CARGANDO' | 'BLOQUEADO' | 'REVISION' | 'RESULTADOS' | 'FORMULARIO' = 'CARGANDO';
  
  cicloUsuario: number = 1;
  carreraUsuario: string = '';
  sedeUsuario: string = '';

  materiasAceptadas: string[] = [];
  materiasRechazadas: string[] = [];

  materiasDisponibles: MateriaCatalogo[] = [];
  materiasSeleccionadas: string[] = [];
  tiempoTutor: string = 'Soy nuevo'; 

  diassemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  franjasHorarias = ['07:00 - 09:00', '09:00 - 11:00', '11:00 - 13:00', '14:00 - 16:00', '16:00 - 18:00', '18:00 - 20:00', '20:00 - 22:00'];
  horarioSeleccionado: { [key: string]: string } = {}; 
  modalidadGlobal: string = 'PRESENCIAL';

  // 🌟 VARIABLE PARA LA GUÍA INTERACTIVA
  mostrarGuiaPostulacion: boolean = false;

  constructor() {
    // 🌟 Añadidos los iconos de ayuda
    addIcons({arrowBackOutline,warningOutline,timeOutline,checkmarkCircleOutline,closeCircleOutline,bookOutline,calendarOutline, helpCircleOutline, informationCircleOutline});
  }

  async ionViewWillEnter() {
    this.estadoVista = 'CARGANDO';
    this.horarioSeleccionado = {};
    this.materiasSeleccionadas = [];
    this.tiempoTutor = 'Soy nuevo';
    
    const correoGuardado = localStorage.getItem('correo') || '';

    const q = query(collection(this.dbService.firestore, 'Postulaciones'), where('correo', '==', correoGuardado));
    const snap = await getDocs(q);

    let tienePendientes = false;
    this.materiasAceptadas = [];
    this.materiasRechazadas = [];

    if (!snap.empty) {
      snap.forEach(doc => {
        const data = doc.data();
        if (data['estado_aprobacion'] === 'PENDIENTE') tienePendientes = true;
        if (data['estado_aprobacion'] === 'ACEPTADO') this.materiasAceptadas.push(data['materia_postulada']);
        if (data['estado_aprobacion'] === 'RECHAZADO') this.materiasRechazadas.push(data['materia_postulada']);
      });
    }

    if (tienePendientes) {
      this.estadoVista = 'REVISION';
      return;
    }

    if (this.materiasAceptadas.length > 0 || this.materiasRechazadas.length > 0) {
      this.estadoVista = 'RESULTADOS';
      return;
    }

    const cicloGuardado = localStorage.getItem('ciclo');
    const cicloLimpio = (cicloGuardado || '1').replace(/\D/g, '');
    this.cicloUsuario = parseInt(cicloLimpio, 10);
    if (isNaN(this.cicloUsuario) || !this.cicloUsuario) this.cicloUsuario = 1;

    this.carreraUsuario = (localStorage.getItem('carrera') || '').trim().toUpperCase();
    this.sedeUsuario = (localStorage.getItem('sede') || 'CUENCA').trim().toUpperCase();

    if (this.cicloUsuario < 2) {
      this.estadoVista = 'BLOQUEADO';
      return;
    }

    const catalogos = await this.dbService.obtenerCatalogosDesdeExcel();
    
    this.materiasDisponibles = catalogos.materias.filter(m => 
      m.carrera === this.carreraUsuario && m.ciclo < this.cicloUsuario
    );

    this.estadoVista = 'FORMULARIO';

    // 🌟 LÓGICA DE GUÍA: Solo aparece si logró acceder al formulario y es su primera vez
    setTimeout(() => {
      const guiaVista = localStorage.getItem('guia_postulacion_vista');
      if (!guiaVista) {
        this.mostrarGuiaPostulacion = true;
        localStorage.setItem('guia_postulacion_vista', 'true');
      }
    }, 400); // Pequeño retraso para que la animación de entrada se vea elegante
  }

  // 🌟 FUNCIONES PARA ABRIR Y CERRAR LA GUÍA
  abrirGuia() {
    this.mostrarGuiaPostulacion = true;
  }

  cerrarGuia() {
    this.mostrarGuiaPostulacion = false;
  }

  seleccionarBloque(dia: string, franja: string) {
    const clave = `${dia}-${franja}`;
    if (this.horarioSeleccionado[clave]) {
      delete this.horarioSeleccionado[clave]; 
    } else {
      if (dia === 'Sábado') this.horarioSeleccionado[clave] = 'VIRTUAL';
      else this.horarioSeleccionado[clave] = this.modalidadGlobal; 
    }
  }

  async enviarPostulaciones() {
    if (this.materiasSeleccionadas.length === 0 || Object.keys(this.horarioSeleccionado).length === 0) {
      alert("⚠️ Debes seleccionar al menos una materia y un bloque de horario.");
      return;
    }

    this.estadoVista = 'CARGANDO';

    try {
      const correo = localStorage.getItem('correo');
      const nombre = localStorage.getItem('nombre');
      const celular = localStorage.getItem('celular') || '';
      const cedula = localStorage.getItem('cedula') || '';

      const datosBasePostulacion = {
        correo: correo,
        nombre: nombre,
        sede: this.sedeUsuario,
        carrera: this.carreraUsuario,
        ciclo: this.cicloUsuario,
        cedula: cedula,
        celular: celular,
        permanencia: this.tiempoTutor, 
        disponibilidad_horaria: this.horarioSeleccionado, 
        estado_aprobacion: 'PENDIENTE',
        fecha_postulacion: new Date().toISOString()
      };

      for (const nombreMateria of this.materiasSeleccionadas) {
        const documentoPostulacion = { ...datosBasePostulacion, materia_postulada: nombreMateria };
        
        await this.dbService.enviarPostulacion(documentoPostulacion); 

        await this.dbService.crearNotificacion({
          titulo: '📝 Nueva Postulación de Tutor',
          mensaje: `${nombre} postuló para dictar ${nombreMateria}.`,
          tipo: 'POSTULACION',
          rol_destino: 'ADMIN', 
          sede_destino: this.sedeUsuario 
        });
      }

      alert("🎉 Postulaciones enviadas con éxito.");
      this.navCtrl.navigateBack('/tabs/perfil');

    } catch (error) {
      alert("Hubo un fallo al procesar la solicitud.");
      this.estadoVista = 'FORMULARIO';
    }
  }

  regresar() { this.navCtrl.navigateBack('/tabs/perfil'); }
}