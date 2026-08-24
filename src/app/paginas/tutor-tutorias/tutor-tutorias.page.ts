import { Component, OnInit, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, 
  IonList, IonItemSliding, IonItem, IonItemOptions, IonItemOption,
  IonPopover, IonLabel // 🌟 NUEVOS IMPORTS PARA EL MENÚ
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  notificationsOutline, bookOutline, logoWhatsapp, 
  personOutline, timeOutline, calendarOutline, trashOutline,
  checkmarkCircleOutline, closeCircleOutline, closeOutline,helpCircleOutline, informationCircleOutline, documentTextOutline } from 'ionicons/icons';
import { Firestore, collection, query, where, getDocs, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { DatabaseService } from '../../services/database';

@Component({
  selector: 'app-tutor-tutorias',
  templateUrl: './tutor-tutorias.page.html',
  styleUrls: ['./tutor-tutorias.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, 
    IonButtons, IonButton, IonIcon, IonList, IonItemSliding, 
    IonItem, IonItemOptions, IonItemOption, IonPopover, IonLabel
  ]
})
export class TutorTutoriasPage implements OnInit {
  private dbService = inject(DatabaseService);
  private firestore = inject(Firestore);
  private router = inject(Router);

  tutoriasPorImpartir: any[] = [];
  cargando: boolean = true;
  correoUsuario: string = '';
  rolUsuario: string = '';
  hayNotificacionesSinLeer: boolean = false;
  mostrarGuiaTutor: boolean = false;

  // 🌟 VARIABLES PARA EL NUEVO MENÚ HERMOSO
  @ViewChild('popoverEstado') popoverEstado!: IonPopover;
  menuEstadoAbierto: boolean = false;
  tutoriaSeleccionada: any = null;

  constructor() {
    addIcons({helpCircleOutline,notificationsOutline,calendarOutline,bookOutline,personOutline,timeOutline,logoWhatsapp,trashOutline,informationCircleOutline,checkmarkCircleOutline,documentTextOutline,closeCircleOutline,closeOutline});
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
      localStorage.setItem('guia_tutor_vista', 'true'); // Marca que ya la vio
    }
  }

async verificarNotificaciones(correo: string, rol: string, sede: string) {
    try {
      // 🌟 LE PASAMOS 'TUTOR' COMO CUARTO PARÁMETRO
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
    // 🌟 ENVIAMOS EL PARÁMETRO EN LA URL
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
        
        let colorEstado = '#fde047'; // Amarillo (Pendiente)
        if (res['estado'] === 'CONFIRMADA' || res['estado'] === 'ACEPTADA') colorEstado = '#34d399'; // Verde
        if (res['estado'] === 'CANCELADA') colorEstado = '#ef4444'; // Rojo

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
      alert("El estudiante no registró su número celular.");
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

  // 🌟 ABRIR EL NUEVO MENÚ VISUAL
  abrirMenuEstado(evento: any, tutoria: any) {
    evento.stopPropagation(); // Evitamos que la tarjeta se deslice por error
    this.tutoriaSeleccionada = tutoria;
    this.popoverEstado.event = evento; // Le decimos al menú que se abra justo donde tocaste
    this.menuEstadoAbierto = true;
  }

  // 🌟 SELECCIONAR DESDE EL MENÚ
  seleccionarNuevoEstado(nuevoEstado: string, nuevoColor: string) {
    if (this.tutoriaSeleccionada) {
      this.actualizarEstadoFirebase(this.tutoriaSeleccionada, nuevoEstado, nuevoColor);
    }
    this.menuEstadoAbierto = false; // Cerramos el menú
  }

  // 🌟 VERSIÓN BLINDADA
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
    } catch (error) {
      alert("❌ Error al guardar el estado. Revisa tu conexión a internet.");
      return;
    }

    // 3. ENVIAR NOTIFICACIÓN AL ALUMNO (Totalmente aislado)
    try {
      if (this.dbService.crearNotificacion) {
        await this.dbService.crearNotificacion({
          titulo: `Tutoría ${nuevoEstado}`,
          mensaje: `El tutor ha marcado tu clase de ${tutoria.materia} como ${nuevoEstado}.`,
          tipo: 'TUTORIA',
          correo_destino: tutoria.correoEstudiante || 'sin_correo',
          rol_destino: 'ESTUDIANTE' // 🌟 SE VA AL PANEL DEL ESTUDIANTE
        });
      }
    } catch (notiError) {
      console.warn("Notificación fallida, pero estado guardado.");
    }
  }

  async eliminarTutoria(tutoria: any) {
    const confirmar = confirm(`¿Estás seguro de eliminar permanentemente el registro de ${tutoria.nombreEstudiante}?`);
    if (!confirmar) return;

    try {
      const tutoriaRef = doc(this.firestore, 'Reservas', tutoria.id);
      await deleteDoc(tutoriaRef);
      alert('Tutoría eliminada de tu panel.');
      await this.cargarTutoriasPorImpartir();
    } catch (error) {
      alert('Error al eliminar la tutoría.');
    }
  }
  abrirGuia() {
    this.mostrarGuiaTutor = true;
  }

  cerrarGuia() {
    this.mostrarGuiaTutor = false;
  }
}