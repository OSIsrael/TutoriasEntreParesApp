import { Component, inject, ElementRef, ViewChild } from '@angular/core';
import { Firestore, collection, query, where, getDocs, addDoc, doc, deleteDoc,updateDoc } from '@angular/fire/firestore';
import { DatabaseService } from '../../services/database';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
  IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonDatetime, IonDatetimeButton, IonModal,ToastController,AlertController,IonLabel,IonList,IonItem,IonSpinner 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, megaphoneOutline, checkmarkCircleOutline, closeCircleOutline, personOutline, timeOutline, bookOutline, personCircleOutline, documentTextOutline, filterOutline, locationOutline, callOutline, pieChartOutline, mailOutline, closeOutline, checkmarkOutline,chevronDownOutline,chevronUpOutline, warning, calendarOutline, logoWhatsapp, buildOutline, sadOutline } from 'ionicons/icons';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-admin-postulaciones',
  templateUrl: './admin-postulaciones.page.html',
  styleUrls: ['./admin.postulaciones.page.scss'], 
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonButton,
    KeyValuePipe, IonButtons, IonIcon, IonInput,
    IonTextarea, IonSelect, IonSelectOption,
    IonDatetime, IonDatetimeButton, IonModal,IonList,IonLabel,IonItem,IonSpinner
  ],
})
export class AdminPostulacionesPage {
  private firestore = inject(Firestore);
  private dbService = inject(DatabaseService);
  private router = inject(Router);

  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  postulacionesAgrupadas: any[] = [];
  
  sedeAdmin: string = ''; 
  filtroSedePostulaciones: string = 'GLOBAL';
  filtroSedeGraficas: string = 'GLOBAL'; 
  
  tutoriasEnAlerta: any[] = [];
  mostrarModalReasignacion: boolean = false;
  cargandoTutores: boolean = false;
  tutoriaAReasignar: any = null;
  tutoresSugeridos: any[] = [];

  @ViewChild('barCanvas', { static: false }) private barCanvas!: ElementRef;
  @ViewChild('pieCanvas', { static: false }) private pieCanvas!: ElementRef;
  graficoBarras: any;
  graficoPastel: any;
  rolUsuario: string = '';
  sedeUsuario: string = '';

  nuevoAnuncio = {
    titulo: '',
    descripcion: '',
    fecha_evento: new Date().toISOString(),
    sede_destino: 'GLOBAL',
  };

  constructor() {
    addIcons({arrowBackOutline,personCircleOutline,filterOutline,checkmarkCircleOutline,personOutline,locationOutline,callOutline,mailOutline,documentTextOutline,timeOutline,bookOutline,closeOutline,checkmarkOutline,warning,calendarOutline,logoWhatsapp,buildOutline,sadOutline,pieChartOutline,megaphoneOutline,closeCircleOutline,chevronDownOutline,chevronUpOutline});
  }

  async ionViewWillEnter() {
    this.rolUsuario = String(localStorage.getItem('rol') || 'ESTUDIANTE').toUpperCase(); 
    this.sedeUsuario = String(localStorage.getItem('sede') || 'CUENCA').toUpperCase();
    this.sedeAdmin = this.sedeUsuario;

    if (this.rolUsuario === 'COORDINADOR') {
      this.filtroSedePostulaciones = this.sedeUsuario;
      this.filtroSedeGraficas = this.sedeUsuario;
      this.nuevoAnuncio.sede_destino = this.sedeUsuario;
    }

    if (this.rolUsuario !== 'ADMIN' && this.rolUsuario !== 'COORDINADOR') {
      this.router.navigate(['/login']);
      return;
    }

    await this.cargarPostulaciones();
    this.limpiarAnunciosExpirados();
    this.cargarTutoriasEnAlerta();
  }

  // 🌟 CAMBIO CLAVE: Esperamos a que la pantalla sea 100% visible para dibujar las gráficas
  ionViewDidEnter() {
    this.cargarEstadisticas();
  }

