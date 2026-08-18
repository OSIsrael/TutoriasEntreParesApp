import { Component, inject, ElementRef, ViewChild } from '@angular/core';
import { Firestore, collection, query, where, getDocs, addDoc, doc, deleteDoc } from '@angular/fire/firestore';
import { DatabaseService } from '../../services/database';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
  IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonDatetime, IonDatetimeButton, IonModal 
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, megaphoneOutline, checkmarkCircleOutline, closeCircleOutline, personOutline, timeOutline, bookOutline } from 'ionicons/icons';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-admin-postulaciones',
  templateUrl: './admin-postulaciones.page.html',
  styleUrls: ['./admin.postulaciones.page.scss'], // 🌟 CORREGIDO: Restaurado al nombre original con punto
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonButton,
    KeyValuePipe, IonButtons, IonIcon, IonItem, IonLabel, IonInput,
    IonTextarea, IonSelect, IonSelectOption,
    IonDatetime, IonDatetimeButton, IonModal 
  ],
})
export class AdminPostulacionesPage {
  private firestore = inject(Firestore);
  private dbService = inject(DatabaseService);
  private router = inject(Router);

  postulacionesAgrupadas: any[] = [];
  
  sedeAdmin: string = ''; 
  filtroSedePostulaciones: string = 'GLOBAL';
  filtroSedeGraficas: string = 'GLOBAL'; 

  @ViewChild('barCanvas', { static: false }) private barCanvas!: ElementRef;
  @ViewChild('pieCanvas', { static: false }) private pieCanvas!: ElementRef;
  graficoBarras: any;
  graficoPastel: any;

  nuevoAnuncio = {
    titulo: '',
    descripcion: '',
    fecha_evento: new Date().toISOString(),
    sede_destino: 'GLOBAL',
  };

  constructor() {
    addIcons({ arrowBackOutline, megaphoneOutline, checkmarkCircleOutline, closeCircleOutline, personOutline, timeOutline, bookOutline });
  }

  async ionViewWillEnter() {
    const rolActual = localStorage.getItem('rol') || '';
    this.sedeAdmin = (localStorage.getItem('sede') || 'CUENCA').toUpperCase();

    if (rolActual !== 'ADMIN' && rolActual !== 'COORDINADOR') {
      this.router.navigate(['/login']);
      return;
    }

    await this.cargarPostulaciones();
    this.limpiarAnunciosExpirados();

    setTimeout(() => { this.cargarEstadisticas(); }, 500);
  }

