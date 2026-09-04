import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonButton, IonIcon, IonSpinner, IonSelect, IonSelectOption, IonItem, IonLabel, NavController, IonButtons,ToastController,AlertController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, bookOutline, warningOutline, checkmarkCircleOutline, timeOutline, closeCircleOutline, calendarOutline, helpCircleOutline, informationCircleOutline, personCircleOutline, documentTextOutline, cloudUploadOutline } from 'ionicons/icons';
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
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

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

  mostrarGuiaPostulacion: boolean = false;

  // 🌟 VARIABLES PARA EL PDF DE RENDIMIENTO
  archivoPDF: File | null = null;
  nombreArchivoPDF: string = '';

  constructor() {
    addIcons({personCircleOutline,helpCircleOutline,arrowBackOutline,warningOutline,timeOutline,checkmarkCircleOutline,closeCircleOutline,bookOutline,calendarOutline,informationCircleOutline,documentTextOutline,cloudUploadOutline});
  }

  async ionViewWillEnter() {
    this.estadoVista = 'CARGANDO';
    this.horarioSeleccionado = {};
    this.materiasSeleccionadas = [];
    this.tiempoTutor = 'Soy nuevo';
    this.archivoPDF = null;
    this.nombreArchivoPDF = '';
    
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

    setTimeout(() => {
      const guiaVista = localStorage.getItem('guia_postulacion_vista');
      if (!guiaVista) {
        this.mostrarGuiaPostulacion = true;
        localStorage.setItem('guia_postulacion_vista', 'true');
      }
    }, 400); 
  }

  abrirGuia() { this.mostrarGuiaPostulacion = true; }
  cerrarGuia() { this.mostrarGuiaPostulacion = false; }

  seleccionarBloque(dia: string, franja: string) {
    const clave = `${dia}-${franja}`;
    if (this.horarioSeleccionado[clave]) {
      delete this.horarioSeleccionado[clave]; 
    } else {
      if (dia === 'Sábado') this.horarioSeleccionado[clave] = 'VIRTUAL';
      else this.horarioSeleccionado[clave] = this.modalidadGlobal; 
    }
  }

  // 🌟 FUNCIÓN PARA LEER EL ARCHIVO SELECCIONADO
  seleccionarArchivoPDF(event: any) {
    const archivo = event.target.files[0];
    if (archivo) {
      if (archivo.type !== 'application/pdf') {
        this.mostrarAviso("Solo se permiten archivos en formato PDF.", 'error');
        event.target.value = null;
        return;
      }
      if (archivo.size > 5 * 1024 * 1024) { // Limite de 5MB
        this.mostrarAviso("El archivo es muy pesado. El límite es 5MB.", 'advertencia');
        event.target.value = null;
        return;
      }
      this.archivoPDF = archivo;
      this.nombreArchivoPDF = archivo.name;
    }
  }

  async enviarPostulaciones() {
    if (this.materiasSeleccionadas.length === 0 || Object.keys(this.horarioSeleccionado).length === 0) {
      this.mostrarAviso("Debes seleccionar al menos una materia y un bloque de horario.", 'advertencia');
      return;
    }

    // 🌟 VALIDAMOS QUE EL PDF ESTÉ CARGADO
    if (!this.archivoPDF) {
      this.mostrarAviso("Es obligatorio subir tu récord académico en PDF.", 'error');
      return;
    }

    this.estadoVista = 'CARGANDO';

    try {
      const correo = localStorage.getItem('correo');
      const nombre = localStorage.getItem('nombre');
      const celular = localStorage.getItem('celular') || '';
      const cedula = localStorage.getItem('cedula') || '';

      // 1. Subir el PDF a Storage y obtener el link
      const urlRendimiento = await this.dbService.subirPDFRendimiento(this.archivoPDF, cedula);

      // 2. Construir el documento con el link incluido
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
        fecha_postulacion: new Date().toISOString(),
        url_documento_rendimiento: urlRendimiento // 🌟 Link asignado
      };

      for (const nombreMateria of this.materiasSeleccionadas) {
        const documentoPostulacion = { ...datosBasePostulacion, materia_postulada: nombreMateria };
        await this.dbService.enviarPostulacion(documentoPostulacion); 

        await this.dbService.crearNotificacion({
          titulo: 'Nueva Postulación de Tutor',
          mensaje: `${nombre} postuló para dictar ${nombreMateria}.`,
          tipo: 'POSTULACION',
          rol_destino: 'ADMIN', 
          sede_destino: this.sedeUsuario 
        });
      }

      this.mostrarAviso("Postulaciones enviadas con éxito.",'exito');
      this.navCtrl.navigateBack('/tabs/perfil');

    } catch (error) {
      console.error(error);
      this.mostrarAviso("Hubo un fallo al procesar la solicitud.",'error');
      this.estadoVista = 'FORMULARIO';
    }
  }

  regresar() { this.navCtrl.navigateBack('/tabs/perfil'); }

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