  async cargarTutoriasEnAlerta() {
    try {
      const q = query(collection(this.firestore, 'Reservas'), where('estado', '==', 'REQUIERE_ADMIN'));
      const snapshot = await getDocs(q);
      
      this.tutoriasEnAlerta = [];
      const esSuperAdmin = this.rolUsuario === 'ADMIN';
      
      snapshot.forEach(documento => {
        const data = documento.data();
        const sedeReserva = String(data['sede'] || data['sedeEstudiante'] || '').toUpperCase();
        
        const cumpleSede = esSuperAdmin || sedeReserva === this.sedeUsuario;

        if (cumpleSede) {
          this.tutoriasEnAlerta.push({ id: documento.id, ...data });
        }
      });
    } catch (error) {
      console.error("Error al cargar alertas:", error);
    }
  }

  async asignarNuevoTutorManual(tutor: any) {
    if (!this.tutoriaAReasignar) return;

    try {
      await updateDoc(doc(this.firestore, 'Reservas', this.tutoriaAReasignar.id), {
        estado: 'PENDIENTE',
        nombreTutor: tutor.nombre.toUpperCase(),
        correoTutor: tutor.correo.toLowerCase(),
        celularTutor: tutor.celular || 'No registrado',
        notas_admin: 'Rescatado y reasignado por Coordinación.'
      });
      
      try {
        if (this.dbService.crearNotificacion) {
          await this.dbService.crearNotificacion({
            titulo: '🚨 Nueva Tutoría Asignada',
            mensaje: `Coordinación te ha asignado una tutoría urgente de ${this.tutoriaAReasignar.materia}. Revisa tu panel para confirmarla.`,
            tipo: 'TUTORIA',
            correo_destino: tutor.correo.toLowerCase(),
            sede_destino: tutor.sede || 'CUENCA',
            rol_destino: 'TUTOR' 
          });
        }
      } catch (notiError) {
        console.warn('La tutoría se reasignó, pero la notificación falló.', notiError);
      }

      this.mostrarAviso(`Tutoría reasignada exitosamente a ${tutor.nombre}.`, 'exito');
      this.mostrarModalReasignacion = false;
      this.cargarTutoriasEnAlerta(); 
      
    } catch (error) {
      this.mostrarAviso('Error al intentar reasignar la tutoría.', 'error');
    }
  }

  async eliminarTutoriaHuerfana() {
    const confirmar = await this.confirmarAccion('¿Dar de baja definitivamente?', 'El estudiante se quedará sin tutoría y esta alerta desaparecerá.');
    if (!confirmar || !this.tutoriaAReasignar) return;

    try {
      await deleteDoc(doc(this.firestore, 'Reservas', this.tutoriaAReasignar.id));
      this.mostrarAviso('Solicitud eliminada.', 'info');
      this.mostrarModalReasignacion = false;
      this.cargarTutoriasEnAlerta();
    } catch (error) {
      this.mostrarAviso('Error al eliminar.', 'error');
    }
  }

  contactarEstudianteAlerta(celular: string, nombre: string) {
    if (!celular) return;
    let celFormateado = celular.replace(/\D/g, ''); 
    if (celFormateado.startsWith('0')) celFormateado = '593' + celFormateado.substring(1);
    const mensaje = encodeURIComponent(`Hola ${nombre}, te escribimos de Coordinación de Tutorías. Hubo un inconveniente con el tutor asignado, pero ya te estamos buscando un reemplazo para tu clase.`);
    window.open(`https://wa.me/${celFormateado}?text=${mensaje}`, '_blank');
  }