  // ==========================================
  // 🌟 CARGA Y AGRUPACIÓN DE POSTULACIONES
  // ==========================================
  async cargarPostulaciones() {
    try {
      let q;
      if (this.filtroSedePostulaciones === 'GLOBAL') {
        q = query(
          collection(this.firestore, 'Postulaciones'),
          where('estado_aprobacion', '==', 'PENDIENTE')
        );
      } else {
        q = query(
          collection(this.firestore, 'Postulaciones'),
          where('estado_aprobacion', '==', 'PENDIENTE'),
          where('sede', '==', this.filtroSedePostulaciones)
        );
      }
      
      const snapshot = await getDocs(q);
      
      // 🌟 CORREGIDO: Le decimos a TypeScript explícitamente que los datos son de tipo "any"
      const rawPostulaciones = snapshot.docs.map((doc) => {
        const data = doc.data() as any; 
        return { id: doc.id, ...data };
      });

      const diccionarioEstudiantes: { [correo: string]: any } = {};

      // 🌟 CORREGIDO: Declaramos a "post" como "any"
      rawPostulaciones.forEach((post: any) => {
        const correo = post['correo'];
        
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

  async aceptar(post: any) {
    try {
      await this.dbService.aceptarTutor(post.id, post);
      alert(`✅ Tutor aceptado en ${post.materia_postulada}`);
      await this.cargarPostulaciones(); 
      this.cargarEstadisticas();
    } catch (e) { 
      alert('Error al aceptar tutor'); 
    }
  }

  async rechazar(post: any) {
    const confirmar = confirm(`¿Estás seguro de RECHAZAR a ${post.nombre} para dictar ${post.materia_postulada}?`);
    if (!confirmar) return;

    try {
      await this.dbService.rechazarPostulacion(post.id);
      alert(`❌ Postulación para ${post.materia_postulada} rechazada.`);
      await this.cargarPostulaciones(); 
    } catch (error) {
      alert('Error al rechazar la postulación.');
    }
  }

  obtenerDia(clave: any): string { return String(clave).split('-')[0] || ''; }
  obtenerHora(clave: any): string { return String(clave).split('-')[1] || ''; }
  
  regresar() { 
    this.router.navigate(['/tabs/perfil']); 
  }

  async cargarEstadisticas() {
    try {
      const querySnapshot = await getDocs(collection(this.firestore, 'Tutores'));
      const conteoCarreras: { [key: string]: number } = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const sedeTutor = (data['sede'] || '').toUpperCase();

        if (this.filtroSedeGraficas === 'GLOBAL' || sedeTutor === this.filtroSedeGraficas) {
          if (data['estado'] === 'ACTIVO') {
            const carrera = data['carrera'] || 'NO ASIGNADA';
            conteoCarreras[carrera] = (conteoCarreras[carrera] || 0) + 1;
          }
        }
      });

      const nombresCarreras = Object.keys(conteoCarreras);
      const cantidadPorCarrera = Object.values(conteoCarreras);

      this.generarGraficoBarras(nombresCarreras, cantidadPorCarrera);
      this.generarGraficoPastel(nombresCarreras, cantidadPorCarrera);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  }

  generarGraficoBarras(labels: string[], data: number[]) {
    if (this.graficoBarras) this.graficoBarras.destroy();
    if (!this.barCanvas) return;
    this.graficoBarras = new Chart(this.barCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ label: 'Tutores Activos', data: data, backgroundColor: '#003366', borderRadius: 4 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
  }

  generarGraficoPastel(labels: string[], data: number[]) {
    if (this.graficoPastel) this.graficoPastel.destroy();
    if (!this.pieCanvas) return;
    this.graficoPastel = new Chart(this.pieCanvas.nativeElement, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{ data: data, backgroundColor: ['#003366', '#d97706', '#10b981', '#ef4444', '#8b5cf6'] }],
      },
      options: { responsive: true },
    });
  }

  async publicarAnuncio() {
    if (!this.nuevoAnuncio.titulo || !this.nuevoAnuncio.descripcion) {
      alert('Por favor, llena el título y la descripción del comunicado.');
      return;
    }

    const payload = {
      titulo: this.nuevoAnuncio.titulo.toUpperCase(),
      descripcion: this.nuevoAnuncio.descripcion,
      fecha_evento: this.nuevoAnuncio.fecha_evento || 'Sin fecha',
      fecha_publicacion: new Date().toISOString(),
      sede_destino: this.nuevoAnuncio.sede_destino.toUpperCase(),
      autor: localStorage.getItem('nombre') || 'COORDINACIÓN',
    };

    try {
      await addDoc(collection(this.firestore, 'Anuncios'), payload);
      
      await this.dbService.crearNotificacion({
        titulo: '📢 Nuevo Comunicado Oficial',
        mensaje: this.nuevoAnuncio.titulo.toUpperCase(),
        tipo: 'AVISO',
        rol_destino: 'TODOS',
        sede_destino: this.nuevoAnuncio.sede_destino.toUpperCase() 
      });

      alert('¡Comunicado oficial publicado con éxito!');
      
      this.nuevoAnuncio = { titulo: '', descripcion: '', fecha_evento: new Date().toISOString(), sede_destino: 'GLOBAL' };
    } catch (error) {
      console.error('Error al publicar:', error);
      alert('Error al publicar el comunicado.');
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
              console.log(`🗑️ Aviso expirado eliminado: ${data['titulo']}`);
            }
          }
        }
      });
    } catch (error) {
      console.error("Error al limpiar anuncios:", error);
    }
  }
}