  async resolverAlerta(tutoria: any) {
    const alert = await this.alertController.create({
      header: 'Gestión Manual de Tutoría',
      message: `El sistema no encontró reemplazo para ${tutoria.materia}. Ingresa los datos del tutor que conseguiste manualmente, o da de baja la solicitud si no hubo solución.`,
      cssClass: 'alerta-premium-gietaes',
      inputs: [
        { name: 'nombreNuevo', type: 'text', placeholder: 'Nombre del nuevo tutor' },
        { name: 'correoNuevo', type: 'email', placeholder: 'Correo del nuevo tutor' }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'btn-alerta-cancelar' },
        { 
          text: 'Dar de Baja (Eliminar)', 
          cssClass: 'btn-alerta-peligro',
          handler: async () => {
            await deleteDoc(doc(this.firestore, 'Reservas', tutoria.id));
            this.mostrarAviso('La solicitud huérfana ha sido eliminada.', 'info');
            this.cargarTutoriasEnAlerta();
          }
        },
        { 
          text: 'Reasignar Tutor', 
          cssClass: 'btn-alerta-confirmar',
          handler: async (data) => {
            if (!data.nombreNuevo || !data.correoNuevo) {
              this.mostrarAviso('Debes ingresar nombre y correo para reasignar.', 'advertencia');
              return false;
            }
            await updateDoc(doc(this.firestore, 'Reservas', tutoria.id), {
              estado: 'PENDIENTE',
              nombreTutor: data.nombreNuevo.toUpperCase(),
              correoTutor: data.correoNuevo.toLowerCase(),
              notas_admin: 'Reasignado manualmente por Coordinación.'
            });
            this.mostrarAviso('¡Tutoría rescatada y reasignada con éxito!', 'exito');
            this.cargarTutoriasEnAlerta();
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async cargarPostulaciones() {
    try {
      let q;
      const esSuperAdmin = this.rolUsuario === 'ADMIN';

      if (this.filtroSedePostulaciones === 'GLOBAL' && esSuperAdmin) {
        q = query(collection(this.firestore, 'Postulaciones'), where('estado_aprobacion', '==', 'PENDIENTE'));
      } else {
        q = query(
          collection(this.firestore, 'Postulaciones'),
          where('estado_aprobacion', '==', 'PENDIENTE'),
          where('sede', '==', this.filtroSedePostulaciones)
        );
      }
      
      const snapshot = await getDocs(q);
      const rawPostulaciones = snapshot.docs.map((doc) => {
        const data = doc.data() as any; 
        return { id: doc.id, ...data };
      });

      const diccionarioEstudiantes: { [correo: string]: any } = {};

      rawPostulaciones.forEach((post: any) => {
        const correo = post['correo'];
        const sedePost = String(post['sede'] || '').toUpperCase();
        
        if (!esSuperAdmin && sedePost !== this.sedeUsuario) return;

        if (!diccionarioEstudiantes[correo]) {
          diccionarioEstudiantes[correo] = {
            nombre: post['nombre'],
            correo: post['correo'],
            cedula: post['cedula'],
            sede: post['sede'],
            carrera: post['carrera'],
            ciclo: post['ciclo'],
            celular: post['celular'],
            permanencia: post['permanencia'],
            horarios: post['disponibilidad_horaria'], 
            url_documento: post['url_documento_rendimiento'] || null, 
            expandido: false,
            materias_postuladas: [] 
          };
        }
        diccionarioEstudiantes[correo].materias_postuladas.push(post);
      });

      this.postulacionesAgrupadas = Object.values(diccionarioEstudiantes);

    } catch (error) {
      console.error('Error cargando postulaciones:', error);
    }
  }

  async abrirModalReasignacion(tutoria: any) {
    this.tutoriaAReasignar = tutoria;
    this.mostrarModalReasignacion = true;
    this.cargandoTutores = true;
    this.tutoresSugeridos = [];

    try {
      const q = query(collection(this.firestore, 'Tutores'), where('estado', '==', 'ACTIVO'));
      const snap = await getDocs(q);

      const horario = tutoria.horas || tutoria.hora_elegida || '';
      const esPresencial = horario.includes('(P)') || horario.includes('(A)');

      let candidatos: any[] = [];

      snap.forEach(doc => {
        const tutor = doc.data();
        const dictaMateria = tutor['materias'] && tutor['materias'].includes(tutoria.materia);

        if (dictaMateria) {
          let cumpleSede = true;
          if (esPresencial) {
            const sedeTutor = String(tutor['sede'] || '').toUpperCase();
            const sedeTutoria = String(tutoria.sede || tutoria.sedeEstudiante || this.sedeAdmin).toUpperCase();
            cumpleSede = sedeTutor === sedeTutoria;
          }

          if (cumpleSede) {
            candidatos.push({
              id: doc.id,
              nombre: tutor['nombre'],
              correo: tutor['correo'] || tutor['correo_google'],
              celular: tutor['celular'],
              sede: tutor['sede']
            });
          }
        }
      });

      this.tutoresSugeridos = candidatos;
    } catch (error) {
      console.error('Error buscando tutores de reemplazo:', error);
    }
    this.cargandoTutores = false;
  }

  verDocumento(url: string) {
    if (!url) {
      this.mostrarAviso('El estudiante no adjuntó un documento válido.', 'advertencia');
      return;
    }
    window.open(url, '_blank');
  }

  async aceptar(post: any) {
    const confirmar = await this.confirmarAccion(`¿Estás seguro de APROBAR a ${post.nombre} para dictar ${post.materia_postulada}?`,'');
    if (!confirmar) return; 

    try {
      await this.dbService.aceptarTutor(post.id, post);
      
      try {
        await this.dbService.crearNotificacion({
          titulo: '¡Postulación Aprobada!',
          mensaje: `¡Felicidades! Tu solicitud para impartir "${post.materia_postulada}" ha sido aceptada. Ya puedes ver tu panel de tutor.`,
          tipo: 'POSTULACION',
          correo_destino: post.correo, 
          sede_destino: post.sede,
          rol_destino: 'TODOS' 
        });
      } catch (e) {
        console.warn('Postulación aceptada, pero falló la notificación', e);
      }

      this.mostrarAviso(`Tutor aceptado en ${post.materia_postulada}`,'info');
      await this.cargarPostulaciones(); 
      this.cargarEstadisticas();
    } catch (e) { 
      this.mostrarAviso('Error al aceptar tutor','error'); 
    }
  }

  async rechazar(post: any) {
    const confirmar = await this.confirmarAccion(`¿Estás seguro de RECHAZAR a ${post.nombre} para dictar ${post.materia_postulada}?`,'');
    if (!confirmar) return;

    try {
      await this.dbService.rechazarPostulacion(post.id);
      
      try {
        await this.dbService.crearNotificacion({
          titulo: 'Postulación Rechazada',
          mensaje: `Tu solicitud para ser tutor de "${post.materia_postulada}" no pudo ser aprobada en esta ocasión.`,
          tipo: 'POSTULACION',
          correo_destino: post.correo, 
          sede_destino: post.sede,
          rol_destino: 'ESTUDIANTE' 
        });
      } catch (e) {
        console.warn('Postulación rechazada, pero falló la notificación', e);
      }

      this.mostrarAviso(`Postulación para ${post.materia_postulada} rechazada.`,'info');
      await this.cargarPostulaciones(); 
    } catch (error) {
      this.mostrarAviso('Error al rechazar la postulación.','error');
    }
  }

  obtenerDia(clave: any): string { return String(clave).split('-')[0] || ''; }
  obtenerHora(clave: any): string { return String(clave).split('-')[1] || ''; }
  
  regresar() { 
    this.router.navigate(['/tabs/perfil']); 
  }

  // ==========================================
  // 🌟 ESTADÍSTICAS (ROBUSTAS)
  // ==========================================
  async cargarEstadisticas() {
    try {
      const querySnapshot = await getDocs(collection(this.firestore, 'Tutores'));
      const conteoCarreras: { [key: string]: number } = {};
      const esSuperAdmin = this.rolUsuario === 'ADMIN';

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const sedeTutor = String(data['sede'] || '').toUpperCase();
        const estadoTutor = String(data['estado'] || '').toUpperCase(); // 🌟 Ignora tildes o minúsculas

        const tienePermisoSede = esSuperAdmin || sedeTutor === this.sedeUsuario;

        if (tienePermisoSede && (this.filtroSedeGraficas === 'GLOBAL' || sedeTutor === this.filtroSedeGraficas)) {
          if (estadoTutor === 'ACTIVO') {
            const carrera = data['carrera'] || 'NO ASIGNADA';
            conteoCarreras[carrera] = (conteoCarreras[carrera] || 0) + 1;
          }
        }
      });

      const nombresCarreras = Object.keys(conteoCarreras);
      const cantidadPorCarrera = Object.values(conteoCarreras);

      // Usamos setTimeout minúsculo para darle a Angular tiempo de pintar los Canvas
      setTimeout(() => {
        this.generarGraficoBarras(nombresCarreras, cantidadPorCarrera);
        this.generarGraficoPastel(nombresCarreras, cantidadPorCarrera);
      }, 150);

    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  }

  generarGraficoBarras(labels: string[], data: number[]) {
    if (this.graficoBarras) this.graficoBarras.destroy();
    if (!this.barCanvas || !this.barCanvas.nativeElement) return; // 🌟 Evita que el código colapse si el canvas no se ha dibujado

    this.graficoBarras = new Chart(this.barCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ label: 'Tutores Activos', data: data, backgroundColor: '#003366', borderRadius: 4 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }, // maintainAspectRatio false evita que la gráfica se encoja o desaparezca
    });
  }

  generarGraficoPastel(labels: string[], data: number[]) {
    if (this.graficoPastel) this.graficoPastel.destroy();
    if (!this.pieCanvas || !this.pieCanvas.nativeElement) return; 

    this.graficoPastel = new Chart(this.pieCanvas.nativeElement, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{ data: data, backgroundColor: ['#003366', '#d97706', '#10b981', '#ef4444', '#8b5cf6'] }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  async publicarAnuncio() {
    if (!this.nuevoAnuncio.titulo || !this.nuevoAnuncio.descripcion) {
      this.mostrarAviso('Por favor, llena el título y la descripción del comunicado.','advertencia');
      return;
    }

    const destinoSeguro = this.rolUsuario === 'ADMIN' ? this.nuevoAnuncio.sede_destino.toUpperCase() : this.sedeUsuario;

    const payload = {
      titulo: this.nuevoAnuncio.titulo.toUpperCase(),
      descripcion: this.nuevoAnuncio.descripcion,
      fecha_evento: this.nuevoAnuncio.fecha_evento || 'Sin fecha',
      fecha_publicacion: new Date().toISOString(),
      sede_destino: destinoSeguro,
      autor: localStorage.getItem('nombre') || 'COORDINACIÓN',
      estado: 'ACTIVO', 
      tipo: 'AVISO'     
    };

    try {
      await addDoc(collection(this.firestore, 'Anuncios'), payload);
      
      await this.dbService.crearNotificacion({
        titulo: 'Nuevo Comunicado Oficial',
        mensaje: this.nuevoAnuncio.titulo.toUpperCase(),
        tipo: 'AVISO',
        rol_destino: 'TODOS',
        sede_destino: destinoSeguro 
      });

      this.mostrarAviso('¡Comunicado oficial publicado con éxito!','exito');
      
      this.nuevoAnuncio = { titulo: '', descripcion: '', fecha_evento: new Date().toISOString(), sede_destino: 'GLOBAL' };
    } catch (error) {
      console.error('Error al publicar:', error);
      this.mostrarAviso('Error al publicar el comunicado.','error');
    }
  }

  async limpiarAnunciosExpirados() {
    try {
      const q = query(collection(this.firestore, 'Anuncios'));
      const snapshot = await getDocs(q);

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      snapshot.forEach(async (documento) => {
        const data = documento.data();
        const fechaEvento = data['fecha_evento'];

        if (fechaEvento && fechaEvento !== 'Sin fecha' && fechaEvento !== '') {
          const soloFecha = fechaEvento.split('T')[0]; 
          const partes = soloFecha.split('-'); 

          if (partes.length === 3) {
            const anio = parseInt(partes[0], 10);
            const mes = parseInt(partes[1], 10) - 1; 
            const dia = parseInt(partes[2], 10);

            const fechaDelAviso = new Date(anio, mes, dia, 23, 59, 59, 999);

            if (fechaDelAviso.getTime() < hoy.getTime()) {
              await deleteDoc(doc(this.firestore, 'Anuncios', documento.id));
              console.log(`Aviso expirado eliminado: ${data['titulo']}`);
            }
          }
        }
      });
    } catch (error) {
      console.error("Error al limpiar anuncios:", error);
    }
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